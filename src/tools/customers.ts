/**
 * Musteri yonetimi MCP araclari.
 * Tum sorgular GraphQL $variable sozdizimi kullanir — string interpolation yok.
 */

import type { HasuraClient } from '../hasura-client.js'
import type { ToolDefinition } from '../types.js'

export function createCustomerTools(hasura: HasuraClient): ToolDefinition[] {
  return [
    // ══════════════════════════════════════════
    //  MUSTERILER (Customers)
    // ══════════════════════════════════════════

    // ── Musterileri Listele ──
    {
      name: 'business_customers_list',
      description: 'Belirli bir urune ait tum musterileri toplam sayi ile birlikte listeler.',
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
            customers(where: {product_id: {_eq: $product_id}}, order_by: {created_at: desc}) {
              id product_id first_name last_name email country_code phone address created_at updated_at
            }
            customers_aggregate(where: {product_id: {_eq: $product_id}}) {
              aggregate { count }
            }
          }`,
          variables: { product_id: args.product_id },
        })
      },
    },

    // ── Musteri Detayi ──
    {
      name: 'business_customers_get',
      description: 'Tek bir musterinin detaylarini getirir. Composite PK: product_id + id.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          product_id: { type: 'string', description: 'Urun UUID (zorunlu)' },
          id: { type: 'string', description: 'Musteri UUID (zorunlu)' },
        },
        required: ['product_id', 'id'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `query($product_id: uuid!, $id: uuid!) {
            customers_by_pk(product_id: $product_id, id: $id) {
              id product_id first_name last_name email country_code phone address created_at updated_at
            }
          }`,
          variables: { product_id: args.product_id, id: args.id },
        })
      },
    },

    // ── Musteri Ara ──
    {
      name: 'business_customers_search',
      description: 'Musterileri e-posta veya telefon numarasina gore arar. En az biri verilmelidir.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          product_id: { type: 'string', description: 'Urun UUID (zorunlu)' },
          email: { type: 'string', description: 'E-posta adresi (opsiyonel)' },
          phone: { type: 'string', description: 'Telefon numarasi (opsiyonel)' },
          country_code: { type: 'integer', description: 'Ulke kodu, ornegin 90 (opsiyonel)' },
        },
        required: ['product_id'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `query($product_id: uuid!, $email: String, $phone: String, $country_code: Int) {
            customers(where: {
              product_id: {_eq: $product_id},
              _or: [
                {email: {_eq: $email}},
                {phone: {_eq: $phone}, country_code: {_eq: $country_code}}
              ]
            }) {
              id product_id first_name last_name email country_code phone address created_at updated_at
            }
          }`,
          variables: {
            product_id: args.product_id,
            email: args.email ?? null,
            phone: args.phone ?? null,
            country_code: args.country_code ?? null,
          },
        })
      },
    },

    // ── Musteri Olustur ──
    {
      name: 'business_customers_create',
      description: 'Yeni bir musteri olusturur.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          input: {
            type: 'object',
            description: 'customers_insert_input nesnesi (product_id, first_name, last_name, email, country_code, phone, address)',
          },
        },
        required: ['input'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($input: customers_insert_input!) {
            insert_customers_one(object: $input) {
              id product_id first_name last_name email country_code phone address created_at updated_at
            }
          }`,
          variables: { input: args.input },
        })
      },
    },

    // ── Musteri Guncelle ──
    {
      name: 'business_customers_update',
      description: 'Bir musterinin bilgilerini gunceller. Composite PK: product_id + id.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          product_id: { type: 'string', description: 'Urun UUID (zorunlu)' },
          id: { type: 'string', description: 'Musteri UUID (zorunlu)' },
          input: {
            type: 'object',
            description: 'customers_set_input nesnesi (first_name, last_name, email, country_code, phone, address)',
          },
        },
        required: ['product_id', 'id', 'input'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($product_id: uuid!, $id: uuid!, $input: customers_set_input!) {
            update_customers_by_pk(pk_columns: {product_id: $product_id, id: $id}, _set: $input) {
              id product_id first_name last_name email country_code phone address created_at updated_at
            }
          }`,
          variables: { product_id: args.product_id, id: args.id, input: args.input },
        })
      },
    },

    // ── Musteri Sil ──
    {
      name: 'business_customers_delete',
      description: 'Bir musteriyi kalici olarak siler. Composite PK: product_id + id.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          product_id: { type: 'string', description: 'Urun UUID (zorunlu)' },
          id: { type: 'string', description: 'Musteri UUID (zorunlu)' },
        },
        required: ['product_id', 'id'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($product_id: uuid!, $id: uuid!) {
            delete_customers_by_pk(product_id: $product_id, id: $id) {
              id
            }
          }`,
          variables: { product_id: args.product_id, id: args.id },
        })
      },
    },
  ]
}
