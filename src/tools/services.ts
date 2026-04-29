/**
 * Hizmet, kategori, paket, grup dersi ve aylik abonelik MCP araclari.
 * Tum sorgular GraphQL $variable sozdizimi kullanir — string interpolation yok.
 */

import type { HasuraClient } from '../hasura-client.js'
import type { ToolDefinition } from '../types.js'

export function createServiceTools(hasura: HasuraClient): ToolDefinition[] {
  return [
    // ══════════════════════════════════════════
    //  HIZMETLER (Services)
    // ══════════════════════════════════════════

    // ── Hizmetleri Listele ──
    {
      name: 'business_services_list',
      description: 'Belirli bir urune ait tum hizmetleri kategorileriyle birlikte listeler.',
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
            services(where: {product_id: {_eq: $product_id}}, order_by: {sort_order: asc}) {
              id product_id category_id name slug description features duration price is_package service_type is_active sort_order created_at updated_at
              service_category { id name }
            }
          }`,
          variables: { product_id: args.product_id },
        })
      },
    },

    // ── Hizmet Detay ──
    {
      name: 'business_services_get',
      description: 'Belirli bir hizmetin detaylarini getirir.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'Hizmet UUID (zorunlu)' },
        },
        required: ['id'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `query($id: uuid!) {
            services_by_pk(id: $id) {
              id product_id category_id name slug description features duration price is_package service_type is_active sort_order created_at updated_at
              service_category { id name }
            }
          }`,
          variables: { id: args.id },
        })
      },
    },

    // ── Kategoriye Gore Hizmetler ──
    {
      name: 'business_services_by_category',
      description: 'Belirli bir kategoriye ait hizmetleri listeler.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          product_id: { type: 'string', description: 'Urun UUID (zorunlu)' },
          category_id: { type: 'string', description: 'Kategori UUID (zorunlu)' },
        },
        required: ['product_id', 'category_id'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `query($product_id: uuid!, $category_id: uuid!) {
            services(where: {product_id: {_eq: $product_id}, category_id: {_eq: $category_id}}, order_by: {sort_order: asc}) {
              id product_id category_id name slug description features duration price is_package service_type is_active sort_order created_at updated_at
              service_category { id name }
            }
          }`,
          variables: { product_id: args.product_id, category_id: args.category_id },
        })
      },
    },

    // ── Hizmet Olustur ──
    {
      name: 'business_services_create',
      description: 'Yeni bir hizmet olusturur.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          input: {
            type: 'object',
            description: 'services_insert_input nesnesi (product_id, category_id, name, slug, description, features, duration, price, is_package, service_type, is_active, sort_order)',
          },
        },
        required: ['input'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($input: services_insert_input!) {
            insert_services_one(object: $input) {
              id product_id category_id name slug description features duration price is_package service_type is_active sort_order created_at updated_at
            }
          }`,
          variables: { input: args.input },
        })
      },
    },

    // ── Hizmet Guncelle ──
    {
      name: 'business_services_update',
      description: 'Bir hizmeti gunceller. PK: id.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'Hizmet UUID (zorunlu)' },
          input: {
            type: 'object',
            description: 'services_set_input nesnesi (name, slug, description, features, duration, price, is_package, service_type, is_active, sort_order, category_id)',
          },
        },
        required: ['id', 'input'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($id: uuid!, $input: services_set_input!) {
            update_services_by_pk(pk_columns: {id: $id}, _set: $input) {
              id product_id category_id name slug description features duration price is_package service_type is_active sort_order created_at updated_at
            }
          }`,
          variables: { id: args.id, input: args.input },
        })
      },
    },

    // ── Hizmet Sil ──
    {
      name: 'business_services_delete',
      description: 'Bir hizmeti kalici olarak siler.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'Hizmet UUID (zorunlu)' },
        },
        required: ['id'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($id: uuid!) {
            delete_services_by_pk(id: $id) {
              id
            }
          }`,
          variables: { id: args.id },
        })
      },
    },

    // ══════════════════════════════════════════
    //  HIZMET KATEGORILERI (Service Categories)
    // ══════════════════════════════════════════

    // ── Hizmet Kategorilerini Listele ──
    {
      name: 'business_service_categories_list',
      description: 'Belirli bir urune ait tum hizmet kategorilerini listeler.',
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
            service_categories(where: {product_id: {_eq: $product_id}}, order_by: {sort_order: asc}) {
              id product_id name slug description icon sort_order is_active
            }
          }`,
          variables: { product_id: args.product_id },
        })
      },
    },

    // ── Hizmet Kategorisi Olustur ──
    {
      name: 'business_service_categories_create',
      description: 'Yeni bir hizmet kategorisi olusturur.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          input: {
            type: 'object',
            description: 'service_categories_insert_input nesnesi (product_id, name, slug, description, icon, sort_order, is_active)',
          },
        },
        required: ['input'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($input: service_categories_insert_input!) {
            insert_service_categories_one(object: $input) {
              id product_id name slug description icon sort_order is_active
            }
          }`,
          variables: { input: args.input },
        })
      },
    },

    // ── Hizmet Kategorisi Guncelle ──
    {
      name: 'business_service_categories_update',
      description: 'Bir hizmet kategorisini gunceller.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'Kategori UUID (zorunlu)' },
          input: {
            type: 'object',
            description: 'service_categories_set_input nesnesi (name, slug, description, icon, sort_order, is_active)',
          },
        },
        required: ['id', 'input'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($id: uuid!, $input: service_categories_set_input!) {
            update_service_categories_by_pk(pk_columns: {id: $id}, _set: $input) {
              id product_id name slug description icon sort_order is_active
            }
          }`,
          variables: { id: args.id, input: args.input },
        })
      },
    },

    // ── Hizmet Kategorisi Sil ──
    {
      name: 'business_service_categories_delete',
      description: 'Bir hizmet kategorisini kalici olarak siler.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'Kategori UUID (zorunlu)' },
        },
        required: ['id'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($id: uuid!) {
            delete_service_categories_by_pk(id: $id) {
              id
            }
          }`,
          variables: { id: args.id },
        })
      },
    },

    // ══════════════════════════════════════════
    //  HIZMET MUSAIT GUNLER (Service Available Days)
    // ══════════════════════════════════════════

    // ── Musait Gunleri Toplu Olustur ──
    {
      name: 'business_service_available_days_create_bulk',
      description: 'Bir hizmet icin musait gunleri toplu olarak olusturur.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          objects: {
            type: 'array',
            description: 'service_available_days_insert_input dizisi (product_id, service_id, day_of_week, ...)',
          },
        },
        required: ['objects'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($objects: [service_available_days_insert_input!]!) {
            insert_service_available_days(objects: $objects) {
              affected_rows
              returning { id product_id service_id }
            }
          }`,
          variables: { objects: args.objects },
        })
      },
    },

    // ── Hizmete Ait Musait Gunleri Sil ──
    {
      name: 'business_service_available_days_delete_by_service',
      description: 'Bir hizmete ait tum musait gunleri siler.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          service_id: { type: 'string', description: 'Hizmet UUID (zorunlu)' },
        },
        required: ['service_id'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($service_id: uuid!) {
            delete_service_available_days(where: {service_id: {_eq: $service_id}}) {
              affected_rows
            }
          }`,
          variables: { service_id: args.service_id },
        })
      },
    },

    // ══════════════════════════════════════════
    //  HIZMET KALEMLERI (Service Items — Paket icerik)
    // ══════════════════════════════════════════

    // ── Paket Icerik Kalemlerini Listele ──
    {
      name: 'business_service_items_by_package',
      description: 'Bir paket hizmetin icerik kalemlerini listeler.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          package_service_id: { type: 'string', description: 'Paket hizmet UUID (zorunlu)' },
        },
        required: ['package_service_id'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `query($package_service_id: uuid!) {
            service_items(where: {package_service_id: {_eq: $package_service_id}}, order_by: {sort_order: asc}) {
              id product_id package_service_id service_id sort_order
              service { id name }
            }
          }`,
          variables: { package_service_id: args.package_service_id },
        })
      },
    },

    // ── Paket Icerik Kalemlerini Toplu Olustur ──
    {
      name: 'business_service_items_create_bulk',
      description: 'Bir paket hizmet icin icerik kalemlerini toplu olarak olusturur.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          objects: {
            type: 'array',
            description: 'service_items_insert_input dizisi (product_id, package_service_id, service_id, sort_order)',
          },
        },
        required: ['objects'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($objects: [service_items_insert_input!]!) {
            insert_service_items(objects: $objects) {
              affected_rows
              returning { id product_id package_service_id service_id sort_order }
            }
          }`,
          variables: { objects: args.objects },
        })
      },
    },

    // ── Pakete Ait Icerik Kalemlerini Sil ──
    {
      name: 'business_service_items_delete_by_package',
      description: 'Bir paket hizmete ait tum icerik kalemlerini siler.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          package_service_id: { type: 'string', description: 'Paket hizmet UUID (zorunlu)' },
        },
        required: ['package_service_id'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($package_service_id: uuid!) {
            delete_service_items(where: {package_service_id: {_eq: $package_service_id}}) {
              affected_rows
            }
          }`,
          variables: { package_service_id: args.package_service_id },
        })
      },
    },

    // ══════════════════════════════════════════
    //  GRUP DERSLERI (Group Classes)
    // ══════════════════════════════════════════

    // ── Grup Derslerini Listele ──
    {
      name: 'business_group_classes_list',
      description: 'Belirli bir urune ait tum grup derslerini hizmetleri ve takvimleriyle listeler.',
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
            group_classes(where: {product_id: {_eq: $product_id}}) {
              id product_id name capacity
              group_class_services { id service_id service { id name } }
              group_class_schedules { id day_of_week start_time end_time }
            }
          }`,
          variables: { product_id: args.product_id },
        })
      },
    },

    // ── Grup Dersi Detay ──
    {
      name: 'business_group_classes_get',
      description: 'Belirli bir grup dersinin detaylarini getirir.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'Grup dersi UUID (zorunlu)' },
        },
        required: ['id'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `query($id: uuid!) {
            group_classes_by_pk(id: $id) {
              id product_id name capacity
              group_class_services { id service_id service { id name } }
              group_class_schedules { id day_of_week start_time end_time }
            }
          }`,
          variables: { id: args.id },
        })
      },
    },

    // ── Grup Dersi Olustur ──
    {
      name: 'business_group_classes_create',
      description: 'Yeni bir grup dersi olusturur.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          input: {
            type: 'object',
            description: 'group_classes_insert_input nesnesi (product_id, name, capacity, group_class_services, group_class_schedules)',
          },
        },
        required: ['input'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($input: group_classes_insert_input!) {
            insert_group_classes_one(object: $input) {
              id product_id name capacity
            }
          }`,
          variables: { input: args.input },
        })
      },
    },

    // ── Grup Dersi Guncelle ──
    {
      name: 'business_group_classes_update',
      description: 'Bir grup dersini gunceller.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'Grup dersi UUID (zorunlu)' },
          input: {
            type: 'object',
            description: 'group_classes_set_input nesnesi (name, capacity)',
          },
        },
        required: ['id', 'input'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($id: uuid!, $input: group_classes_set_input!) {
            update_group_classes_by_pk(pk_columns: {id: $id}, _set: $input) {
              id product_id name capacity
            }
          }`,
          variables: { id: args.id, input: args.input },
        })
      },
    },

    // ── Grup Dersi Sil ──
    {
      name: 'business_group_classes_delete',
      description: 'Bir grup dersini kalici olarak siler.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'Grup dersi UUID (zorunlu)' },
        },
        required: ['id'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($id: uuid!) {
            delete_group_classes_by_pk(id: $id) {
              id
            }
          }`,
          variables: { id: args.id },
        })
      },
    },

    // ══════════════════════════════════════════
    //  GRUP DERSI KATILIMLARI (Group Class Joinings)
    // ══════════════════════════════════════════

    // ── Grup Dersi Katilimlarini Listele ──
    {
      name: 'business_group_class_joinings_list',
      description: 'Belirli bir urune ait grup dersi katilimlarini musteri bilgileriyle listeler.',
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
            group_class_joinings(where: {product_id: {_eq: $product_id}}, order_by: {created_at: desc}) {
              id product_id group_class_id customer_id start_date end_date status created_at updated_at
              customer { id name phone email }
              group_class { id name }
            }
          }`,
          variables: { product_id: args.product_id },
        })
      },
    },

    // ── Grup Dersi Katilimi Olustur ──
    {
      name: 'business_group_class_joinings_create',
      description: 'Bir musterinin grup dersine katilimini olusturur.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          input: {
            type: 'object',
            description: 'group_class_joinings_insert_input nesnesi (product_id, group_class_id, customer_id, start_date, end_date, status)',
          },
        },
        required: ['input'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($input: group_class_joinings_insert_input!) {
            insert_group_class_joinings_one(object: $input) {
              id product_id group_class_id customer_id start_date end_date status created_at updated_at
            }
          }`,
          variables: { input: args.input },
        })
      },
    },

    // ── Grup Dersi Katilimi Guncelle ──
    {
      name: 'business_group_class_joinings_update',
      description: 'Bir grup dersi katilimini gunceller.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'Katilim UUID (zorunlu)' },
          input: {
            type: 'object',
            description: 'group_class_joinings_set_input nesnesi (start_date, end_date, status)',
          },
        },
        required: ['id', 'input'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($id: uuid!, $input: group_class_joinings_set_input!) {
            update_group_class_joinings_by_pk(pk_columns: {id: $id}, _set: $input) {
              id product_id group_class_id customer_id start_date end_date status created_at updated_at
            }
          }`,
          variables: { id: args.id, input: args.input },
        })
      },
    },

    // ══════════════════════════════════════════
    //  AYLIK PAKETLER (Monthly Packages)
    // ══════════════════════════════════════════

    // ── Aylik Paketleri Listele ──
    {
      name: 'business_monthly_packages_list',
      description: 'Belirli bir urune ait tum aylik paketleri icerik kalemleriyle listeler.',
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
            monthly_packages(where: {product_id: {_eq: $product_id}}) {
              id product_id name period_months price auto_renew
              monthly_package_items { id service_id quantity service { id name } }
            }
          }`,
          variables: { product_id: args.product_id },
        })
      },
    },

    // ── Aylik Paket Detay ──
    {
      name: 'business_monthly_packages_get',
      description: 'Belirli bir aylik paketin detaylarini getirir.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'Aylik paket UUID (zorunlu)' },
        },
        required: ['id'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `query($id: uuid!) {
            monthly_packages_by_pk(id: $id) {
              id product_id name period_months price auto_renew
              monthly_package_items { id service_id quantity service { id name } }
            }
          }`,
          variables: { id: args.id },
        })
      },
    },

    // ── Aylik Paket Olustur ──
    {
      name: 'business_monthly_packages_create',
      description: 'Yeni bir aylik paket olusturur.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          input: {
            type: 'object',
            description: 'monthly_packages_insert_input nesnesi (product_id, name, period_months, price, auto_renew, monthly_package_items)',
          },
        },
        required: ['input'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($input: monthly_packages_insert_input!) {
            insert_monthly_packages_one(object: $input) {
              id product_id name period_months price auto_renew
            }
          }`,
          variables: { input: args.input },
        })
      },
    },

    // ── Aylik Paket Guncelle ──
    {
      name: 'business_monthly_packages_update',
      description: 'Bir aylik paketi gunceller.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'Aylik paket UUID (zorunlu)' },
          input: {
            type: 'object',
            description: 'monthly_packages_set_input nesnesi (name, period_months, price, auto_renew)',
          },
        },
        required: ['id', 'input'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($id: uuid!, $input: monthly_packages_set_input!) {
            update_monthly_packages_by_pk(pk_columns: {id: $id}, _set: $input) {
              id product_id name period_months price auto_renew
            }
          }`,
          variables: { id: args.id, input: args.input },
        })
      },
    },

    // ── Aylik Paket Sil ──
    {
      name: 'business_monthly_packages_delete',
      description: 'Bir aylik paketi kalici olarak siler.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'Aylik paket UUID (zorunlu)' },
        },
        required: ['id'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($id: uuid!) {
            delete_monthly_packages_by_pk(id: $id) {
              id
            }
          }`,
          variables: { id: args.id },
        })
      },
    },

    // ══════════════════════════════════════════
    //  AYLIK PAKET KATILIMLARI (Monthly Package Joinings)
    // ══════════════════════════════════════════

    // ── Aylik Paket Katilimlarini Listele ──
    {
      name: 'business_monthly_package_joinings_list',
      description: 'Belirli bir urune ait aylik paket katilimlarini listeler.',
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
            monthly_package_joinings(where: {product_id: {_eq: $product_id}}, order_by: {created_at: desc}) {
              id product_id monthly_package_id customer_id start_date end_date status auto_renew created_at updated_at
              customer { id name phone email }
              monthly_package { id name period_months price }
            }
          }`,
          variables: { product_id: args.product_id },
        })
      },
    },

    // ── Aylik Paket Katilimi Olustur ──
    {
      name: 'business_monthly_package_joinings_create',
      description: 'Bir musterinin aylik pakete katilimini olusturur.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          input: {
            type: 'object',
            description: 'monthly_package_joinings_insert_input nesnesi (product_id, monthly_package_id, customer_id, start_date, end_date, status, auto_renew)',
          },
        },
        required: ['input'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($input: monthly_package_joinings_insert_input!) {
            insert_monthly_package_joinings_one(object: $input) {
              id product_id monthly_package_id customer_id start_date end_date status auto_renew created_at updated_at
            }
          }`,
          variables: { input: args.input },
        })
      },
    },

    // ── Aylik Paket Katilimi Guncelle ──
    {
      name: 'business_monthly_package_joinings_update',
      description: 'Bir aylik paket katilimini gunceller.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'Katilim UUID (zorunlu)' },
          input: {
            type: 'object',
            description: 'monthly_package_joinings_set_input nesnesi (start_date, end_date, status, auto_renew)',
          },
        },
        required: ['id', 'input'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($id: uuid!, $input: monthly_package_joinings_set_input!) {
            update_monthly_package_joinings_by_pk(pk_columns: {id: $id}, _set: $input) {
              id product_id monthly_package_id customer_id start_date end_date status auto_renew created_at updated_at
            }
          }`,
          variables: { id: args.id, input: args.input },
        })
      },
    },
  ]
}
