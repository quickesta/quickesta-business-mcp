/**
 * Studio araclari — Storefront theme editor workflow'lari.
 *
 * business-mcp icindeki diger tool'lar temel CRUD saglar;
 * bu dosyadakiler Studio'ya ozel is akislarini kapsar:
 *   - Theme draft/publish lifecycle
 *   - Atomik homepage atama
 *   - Block preview sorgulari
 *   - Onboarding durum kontrolu
 */

import type { HasuraClient } from '../hasura-client.js'
import type { ToolDefinition } from '../types.js'

const THEME_FIELDS = `id product_id name status version schema_version config parent_id published_at created_at updated_at`

export function createStudioTools(hasura: HasuraClient): ToolDefinition[] {
  return [
    // ═══ THEME WORKFLOW ═══

    {
      name: 'studio_themes_get_active',
      description:
        'Studio: Urunun aktif draft ve published temasini getirir (sadece son birer tane).',
      inputSchema: {
        type: 'object' as const,
        properties: {
          product_id: { type: 'string', description: 'Urun ID (zorunlu)' },
        },
        required: ['product_id'],
      },
      handler: async (args: Record<string, unknown>) =>
        hasura.query({
          query: `query($product_id: uuid!) {
            drafts: themes(
              where: { product_id: { _eq: $product_id }, status: { _eq: "draft" } }
              order_by: { updated_at: desc }
              limit: 1
            ) { ${THEME_FIELDS} }
            published: themes(
              where: { product_id: { _eq: $product_id }, status: { _eq: "published" } }
              limit: 1
            ) { ${THEME_FIELDS} }
          }`,
          variables: { product_id: args.product_id },
        }),
    },

    {
      name: 'studio_themes_create_draft',
      description:
        'Studio: Yeni draft tema olusturur (status otomatik "draft").',
      inputSchema: {
        type: 'object' as const,
        properties: {
          product_id: { type: 'string', description: 'Urun ID (zorunlu)' },
          config: { type: 'object', description: 'Tema konfigurasyonu JSONB (zorunlu)' },
          schema_version: { type: 'string', description: 'Tema sema versiyonu (zorunlu)' },
          parent_id: { type: 'string', description: 'Kaynak tema UUID (opsiyonel)' },
          name: { type: 'string', description: 'Tema adi (opsiyonel)' },
        },
        required: ['product_id', 'config', 'schema_version'],
      },
      handler: async (args: Record<string, unknown>) =>
        hasura.query({
          query: `mutation($product_id: uuid!, $config: jsonb!, $schema_version: String!, $parent_id: uuid, $name: String) {
            insert_themes_one(object: {
              product_id: $product_id
              status: "draft"
              config: $config
              schema_version: $schema_version
              parent_id: $parent_id
              name: $name
            }) { ${THEME_FIELDS} }
          }`,
          variables: {
            product_id: args.product_id,
            config: args.config,
            schema_version: args.schema_version,
            parent_id: args.parent_id ?? null,
            name: args.name ?? null,
          },
        }),
    },

    {
      name: 'studio_themes_update_draft',
      description:
        'Studio: Draft temanin config JSONB\'sini gunceller.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'Draft tema UUID (zorunlu)' },
          config: { type: 'object', description: 'Yeni tema konfigurasyonu JSONB (zorunlu)' },
        },
        required: ['id', 'config'],
      },
      handler: async (args: Record<string, unknown>) =>
        hasura.query({
          query: `mutation($id: uuid!, $config: jsonb!) {
            update_themes_by_pk(pk_columns: { id: $id }, _set: { config: $config }) {
              id status config updated_at
            }
          }`,
          variables: { id: args.id, config: args.config },
        }),
    },

    {
      name: 'studio_themes_publish',
      description:
        'Studio: Atomik tema yayinlama — mevcut published temayi arsivler, draft\'i published yapar ve versiyonu arttirir.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          product_id: { type: 'string', description: 'Urun ID (zorunlu)' },
          draft_id: { type: 'string', description: 'Yayinlanacak draft tema UUID (zorunlu)' },
          next_version: { type: 'integer', description: 'Yeni versiyon numarasi (zorunlu)' },
        },
        required: ['product_id', 'draft_id', 'next_version'],
      },
      handler: async (args: Record<string, unknown>) =>
        hasura.query({
          query: `mutation($draft_id: uuid!, $product_id: uuid!, $next_version: Int!) {
            archive_previous: update_themes(
              where: { product_id: { _eq: $product_id }, status: { _eq: "published" } }
              _set: { status: "archived" }
            ) { affected_rows }
            promote_draft: update_themes_by_pk(
              pk_columns: { id: $draft_id }
              _set: { status: "published", version: $next_version, published_at: "now()" }
            ) { id status version published_at }
          }`,
          variables: {
            draft_id: args.draft_id,
            product_id: args.product_id,
            next_version: args.next_version,
          },
        }),
    },

    // ═══ PAGE WORKFLOW ═══

    {
      name: 'studio_pages_set_homepage',
      description:
        'Studio: Atomik homepage atama — tum sayfalardaki is_homepage\'i temizler, belirtilen sayfayi homepage yapar.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          product_id: { type: 'string', description: 'Urun ID (zorunlu)' },
          page_id: { type: 'string', description: 'Homepage yapilacak sayfa UUID (zorunlu)' },
        },
        required: ['product_id', 'page_id'],
      },
      handler: async (args: Record<string, unknown>) =>
        hasura.query({
          query: `mutation($product_id: uuid!, $page_id: uuid!) {
            clear: update_pages(
              where: { product_id: { _eq: $product_id }, is_homepage: { _eq: true } }
              _set: { is_homepage: false }
            ) { affected_rows }
            set: update_pages_by_pk(
              pk_columns: { id: $page_id }
              _set: { is_homepage: true }
            ) { id title is_homepage }
          }`,
          variables: { product_id: args.product_id, page_id: args.page_id },
        }),
    },

    // ═══ BLOCK PREVIEW ═══

    {
      name: 'studio_preview_services',
      description:
        'Studio: Blok onizleme icin limitli servis listesi.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          product_id: { type: 'string', description: 'Urun ID (zorunlu)' },
          limit: { type: 'integer', description: 'Maksimum kayit (varsayilan: 6)' },
        },
        required: ['product_id'],
      },
      handler: async (args: Record<string, unknown>) =>
        hasura.query({
          query: `query($product_id: uuid!, $limit: Int!) {
            services(
              where: { product_id: { _eq: $product_id } }
              order_by: { name: asc }
              limit: $limit
            ) { id name description price duration }
          }`,
          variables: { product_id: args.product_id, limit: args.limit ?? 6 },
        }),
    },

    {
      name: 'studio_preview_news',
      description:
        'Studio: Blok onizleme icin limitli yayinlanmis haber listesi.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          product_id: { type: 'string', description: 'Urun ID (zorunlu)' },
          limit: { type: 'integer', description: 'Maksimum kayit (varsayilan: 6)' },
        },
        required: ['product_id'],
      },
      handler: async (args: Record<string, unknown>) =>
        hasura.query({
          query: `query($product_id: uuid!, $limit: Int!) {
            news(
              where: { product_id: { _eq: $product_id }, status: { _eq: "published" } }
              order_by: { published_at: desc_nulls_last }
              limit: $limit
            ) { id title description slug published_at }
          }`,
          variables: { product_id: args.product_id, limit: args.limit ?? 6 },
        }),
    },

    {
      name: 'studio_preview_blog',
      description:
        'Studio: Blok onizleme icin limitli yayinlanmis blog yazisi listesi.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          product_id: { type: 'string', description: 'Urun ID (zorunlu)' },
          limit: { type: 'integer', description: 'Maksimum kayit (varsayilan: 6)' },
        },
        required: ['product_id'],
      },
      handler: async (args: Record<string, unknown>) =>
        hasura.query({
          query: `query($product_id: uuid!, $limit: Int!) {
            blog_posts(
              where: { product_id: { _eq: $product_id }, status: { _eq: "published" } }
              order_by: { published_at: desc_nulls_last }
              limit: $limit
            ) { id title excerpt slug published_at }
          }`,
          variables: { product_id: args.product_id, limit: args.limit ?? 6 },
        }),
    },

    {
      name: 'studio_preview_faq',
      description:
        'Studio: Blok onizleme icin FAQ maddeleri (maks 8).',
      inputSchema: {
        type: 'object' as const,
        properties: {
          product_id: { type: 'string', description: 'Urun ID (zorunlu)' },
        },
        required: ['product_id'],
      },
      handler: async (args: Record<string, unknown>) =>
        hasura.query({
          query: `query($product_id: uuid!) {
            faq_items(
              where: { product_id: { _eq: $product_id } }
              order_by: { created_at: asc }
              limit: 8
            ) { id question answer }
          }`,
          variables: { product_id: args.product_id },
        }),
    },

    {
      name: 'studio_preview_team',
      description:
        'Studio: Blok onizleme icin aktif ekip uyeleri listesi.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          product_id: { type: 'string', description: 'Urun ID (zorunlu)' },
          limit: { type: 'integer', description: 'Maksimum kayit (varsayilan: 6)' },
        },
        required: ['product_id'],
      },
      handler: async (args: Record<string, unknown>) =>
        hasura.query({
          query: `query($product_id: uuid!, $limit: Int!) {
            members(
              where: { product_id: { _eq: $product_id }, is_active: { _eq: true } }
              order_by: { name: asc }
              limit: $limit
            ) { id name position }
          }`,
          variables: { product_id: args.product_id, limit: args.limit ?? 6 },
        }),
    },

    {
      name: 'studio_preview_products',
      description:
        'Studio: Blok onizleme icin aktif urun katalogu listesi.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          product_id: { type: 'string', description: 'Urun ID (zorunlu)' },
          limit: { type: 'integer', description: 'Maksimum kayit (varsayilan: 6)' },
        },
        required: ['product_id'],
      },
      handler: async (args: Record<string, unknown>) =>
        hasura.query({
          query: `query($product_id: uuid!, $limit: Int!) {
            products_catalog(
              where: { product_id: { _eq: $product_id }, status: { _eq: "active" } }
              order_by: { created_at: desc }
              limit: $limit
            ) { id name price description }
          }`,
          variables: { product_id: args.product_id, limit: args.limit ?? 6 },
        }),
    },

    // ═══ ONBOARDING ═══

    {
      name: 'studio_onboarding_status',
      description:
        'Studio: Baslangic rehberi — tum iceriklerin doldurulma durumunu dondurur (aggregate count\'lar).',
      inputSchema: {
        type: 'object' as const,
        properties: {
          product_id: { type: 'string', description: 'Urun ID (zorunlu)' },
        },
        required: ['product_id'],
      },
      handler: async (args: Record<string, unknown>) =>
        hasura.query({
          query: `query($product_id: uuid!) {
            site_info_aggregate(where: { product_id: { _eq: $product_id } }) {
              aggregate { count }
              nodes { company_name logo_light logo_dark favicon }
            }
            working_hours_aggregate(where: { product_id: { _eq: $product_id } }) {
              aggregate { count }
            }
            contact_info_aggregate(where: { product_id: { _eq: $product_id } }) {
              aggregate { count }
              nodes { email phone address }
            }
            policies_aggregate(where: { product_id: { _eq: $product_id }, is_active: { _eq: true } }) {
              aggregate { count }
            }
            pages_aggregate(where: { product_id: { _eq: $product_id } }) {
              aggregate { count }
            }
            services_aggregate(where: { product_id: { _eq: $product_id } }) {
              aggregate { count }
            }
            blog_posts_aggregate(where: { product_id: { _eq: $product_id } }) {
              aggregate { count }
            }
            news_aggregate(where: { product_id: { _eq: $product_id } }) {
              aggregate { count }
            }
            faq_items_aggregate(where: { product_id: { _eq: $product_id } }) {
              aggregate { count }
            }
            members_aggregate(where: { product_id: { _eq: $product_id } }) {
              aggregate { count }
            }
          }`,
          variables: { product_id: args.product_id },
        }),
    },
  ]
}
