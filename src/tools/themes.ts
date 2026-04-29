/**
 * Tema yonetimi ve eksik junction table MCP araclari.
 * themes, group_class_schedules, group_class_services,
 * monthly_package_items, blog_post_tags
 */

import type { HasuraClient } from '../hasura-client.js'
import type { ToolDefinition } from '../types.js'

const THEME_FIELDS = `id product_id name status version schema_version config parent_id published_at created_by updated_by created_at updated_at`

export function createThemeTools(hasura: HasuraClient): ToolDefinition[] {
  return [
    // ═══ THEMES ═══

    {
      name: 'business_themes_list',
      description: 'Urune ait temalari listeler.',
      inputSchema: {
        type: 'object' as const,
        properties: { product_id: { type: 'string', description: 'Urun ID (zorunlu)' } },
        required: ['product_id'],
      },
      handler: async (args: Record<string, unknown>) => hasura.query({
        query: `query($product_id: uuid!) {
          themes(where: {product_id: {_eq: $product_id}}, order_by: {updated_at: desc}) { ${THEME_FIELDS} }
        }`,
        variables: { product_id: args.product_id },
      }),
    },

    {
      name: 'business_themes_get',
      description: 'Tek bir temanin detayini getirir — config JSONB dahil.',
      inputSchema: {
        type: 'object' as const,
        properties: { id: { type: 'string', description: 'Tema UUID (zorunlu)' } },
        required: ['id'],
      },
      handler: async (args: Record<string, unknown>) => hasura.query({
        query: `query($id: uuid!) { themes_by_pk(id: $id) { ${THEME_FIELDS} } }`,
        variables: { id: args.id },
      }),
    },

    {
      name: 'business_themes_create',
      description: 'Yeni tema olusturur.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          input: { type: 'object', description: 'themes_insert_input (product_id, name, status, config, schema_version)' },
        },
        required: ['input'],
      },
      handler: async (args: Record<string, unknown>) => hasura.query({
        query: `mutation($input: themes_insert_input!) { insert_themes_one(object: $input) { ${THEME_FIELDS} } }`,
        variables: { input: args.input },
      }),
    },

    {
      name: 'business_themes_update',
      description: 'Tema gunceller — config, status, name degistirilebilir.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'Tema UUID (zorunlu)' },
          input: { type: 'object', description: 'themes_set_input (name, status, config, published_at, updated_by)' },
        },
        required: ['id', 'input'],
      },
      handler: async (args: Record<string, unknown>) => hasura.query({
        query: `mutation($id: uuid!, $input: themes_set_input!) { update_themes_by_pk(pk_columns: {id: $id}, _set: $input) { ${THEME_FIELDS} } }`,
        variables: { id: args.id, input: args.input },
      }),
    },

    {
      name: 'business_themes_delete',
      description: 'Tema siler.',
      inputSchema: {
        type: 'object' as const,
        properties: { id: { type: 'string', description: 'Tema UUID (zorunlu)' } },
        required: ['id'],
      },
      handler: async (args: Record<string, unknown>) => hasura.query({
        query: `mutation($id: uuid!) { delete_themes_by_pk(id: $id) { id name } }`,
        variables: { id: args.id },
      }),
    },

    {
      name: 'business_themes_publish',
      description: 'Temayi yayinlar (status: published, published_at: now).',
      inputSchema: {
        type: 'object' as const,
        properties: { id: { type: 'string', description: 'Tema UUID (zorunlu)' } },
        required: ['id'],
      },
      handler: async (args: Record<string, unknown>) => hasura.query({
        query: `mutation($id: uuid!) { update_themes_by_pk(pk_columns: {id: $id}, _set: {status: "published", published_at: "now()"}) { ${THEME_FIELDS} } }`,
        variables: { id: args.id },
      }),
    },

    // ═══ GROUP CLASS SCHEDULES ═══

    {
      name: 'business_group_class_schedules_list',
      description: 'Grup dersi takvim programlarini listeler.',
      inputSchema: {
        type: 'object' as const,
        properties: { group_class_id: { type: 'string', description: 'Grup dersi UUID (zorunlu)' } },
        required: ['group_class_id'],
      },
      handler: async (args: Record<string, unknown>) => hasura.query({
        query: `query($group_class_id: uuid!) {
          group_class_schedules(where: {group_class_id: {_eq: $group_class_id}}, order_by: {day_of_week: asc}) {
            id group_class_id day_of_week start_time duration created_at
          }
        }`,
        variables: { group_class_id: args.group_class_id },
      }),
    },

    {
      name: 'business_group_class_schedules_create',
      description: 'Grup dersine takvim programi ekler.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          input: { type: 'object', description: 'group_class_schedules_insert_input (group_class_id, day_of_week, start_time, duration)' },
        },
        required: ['input'],
      },
      handler: async (args: Record<string, unknown>) => hasura.query({
        query: `mutation($input: group_class_schedules_insert_input!) {
          insert_group_class_schedules_one(object: $input) { id group_class_id day_of_week start_time duration }
        }`,
        variables: { input: args.input },
      }),
    },

    {
      name: 'business_group_class_schedules_update',
      description: 'Takvim programini gunceller.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'UUID (zorunlu)' },
          input: { type: 'object', description: 'group_class_schedules_set_input' },
        },
        required: ['id', 'input'],
      },
      handler: async (args: Record<string, unknown>) => hasura.query({
        query: `mutation($id: uuid!, $input: group_class_schedules_set_input!) {
          update_group_class_schedules_by_pk(pk_columns: {id: $id}, _set: $input) { id day_of_week start_time duration }
        }`,
        variables: { id: args.id, input: args.input },
      }),
    },

    {
      name: 'business_group_class_schedules_delete',
      description: 'Takvim programini siler.',
      inputSchema: {
        type: 'object' as const,
        properties: { id: { type: 'string', description: 'UUID (zorunlu)' } },
        required: ['id'],
      },
      handler: async (args: Record<string, unknown>) => hasura.query({
        query: `mutation($id: uuid!) { delete_group_class_schedules_by_pk(id: $id) { id } }`,
        variables: { id: args.id },
      }),
    },

    // ═══ GROUP CLASS SERVICES ═══

    {
      name: 'business_group_class_services_list',
      description: 'Grup dersinin hizmetlerini listeler.',
      inputSchema: {
        type: 'object' as const,
        properties: { group_class_id: { type: 'string', description: 'Grup dersi UUID (zorunlu)' } },
        required: ['group_class_id'],
      },
      handler: async (args: Record<string, unknown>) => hasura.query({
        query: `query($group_class_id: uuid!) {
          group_class_services(where: {group_class_id: {_eq: $group_class_id}}, order_by: {sort_order: asc}) {
            id group_class_id service_id sort_order service { id name price duration }
          }
        }`,
        variables: { group_class_id: args.group_class_id },
      }),
    },

    {
      name: 'business_group_class_services_create',
      description: 'Grup dersine hizmet ekler.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          input: { type: 'object', description: 'group_class_services_insert_input (group_class_id, service_id, sort_order)' },
        },
        required: ['input'],
      },
      handler: async (args: Record<string, unknown>) => hasura.query({
        query: `mutation($input: group_class_services_insert_input!) {
          insert_group_class_services_one(object: $input) { id group_class_id service_id sort_order }
        }`,
        variables: { input: args.input },
      }),
    },

    {
      name: 'business_group_class_services_delete',
      description: 'Grup dersinden hizmet kaldirir.',
      inputSchema: {
        type: 'object' as const,
        properties: { id: { type: 'string', description: 'UUID (zorunlu)' } },
        required: ['id'],
      },
      handler: async (args: Record<string, unknown>) => hasura.query({
        query: `mutation($id: uuid!) { delete_group_class_services_by_pk(id: $id) { id } }`,
        variables: { id: args.id },
      }),
    },

    // ═══ MONTHLY PACKAGE ITEMS ═══

    {
      name: 'business_monthly_package_items_list',
      description: 'Aylik paketin icerigini (hizmet/grup dersi) listeler.',
      inputSchema: {
        type: 'object' as const,
        properties: { monthly_package_id: { type: 'string', description: 'Paket UUID (zorunlu)' } },
        required: ['monthly_package_id'],
      },
      handler: async (args: Record<string, unknown>) => hasura.query({
        query: `query($monthly_package_id: uuid!) {
          monthly_package_items(where: {monthly_package_id: {_eq: $monthly_package_id}}, order_by: {sort_order: asc}) {
            id monthly_package_id service_id group_class_id sort_order
            service { id name price } group_class { id name }
          }
        }`,
        variables: { monthly_package_id: args.monthly_package_id },
      }),
    },

    {
      name: 'business_monthly_package_items_create',
      description: 'Aylik pakete icerik ekler.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          input: { type: 'object', description: 'monthly_package_items_insert_input (monthly_package_id, service_id veya group_class_id, sort_order)' },
        },
        required: ['input'],
      },
      handler: async (args: Record<string, unknown>) => hasura.query({
        query: `mutation($input: monthly_package_items_insert_input!) {
          insert_monthly_package_items_one(object: $input) { id monthly_package_id service_id group_class_id sort_order }
        }`,
        variables: { input: args.input },
      }),
    },

    {
      name: 'business_monthly_package_items_delete',
      description: 'Aylik paketten icerik kaldirir.',
      inputSchema: {
        type: 'object' as const,
        properties: { id: { type: 'string', description: 'UUID (zorunlu)' } },
        required: ['id'],
      },
      handler: async (args: Record<string, unknown>) => hasura.query({
        query: `mutation($id: uuid!) { delete_monthly_package_items_by_pk(id: $id) { id } }`,
        variables: { id: args.id },
      }),
    },

    // ═══ BLOG POST TAGS ═══

    {
      name: 'business_blog_post_tags_add',
      description: 'Blog yazisinina etiketler ekler (toplu).',
      inputSchema: {
        type: 'object' as const,
        properties: {
          objects: { type: 'array', items: { type: 'object' }, description: '[{post_id, tag_id}] listesi (zorunlu)' },
        },
        required: ['objects'],
      },
      handler: async (args: Record<string, unknown>) => hasura.query({
        query: `mutation($objects: [blog_post_tags_insert_input!]!) {
          insert_blog_post_tags(objects: $objects) { affected_rows returning { post_id tag_id } }
        }`,
        variables: { objects: args.objects },
      }),
    },

    {
      name: 'business_blog_post_tags_remove',
      description: 'Blog yazisindan tum etiketleri kaldirir.',
      inputSchema: {
        type: 'object' as const,
        properties: { post_id: { type: 'string', description: 'Yazi UUID (zorunlu)' } },
        required: ['post_id'],
      },
      handler: async (args: Record<string, unknown>) => hasura.query({
        query: `mutation($post_id: uuid!) {
          delete_blog_post_tags(where: {post_id: {_eq: $post_id}}) { affected_rows }
        }`,
        variables: { post_id: args.post_id },
      }),
    },

    // ═══ PAGE TRANSLATIONS ═══

    {
      name: 'business_page_translations_list',
      description: 'Sayfa cevirilerini listeler.',
      inputSchema: {
        type: 'object' as const,
        properties: { page_id: { type: 'string', description: 'Sayfa UUID (zorunlu)' } },
        required: ['page_id'],
      },
      handler: async (args: Record<string, unknown>) => hasura.query({
        query: `query($page_id: uuid!) {
          translations(where: {entity_id: {_eq: $page_id}, entity_type: {_eq: "page"}}) {
            id product_id entity_type entity_id language_code translation_data is_active created_by created_at updated_at
          }
        }`,
        variables: { page_id: args.page_id },
      }),
    },

    // ═══ APPOINTMENT GUEST SERVICES ═══

    {
      name: 'business_appointment_guest_services_update',
      description: 'Randevu misafir hizmetinin uyesini degistirir.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'UUID (zorunlu)' },
          member_id: { type: 'string', description: 'Yeni uye UUID (zorunlu)' },
        },
        required: ['id', 'member_id'],
      },
      handler: async (args: Record<string, unknown>) => hasura.query({
        query: `mutation($id: uuid!, $member_id: uuid!) {
          update_appointment_guest_services_by_pk(pk_columns: {id: $id}, _set: {member_id: $member_id}) { id member_id }
        }`,
        variables: { id: args.id, member_id: args.member_id },
      }),
    },
  ]
}
