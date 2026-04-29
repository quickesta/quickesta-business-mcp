/**
 * Calisma saatleri, iletisim bilgileri, site bilgileri, politikalar ve iletisim formu MCP araclari.
 * Tum sorgular GraphQL $variable sozdizimi kullanir — string interpolation yok.
 */

import type { HasuraClient } from '../hasura-client.js'
import type { ToolDefinition } from '../types.js'

export function createSettingsTools(hasura: HasuraClient): ToolDefinition[] {
  return [
    // ══════════════════════════════════════════
    //  CALISMA SAATLERI (Working Hours)
    // ══════════════════════════════════════════

    // ── Calisma Saatlerini Listele ──
    {
      name: 'business_working_hours_list',
      description: 'Belirli bir urune ait tum calisma saatlerini listeler.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          product_id: { type: 'string', description: 'Urun UUID (zorunlu)' },
        },
        required: ['product_id'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `query($product_id: uuid!) {
            working_hours(where: {product_id: {_eq: $product_id}}, order_by: {day_of_week: asc}) {
              id product_id day_of_week start_time end_time is_working_day member_id
            }
          }`,
          variables: { product_id: args.product_id },
        })
      },
    },

    // ── Calisma Saati Upsert ──
    {
      name: 'business_working_hours_upsert',
      description: 'Calisma saati olusturur veya gunceller (upsert). Ayni product_id + day_of_week + member_id varsa gunceller.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          input: {
            type: 'object',
            description: 'working_hours_insert_input nesnesi (product_id, day_of_week, start_time, end_time, is_working_day, member_id)',
          },
        },
        required: ['input'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($input: working_hours_insert_input!) {
            insert_working_hours_one(
              object: $input,
              on_conflict: {
                constraint: working_hours_product_id_day_of_week_member_id_key,
                update_columns: [start_time, end_time, is_working_day]
              }
            ) {
              id product_id day_of_week start_time end_time is_working_day member_id
            }
          }`,
          variables: { input: args.input },
        })
      },
    },

    // ── Calisma Saati Sil ──
    {
      name: 'business_working_hours_delete',
      description: 'Bir calisma saati kaydini kalici olarak siler.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'Calisma saati UUID (zorunlu)' },
        },
        required: ['id'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($id: uuid!) {
            delete_working_hours_by_pk(id: $id) {
              id
            }
          }`,
          variables: { id: args.id },
        })
      },
    },

    // ══════════════════════════════════════════
    //  ILETISIM BILGILERI (Contact Info)
    // ══════════════════════════════════════════

    // ── Iletisim Bilgilerini Getir ──
    {
      name: 'business_contact_info_get',
      description: 'Belirli bir urune ait iletisim bilgilerini getirir.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          product_id: { type: 'string', description: 'Urun UUID (zorunlu)' },
        },
        required: ['product_id'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `query($product_id: uuid!) {
            contact_info(where: {product_id: {_eq: $product_id}}, limit: 1) {
              id product_id email phone address linkedin_url youtube_url twitter_url instagram_url facebook_url tiktok_url
            }
          }`,
          variables: { product_id: args.product_id },
        })
      },
    },

    // ── Iletisim Bilgileri Upsert ──
    {
      name: 'business_contact_info_upsert',
      description: 'Iletisim bilgilerini olusturur veya gunceller (upsert). Ayni product_id varsa gunceller.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          input: {
            type: 'object',
            description: 'contact_info_insert_input nesnesi (product_id, email, phone, address, linkedin_url, youtube_url, twitter_url, instagram_url, facebook_url, tiktok_url)',
          },
        },
        required: ['input'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($input: contact_info_insert_input!) {
            insert_contact_info_one(
              object: $input,
              on_conflict: {
                constraint: contact_info_product_id_key,
                update_columns: [email, phone, address, linkedin_url, youtube_url, twitter_url, instagram_url, facebook_url, tiktok_url]
              }
            ) {
              id product_id email phone address linkedin_url youtube_url twitter_url instagram_url facebook_url tiktok_url
            }
          }`,
          variables: { input: args.input },
        })
      },
    },

    // ══════════════════════════════════════════
    //  SITE BILGILERI (Site Info)
    // ══════════════════════════════════════════

    // ── Site Bilgilerini Getir ──
    {
      name: 'business_site_info_get',
      description: 'Belirli bir urune ait site bilgilerini getirir.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          product_id: { type: 'string', description: 'Urun UUID (zorunlu)' },
        },
        required: ['product_id'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `query($product_id: uuid!) {
            site_info(where: {product_id: {_eq: $product_id}}, limit: 1) {
              id product_id company_name company_description slogan founded_year footer_text footer_copyright website_url meta_description meta_keywords auth_mode logo_light logo_dark favicon
            }
          }`,
          variables: { product_id: args.product_id },
        })
      },
    },

    // ── Site Bilgileri Upsert ──
    {
      name: 'business_site_info_upsert',
      description: 'Site bilgilerini olusturur veya gunceller (upsert). Ayni product_id varsa gunceller.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          input: {
            type: 'object',
            description: 'site_info_insert_input nesnesi (product_id, company_name, company_description, slogan, founded_year, footer_text, footer_copyright, website_url, meta_description, meta_keywords, auth_mode, logo_light, logo_dark, favicon)',
          },
        },
        required: ['input'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($input: site_info_insert_input!) {
            insert_site_info_one(
              object: $input,
              on_conflict: {
                constraint: site_info_product_id_key,
                update_columns: [company_name, company_description, slogan, founded_year, footer_text, footer_copyright, website_url, meta_description, meta_keywords, auth_mode, logo_light, logo_dark, favicon]
              }
            ) {
              id product_id company_name company_description slogan founded_year footer_text footer_copyright website_url meta_description meta_keywords auth_mode logo_light logo_dark favicon
            }
          }`,
          variables: { input: args.input },
        })
      },
    },

    // ══════════════════════════════════════════
    //  POLITIKALAR (Policies)
    // ══════════════════════════════════════════

    // ── Politikalari Listele ──
    {
      name: 'business_policies_list',
      description: 'Belirli bir urune ait tum politikalari listeler.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          product_id: { type: 'string', description: 'Urun UUID (zorunlu)' },
        },
        required: ['product_id'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `query($product_id: uuid!) {
            policies(where: {product_id: {_eq: $product_id}}) {
              id product_id policy_type title content is_active
            }
          }`,
          variables: { product_id: args.product_id },
        })
      },
    },

    // ── Politikayi Turune Gore Getir ──
    {
      name: 'business_policies_get_by_type',
      description: 'Belirli bir politika turune gore politikayi getirir (ornegin: privacy, terms, cookie, refund).',
      inputSchema: {
        type: 'object' as const,
        properties: {
          product_id: { type: 'string', description: 'Urun UUID (zorunlu)' },
          policy_type: { type: 'string', description: 'Politika turu (zorunlu, ornegin: privacy, terms, cookie, refund)' },
        },
        required: ['product_id', 'policy_type'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `query($product_id: uuid!, $policy_type: String!) {
            policies(where: {product_id: {_eq: $product_id}, policy_type: {_eq: $policy_type}}, limit: 1) {
              id product_id policy_type title content is_active
            }
          }`,
          variables: { product_id: args.product_id, policy_type: args.policy_type },
        })
      },
    },

    // ── Politika Upsert ──
    {
      name: 'business_policies_upsert',
      description: 'Politika olusturur veya gunceller (upsert). Ayni product_id + policy_type varsa gunceller.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          input: {
            type: 'object',
            description: 'policies_insert_input nesnesi (product_id, policy_type, title, content, is_active)',
          },
        },
        required: ['input'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($input: policies_insert_input!) {
            insert_policies_one(
              object: $input,
              on_conflict: {
                constraint: policies_product_id_policy_type_key,
                update_columns: [title, content, is_active]
              }
            ) {
              id product_id policy_type title content is_active
            }
          }`,
          variables: { input: args.input },
        })
      },
    },

    // ── Politika Sil ──
    {
      name: 'business_policies_delete',
      description: 'Bir politikayi kalici olarak siler.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'Politika UUID (zorunlu)' },
        },
        required: ['id'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($id: uuid!) {
            delete_policies_by_pk(id: $id) {
              id
            }
          }`,
          variables: { id: args.id },
        })
      },
    },

    // ══════════════════════════════════════════
    //  ILETISIM FORMU GONDERIMLERI (Contact Submissions)
    // ══════════════════════════════════════════

    // ── Iletisim Formu Gonderimlerini Listele ──
    {
      name: 'business_contact_submissions_list',
      description: 'Belirli bir urune ait tum iletisim formu gonderimlerini listeler.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          product_id: { type: 'string', description: 'Urun UUID (zorunlu)' },
        },
        required: ['product_id'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `query($product_id: uuid!) {
            contact_submissions(where: {product_id: {_eq: $product_id}}, order_by: {created_at: desc}) {
              id product_id name email phone subject message status notes created_at updated_at
            }
          }`,
          variables: { product_id: args.product_id },
        })
      },
    },

    // ── Iletisim Formu Gonderim Durumu Guncelle ──
    {
      name: 'business_contact_submissions_update_status',
      description: 'Bir iletisim formu gonderiminin durumunu gunceller.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'Gonderim UUID (zorunlu)' },
          status: { type: 'string', description: 'Yeni durum (zorunlu, ornegin: new, read, replied, archived)' },
        },
        required: ['id', 'status'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($id: uuid!, $status: String!) {
            update_contact_submissions_by_pk(pk_columns: {id: $id}, _set: {status: $status}) {
              id product_id name email phone subject message status notes created_at updated_at
            }
          }`,
          variables: { id: args.id, status: args.status },
        })
      },
    },
  ]
}
