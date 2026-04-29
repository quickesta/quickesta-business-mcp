/**
 * Uye, rol, uye hizmetleri ve izin yonetimi MCP araclari.
 * Tum sorgular GraphQL $variable sozdizimi kullanir — string interpolation yok.
 */

import type { HasuraClient } from '../hasura-client.js'
import type { ToolDefinition } from '../types.js'

export function createMemberTools(hasura: HasuraClient): ToolDefinition[] {
  return [
    // ══════════════════════════════════════════
    //  UYELER (Members)
    // ══════════════════════════════════════════

    // ── Uyeleri Listele ──
    {
      name: 'business_members_list',
      description: 'Belirli bir urune ait tum uyeleri toplam sayi ile birlikte listeler.',
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
            members(where: {product_id: {_eq: $product_id}}, order_by: {sort_order: asc}) {
              id product_id name avatar bio position social_links expertise_areas
              experience_years education is_active sort_order created_at updated_at
            }
            members_aggregate(where: {product_id: {_eq: $product_id}}) {
              aggregate { count }
            }
          }`,
          variables: { product_id: args.product_id },
        })
      },
    },

    // ── Uye Detayi ──
    {
      name: 'business_members_get',
      description: 'Tek bir uyenin detaylarini getirir. Composite PK: product_id + id.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          product_id: { type: 'string', description: 'Urun UUID (zorunlu)' },
          id: { type: 'string', description: 'Uye UUID (zorunlu)' },
        },
        required: ['product_id', 'id'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `query($product_id: uuid!, $id: uuid!) {
            members_by_pk(product_id: $product_id, id: $id) {
              id product_id name avatar bio position social_links expertise_areas
              experience_years education is_active sort_order created_at updated_at
            }
          }`,
          variables: { product_id: args.product_id, id: args.id },
        })
      },
    },

    // ── Uyeleri Rollerle Listele ──
    {
      name: 'business_members_with_roles',
      description: 'Uyeleri atanmis rolleriyle birlikte listeler.',
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
            members(where: {product_id: {_eq: $product_id}}, order_by: {sort_order: asc}) {
              id product_id name avatar bio position social_links expertise_areas
              experience_years education is_active sort_order created_at updated_at
              member_roles {
                id
                role { id name description }
              }
            }
          }`,
          variables: { product_id: args.product_id },
        })
      },
    },

    // ── Uye Olustur ──
    {
      name: 'business_members_create',
      description: 'Yeni bir uye olusturur.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          input: {
            type: 'object',
            description: 'members_insert_input nesnesi (product_id, name, avatar, bio, position, social_links, expertise_areas, experience_years, education, is_active, sort_order)',
          },
        },
        required: ['input'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($input: members_insert_input!) {
            insert_members_one(object: $input) {
              id product_id name avatar bio position social_links expertise_areas
              experience_years education is_active sort_order created_at updated_at
            }
          }`,
          variables: { input: args.input },
        })
      },
    },

    // ── Uye Guncelle ──
    {
      name: 'business_members_update',
      description: 'Bir uyenin bilgilerini gunceller. Composite PK: product_id + id.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          product_id: { type: 'string', description: 'Urun UUID (zorunlu)' },
          id: { type: 'string', description: 'Uye UUID (zorunlu)' },
          input: {
            type: 'object',
            description: 'members_set_input nesnesi (name, avatar, bio, position, social_links, expertise_areas, experience_years, education, is_active, sort_order)',
          },
        },
        required: ['product_id', 'id', 'input'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($product_id: uuid!, $id: uuid!, $input: members_set_input!) {
            update_members_by_pk(pk_columns: {product_id: $product_id, id: $id}, _set: $input) {
              id product_id name avatar bio position social_links expertise_areas
              experience_years education is_active sort_order created_at updated_at
            }
          }`,
          variables: { product_id: args.product_id, id: args.id, input: args.input },
        })
      },
    },

    // ── Uye Sil ──
    {
      name: 'business_members_delete',
      description: 'Bir uyeyi kalici olarak siler. where filtresi kullanir.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          product_id: { type: 'string', description: 'Urun UUID (zorunlu)' },
          id: { type: 'string', description: 'Uye UUID (zorunlu)' },
        },
        required: ['product_id', 'id'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($product_id: uuid!, $id: uuid!) {
            delete_members(where: {product_id: {_eq: $product_id}, id: {_eq: $id}}) {
              affected_rows
            }
          }`,
          variables: { product_id: args.product_id, id: args.id },
        })
      },
    },

    // ══════════════════════════════════════════
    //  ROLLER (Roles)
    // ══════════════════════════════════════════

    // ── Rolleri Listele ──
    {
      name: 'business_roles_list',
      description: 'Belirli bir urune ait tum rolleri listeler.',
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
            roles(where: {product_id: {_eq: $product_id}}) {
              id product_id name description created_at
            }
          }`,
          variables: { product_id: args.product_id },
        })
      },
    },

    // ── Rol Olustur ──
    {
      name: 'business_roles_create',
      description: 'Yeni bir rol olusturur.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          input: {
            type: 'object',
            description: 'roles_insert_input nesnesi (product_id, name, description)',
          },
        },
        required: ['input'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($input: roles_insert_input!) {
            insert_roles_one(object: $input) {
              id product_id name description created_at
            }
          }`,
          variables: { input: args.input },
        })
      },
    },

    // ── Uyeye Rol Ata ──
    {
      name: 'business_roles_assign',
      description: 'Bir uyeye rol atar.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          input: {
            type: 'object',
            description: 'member_roles_insert_input nesnesi (product_id, member_id, role_id)',
          },
        },
        required: ['input'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($input: member_roles_insert_input!) {
            insert_member_roles_one(object: $input) {
              id product_id member_id role_id
            }
          }`,
          variables: { input: args.input },
        })
      },
    },

    // ── Uyeden Rol Kaldir ──
    {
      name: 'business_roles_remove',
      description: 'Bir uyeden rolu kaldirir. where filtresi: product_id, member_id, role_id.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          product_id: { type: 'string', description: 'Urun UUID (zorunlu)' },
          member_id: { type: 'string', description: 'Uye UUID (zorunlu)' },
          role_id: { type: 'string', description: 'Rol UUID (zorunlu)' },
        },
        required: ['product_id', 'member_id', 'role_id'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($product_id: uuid!, $member_id: uuid!, $role_id: uuid!) {
            delete_member_roles(where: {
              product_id: {_eq: $product_id},
              member_id: {_eq: $member_id},
              role_id: {_eq: $role_id}
            }) {
              affected_rows
            }
          }`,
          variables: { product_id: args.product_id, member_id: args.member_id, role_id: args.role_id },
        })
      },
    },

    // ══════════════════════════════════════════
    //  UYE HIZMETLERI (Member Services)
    // ══════════════════════════════════════════

    // ── Uye Hizmetlerini Listele ──
    {
      name: 'business_member_services_list',
      description: 'Belirli bir urune ait tum uye-hizmet eslesmelerini listeler.',
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
            member_services(where: {product_id: {_eq: $product_id}}) {
              id product_id member_id service_id
              member { id name }
              service { id name }
            }
          }`,
          variables: { product_id: args.product_id },
        })
      },
    },

    // ── Uyeye Ait Hizmetler ──
    {
      name: 'business_member_services_by_member',
      description: 'Belirli bir uyeye atanmis hizmetleri listeler.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          product_id: { type: 'string', description: 'Urun UUID (zorunlu)' },
          member_id: { type: 'string', description: 'Uye UUID (zorunlu)' },
        },
        required: ['product_id', 'member_id'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `query($product_id: uuid!, $member_id: uuid!) {
            member_services(where: {product_id: {_eq: $product_id}, member_id: {_eq: $member_id}}) {
              id product_id member_id service_id
              member { id name }
              service { id name }
            }
          }`,
          variables: { product_id: args.product_id, member_id: args.member_id },
        })
      },
    },

    // ── Uye Hizmeti Olustur ──
    {
      name: 'business_member_services_create',
      description: 'Bir uyeye yeni bir hizmet atar.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          input: {
            type: 'object',
            description: 'member_services_insert_input nesnesi (product_id, member_id, service_id)',
          },
        },
        required: ['input'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($input: member_services_insert_input!) {
            insert_member_services_one(object: $input) {
              id product_id member_id service_id
              member { id name }
              service { id name }
            }
          }`,
          variables: { input: args.input },
        })
      },
    },

    // ── Uye Hizmetleri Toplu Olustur ──
    {
      name: 'business_member_services_create_bulk',
      description: 'Bir uyeye birden fazla hizmeti toplu olarak atar.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          inputs: {
            type: 'array',
            description: 'member_services_insert_input dizisi. Her eleman: product_id, member_id, service_id',
            items: { type: 'object' },
          },
        },
        required: ['inputs'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($inputs: [member_services_insert_input!]!) {
            insert_member_services(objects: $inputs) {
              returning {
                id product_id member_id service_id
                member { id name }
                service { id name }
              }
            }
          }`,
          variables: { inputs: args.inputs },
        })
      },
    },

    // ── Uye Hizmeti Sil ──
    {
      name: 'business_member_services_delete',
      description: 'Bir uye-hizmet eslesmesini kalici olarak siler.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'Uye-hizmet eslesmesi UUID (zorunlu)' },
        },
        required: ['id'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($id: uuid!) {
            delete_member_services_by_pk(id: $id) {
              id
            }
          }`,
          variables: { id: args.id },
        })
      },
    },

    // ══════════════════════════════════════════
    //  IZINLER (Leaves)
    // ══════════════════════════════════════════

    // ── Izinleri Listele ──
    {
      name: 'business_leaves_list',
      description: 'Belirli bir urune ait tum izinleri listeler.',
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
            leaves(where: {product_id: {_eq: $product_id}}, order_by: {start_date: desc}) {
              id product_id leave_type member_id title description start_date end_date is_all_day created_at
            }
          }`,
          variables: { product_id: args.product_id },
        })
      },
    },

    // ── Uyeye Ait Izinler ──
    {
      name: 'business_leaves_by_member',
      description: 'Belirli bir uyeye ait izinleri listeler.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          product_id: { type: 'string', description: 'Urun UUID (zorunlu)' },
          member_id: { type: 'string', description: 'Uye UUID (zorunlu)' },
        },
        required: ['product_id', 'member_id'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `query($product_id: uuid!, $member_id: uuid!) {
            leaves(where: {product_id: {_eq: $product_id}, member_id: {_eq: $member_id}}, order_by: {start_date: desc}) {
              id product_id leave_type member_id title description start_date end_date is_all_day created_at
            }
          }`,
          variables: { product_id: args.product_id, member_id: args.member_id },
        })
      },
    },

    // ── Tarih Araligina Gore Izinler ──
    {
      name: 'business_leaves_by_date_range',
      description: 'Belirli bir tarih araligindaki izinleri listeler. Takvim gorunumu icin kullanilir.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          product_id: { type: 'string', description: 'Urun UUID (zorunlu)' },
          start_date: { type: 'string', description: 'Baslangic tarihi (YYYY-MM-DD) (zorunlu)' },
          end_date: { type: 'string', description: 'Bitis tarihi (YYYY-MM-DD) (zorunlu)' },
        },
        required: ['product_id', 'start_date', 'end_date'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `query($product_id: uuid!, $start_date: date!, $end_date: date!) {
            leaves(where: {
              product_id: {_eq: $product_id},
              _or: [
                {start_date: {_lte: $end_date}, end_date: {_gte: $start_date}},
                {start_date: {_gte: $start_date, _lte: $end_date}}
              ]
            }, order_by: {start_date: asc}) {
              id product_id leave_type member_id title description start_date end_date is_all_day created_at
            }
          }`,
          variables: {
            product_id: args.product_id,
            start_date: args.start_date,
            end_date: args.end_date,
          },
        })
      },
    },

    // ── Izin Olustur ──
    {
      name: 'business_leaves_create',
      description: 'Yeni bir izin kaydi olusturur.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          input: {
            type: 'object',
            description: 'leaves_insert_input nesnesi (product_id, member_id, leave_type, title, description, start_date, end_date, is_all_day)',
          },
        },
        required: ['input'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($input: leaves_insert_input!) {
            insert_leaves_one(object: $input) {
              id product_id leave_type member_id title description start_date end_date is_all_day created_at
            }
          }`,
          variables: { input: args.input },
        })
      },
    },

    // ── Izin Guncelle ──
    {
      name: 'business_leaves_update',
      description: 'Bir izin kaydini gunceller.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'Izin UUID (zorunlu)' },
          input: {
            type: 'object',
            description: 'leaves_set_input nesnesi (leave_type, title, description, start_date, end_date, is_all_day)',
          },
        },
        required: ['id', 'input'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($id: uuid!, $input: leaves_set_input!) {
            update_leaves_by_pk(pk_columns: {id: $id}, _set: $input) {
              id product_id leave_type member_id title description start_date end_date is_all_day created_at
            }
          }`,
          variables: { id: args.id, input: args.input },
        })
      },
    },

    // ── Izin Sil ──
    {
      name: 'business_leaves_delete',
      description: 'Bir izin kaydini kalici olarak siler.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'Izin UUID (zorunlu)' },
        },
        required: ['id'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($id: uuid!) {
            delete_leaves_by_pk(id: $id) {
              id
            }
          }`,
          variables: { id: args.id },
        })
      },
    },
  ]
}
