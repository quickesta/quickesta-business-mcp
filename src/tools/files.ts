/**
 * Dosya yöneticisi, yükleme linkleri, çeviriler, dashboard istatistikleri
 * dosya yönetimi ve dashboard.
 *
 * Tüm sorgular $variable sözdizimi kullanır — string interpolasyon yok.
 */

import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { randomUUID } from 'crypto'
import type { HasuraClient } from '../hasura-client.js'
import type { ToolDefinition } from '../types.js'
import { getDateRanges } from '../utils.js'

// ── S3 (Hetzner Object Storage) client ──

const S3_ENDPOINT = process.env.HETZNER_ENDPOINT || ''
const S3_REGION = process.env.HETZNER_REGION || 'fsn1'
const S3_ACCESS_KEY = process.env.HETZNER_ACCESS_KEY || ''
const S3_SECRET_KEY = process.env.HETZNER_SECRET_KEY || ''
const S3_BUCKET = process.env.HETZNER_BUCKET_NAME || 'quickesta-object-storage-1'
const S3_PROJECT = process.env.PROJECT_NAME || 'quickesta-business'

const s3Configured = !!(S3_ENDPOINT && S3_ACCESS_KEY && S3_SECRET_KEY)

const s3Client = s3Configured
  ? new S3Client({
      endpoint: S3_ENDPOINT,
      region: S3_REGION,
      credentials: { accessKeyId: S3_ACCESS_KEY, secretAccessKey: S3_SECRET_KEY },
      forcePathStyle: true,
    })
  : null

function getFileType(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('audio/')) return 'audio'
  return 'document'
}

function getExtension(filename: string): string {
  const dot = filename.lastIndexOf('.')
  return dot >= 0 ? filename.slice(dot) : ''
}

// ── Field fragments ──

const FILE_FIELDS = `id product_id name original_name file_path s3_key file_url file_type mime_type file_size folder_path category tags alt_text description is_public download_count created_by created_at updated_at`

const UPLOAD_LINK_FIELDS = `id product_id token label description target_folder max_files max_file_size_mb allowed_file_types expires_at is_active upload_count created_by created_at updated_at`

const TRANSLATION_FIELDS = `id product_id entity_type entity_id locale field_name field_value is_active created_at updated_at deleted_at`

// Tickets removed — admin/cloud internal support panel, not business customer data


