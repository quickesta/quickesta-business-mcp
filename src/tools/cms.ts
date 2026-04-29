/**
 * Blog, haber, sayfa, SSS, referans ve urun katalogu MCP araclari.
 * Tum sorgular GraphQL $variable sozdizimi kullanir — string interpolation yok.
 */

import type { HasuraClient } from '../hasura-client.js'
import type { ToolDefinition } from '../types.js'

export function createCmsTools(hasura: HasuraClient): ToolDefinition[] {
  return [
    // ══════════════════════════════════════════
    //  BLOG YAZILAR (Blog Posts)
    // ══════════════════════════════════════════

    // ── Blog Yazilarini Listele ──
    {
      name: 'business_blog_posts_list',
      description: 'Belirli bir urune ait tum blog yazilarini kategorileri, etiketleri ve yazarlariyla listeler.',
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
            blog_posts(where: {product_id: {_eq: $product_id}}, order_by: {created_at: desc}) {
              id product_id title slug excerpt content featured_image status published_at meta_title meta_description created_at updated_at
              blog_post_categories { id blog_category { id name slug } }
              blog_post_tags { id blog_tag { id name slug } }
              blog_post_authors { id blog_author { id name avatar } }
            }
          }`,
          variables: { product_id: args.product_id },
        })
      },
    },

    // ── Blog Yazi Detay ──
    {
      name: 'business_blog_posts_get',
      description: 'Belirli bir blog yazisinin detaylarini getirir.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'Blog yazi UUID (zorunlu)' },
        },
        required: ['id'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `query($id: uuid!) {
            blog_posts_by_pk(id: $id) {
              id product_id title slug excerpt content featured_image status published_at meta_title meta_description created_at updated_at
              blog_post_categories { id blog_category { id name slug } }
              blog_post_tags { id blog_tag { id name slug } }
              blog_post_authors { id blog_author { id name avatar } }
            }
          }`,
          variables: { id: args.id },
        })
      },
    },

    // ── Blog Yazi Olustur ──
    {
      name: 'business_blog_posts_create',
      description: 'Yeni bir blog yazisi olusturur.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          input: {
            type: 'object',
            description: 'blog_posts_insert_input nesnesi (product_id, title, slug, excerpt, content, featured_image, status, meta_title, meta_description)',
          },
        },
        required: ['input'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($input: blog_posts_insert_input!) {
            insert_blog_posts_one(object: $input) {
              id product_id title slug excerpt content featured_image status published_at meta_title meta_description created_at updated_at
            }
          }`,
          variables: { input: args.input },
        })
      },
    },

    // ── Blog Yazi Guncelle ──
    {
      name: 'business_blog_posts_update',
      description: 'Bir blog yazisini gunceller.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'Blog yazi UUID (zorunlu)' },
          input: {
            type: 'object',
            description: 'blog_posts_set_input nesnesi (title, slug, excerpt, content, featured_image, status, meta_title, meta_description)',
          },
        },
        required: ['id', 'input'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($id: uuid!, $input: blog_posts_set_input!) {
            update_blog_posts_by_pk(pk_columns: {id: $id}, _set: $input) {
              id product_id title slug excerpt content featured_image status published_at meta_title meta_description created_at updated_at
            }
          }`,
          variables: { id: args.id, input: args.input },
        })
      },
    },

    // ── Blog Yazi Sil ──
    {
      name: 'business_blog_posts_delete',
      description: 'Bir blog yazisini kalici olarak siler.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'Blog yazi UUID (zorunlu)' },
        },
        required: ['id'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($id: uuid!) {
            delete_blog_posts_by_pk(id: $id) {
              id
            }
          }`,
          variables: { id: args.id },
        })
      },
    },

    // ── Blog Yazi Yayinla ──
    {
      name: 'business_blog_posts_publish',
      description: 'Bir blog yazisini yayinlar (status=published, published_at=now).',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'Blog yazi UUID (zorunlu)' },
        },
        required: ['id'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($id: uuid!) {
            update_blog_posts_by_pk(pk_columns: {id: $id}, _set: {status: "published", published_at: "now()"}) {
              id status published_at
            }
          }`,
          variables: { id: args.id },
        })
      },
    },

    // ══════════════════════════════════════════
    //  BLOG KATEGORILERI (Blog Categories)
    // ══════════════════════════════════════════

    // ── Blog Kategorilerini Listele ──
    {
      name: 'business_blog_categories_list',
      description: 'Belirli bir urune ait tum blog kategorilerini listeler.',
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
            blog_categories(where: {product_id: {_eq: $product_id}}, order_by: {sort_order: asc}) {
              id product_id name slug description sort_order is_active created_at
            }
          }`,
          variables: { product_id: args.product_id },
        })
      },
    },

    // ── Blog Kategorisi Olustur ──
    {
      name: 'business_blog_categories_create',
      description: 'Yeni bir blog kategorisi olusturur.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          input: {
            type: 'object',
            description: 'blog_categories_insert_input nesnesi (product_id, name, slug, description, sort_order, is_active)',
          },
        },
        required: ['input'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($input: blog_categories_insert_input!) {
            insert_blog_categories_one(object: $input) {
              id product_id name slug description sort_order is_active created_at
            }
          }`,
          variables: { input: args.input },
        })
      },
    },

    // ── Blog Kategorisi Guncelle ──
    {
      name: 'business_blog_categories_update',
      description: 'Bir blog kategorisini gunceller.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'Blog kategori UUID (zorunlu)' },
          input: {
            type: 'object',
            description: 'blog_categories_set_input nesnesi (name, slug, description, sort_order, is_active)',
          },
        },
        required: ['id', 'input'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($id: uuid!, $input: blog_categories_set_input!) {
            update_blog_categories_by_pk(pk_columns: {id: $id}, _set: $input) {
              id product_id name slug description sort_order is_active created_at
            }
          }`,
          variables: { id: args.id, input: args.input },
        })
      },
    },

    // ── Blog Kategorisi Sil ──
    {
      name: 'business_blog_categories_delete',
      description: 'Bir blog kategorisini kalici olarak siler.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'Blog kategori UUID (zorunlu)' },
        },
        required: ['id'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($id: uuid!) {
            delete_blog_categories_by_pk(id: $id) {
              id
            }
          }`,
          variables: { id: args.id },
        })
      },
    },

    // ══════════════════════════════════════════
    //  BLOG ETIKETLERI (Blog Tags)
    // ══════════════════════════════════════════

    // ── Blog Etiketlerini Listele ──
    {
      name: 'business_blog_tags_list',
      description: 'Belirli bir urune ait tum blog etiketlerini listeler.',
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
            blog_tags(where: {product_id: {_eq: $product_id}}, order_by: {name: asc}) {
              id product_id name slug created_at
            }
          }`,
          variables: { product_id: args.product_id },
        })
      },
    },

    // ── Blog Etiketi Olustur ──
    {
      name: 'business_blog_tags_create',
      description: 'Yeni bir blog etiketi olusturur.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          input: {
            type: 'object',
            description: 'blog_tags_insert_input nesnesi (product_id, name, slug)',
          },
        },
        required: ['input'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($input: blog_tags_insert_input!) {
            insert_blog_tags_one(object: $input) {
              id product_id name slug created_at
            }
          }`,
          variables: { input: args.input },
        })
      },
    },

    // ── Blog Etiketi Guncelle ──
    {
      name: 'business_blog_tags_update',
      description: 'Bir blog etiketini gunceller.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'Blog etiket UUID (zorunlu)' },
          input: {
            type: 'object',
            description: 'blog_tags_set_input nesnesi (name, slug)',
          },
        },
        required: ['id', 'input'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($id: uuid!, $input: blog_tags_set_input!) {
            update_blog_tags_by_pk(pk_columns: {id: $id}, _set: $input) {
              id product_id name slug created_at
            }
          }`,
          variables: { id: args.id, input: args.input },
        })
      },
    },

    // ── Blog Etiketi Sil ──
    {
      name: 'business_blog_tags_delete',
      description: 'Bir blog etiketini kalici olarak siler.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'Blog etiket UUID (zorunlu)' },
        },
        required: ['id'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($id: uuid!) {
            delete_blog_tags_by_pk(id: $id) {
              id
            }
          }`,
          variables: { id: args.id },
        })
      },
    },

    // ══════════════════════════════════════════
    //  BLOG YAZARLARI (Blog Authors)
    // ══════════════════════════════════════════

    // ── Blog Yazarlarini Listele ──
    {
      name: 'business_blog_authors_list',
      description: 'Belirli bir urune ait tum blog yazarlarini listeler.',
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
            blog_authors(where: {product_id: {_eq: $product_id}}, order_by: {name: asc}) {
              id product_id name bio avatar social_links created_at
            }
          }`,
          variables: { product_id: args.product_id },
        })
      },
    },

    // ── Blog Yazar Olustur ──
    {
      name: 'business_blog_authors_create',
      description: 'Yeni bir blog yazari olusturur.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          input: {
            type: 'object',
            description: 'blog_authors_insert_input nesnesi (product_id, name, bio, avatar, social_links)',
          },
        },
        required: ['input'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($input: blog_authors_insert_input!) {
            insert_blog_authors_one(object: $input) {
              id product_id name bio avatar social_links created_at
            }
          }`,
          variables: { input: args.input },
        })
      },
    },

    // ── Blog Yazar Guncelle ──
    {
      name: 'business_blog_authors_update',
      description: 'Bir blog yazarini gunceller.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'Blog yazar UUID (zorunlu)' },
          input: {
            type: 'object',
            description: 'blog_authors_set_input nesnesi (name, bio, avatar, social_links)',
          },
        },
        required: ['id', 'input'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($id: uuid!, $input: blog_authors_set_input!) {
            update_blog_authors_by_pk(pk_columns: {id: $id}, _set: $input) {
              id product_id name bio avatar social_links created_at
            }
          }`,
          variables: { id: args.id, input: args.input },
        })
      },
    },

    // ── Blog Yazar Sil ──
    {
      name: 'business_blog_authors_delete',
      description: 'Bir blog yazarini kalici olarak siler.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'Blog yazar UUID (zorunlu)' },
        },
        required: ['id'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($id: uuid!) {
            delete_blog_authors_by_pk(id: $id) {
              id
            }
          }`,
          variables: { id: args.id },
        })
      },
    },

    // ══════════════════════════════════════════
    //  HABERLER (News)
    // ══════════════════════════════════════════

    // ── Haberleri Listele ──
    {
      name: 'business_news_list',
      description: 'Belirli bir urune ait tum haberleri listeler.',
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
            news(where: {product_id: {_eq: $product_id}}, order_by: {created_at: desc}) {
              id product_id title slug excerpt content featured_image status published_at meta_title meta_description created_at updated_at
            }
          }`,
          variables: { product_id: args.product_id },
        })
      },
    },

    // ── Haber Detay ──
    {
      name: 'business_news_get',
      description: 'Belirli bir haberin detaylarini getirir.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'Haber UUID (zorunlu)' },
        },
        required: ['id'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `query($id: uuid!) {
            news_by_pk(id: $id) {
              id product_id title slug excerpt content featured_image status published_at meta_title meta_description created_at updated_at
            }
          }`,
          variables: { id: args.id },
        })
      },
    },

    // ── Haber Olustur ──
    {
      name: 'business_news_create',
      description: 'Yeni bir haber olusturur.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          input: {
            type: 'object',
            description: 'news_insert_input nesnesi (product_id, title, slug, excerpt, content, featured_image, status, meta_title, meta_description)',
          },
        },
        required: ['input'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($input: news_insert_input!) {
            insert_news_one(object: $input) {
              id product_id title slug excerpt content featured_image status published_at meta_title meta_description created_at updated_at
            }
          }`,
          variables: { input: args.input },
        })
      },
    },

    // ── Haber Guncelle ──
    {
      name: 'business_news_update',
      description: 'Bir haberi gunceller.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'Haber UUID (zorunlu)' },
          input: {
            type: 'object',
            description: 'news_set_input nesnesi (title, slug, excerpt, content, featured_image, status, meta_title, meta_description)',
          },
        },
        required: ['id', 'input'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($id: uuid!, $input: news_set_input!) {
            update_news_by_pk(pk_columns: {id: $id}, _set: $input) {
              id product_id title slug excerpt content featured_image status published_at meta_title meta_description created_at updated_at
            }
          }`,
          variables: { id: args.id, input: args.input },
        })
      },
    },

    // ── Haber Sil ──
    {
      name: 'business_news_delete',
      description: 'Bir haberi kalici olarak siler.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'Haber UUID (zorunlu)' },
        },
        required: ['id'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($id: uuid!) {
            delete_news_by_pk(id: $id) {
              id
            }
          }`,
          variables: { id: args.id },
        })
      },
    },

    // ── Haber Yayinla ──
    {
      name: 'business_news_publish',
      description: 'Bir haberi yayinlar (status=published, published_at=now).',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'Haber UUID (zorunlu)' },
        },
        required: ['id'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($id: uuid!) {
            update_news_by_pk(pk_columns: {id: $id}, _set: {status: "published", published_at: "now()"}) {
              id status published_at
            }
          }`,
          variables: { id: args.id },
        })
      },
    },

    // ══════════════════════════════════════════
    //  SAYFALAR (Pages)
    // ══════════════════════════════════════════

    // ── Sayfalari Listele ──
    {
      name: 'business_pages_list',
      description: 'Belirli bir urune ait tum sayfalari listeler.',
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
            pages(where: {product_id: {_eq: $product_id}}, order_by: {sort_order: asc}) {
              id product_id title slug content featured_image status published_at meta_title meta_description sort_order created_at updated_at
            }
          }`,
          variables: { product_id: args.product_id },
        })
      },
    },

    // ── Sayfa Detay ──
    {
      name: 'business_pages_get',
      description: 'Belirli bir sayfanin detaylarini getirir.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'Sayfa UUID (zorunlu)' },
        },
        required: ['id'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `query($id: uuid!) {
            pages_by_pk(id: $id) {
              id product_id title slug content featured_image status published_at meta_title meta_description sort_order created_at updated_at
            }
          }`,
          variables: { id: args.id },
        })
      },
    },

    // ── Sayfa Olustur ──
    {
      name: 'business_pages_create',
      description: 'Yeni bir sayfa olusturur.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          input: {
            type: 'object',
            description: 'pages_insert_input nesnesi (product_id, title, slug, content, featured_image, status, meta_title, meta_description, sort_order)',
          },
        },
        required: ['input'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($input: pages_insert_input!) {
            insert_pages_one(object: $input) {
              id product_id title slug content featured_image status published_at meta_title meta_description sort_order created_at updated_at
            }
          }`,
          variables: { input: args.input },
        })
      },
    },

    // ── Sayfa Guncelle ──
    {
      name: 'business_pages_update',
      description: 'Bir sayfayi gunceller.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'Sayfa UUID (zorunlu)' },
          input: {
            type: 'object',
            description: 'pages_set_input nesnesi (title, slug, content, featured_image, status, meta_title, meta_description, sort_order)',
          },
        },
        required: ['id', 'input'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($id: uuid!, $input: pages_set_input!) {
            update_pages_by_pk(pk_columns: {id: $id}, _set: $input) {
              id product_id title slug content featured_image status published_at meta_title meta_description sort_order created_at updated_at
            }
          }`,
          variables: { id: args.id, input: args.input },
        })
      },
    },

    // ── Sayfa Sil ──
    {
      name: 'business_pages_delete',
      description: 'Bir sayfayi kalici olarak siler.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'Sayfa UUID (zorunlu)' },
        },
        required: ['id'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($id: uuid!) {
            delete_pages_by_pk(id: $id) {
              id
            }
          }`,
          variables: { id: args.id },
        })
      },
    },

    // ── Sayfa Yayinla ──
    {
      name: 'business_pages_publish',
      description: 'Bir sayfayi yayinlar (status=published, published_at=now).',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'Sayfa UUID (zorunlu)' },
        },
        required: ['id'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($id: uuid!) {
            update_pages_by_pk(pk_columns: {id: $id}, _set: {status: "published", published_at: "now()"}) {
              id status published_at
            }
          }`,
          variables: { id: args.id },
        })
      },
    },

    // ══════════════════════════════════════════
    //  SSS KATEGORILERI (FAQ Categories)
    // ══════════════════════════════════════════

    // ── SSS Kategorilerini Listele ──
    {
      name: 'business_faq_categories_list',
      description: 'Belirli bir urune ait tum SSS kategorilerini listeler.',
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
            faq_categories(where: {product_id: {_eq: $product_id}}, order_by: {sort_order: asc}) {
              id product_id name slug description sort_order is_active created_at
            }
          }`,
          variables: { product_id: args.product_id },
        })
      },
    },

    // ── SSS Kategorisi Olustur ──
    {
      name: 'business_faq_categories_create',
      description: 'Yeni bir SSS kategorisi olusturur.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          input: {
            type: 'object',
            description: 'faq_categories_insert_input nesnesi (product_id, name, slug, description, sort_order, is_active)',
          },
        },
        required: ['input'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($input: faq_categories_insert_input!) {
            insert_faq_categories_one(object: $input) {
              id product_id name slug description sort_order is_active created_at
            }
          }`,
          variables: { input: args.input },
        })
      },
    },

    // ── SSS Kategorisi Guncelle ──
    {
      name: 'business_faq_categories_update',
      description: 'Bir SSS kategorisini gunceller.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'SSS kategori UUID (zorunlu)' },
          input: {
            type: 'object',
            description: 'faq_categories_set_input nesnesi (name, slug, description, sort_order, is_active)',
          },
        },
        required: ['id', 'input'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($id: uuid!, $input: faq_categories_set_input!) {
            update_faq_categories_by_pk(pk_columns: {id: $id}, _set: $input) {
              id product_id name slug description sort_order is_active created_at
            }
          }`,
          variables: { id: args.id, input: args.input },
        })
      },
    },

    // ── SSS Kategorisi Sil ──
    {
      name: 'business_faq_categories_delete',
      description: 'Bir SSS kategorisini kalici olarak siler.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'SSS kategori UUID (zorunlu)' },
        },
        required: ['id'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($id: uuid!) {
            delete_faq_categories_by_pk(id: $id) {
              id
            }
          }`,
          variables: { id: args.id },
        })
      },
    },

    // ══════════════════════════════════════════
    //  SSS MADDELERI (FAQ Items)
    // ══════════════════════════════════════════

    // ── SSS Maddelerini Listele ──
    {
      name: 'business_faq_items_list',
      description: 'Belirli bir urune ait tum SSS maddelerini kategorileriyle listeler.',
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
            faq_items(where: {product_id: {_eq: $product_id}}, order_by: {sort_order: asc}) {
              id product_id category_id question answer sort_order is_active created_at updated_at
              faq_category { id name }
            }
          }`,
          variables: { product_id: args.product_id },
        })
      },
    },

    // ── SSS Maddesi Olustur ──
    {
      name: 'business_faq_items_create',
      description: 'Yeni bir SSS maddesi olusturur.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          input: {
            type: 'object',
            description: 'faq_items_insert_input nesnesi (product_id, category_id, question, answer, sort_order, is_active)',
          },
        },
        required: ['input'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($input: faq_items_insert_input!) {
            insert_faq_items_one(object: $input) {
              id product_id category_id question answer sort_order is_active created_at updated_at
            }
          }`,
          variables: { input: args.input },
        })
      },
    },

    // ── SSS Maddesi Guncelle ──
    {
      name: 'business_faq_items_update',
      description: 'Bir SSS maddesini gunceller.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'SSS madde UUID (zorunlu)' },
          input: {
            type: 'object',
            description: 'faq_items_set_input nesnesi (category_id, question, answer, sort_order, is_active)',
          },
        },
        required: ['id', 'input'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($id: uuid!, $input: faq_items_set_input!) {
            update_faq_items_by_pk(pk_columns: {id: $id}, _set: $input) {
              id product_id category_id question answer sort_order is_active created_at updated_at
            }
          }`,
          variables: { id: args.id, input: args.input },
        })
      },
    },

    // ── SSS Maddesi Sil ──
    {
      name: 'business_faq_items_delete',
      description: 'Bir SSS maddesini kalici olarak siler.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'SSS madde UUID (zorunlu)' },
        },
        required: ['id'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($id: uuid!) {
            delete_faq_items_by_pk(id: $id) {
              id
            }
          }`,
          variables: { id: args.id },
        })
      },
    },

    // ══════════════════════════════════════════
    //  REFERANSLAR (References)
    // ══════════════════════════════════════════

    // ── Referanslari Listele ──
    {
      name: 'business_references_list',
      description: 'Belirli bir urune ait tum referanslari listeler.',
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
            references(where: {product_id: {_eq: $product_id}}, order_by: {sort_order: asc}) {
              id product_id name title description logo_url website_url testimonial rating sort_order is_active created_at updated_at
            }
          }`,
          variables: { product_id: args.product_id },
        })
      },
    },

    // ── Referans Detay ──
    {
      name: 'business_references_get',
      description: 'Belirli bir referansin detaylarini getirir.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'Referans UUID (zorunlu)' },
        },
        required: ['id'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `query($id: uuid!) {
            references_by_pk(id: $id) {
              id product_id name title description logo_url website_url testimonial rating sort_order is_active created_at updated_at
            }
          }`,
          variables: { id: args.id },
        })
      },
    },

    // ── Referans Olustur ──
    {
      name: 'business_references_create',
      description: 'Yeni bir referans olusturur.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          input: {
            type: 'object',
            description: 'references_insert_input nesnesi (product_id, name, title, description, logo_url, website_url, testimonial, rating, sort_order, is_active)',
          },
        },
        required: ['input'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($input: references_insert_input!) {
            insert_references_one(object: $input) {
              id product_id name title description logo_url website_url testimonial rating sort_order is_active created_at updated_at
            }
          }`,
          variables: { input: args.input },
        })
      },
    },

    // ── Referans Guncelle ──
    {
      name: 'business_references_update',
      description: 'Bir referansi gunceller.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'Referans UUID (zorunlu)' },
          input: {
            type: 'object',
            description: 'references_set_input nesnesi (name, title, description, logo_url, website_url, testimonial, rating, sort_order, is_active)',
          },
        },
        required: ['id', 'input'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($id: uuid!, $input: references_set_input!) {
            update_references_by_pk(pk_columns: {id: $id}, _set: $input) {
              id product_id name title description logo_url website_url testimonial rating sort_order is_active created_at updated_at
            }
          }`,
          variables: { id: args.id, input: args.input },
        })
      },
    },

    // ── Referans Sil ──
    {
      name: 'business_references_delete',
      description: 'Bir referansi kalici olarak siler.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'Referans UUID (zorunlu)' },
        },
        required: ['id'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($id: uuid!) {
            delete_references_by_pk(id: $id) {
              id
            }
          }`,
          variables: { id: args.id },
        })
      },
    },

    // ══════════════════════════════════════════
    //  URUN KATALOGU (Product Catalog)
    // ══════════════════════════════════════════

    // ── Urun Katalogu Listele ──
    {
      name: 'business_product_catalog_list',
      description: 'Belirli bir urune ait tum katalog urunlerini listeler.',
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
            product_catalog(where: {product_id: {_eq: $product_id}}, order_by: {sort_order: asc}) {
              id product_id category_id brand_id name slug description content price sale_price sku featured_image images status published_at meta_title meta_description sort_order is_active created_at updated_at
              product_category { id name }
              product_brand { id name }
            }
          }`,
          variables: { product_id: args.product_id },
        })
      },
    },

    // ── Urun Katalog Detay ──
    {
      name: 'business_product_catalog_get',
      description: 'Belirli bir katalog urunun detaylarini getirir.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'Katalog urun UUID (zorunlu)' },
        },
        required: ['id'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `query($id: uuid!) {
            product_catalog_by_pk(id: $id) {
              id product_id category_id brand_id name slug description content price sale_price sku featured_image images status published_at meta_title meta_description sort_order is_active created_at updated_at
              product_category { id name }
              product_brand { id name }
            }
          }`,
          variables: { id: args.id },
        })
      },
    },

    // ── Urun Katalog Olustur ──
    {
      name: 'business_product_catalog_create',
      description: 'Yeni bir katalog urunu olusturur.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          input: {
            type: 'object',
            description: 'product_catalog_insert_input nesnesi (product_id, category_id, brand_id, name, slug, description, content, price, sale_price, sku, featured_image, images, status, meta_title, meta_description, sort_order, is_active)',
          },
        },
        required: ['input'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($input: product_catalog_insert_input!) {
            insert_product_catalog_one(object: $input) {
              id product_id category_id brand_id name slug description content price sale_price sku featured_image images status published_at meta_title meta_description sort_order is_active created_at updated_at
            }
          }`,
          variables: { input: args.input },
        })
      },
    },

    // ── Urun Katalog Guncelle ──
    {
      name: 'business_product_catalog_update',
      description: 'Bir katalog urununu gunceller.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'Katalog urun UUID (zorunlu)' },
          input: {
            type: 'object',
            description: 'product_catalog_set_input nesnesi (category_id, brand_id, name, slug, description, content, price, sale_price, sku, featured_image, images, status, meta_title, meta_description, sort_order, is_active)',
          },
        },
        required: ['id', 'input'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($id: uuid!, $input: product_catalog_set_input!) {
            update_product_catalog_by_pk(pk_columns: {id: $id}, _set: $input) {
              id product_id category_id brand_id name slug description content price sale_price sku featured_image images status published_at meta_title meta_description sort_order is_active created_at updated_at
            }
          }`,
          variables: { id: args.id, input: args.input },
        })
      },
    },

    // ── Urun Katalog Sil ──
    {
      name: 'business_product_catalog_delete',
      description: 'Bir katalog urununu kalici olarak siler.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'Katalog urun UUID (zorunlu)' },
        },
        required: ['id'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($id: uuid!) {
            delete_product_catalog_by_pk(id: $id) {
              id
            }
          }`,
          variables: { id: args.id },
        })
      },
    },

    // ── Urun Katalog Yayinla ──
    {
      name: 'business_product_catalog_publish',
      description: 'Bir katalog urununu yayinlar (status=published, published_at=now).',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'Katalog urun UUID (zorunlu)' },
        },
        required: ['id'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($id: uuid!) {
            update_product_catalog_by_pk(pk_columns: {id: $id}, _set: {status: "published", published_at: "now()"}) {
              id status published_at
            }
          }`,
          variables: { id: args.id },
        })
      },
    },

    // ══════════════════════════════════════════
    //  URUN KATEGORILERI (Product Categories)
    // ══════════════════════════════════════════

    // ── Urun Kategorilerini Listele ──
    {
      name: 'business_product_categories_list',
      description: 'Belirli bir urune ait tum urun kategorilerini listeler.',
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
            product_categories(where: {product_id: {_eq: $product_id}}, order_by: {sort_order: asc}) {
              id product_id name slug description sort_order is_active created_at
            }
          }`,
          variables: { product_id: args.product_id },
        })
      },
    },

    // ── Urun Kategorisi Olustur ──
    {
      name: 'business_product_categories_create',
      description: 'Yeni bir urun kategorisi olusturur.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          input: {
            type: 'object',
            description: 'product_categories_insert_input nesnesi (product_id, name, slug, description, sort_order, is_active)',
          },
        },
        required: ['input'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($input: product_categories_insert_input!) {
            insert_product_categories_one(object: $input) {
              id product_id name slug description sort_order is_active created_at
            }
          }`,
          variables: { input: args.input },
        })
      },
    },

    // ── Urun Kategorisi Guncelle ──
    {
      name: 'business_product_categories_update',
      description: 'Bir urun kategorisini gunceller.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'Urun kategori UUID (zorunlu)' },
          input: {
            type: 'object',
            description: 'product_categories_set_input nesnesi (name, slug, description, sort_order, is_active)',
          },
        },
        required: ['id', 'input'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($id: uuid!, $input: product_categories_set_input!) {
            update_product_categories_by_pk(pk_columns: {id: $id}, _set: $input) {
              id product_id name slug description sort_order is_active created_at
            }
          }`,
          variables: { id: args.id, input: args.input },
        })
      },
    },

    // ── Urun Kategorisi Sil ──
    {
      name: 'business_product_categories_delete',
      description: 'Bir urun kategorisini kalici olarak siler.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'Urun kategori UUID (zorunlu)' },
        },
        required: ['id'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($id: uuid!) {
            delete_product_categories_by_pk(id: $id) {
              id
            }
          }`,
          variables: { id: args.id },
        })
      },
    },

    // ══════════════════════════════════════════
    //  URUN MARKALARI (Product Brands)
    // ══════════════════════════════════════════

    // ── Urun Markalarini Listele ──
    {
      name: 'business_product_brands_list',
      description: 'Belirli bir urune ait tum urun markalarini listeler.',
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
            product_brands(where: {product_id: {_eq: $product_id}}, order_by: {name: asc}) {
              id product_id name slug logo_url description is_active created_at
            }
          }`,
          variables: { product_id: args.product_id },
        })
      },
    },

    // ── Urun Markasi Olustur ──
    {
      name: 'business_product_brands_create',
      description: 'Yeni bir urun markasi olusturur.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          input: {
            type: 'object',
            description: 'product_brands_insert_input nesnesi (product_id, name, slug, logo_url, description, is_active)',
          },
        },
        required: ['input'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($input: product_brands_insert_input!) {
            insert_product_brands_one(object: $input) {
              id product_id name slug logo_url description is_active created_at
            }
          }`,
          variables: { input: args.input },
        })
      },
    },

    // ── Urun Markasi Guncelle ──
    {
      name: 'business_product_brands_update',
      description: 'Bir urun markasini gunceller.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'Urun marka UUID (zorunlu)' },
          input: {
            type: 'object',
            description: 'product_brands_set_input nesnesi (name, slug, logo_url, description, is_active)',
          },
        },
        required: ['id', 'input'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($id: uuid!, $input: product_brands_set_input!) {
            update_product_brands_by_pk(pk_columns: {id: $id}, _set: $input) {
              id product_id name slug logo_url description is_active created_at
            }
          }`,
          variables: { id: args.id, input: args.input },
        })
      },
    },

    // ── Urun Markasi Sil ──
    {
      name: 'business_product_brands_delete',
      description: 'Bir urun markasini kalici olarak siler.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'Urun marka UUID (zorunlu)' },
        },
        required: ['id'],
      },
      handler: async (args: Record<string, unknown>) => {
        return hasura.query({
          query: `mutation($id: uuid!) {
            delete_product_brands_by_pk(id: $id) {
              id
            }
          }`,
          variables: { id: args.id },
        })
      },
    },
  ]
}
