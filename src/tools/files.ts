/**
 * Dosya yöneticisi, yükleme linkleri, çeviriler, dashboard istatistikleri
 * ve destek talepleri (tickets).
 *
 * Tüm sorgular $variable sözdizimi kullanır — string interpolasyon yok.
 */

import type { HasuraClient } from '../hasura-client.js'
import type { ToolDefinition } from '../types.js'
import { getDateRanges } from '../utils.js'

// ── Field fragments ──

const FILE_FIELDS = `id product_id name original_name file_path s3_key file_url file_type mime_type file_size folder_path category tags alt_text description is_public download_count created_by created_at updated_at`

const UPLOAD_LINK_FIELDS = `id product_id token label description target_folder max_files max_file_size_mb allowed_file_types expires_at is_active upload_count created_by created_at updated_at`

const TRANSLATION_FIELDS = `id product_id entity_type entity_id locale field_name field_value is_active created_at updated_at deleted_at`

const TICKET_FIELDS = `id ticket_number title category priority status source_platform created_at updated_at`

const TICKET_DETAIL_FIELDS = `id ticket_number organization_id product_id reporter_id reporter_name reporter_email title description category priority status source_platform created_at updated_at resolved_at closed_at
  product { id name product_type { code name } }
  ticket_messages(where: {is_internal: {_eq: false}}, order_by: {created_at: asc}) {
    id ticket_id sender_id sender_name sender_email content is_internal message_type created_at
    ticket_attachments { id file_name original_name file_path s3_key file_url file_type mime_type file_size uploaded_by uploaded_by_name created_at }
  }
  ticket_attachments(where: {message_id: {_is_null: true}}, order_by: {created_at: asc}) {
    id file_name original_name file_path s3_key file_url file_type mime_type file_size uploaded_by uploaded_by_name created_at
  }`

const TICKET_MSG_FIELDS = `id ticket_id sender_id sender_name sender_email content is_internal message_type created_at`

const TICKET_ATTACH_FIELDS = `id ticket_id message_id file_name original_name file_path s3_key file_url file_type mime_type file_size uploaded_by uploaded_by_name created_at`

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
          query: `query($product_id: uuid!, $current_month_start: timestamp!) {
            members_aggregate(where: {product_id: {_eq: $product_id}}) { aggregate { count } }
            news(where: {product_id: {_eq: $product_id}}, order_by: {created_at: desc}, limit: 5) { id title created_at }
            appointments_aggregate(where: {product_id: {_eq: $product_id}, start_time: {_gte: $current_month_start}}) { aggregate { count } }
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
          query: `query($product_id: uuid!, $current_month_start: timestamp!) {
            customers_aggregate(where: {product_id: {_eq: $product_id}}) { aggregate { count } }
            appointments_aggregate(where: {product_id: {_eq: $product_id}, start_time: {_gte: $current_month_start}}) { aggregate { count } }
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

    // ═══════════════════════════════════════════════
    //  TICKETS
    // ═══════════════════════════════════════════════

    {
      name: 'business_tickets_list',
      description: 'Destek taleplerini listele.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          where: { type: 'object', description: 'tickets_bool_exp filtresi (zorunlu)' },
          limit: { type: 'number', description: 'Maks sonuç' },
          offset: { type: 'number', description: 'Sayfalama offset' },
        },
        required: ['where'],
      },
      handler: async (args: Record<string, unknown>) => hasura.query({
        query: `query($where: tickets_bool_exp!, $limit: Int, $offset: Int) {
          tickets(where: $where, order_by: {updated_at: desc}, limit: $limit, offset: $offset) {
            ${TICKET_FIELDS}
            product { id name product_type { code name } }
            ticket_messages_aggregate(where: {is_internal: {_eq: false}}) { aggregate { count } }
          }
          tickets_aggregate(where: $where) { aggregate { count } }
        }`,
        variables: {
          where: args.where,
          limit: args.limit ?? null,
          offset: args.offset ?? null,
        },
      }),
    },

    {
      name: 'business_tickets_get',
      description: 'Tek destek talebi detayı — mesajlar ve ekler dahil.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'Ticket UUID (zorunlu)' },
        },
        required: ['id'],
      },
      handler: async (args: Record<string, unknown>) => hasura.query({
        query: `query($id: uuid!) {
          tickets_by_pk(id: $id) { ${TICKET_DETAIL_FIELDS} }
        }`,
        variables: { id: args.id },
      }),
    },

    {
      name: 'business_tickets_create',
      description: 'Yeni destek talebi oluştur.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          organization_id: { type: 'number', description: 'Organizasyon ID (zorunlu)' },
          product_id: { type: 'string', description: 'Ürün ID (zorunlu)' },
          title: { type: 'string', description: 'Başlık (zorunlu)' },
          description: { type: 'string' },
          category: { type: 'string', description: 'Kategori' },
          priority: { type: 'string', description: 'low, medium, high, urgent' },
          reporter_id: { type: 'string' }, reporter_name: { type: 'string' },
          reporter_email: { type: 'string' }, source_platform: { type: 'string' },
        },
        required: ['organization_id', 'product_id', 'title'],
      },
      handler: async (args: Record<string, unknown>) => hasura.query({
        query: `mutation($input: tickets_insert_input!) {
          insert_tickets_one(object: $input) { id ticket_number title status created_at }
        }`,
        variables: { input: args },
      }),
    },

    {
      name: 'business_tickets_create_message',
      description: 'Destek talebine mesaj ekle.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          ticket_id: { type: 'string', description: 'Ticket UUID (zorunlu)' },
          content: { type: 'string', description: 'Mesaj içeriği (zorunlu)' },
          sender_id: { type: 'string' }, sender_name: { type: 'string' },
          sender_email: { type: 'string' }, is_internal: { type: 'boolean' },
          message_type: { type: 'string' },
        },
        required: ['ticket_id', 'content'],
      },
      handler: async (args: Record<string, unknown>) => hasura.query({
        query: `mutation($input: ticket_messages_insert_input!) {
          insert_ticket_messages_one(object: $input) { ${TICKET_MSG_FIELDS} }
        }`,
        variables: { input: args },
      }),
    },

    {
      name: 'business_tickets_create_attachment',
      description: 'Destek talebine dosya ekle.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          ticket_id: { type: 'string', description: 'Ticket UUID (zorunlu)' },
          message_id: { type: 'string', description: 'Mesaj UUID (opsiyonel — mesaja bağlı değilse boş)' },
          file_name: { type: 'string', description: 'Dosya adı (zorunlu)' },
          original_name: { type: 'string' }, file_path: { type: 'string' },
          s3_key: { type: 'string' }, file_url: { type: 'string' },
          file_type: { type: 'string' }, mime_type: { type: 'string' },
          file_size: { type: 'number' }, uploaded_by: { type: 'string' },
          uploaded_by_name: { type: 'string' },
        },
        required: ['ticket_id', 'file_name'],
      },
      handler: async (args: Record<string, unknown>) => hasura.query({
        query: `mutation($input: ticket_attachments_insert_input!) {
          insert_ticket_attachments_one(object: $input) { ${TICKET_ATTACH_FIELDS} }
        }`,
        variables: { input: args },
      }),
    },
  ]
}