export function createFileAndMiscTools(hasura: HasuraClient): ToolDefinition[] {
  return [

    // ═══════════════════════════════════════════════
    //  DASHBOARD
    // ═══════════════════════════════════════════════

    {
      name: 'business_dashboard_stats',
      description: 'Dashboard genel istatistikleri — üye sayısı, haberler, bu ayki randevu sayısı.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          product_id: { type: 'string', description: 'Ürün ID (zorunlu)' },
        },
        required: ['product_id'],
      },
      handler: async (args: Record<string, unknown>) => {
        const { monthStart } = getDateRanges()
        return hasura.query({
          query: `query($product_id: uuid!, $current_month_start: date!) {
            members_aggregate(where: {product_id: {_eq: $product_id}}) { aggregate { count } }
            news(where: {product_id: {_eq: $product_id}}, order_by: {created_at: desc}, limit: 5) { id title created_at }
            appointments_aggregate(where: {product_id: {_eq: $product_id}, appointment_date: {_gte: $current_month_start}}) { aggregate { count } }
          }`,
          variables: { product_id: args.product_id, current_month_start: monthStart },
        })
      },
    },

    {
      name: 'business_dashboard_summary',
      description: 'Dashboard özet — müşteri sayısı, bu ayki randevular, hizmet sayısı.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          product_id: { type: 'string', description: 'Ürün ID (zorunlu)' },
        },
        required: ['product_id'],
      },
      handler: async (args: Record<string, unknown>) => {
        const { monthStart } = getDateRanges()
        return hasura.query({
          query: `query($product_id: uuid!, $current_month_start: date!) {
            customers_aggregate(where: {product_id: {_eq: $product_id}}) { aggregate { count } }
            appointments_aggregate(where: {product_id: {_eq: $product_id}, appointment_date: {_gte: $current_month_start}}) { aggregate { count } }
            services_aggregate(where: {product_id: {_eq: $product_id}}) { aggregate { count } }
          }`,
          variables: { product_id: args.product_id, current_month_start: monthStart },
        })
      },
    },

    {
      name: 'business_dashboard_onboarding',
      description: 'Onboarding durumu — site bilgisi, iletişim, hizmetler, üyeler, çalışma saatleri, blog, sayfalar, SSS vb. sayıları.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          product_id: { type: 'string', description: 'Ürün ID (zorunlu)' },
        },
        required: ['product_id'],
      },
      handler: async (args: Record<string, unknown>) => hasura.query({
        query: `query($product_id: uuid!) {
          site_info: site_infos(where: {product_id: {_eq: $product_id}}, limit: 1) { id }
          contact_info: contact_infos(where: {product_id: {_eq: $product_id}}, limit: 1) { id }
          services_aggregate(where: {product_id: {_eq: $product_id}}) { aggregate { count } }
          members_aggregate(where: {product_id: {_eq: $product_id}}) { aggregate { count } }
          working_hours_aggregate(where: {product_id: {_eq: $product_id}}) { aggregate { count } }
          blog_posts_aggregate(where: {product_id: {_eq: $product_id}}) { aggregate { count } }
          pages_aggregate(where: {product_id: {_eq: $product_id}}) { aggregate { count } }
          faq_items_aggregate(where: {product_id: {_eq: $product_id}}) { aggregate { count } }
        }`,
        variables: { product_id: args.product_id },
      }),
    },

    // ═══════════════════════════════════════════════
    //  FILE MANAGER
    // ═══════════════════════════════════════════════

    {
      name: 'business_files_list',
      description: 'Klasördeki dosyaları listele.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          product_id: { type: 'string', description: 'Ürün ID (zorunlu)' },
          folder_path: { type: 'string', description: 'Klasör yolu (varsayılan: /)' },
        },
        required: ['product_id'],
      },
      handler: async (args: Record<string, unknown>) => hasura.query({
        query: `query($product_id: uuid!, $folder_path: String) {
          file_manager(
            where: {product_id: {_eq: $product_id}, folder_path: {_eq: $folder_path}, is_folder: {_eq: false}}
            order_by: [{sort_order: asc}, {created_at: desc}]
          ) { ${FILE_FIELDS} }
        }`,
        variables: { product_id: args.product_id, folder_path: args.folder_path ?? '/' },
      }),
    },

    {
      name: 'business_files_folders',
      description: 'Klasörleri listele.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          product_id: { type: 'string', description: 'Ürün ID (zorunlu)' },
          parent_path: { type: 'string', description: 'Üst klasör yolu (varsayılan: /)' },
        },
        required: ['product_id'],
      },
      handler: async (args: Record<string, unknown>) => hasura.query({
        query: `query($product_id: uuid!, $parent_path: String) {
          file_manager(
            where: {product_id: {_eq: $product_id}, folder_path: {_eq: $parent_path}, is_folder: {_eq: true}}
            order_by: {name: asc}
          ) { id product_id name folder_path created_at }
        }`,
        variables: { product_id: args.product_id, parent_path: args.parent_path ?? '/' },
      }),
    },

    {
      name: 'business_files_get',
      description: 'Tek dosya detayı.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'Dosya UUID (zorunlu)' },
        },
        required: ['id'],
      },
      handler: async (args: Record<string, unknown>) => hasura.query({
        query: `query($id: uuid!) {
          file_manager_by_pk(id: $id) { ${FILE_FIELDS} }
        }`,
        variables: { id: args.id },
      }),
    },

    {
      name: 'business_files_create',
      description: 'Dosya kaydı oluştur (S3 yükleme sonrası).',
      inputSchema: {
        type: 'object' as const,
        properties: {
          input: { type: 'object', description: 'file_manager_insert_input (zorunlu)' },
        },
        required: ['input'],
      },
      handler: async (args: Record<string, unknown>) => hasura.query({
        query: `mutation($input: file_manager_insert_input!) {
          insert_file_manager_one(object: $input) {
            id product_id name original_name file_path s3_key file_url file_type mime_type file_size folder_path created_by created_at
          }
        }`,
        variables: { input: args.input },
      }),
    },

    {
      name: 'business_files_create_folder',
      description: 'Yeni klasör oluştur.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          product_id: { type: 'string', description: 'Ürün ID (zorunlu)' },
          name: { type: 'string', description: 'Klasör adı (zorunlu)' },
          folder_path: { type: 'string', description: 'Üst klasör yolu (zorunlu)' },
        },
        required: ['product_id', 'name', 'folder_path'],
      },
      handler: async (args: Record<string, unknown>) => hasura.query({
        query: `mutation($input: file_manager_insert_input!) {
          insert_file_manager_one(object: $input) { id product_id name folder_path is_folder created_at }
        }`,
        variables: { input: { product_id: args.product_id, name: args.name, folder_path: args.folder_path, is_folder: true } },
      }),
    },

    {
      name: 'business_files_update',
      description: 'Dosya meta bilgilerini güncelle.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'Dosya UUID (zorunlu)' },
          input: { type: 'object', description: 'file_manager_set_input (zorunlu)' },
        },
        required: ['id', 'input'],
      },
      handler: async (args: Record<string, unknown>) => hasura.query({
        query: `mutation($id: uuid!, $input: file_manager_set_input!) {
          update_file_manager_by_pk(pk_columns: {id: $id}, _set: $input) { id name alt_text description tags category updated_at }
        }`,
        variables: { id: args.id, input: args.input },
      }),
    },

    {
      name: 'business_files_delete',
      description: 'Dosya veya klasör sil.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'Dosya UUID (zorunlu)' },
          product_id: { type: 'string', description: 'Ürün ID (zorunlu)' },
        },
        required: ['id', 'product_id'],
      },
      handler: async (args: Record<string, unknown>) => hasura.query({
        query: `mutation($id: uuid!, $product_id: uuid!) {
          delete_file_manager(where: {id: {_eq: $id}, product_id: {_eq: $product_id}}) { affected_rows }
        }`,
        variables: { id: args.id, product_id: args.product_id },
      }),
    },

    // ═══════════════════════════════════════════════
    //  FILE UPLOAD & PRESIGNED URLS
    // ═══════════════════════════════════════════════

    {
      name: 'business_files_get_upload_url',
      description:
        'S3 (Hetzner Object Storage) icin presigned PUT URL uretir. ' +
        'Bu URL ile dosya yukleyebilirsiniz (HTTP PUT). ' +
        'Yukleme sonrasi business_files_create ile DB kaydini olusturun. ' +
        'Donus: { upload_url, s3_key, file_url, file_id, expires_in }.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          product_id: { type: 'string', description: 'Urun ID (zorunlu)' },
          filename: { type: 'string', description: 'Orijinal dosya adi (zorunlu, ornek: "logo.png")' },
          content_type: { type: 'string', description: 'MIME tipi (zorunlu, ornek: "image/png", "application/pdf")' },
          folder_path: { type: 'string', description: 'Hedef klasor yolu (opsiyonel, varsayilan: "/")' },
          expires_in: { type: 'integer', description: 'URL gecerlilik suresi saniye (opsiyonel, varsayilan: 3600)' },
        },
        required: ['product_id', 'filename', 'content_type'],
      },
      handler: async (args: Record<string, unknown>) => {
        if (!s3Client) throw new Error('S3 yapilandirmasi eksik. HETZNER_ENDPOINT, HETZNER_ACCESS_KEY, HETZNER_SECRET_KEY env degiskenlerini kontrol edin.')

        const productId = args.product_id as string
        const filename = args.filename as string
        const contentType = args.content_type as string
        const expiresIn = (args.expires_in as number) || 3600

        // Dashboard format: folderPath always starts/ends with "/" (e.g., "/", "/images/")
        let folderPath = (args.folder_path as string) || '/'
        if (!folderPath.startsWith('/')) folderPath = '/' + folderPath
        if (!folderPath.endsWith('/')) folderPath = folderPath + '/'

        const ext = getExtension(filename)
        const fileId = randomUUID()
        const uniqueName = `${fileId}${ext}`

        // Dashboard key format: quickesta-business/{productId}{folderPath}{uniqueName}
        // e.g., quickesta-business/uuid//logo.png (root) or quickesta-business/uuid/images/logo.png
        const s3Key = `${S3_PROJECT}/${productId}${folderPath}${uniqueName}`

        const command = new PutObjectCommand({
          Bucket: S3_BUCKET,
          Key: s3Key,
          ContentType: contentType,
          Metadata: {
            'original-name': filename,
            'product-id': productId,
          },
        })

        const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn })
        const endpointDomain = S3_ENDPOINT.replace('https://', '').replace('http://', '')
        const fileUrl = `https://${S3_BUCKET}.${endpointDomain}/${s3Key}`
        const fileType = getFileType(contentType)

        return {
          upload_url: uploadUrl,
          s3_key: s3Key,
          file_url: fileUrl,
          file_id: fileId,
          original_name: filename,
          unique_name: uniqueName,
          content_type: contentType,
          file_type: fileType,
          folder_path: folderPath,
          expires_in: expiresIn,
          db_record: {
            product_id: productId,
            name: uniqueName,
            original_name: filename,
            file_path: s3Key,
            s3_key: s3Key,
            file_url: fileUrl,
            file_type: fileType,
            mime_type: contentType,
            folder_path: folderPath,
            is_folder: false,
          },
          instructions: 'Adim 1: upload_url\'ye HTTP PUT ile dosyayi yukleyin (Content-Type: ' + contentType + '). ' +
            'Adim 2: business_files_create ile DB kaydini olusturun — db_record objesini input olarak gonderin, file_size ekleyin.',
        }
      },
    },

    {
      name: 'business_files_get_download_url',
      description:
        'Mevcut bir dosya icin presigned GET URL uretir (okuma/goruntuleme). ' +
        's3_key veya file_path gerekli. Donus: { download_url, expires_in }.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          s3_key: { type: 'string', description: 'Dosyanin S3 key\'i (zorunlu)' },
          expires_in: { type: 'integer', description: 'URL gecerlilik suresi saniye (opsiyonel, varsayilan: 3600)' },
        },
        required: ['s3_key'],
      },
      handler: async (args: Record<string, unknown>) => {
        if (!s3Client) throw new Error('S3 yapilandirmasi eksik. HETZNER_ENDPOINT, HETZNER_ACCESS_KEY, HETZNER_SECRET_KEY env degiskenlerini kontrol edin.')

        const s3Key = args.s3_key as string
        const expiresIn = (args.expires_in as number) || 3600

        const command = new GetObjectCommand({
          Bucket: S3_BUCKET,
          Key: s3Key,
        })

        const downloadUrl = await getSignedUrl(s3Client, command, { expiresIn })
        return { download_url: downloadUrl, s3_key: s3Key, expires_in: expiresIn }
      },
    },

    // ═══════════════════════════════════════════════
    //  FILE UPLOAD LINKS
    // ═══════════════════════════════════════════════

    {
      name: 'business_upload_links_list',
      description: 'Dosya yükleme linklerini listele.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          product_id: { type: 'string', description: 'Ürün ID (zorunlu)' },
        },
        required: ['product_id'],
      },
      handler: async (args: Record<string, unknown>) => hasura.query({
        query: `query($product_id: uuid!) {
          file_upload_links(where: {product_id: {_eq: $product_id}}, order_by: {created_at: desc}) { ${UPLOAD_LINK_FIELDS} }
        }`,
        variables: { product_id: args.product_id },
      }),
    },

    {
      name: 'business_upload_links_create',
      description: 'Paylaşılabilir dosya yükleme linki oluştur.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          product_id: { type: 'string', description: 'Ürün ID (zorunlu)' },
          label: { type: 'string' }, description: { type: 'string' },
          target_folder: { type: 'string' }, max_files: { type: 'number' },
          max_file_size_mb: { type: 'number' },
          allowed_file_types: { type: 'array', items: { type: 'string' } },
          expires_at: { type: 'string' }, created_by: { type: 'string' },
        },
        required: ['product_id'],
      },
      handler: async (args: Record<string, unknown>) => hasura.query({
        query: `mutation($input: file_upload_links_insert_input!) {
          insert_file_upload_links_one(object: $input) { ${UPLOAD_LINK_FIELDS} }
        }`,
        variables: { input: args },
      }),
    },

    {
      name: 'business_upload_links_update',
      description: 'Dosya yükleme linkini güncelle.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'Link UUID (zorunlu)' },
          label: { type: 'string' }, description: { type: 'string' },
          target_folder: { type: 'string' }, max_files: { type: 'number' },
          max_file_size_mb: { type: 'number' },
          allowed_file_types: { type: 'array', items: { type: 'string' } },
          expires_at: { type: 'string' }, is_active: { type: 'boolean' },
        },
        required: ['id'],
      },
      handler: async (args: Record<string, unknown>) => {
        const { id, ...input } = args
        return hasura.query({
          query: `mutation($id: uuid!, $input: file_upload_links_set_input!) {
            update_file_upload_links_by_pk(pk_columns: {id: $id}, _set: $input) { id is_active updated_at }
          }`,
          variables: { id, input },
        })
      },
    },

    {
      name: 'business_upload_links_delete',
      description: 'Dosya yükleme linkini sil.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'Link UUID (zorunlu)' },
        },
        required: ['id'],
      },
      handler: async (args: Record<string, unknown>) => hasura.query({
        query: `mutation($id: uuid!) {
          delete_file_upload_links_by_pk(id: $id) { id }
        }`,
        variables: { id: args.id },
      }),
    },

    // ═══════════════════════════════════════════════
    //  TRANSLATIONS
    // ═══════════════════════════════════════════════

    {
      name: 'business_translations_list',
      description: 'Belirli bir entity için çevirileri listele.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          product_id: { type: 'string', description: 'Ürün ID (zorunlu)' },
          entity_type: { type: 'string', description: 'Entity tipi — service, page, blog_post vb. (zorunlu)' },
          entity_id: { type: 'string', description: 'Entity UUID (zorunlu)' },
        },
        required: ['product_id', 'entity_type', 'entity_id'],
      },
      handler: async (args: Record<string, unknown>) => hasura.query({
        query: `query($product_id: uuid!, $entity_type: String!, $entity_id: uuid!) {
          translations(
            where: {product_id: {_eq: $product_id}, entity_type: {_eq: $entity_type}, entity_id: {_eq: $entity_id}, deleted_at: {_is_null: true}}
            order_by: [{locale: asc}, {field_name: asc}]
          ) { ${TRANSLATION_FIELDS} }
        }`,
        variables: { product_id: args.product_id, entity_type: args.entity_type, entity_id: args.entity_id },
      }),
    },

    {
      name: 'business_translations_by_type',
      description: 'Belirli bir entity tipi için tüm çevirileri listele.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          product_id: { type: 'string', description: 'Ürün ID (zorunlu)' },
          entity_type: { type: 'string', description: 'Entity tipi (zorunlu)' },
        },
        required: ['product_id', 'entity_type'],
      },
      handler: async (args: Record<string, unknown>) => hasura.query({
        query: `query($product_id: uuid!, $entity_type: String!) {
          translations(
            where: {product_id: {_eq: $product_id}, entity_type: {_eq: $entity_type}, deleted_at: {_is_null: true}}
            order_by: [{entity_id: asc}, {locale: asc}, {field_name: asc}]
          ) { ${TRANSLATION_FIELDS} }
        }`,
        variables: { product_id: args.product_id, entity_type: args.entity_type },
      }),
    },

    {
      name: 'business_translations_stats',
      description: 'Çeviri istatistikleri — entity tipi bazlı aggregate sayılar.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          product_id: { type: 'string', description: 'Ürün ID (zorunlu)' },
        },
        required: ['product_id'],
      },
      handler: async (args: Record<string, unknown>) => hasura.query({
        query: `query($product_id: uuid!) {
          translations_aggregate(where: {product_id: {_eq: $product_id}, deleted_at: {_is_null: true}}) {
            aggregate { count }
            nodes { entity_type locale }
          }
        }`,
        variables: { product_id: args.product_id },
      }),
    },

    {
      name: 'business_translations_create',
      description: 'Yeni çeviri oluştur.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          input: { type: 'object', description: 'translations_insert_input (zorunlu)' },
        },
        required: ['input'],
      },
      handler: async (args: Record<string, unknown>) => hasura.query({
        query: `mutation($input: translations_insert_input!) {
          insert_translations_one(object: $input) { ${TRANSLATION_FIELDS} }
        }`,
        variables: { input: args.input },
      }),
    },

    {
      name: 'business_translations_update',
      description: 'Çeviri güncelle.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'Çeviri UUID (zorunlu)' },
          input: { type: 'object', description: 'translations_set_input (zorunlu)' },
        },
        required: ['id', 'input'],
      },
      handler: async (args: Record<string, unknown>) => hasura.query({
        query: `mutation($id: uuid!, $input: translations_set_input!) {
          update_translations_by_pk(pk_columns: {id: $id}, _set: $input) { ${TRANSLATION_FIELDS} }
        }`,
        variables: { id: args.id, input: args.input },
      }),
    },

    {
      name: 'business_translations_delete',
      description: 'Çeviriyi soft-delete yap.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'Çeviri UUID (zorunlu)' },
        },
        required: ['id'],
      },
      handler: async (args: Record<string, unknown>) => hasura.query({
        query: `mutation($id: uuid!) {
          update_translations_by_pk(pk_columns: {id: $id}, _set: {deleted_at: "now()"}) { id deleted_at }
        }`,
        variables: { id: args.id },
      }),
    },

    {
      name: 'business_translations_bulk_create',
      description: 'Toplu çeviri oluştur.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          objects: {
            type: 'array',
            description: 'Çeviri listesi (translations_insert_input[])',
            items: { type: 'object' },
          },
        },
        required: ['objects'],
      },
      handler: async (args: Record<string, unknown>) => hasura.query({
        query: `mutation($objects: [translations_insert_input!]!) {
          insert_translations(objects: $objects) {
            returning { ${TRANSLATION_FIELDS} }
          }
        }`,
        variables: { objects: args.objects },
      }),
    },

    {
      name: 'business_translations_search',
      description: 'Çevirilerde arama yap (field_value içinde).',
      inputSchema: {
        type: 'object' as const,
        properties: {
          product_id: { type: 'string', description: 'Ürün ID (zorunlu)' },
          search_term: { type: 'string', description: 'Aranacak metin (zorunlu)' },
          locale: { type: 'string', description: 'Dil filtresi (opsiyonel)' },
          entity_type: { type: 'string', description: 'Entity tipi filtresi (opsiyonel)' },
        },
        required: ['product_id', 'search_term'],
      },
      handler: async (args: Record<string, unknown>) => hasura.query({
        query: `query($product_id: uuid!, $search_term: String!, $locale: String, $entity_type: String) {
          translations(
            where: {
              product_id: {_eq: $product_id}
              field_value: {_ilike: $search_term}
              locale: {_eq: $locale}
              entity_type: {_eq: $entity_type}
              deleted_at: {_is_null: true}
            }
            order_by: [{entity_type: asc}, {entity_id: asc}]
          ) { ${TRANSLATION_FIELDS} }
        }`,
        variables: {
          product_id: args.product_id,
          search_term: `%${args.search_term}%`,
          locale: args.locale ?? null,
          entity_type: args.entity_type ?? null,
        },
      }),
    },

  ]
}
