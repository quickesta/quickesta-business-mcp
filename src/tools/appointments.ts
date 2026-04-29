/**
 * Randevu yonetimi MCP araclari.
 * Tum sorgular GraphQL $variable sozdizimi kullanir — string interpolation yok.
 */

import type { HasuraClient } from '../hasura-client.js'
import type { ToolDefinition } from '../types.js'

export function createAppointmentTools(hasura: HasuraClient): ToolDefinition[] {
  return [
    // ══════════════════════════════════════════
    //  RANDEVULAR (Appointments)
    // ══════════════════════════════════════════

    // ── Randevulari Listele ──
    {
      name: 'business_appointments_list',
      description: 'Randevulari filtrelerle listeler. where parametresi ile product_id, status, tarih araligina gore filtrelenebilir.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          where: {
            type: 'object',
            description: 'appointments_bool_exp filtre nesnesi (zorunlu). Ornek: {product_id: {_eq: "..."}, status: {_eq: "confirmed"}}',
          },
        },
        required: ['where'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `query($where: appointments_bool_exp!) {
            appointments(where: $where, order_by: {appointment_date: desc}) {
              id product_id appointment_date start_time end_time total_duration total_price
              status notes cancellation_reason cancelled_at created_at updated_at
              appointment_guests {
                id appointment_id product_id customer_id sort_order
                customer { id first_name last_name email phone }
                appointment_guest_services {
                  id service_id member_id duration price sort_order
                  service { id name }
                  member { id name }
                }
              }
            }
          }`,
          variables: { where: args.where },
        })
      },
    },

    // ── Randevu Detayi ──
    {
      name: 'business_appointments_get',
      description: 'Tek bir randevunun tum detaylarini (misafirler, hizmetler, uyeler) getirir.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'Randevu UUID (zorunlu)' },
        },
        required: ['id'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `query($id: uuid!) {
            appointments_by_pk(id: $id) {
              id product_id appointment_date start_time end_time total_duration total_price
              status notes cancellation_reason cancelled_at created_at updated_at
              appointment_guests {
                id appointment_id product_id customer_id sort_order
                customer { id first_name last_name email phone }
                appointment_guest_services {
                  id service_id member_id duration price sort_order
                  service { id name }
                  member { id name }
                }
              }
            }
          }`,
          variables: { id: args.id },
        })
      },
    },

    // ── Uyeye Gore Randevular ──
    {
      name: 'business_appointments_by_member',
      description: 'Belirli bir uye icin tarih araligindaki randevulari getirir. Takvim gorunumu icin kullanilir.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          product_id: { type: 'string', description: 'Urun UUID (zorunlu)' },
          member_id: { type: 'string', description: 'Uye UUID (zorunlu)' },
          start_date: { type: 'string', description: 'Baslangic tarihi (YYYY-MM-DD) (zorunlu)' },
          end_date: { type: 'string', description: 'Bitis tarihi (YYYY-MM-DD) (zorunlu)' },
        },
        required: ['product_id', 'member_id', 'start_date', 'end_date'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `query($product_id: uuid!, $member_id: uuid!, $start_date: date!, $end_date: date!) {
            appointments(where: {
              product_id: {_eq: $product_id},
              appointment_date: {_gte: $start_date, _lte: $end_date},
              appointment_guests: {appointment_guest_services: {member_id: {_eq: $member_id}}}
            }, order_by: {appointment_date: asc, start_time: asc}) {
              id product_id appointment_date start_time end_time total_duration total_price
              status notes cancellation_reason cancelled_at created_at updated_at
              appointment_guests {
                id appointment_id product_id customer_id sort_order
                customer { id first_name last_name email phone }
                appointment_guest_services {
                  id service_id member_id duration price sort_order
                  service { id name }
                  member { id name }
                }
              }
            }
          }`,
          variables: {
            product_id: args.product_id,
            member_id: args.member_id,
            start_date: args.start_date,
            end_date: args.end_date,
          },
        })
      },
    },

    // ── Randevu Olustur ──
    {
      name: 'business_appointments_create',
      description: 'Yeni bir randevu olusturur.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          input: {
            type: 'object',
            description: 'appointments_insert_input nesnesi (product_id, appointment_date, start_time, end_time, total_duration, total_price, status, notes)',
          },
        },
        required: ['input'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($input: appointments_insert_input!) {
            insert_appointments_one(object: $input) {
              id product_id appointment_date start_time end_time total_duration total_price
              status notes created_at updated_at
            }
          }`,
          variables: { input: args.input },
        })
      },
    },

    // ── Randevu Guncelle ──
    {
      name: 'business_appointments_update',
      description: 'Bir randevuyu gunceller (tarih, saat, notlar vb.).',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'Randevu UUID (zorunlu)' },
          input: {
            type: 'object',
            description: 'appointments_set_input nesnesi (appointment_date, start_time, end_time, total_duration, total_price, status, notes)',
          },
        },
        required: ['id', 'input'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($id: uuid!, $input: appointments_set_input!) {
            update_appointments_by_pk(pk_columns: {id: $id}, _set: $input) {
              id product_id appointment_date start_time end_time total_duration total_price
              status notes cancellation_reason cancelled_at created_at updated_at
            }
          }`,
          variables: { id: args.id, input: args.input },
        })
      },
    },

    // ── Randevu Iptal Et ──
    {
      name: 'business_appointments_cancel',
      description: 'Bir randevuyu iptal eder. Durumu "cancelled" olarak ayarlar ve iptal nedenini kaydeder.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'Randevu UUID (zorunlu)' },
          cancellation_reason: { type: 'string', description: 'Iptal nedeni (opsiyonel)' },
        },
        required: ['id'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($id: uuid!, $cancellation_reason: String) {
            update_appointments_by_pk(pk_columns: {id: $id}, _set: {
              status: "cancelled",
              cancellation_reason: $cancellation_reason,
              cancelled_at: "now()"
            }) {
              id product_id appointment_date start_time end_time status
              cancellation_reason cancelled_at updated_at
            }
          }`,
          variables: { id: args.id, cancellation_reason: args.cancellation_reason ?? null },
        })
      },
    },

    // ── Randevu Durumu Guncelle ──
    {
      name: 'business_appointments_update_status',
      description: 'Bir randevunun durumunu gunceller (confirmed, completed, no_show vb.).',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'Randevu UUID (zorunlu)' },
          status: { type: 'string', description: 'Yeni durum (zorunlu). Ornek: confirmed, completed, no_show, cancelled' },
        },
        required: ['id', 'status'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($id: uuid!, $status: String!) {
            update_appointments_by_pk(pk_columns: {id: $id}, _set: {status: $status}) {
              id product_id appointment_date start_time end_time status updated_at
            }
          }`,
          variables: { id: args.id, status: args.status },
        })
      },
    },

    // ── Randevu Misafirleri Olustur ──
    {
      name: 'business_appointments_create_guests',
      description: 'Bir randevuya misafirler (ve hizmetleri) toplu ekler. Nested insert ile appointment_guest_services da eklenebilir.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          input: {
            type: 'array',
            description: 'appointment_guests_insert_input dizisi. Her eleman: appointment_id, product_id, customer_id, sort_order, appointment_guest_services: {data: [...]}',
            items: { type: 'object' },
          },
        },
        required: ['input'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($input: [appointment_guests_insert_input!]!) {
            insert_appointment_guests(objects: $input) {
              returning {
                id appointment_id product_id customer_id sort_order
                appointment_guest_services {
                  id service_id member_id duration price sort_order
                }
              }
            }
          }`,
          variables: { input: args.input },
        })
      },
    },

    // ══════════════════════════════════════════
    //  RANDEVU AYARLARI (Appointment Settings)
    // ══════════════════════════════════════════

    // ── Randevu Ayarlarini Getir ──
    {
      name: 'business_appointment_settings_get',
      description: 'Bir urunun randevu ayarlarini getirir (slot suresi, tampon sure, iptal politikasi vb.).',
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
            appointment_settings(where: {product_id: {_eq: $product_id}}) {
              id product_id slot_duration buffer_time max_advance_days min_advance_hours
              cancellation_policy auto_confirm allow_online_booking working_hours_override
              created_at updated_at
            }
          }`,
          variables: { product_id: args.product_id },
        })
      },
    },

    // ── Randevu Ayarlarini Kaydet (Upsert) ──
    {
      name: 'business_appointment_settings_upsert',
      description: 'Randevu ayarlarini olusturur veya gunceller (upsert). Varsa gunceller, yoksa yeni kayit olusturur.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          input: {
            type: 'object',
            description: 'appointment_settings_insert_input nesnesi (product_id, slot_duration, buffer_time, max_advance_days, min_advance_hours, cancellation_policy, auto_confirm, allow_online_booking, working_hours_override)',
          },
        },
        required: ['input'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($input: appointment_settings_insert_input!) {
            insert_appointment_settings_one(
              object: $input,
              on_conflict: {
                constraint: appointment_settings_product_id_key,
                update_columns: [slot_duration, buffer_time, max_advance_days, min_advance_hours, cancellation_policy, auto_confirm, allow_online_booking, working_hours_override]
              }
            ) {
              id product_id slot_duration buffer_time max_advance_days min_advance_hours
              cancellation_policy auto_confirm allow_online_booking working_hours_override
              created_at updated_at
            }
          }`,
          variables: { input: args.input },
        })
      },
    },

    // ══════════════════════════════════════════
    //  MUSAIT SLOTLAR (Available Slots)
    // ══════════════════════════════════════════

    // ── Musait Slot Verilerini Getir ──
    {
      name: 'business_available_slots',
      description: 'Slot hesaplamasi icin gerekli tum verileri getirir: calisma saatleri, mevcut randevular, izinler ve randevu ayarlari. Client tarafinda slot hesaplamasi yapilir.',
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
            working_hours(where: {product_id: {_eq: $product_id}}) {
              id product_id member_id day_of_week start_time end_time is_active
            }
            appointments(where: {
              product_id: {_eq: $product_id},
              appointment_date: {_gte: $start_date, _lte: $end_date},
              status: {_nin: ["cancelled"]}
            }, order_by: {appointment_date: asc, start_time: asc}) {
              id appointment_date start_time end_time status
              appointment_guests {
                appointment_guest_services {
                  member_id duration
                }
              }
            }
            leaves(where: {
              product_id: {_eq: $product_id},
              _or: [
                {start_date: {_lte: $end_date}, end_date: {_gte: $start_date}},
                {start_date: {_gte: $start_date, _lte: $end_date}}
              ]
            }) {
              id member_id leave_type start_date end_date is_all_day
            }
            appointment_settings(where: {product_id: {_eq: $product_id}}) {
              id slot_duration buffer_time max_advance_days min_advance_hours
              cancellation_policy auto_confirm allow_online_booking working_hours_override
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
  ]
}
