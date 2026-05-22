/**
 * Studio MCP Araclari — Storefront editor'un TUM yeteneklerini MCP uzerinden sunar.
 *
 * Bu tool'lar AI asistanlarin bir isletmenin web sitesini (storefront) tamamen
 * duzenlemesini saglar: tema renkleri, tipografi, layout, sayfa bloklari,
 * blok ekleme/silme/siralama, CMS icerik onizleme ve daha fazlasi.
 *
 * MIMARI:
 *   Tema (theme) = JSONB config olarak DB'de saklanir.
 *   config icinde:
 *     - colors       → 17 renk token'i (HSL formatinda)
 *     - typography   → font ailesi, boyut, agirlik
 *     - layout       → border radius, konteyner genisligi, bosluk
 *     - darkMode     → karanlik mod renkleri
 *     - header       → ust bar, yukseklik, CTA buton
 *     - footer       → renk, kolon sayisi, ikon stili
 *     - pageBlocks   → { [page_id]: { blocks: Block[] } }
 *
 *   Block = { id, type, enabled, data: { ...type-specific } }
 *   19 blok tipi: hero, services, products, news, blog, faq, testimonials,
 *     gallery, team, cta, text, image, spacer, features_grid, stats,
 *     working_model, map, two_column, booking, contact_form
 *
 * KULLANIM AKISI:
 *   1. studio_themes_get_active → mevcut draft tema config'ini al
 *   2. studio_blocks_list → bir sayfanin bloklarini gor
 *   3. studio_blocks_add / update / remove / reorder → bloklari duzenle
 *   4. studio_theme_update_colors / typography / layout → genel tema ayarlarini degistir
 *   5. studio_themes_update_draft → tum config'i kaydet
 *   6. studio_themes_publish → canli siteye yayinla
 */

import type { HasuraClient } from '../hasura-client.js'
import type { ToolDefinition } from '../types.js'

const THEME_FIELDS = `id product_id name status version schema_version config parent_id published_at created_at updated_at`

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeBlockId(): string {
  return `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

/** Read theme config, return parsed or throw */
async function getThemeConfig(hasura: HasuraClient, themeId: string): Promise<{ id: string; config: any }> {
  const result: any = await hasura.query({
    query: `query($id: uuid!) { themes_by_pk(id: $id) { id config } }`,
    variables: { id: themeId },
  })
  const row = result?.themes_by_pk
  if (!row) throw new Error(`Tema bulunamadi: ${themeId}`)
  return { id: row.id, config: typeof row.config === 'string' ? JSON.parse(row.config) : row.config }
}

/** Write theme config back */
async function saveThemeConfig(hasura: HasuraClient, themeId: string, config: any): Promise<any> {
  return hasura.query({
    query: `mutation($id: uuid!, $config: jsonb!) {
      update_themes_by_pk(pk_columns: { id: $id }, _set: { config: $config }) {
        id status config updated_at
      }
    }`,
    variables: { id: themeId, config },
  })
}

// ── Default block data factories ─────────────────────────────────────────────

const DEFAULT_BLOCK_DATA: Record<string, () => any> = {
  hero: () => ({
    variant: 'centered',
    heroStyle: 'default',
    title: 'Hoş Geldiniz',
    subtitle: '',
    ctaPrimary: { label: 'Hemen Başlayın', href: '/contact' },
    ctaSecondary: undefined,
    showImage: false,
    imageUrl: '',
    backgroundFileId: undefined,
  }),
  services: () => ({
    title: 'Hizmetlerimiz',
    subtitle: '',
    columns: 3,
    cardStyle: 'border',
    showImage: true,
    limit: 9,
  }),
  products: () => ({
    title: 'Ürünler',
    subtitle: '',
    columns: 3,
    limit: 12,
    showPrice: true,
  }),
  news: () => ({
    title: 'Haberler',
    subtitle: '',
    columns: 3,
    limit: 6,
  }),
  blog: () => ({
    title: 'Blog',
    subtitle: '',
    columns: 3,
    limit: 6,
  }),
  faq: () => ({
    title: 'Sıkça Sorulan Sorular',
    subtitle: '',
    style: 'accordion',
  }),
  testimonials: () => ({
    title: 'Müşteri Yorumları',
    subtitle: '',
    layout: 'grid',
    columns: 3,
  }),
  gallery: () => ({
    title: 'Galeri',
    columns: 4,
    items: [],
    folderId: undefined,
  }),
  team: () => ({
    title: 'Ekibimiz',
    subtitle: '',
    columns: 3,
  }),
  cta: () => ({
    title: 'Hemen Başlayın',
    subtitle: '',
    buttonLabel: 'Randevu Al',
    buttonHref: '/book',
    variant: 'centered',
  }),
  text: () => ({
    content: '',
    align: 'left',
    maxWidth: 'md',
  }),
  image: () => ({
    url: '',
    fileId: undefined,
    alt: '',
    caption: '',
    maxWidth: 'lg',
  }),
  spacer: () => ({
    size: 'md',
  }),
  features_grid: () => ({
    title: 'Neden Bizi Tercih Etmelisiniz?',
    subtitle: '',
    columns: 3,
    style: 'glass',
    backgroundFilled: true,
    items: [],
  }),
  stats: () => ({
    title: 'Rakamlarla Biz',
    subtitle: '',
    columns: 4,
    items: [],
  }),
  working_model: () => ({
    title: 'Çalışma Modelimiz',
    subtitle: '',
    steps: [],
  }),
  map: () => ({
    title: '',
    height: 'md',
    showAddressOverlay: true,
  }),
  two_column: () => ({
    title: '',
    leftContent: '',
    rightContent: '',
    ratio: '50-50',
    style: 'default',
  }),
  booking: () => ({
    title: 'Online Randevu',
    subtitle: '',
    buttonLabel: 'Randevu Al',
    buttonHref: '/book',
  }),
  contact_form: () => ({
    title: 'Bize Ulaşın',
  }),
}

// ── Tool definitions ─────────────────────────────────────────────────────────

export function createStudioTools(hasura: HasuraClient): ToolDefinition[] {
  return [

    // ═══════════════════════════════════════════════════════════════════════════
    // TEMA LIFECYCLE — draft/publish akisi
    // ═══════════════════════════════════════════════════════════════════════════

    {
      name: 'studio_themes_get_active',
      description:
        'Urunun aktif draft ve published temasini getirir (sadece son birer tane). ' +
        'Config JSONB icerir: colors, typography, layout, darkMode, header, footer, pageBlocks.',
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
        'Yeni draft tema olusturur. Config: { version: "1.0.0", colors, typography, layout, darkMode, header, footer, pageBlocks }. ' +
        'schema_version daima "1.0.0" gonderilmeli. UYARI: pageBlocks bos ({}) gonderirseniz storefront varsayilan placeholder icerik gosterir. ' +
        'Mevcut bir temayi kopyalamak icin parent_id verin VE parent\'in pageBlocks\'unu config\'e dahil edin.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          product_id: { type: 'string', description: 'Urun ID (zorunlu)' },
          config: {
            type: 'object',
            description:
              'Tema config JSONB (zorunlu). Icerik: { version: "1.0.0", colors: {17 HSL token}, ' +
              'typography: {fontFamily, baseSize, headingScale, weight}, layout: {radius, containerWidth, spacing}, ' +
              'darkMode: {enabled, colors?}, header?: {topBar?, height?, ctaButton?}, footer?: {backgroundColor?, columns?, socialIconStyle?}, ' +
              'pageBlocks: { [page_id]: { blocks: Block[] } } }',
          },
          schema_version: { type: 'string', description: 'Tema sema versiyonu — daima "1.0.0" (zorunlu)' },
          parent_id: { type: 'string', description: 'Kaynak/published tema UUID (opsiyonel)' },
          name: { type: 'string', description: 'Tema adi (opsiyonel, varsayilan: "Draft")' },
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
        'Draft temanin TUM config JSONB\'sini REPLACE eder (partial update DEGIL). ' +
        'Kucuk degisiklikler icin studio_theme_update_colors, studio_theme_update_typography, ' +
        'studio_theme_update_layout, studio_theme_update_header, studio_theme_update_footer kullanin — ' +
        'bunlar mevcut config\'i okur, degistirir, geri yazar. Bu tool ise komple config gondermenizi gerektirir.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'Draft tema UUID (zorunlu)' },
          config: { type: 'object', description: 'Yeni tema konfigurasyonu JSONB — tum config (zorunlu)' },
        },
        required: ['id', 'config'],
      },
      handler: async (args: Record<string, unknown>) =>
        saveThemeConfig(hasura, args.id as string, args.config),
    },

    {
      name: 'studio_themes_publish',
      description:
        'Atomik tema yayinlama — mevcut published temayi arsivler, draft\'i published yapar ve versiyonu arttirir. ' +
        'Bu islem canli storefront\'u aninda gunceller.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          product_id: { type: 'string', description: 'Urun ID (zorunlu)' },
          draft_id: { type: 'string', description: 'Yayinlanacak draft tema UUID (zorunlu)' },
          next_version: { type: 'integer', description: 'Yeni versiyon numarasi (zorunlu, mevcut version + 1)' },
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

    // ═══════════════════════════════════════════════════════════════════════════
    // TEMA PARCALI GUNCELLEME — renkler, tipografi, layout, header, footer
    // ═══════════════════════════════════════════════════════════════════════════

    {
      name: 'studio_theme_update_colors',
      description:
        'Draft temanin renklerini gunceller. Her renk HSL objesi: { h: 0-360, s: 0-100, l: 0-100 }. ' +
        '17 token: background, foreground, primary, primaryForeground, secondary, secondaryForeground, ' +
        'accent, accentForeground, muted, mutedForeground, border, input, ring, card, cardForeground, ' +
        'destructive, destructiveForeground. Her renk { h: 0-360, s: 0-100, l: 0-100 } OBJESI olmalidir. ' +
        'String format ("220 90% 50%") KABUL EDILMEZ — frontend render etmez. Sadece degisen token\'lari gonderin.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          theme_id: { type: 'string', description: 'Draft tema UUID (zorunlu)' },
          colors: {
            type: 'object',
            description:
              'Guncellenecek renk token\'lari. Ornek: { primary: { h: 220, s: 90, l: 50 }, background: { h: 0, s: 0, l: 100 } }',
          },
        },
        required: ['theme_id', 'colors'],
      },
      handler: async (args: Record<string, unknown>) => {
        const { id, config } = await getThemeConfig(hasura, args.theme_id as string)
        config.colors = { ...config.colors, ...(args.colors as any) }
        return saveThemeConfig(hasura, id, config)
      },
    },

    {
      name: 'studio_theme_update_typography',
      description:
        'Draft temanin tipografi ayarlarini gunceller. ' +
        'fontFamily: "inter"|"geist"|"system"|"serif"|"mono" (SADECE bu 5 preset — diger degerler frontend tarafindan TANINMAZ), ' +
        'baseSize: 12-20 tamsayi (px), headingScale: 1.1-1.5 ondalikli sayi (baslik boyut carpani), ' +
        'weight: "normal"|"medium"|"semibold"|"bold".',
      inputSchema: {
        type: 'object' as const,
        properties: {
          theme_id: { type: 'string', description: 'Draft tema UUID (zorunlu)' },
          typography: {
            type: 'object',
            description:
              'Tipografi ayarlari. Ornek: { fontFamily: "inter", baseSize: 16, headingScale: 1.25, weight: "semibold" }',
          },
        },
        required: ['theme_id', 'typography'],
      },
      handler: async (args: Record<string, unknown>) => {
        const { id, config } = await getThemeConfig(hasura, args.theme_id as string)
        config.typography = { ...config.typography, ...(args.typography as any) }
        return saveThemeConfig(hasura, id, config)
      },
    },

    {
      name: 'studio_theme_update_layout',
      description:
        'Draft temanin layout ayarlarini gunceller. ' +
        'radius: 0-2 ondalikli sayi (rem, border radius), ' +
        'containerWidth: "narrow"|"default"|"wide"|"full" (SADECE bu 4 preset), ' +
        'spacing: "compact"|"default"|"relaxed" (SADECE bu 3 preset).',
      inputSchema: {
        type: 'object' as const,
        properties: {
          theme_id: { type: 'string', description: 'Draft tema UUID (zorunlu)' },
          layout: {
            type: 'object',
            description: 'Layout ayarlari. Ornek: { radius: 0.5, containerWidth: "default", spacing: "default" }',
          },
        },
        required: ['theme_id', 'layout'],
      },
      handler: async (args: Record<string, unknown>) => {
        const { id, config } = await getThemeConfig(hasura, args.theme_id as string)
        config.layout = { ...config.layout, ...(args.layout as any) }
        return saveThemeConfig(hasura, id, config)
      },
    },

    {
      name: 'studio_theme_update_header',
      description:
        'Draft temanin header (ust bilgi cubugu) ayarlarini gunceller. ' +
        'topBar: { enabled, height (px), backgroundColor (HSL) }, ' +
        'height: { mobile (px), tablet (px), desktop (px) }, ' +
        'ctaButton: { label, href, icon: "mail"|"phone"|"arrow" }.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          theme_id: { type: 'string', description: 'Draft tema UUID (zorunlu)' },
          header: {
            type: 'object',
            description:
              'Header ayarlari. Ornek: { topBar: { enabled: true, height: 40 }, ctaButton: { label: "Teklif Al", href: "/contact", icon: "mail" } }',
          },
        },
        required: ['theme_id', 'header'],
      },
      handler: async (args: Record<string, unknown>) => {
        const { id, config } = await getThemeConfig(hasura, args.theme_id as string)
        config.header = { ...(config.header || {}), ...(args.header as any) }
        return saveThemeConfig(hasura, id, config)
      },
    },

    {
      name: 'studio_theme_update_footer',
      description:
        'Draft temanin footer (alt bilgi) ayarlarini gunceller. ' +
        'backgroundColor (HSL), borderColor (HSL), columns: 2-4, ' +
        'socialIconStyle: "circle"|"square"|"minimal".',
      inputSchema: {
        type: 'object' as const,
        properties: {
          theme_id: { type: 'string', description: 'Draft tema UUID (zorunlu)' },
          footer: {
            type: 'object',
            description:
              'Footer ayarlari. Ornek: { columns: 4, socialIconStyle: "circle" }',
          },
        },
        required: ['theme_id', 'footer'],
      },
      handler: async (args: Record<string, unknown>) => {
        const { id, config } = await getThemeConfig(hasura, args.theme_id as string)
        config.footer = { ...(config.footer || {}), ...(args.footer as any) }
        return saveThemeConfig(hasura, id, config)
      },
    },

    {
      name: 'studio_theme_toggle_dark_mode',
      description:
        'Draft temanin karanlik mod ayarini acar/kapatir. ' +
        'Opsiyonel olarak karanlik mod icin ayri renkler verilebilir.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          theme_id: { type: 'string', description: 'Draft tema UUID (zorunlu)' },
          enabled: { type: 'boolean', description: 'Karanlik mod acik mi? (zorunlu)' },
          colors: {
            type: 'object',
            description: 'Karanlik mod icin ozel renkler (opsiyonel, ayni 17 HSL token)',
          },
        },
        required: ['theme_id', 'enabled'],
      },
      handler: async (args: Record<string, unknown>) => {
        const { id, config } = await getThemeConfig(hasura, args.theme_id as string)
        config.darkMode = {
          enabled: args.enabled as boolean,
          ...(args.colors ? { colors: args.colors } : {}),
        }
        return saveThemeConfig(hasura, id, config)
      },
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // BLOK YONETIMI — sayfa bazli blok islemleri
    // ═══════════════════════════════════════════════════════════════════════════

    {
      name: 'studio_block_types',
      description:
        'Kullanilabilir 19 blok tipini, kategorilerini ve varsayilan ayarlarini listeler. ' +
        'AI\'nin hangi bloku nerede kullanacagini anlamasi icin referans tool\'udur.',
      inputSchema: {
        type: 'object' as const,
        properties: {},
      },
      handler: async () => ({
        block_types: [
          {
            type: 'hero', category: 'hero', label: 'Hero / Banner',
            description: 'Sayfanin en ust kismi — baslik, alt baslik, CTA butonlari, arkaplan gorseli. Genellikle anasayfada kullanilir.',
            data_fields: {
              variant: { type: 'enum', values: ['centered', 'split', 'minimal'], default: 'centered' },
              heroStyle: { type: 'enum', values: ['default', 'glass-overlay'], default: 'default' },
              title: { type: 'string', default: 'Hos geldiniz' },
              subtitle: { type: 'string', optional: true },
              ctaPrimary: { type: 'object', fields: { label: 'string', href: 'string' }, optional: true },
              ctaSecondary: { type: 'object', fields: { label: 'string', href: 'string' }, optional: true },
              showImage: { type: 'boolean', default: false },
              imageUrl: { type: 'string', optional: true },
              backgroundFileId: { type: 'string', optional: true, note: 'Dosya yoneticisinden secilen gorsel ID' },
            },
          },
          {
            type: 'services', category: 'data', label: 'Hizmetler',
            description: 'CMS\'deki hizmetleri grid olarak gosterir. Veri otomatik cekilir.',
            data_fields: {
              title: { type: 'string', default: 'Hizmetlerimiz' },
              subtitle: { type: 'string', optional: true },
              columns: { type: 'number', min: 1, max: 4, default: 3 },
              cardStyle: { type: 'enum', values: ['shadow', 'border', 'minimal', 'glass'], default: 'border' },
              showImage: { type: 'boolean', default: true },
              limit: { type: 'number', min: 1, max: 100, default: 9 },
            },
          },
          {
            type: 'products', category: 'data', label: 'Ürünler',
            description: 'CMS\'deki urun katalogunu grid olarak gosterir.',
            data_fields: {
              title: { type: 'string', default: 'Ürünler' },
              subtitle: { type: 'string', optional: true },
              columns: { type: 'number', min: 1, max: 4, default: 3 },
              limit: { type: 'number', min: 1, max: 100, default: 12 },
              showPrice: { type: 'boolean', default: true },
            },
          },
          {
            type: 'news', category: 'data', label: 'Haberler',
            description: 'Yayinlanmis haberleri kart olarak gosterir.',
            data_fields: {
              title: { type: 'string', default: 'Haberler' },
              subtitle: { type: 'string', optional: true },
              columns: { type: 'number', min: 1, max: 4, default: 3 },
              limit: { type: 'number', min: 1, max: 20, default: 6 },
            },
          },
          {
            type: 'blog', category: 'data', label: 'Blog',
            description: 'Yayinlanmis blog yazilarini kart olarak gosterir.',
            data_fields: {
              title: { type: 'string', default: 'Blog' },
              subtitle: { type: 'string', optional: true },
              columns: { type: 'number', min: 1, max: 4, default: 3 },
              limit: { type: 'number', min: 1, max: 20, default: 6 },
            },
          },
          {
            type: 'faq', category: 'data', label: 'SSS',
            description: 'Sikca sorulan sorulari accordion/kart olarak gosterir.',
            data_fields: {
              title: { type: 'string', default: 'Sıkça Sorulan Sorular' },
              subtitle: { type: 'string', optional: true },
              style: { type: 'enum', values: ['accordion', 'cards', 'simple'], default: 'accordion' },
            },
          },
          {
            type: 'testimonials', category: 'data', label: 'Referanslar / Yorumlar',
            description: 'Musteri referanslarini/yorumlarini grid veya carousel olarak gosterir.',
            data_fields: {
              title: { type: 'string', default: 'Müşteri Yorumları' },
              subtitle: { type: 'string', optional: true },
              layout: { type: 'enum', values: ['grid', 'carousel'], default: 'grid' },
              columns: { type: 'number', min: 1, max: 4, default: 3 },
            },
          },
          {
            type: 'gallery', category: 'media', label: 'Galeri',
            description: 'Gorsel galerisi — dosya yoneticisinden gorseller secilir.',
            data_fields: {
              title: { type: 'string', default: 'Galeri' },
              columns: { type: 'number', min: 2, max: 6, default: 4 },
              items: { type: 'array', item_fields: { fileId: 'string', alt: 'string?', caption: 'string?' } },
              folderId: { type: 'string', optional: true, note: 'Dosya yoneticisi klasor ID' },
            },
          },
          {
            type: 'team', category: 'data', label: 'Ekip',
            description: 'Aktif ekip uyelerini kart olarak gosterir.',
            data_fields: {
              title: { type: 'string', default: 'Ekibimiz' },
              subtitle: { type: 'string', optional: true },
              columns: { type: 'number', min: 1, max: 4, default: 3 },
            },
          },
          {
            type: 'cta', category: 'content', label: 'CTA (Aksiyon Cagrisi)',
            description: 'Dikkat cekici aksiyon butonu — randevu, iletisim vb. yonlendirme.',
            data_fields: {
              title: { type: 'string', default: 'Hemen Başlayın' },
              subtitle: { type: 'string', optional: true },
              buttonLabel: { type: 'string', default: 'Randevu Al' },
              buttonHref: { type: 'string', default: '/book' },
              variant: { type: 'enum', values: ['banner', 'card', 'centered'], default: 'centered' },
            },
          },
          {
            type: 'text', category: 'content', label: 'Metin',
            description: 'Serbest metin blogu — aciklama, paragraf, duyuru icin.',
            data_fields: {
              content: { type: 'string', default: '' },
              align: { type: 'enum', values: ['left', 'center', 'right'], default: 'left' },
              maxWidth: { type: 'enum', values: ['sm', 'md', 'lg', 'full'], default: 'md' },
            },
          },
          {
            type: 'image', category: 'media', label: 'Gorsel',
            description: 'Tekli gorsel blogu — URL veya dosya yoneticisinden.',
            data_fields: {
              url: { type: 'string', default: '' },
              fileId: { type: 'string', optional: true },
              alt: { type: 'string', default: '' },
              caption: { type: 'string', optional: true },
              maxWidth: { type: 'enum', values: ['sm', 'md', 'lg', 'full'], default: 'lg' },
            },
          },
          {
            type: 'spacer', category: 'utility', label: 'Bosluk',
            description: 'Bloklar arasi bosluk birakir.',
            data_fields: {
              size: { type: 'enum', values: ['sm', 'md', 'lg', 'xl'], default: 'md' },
            },
          },
          {
            type: 'features_grid', category: 'content', label: 'Ozellikler Grid',
            description: 'Ikon + baslik + aciklama kartlari — "Neden biz?" tarzi bolumler icin.',
            data_fields: {
              title: { type: 'string', default: 'Neden Bizi Tercih Etmelisiniz?' },
              subtitle: { type: 'string', optional: true },
              columns: { type: 'number', min: 1, max: 4, default: 3 },
              style: { type: 'enum', values: ['card', 'glass', 'minimal'], default: 'glass' },
              backgroundFilled: { type: 'boolean', default: true },
              items: { type: 'array', item_fields: { icon: 'string', title: 'string', description: 'string' } },
            },
          },
          {
            type: 'stats', category: 'content', label: 'Istatistikler',
            description: 'Sayisal istatistikler — "500+ musteri", "10 yil tecrube" tarzinda.',
            data_fields: {
              title: { type: 'string', optional: true },
              subtitle: { type: 'string', optional: true },
              columns: { type: 'number', min: 2, max: 4, default: 4 },
              items: { type: 'array', item_fields: { number: 'string', label: 'string', description: 'string?' } },
            },
          },
          {
            type: 'working_model', category: 'content', label: 'Calisma Modeli',
            description: 'Adim adim surec aciklamasi — "1. Randevu al → 2. Gelin → 3. Sonuc" tarzi.',
            data_fields: {
              title: { type: 'string', default: 'Çalışma Modelimiz' },
              subtitle: { type: 'string', optional: true },
              steps: { type: 'array', item_fields: { number: 'string', title: 'string', description: 'string', icon: 'string' } },
            },
          },
          {
            type: 'map', category: 'utility', label: 'Harita',
            description: 'Google Maps embed — isletme konumunu gosterir (contact_info adres verisini kullanir).',
            data_fields: {
              title: { type: 'string', optional: true },
              height: { type: 'enum', values: ['sm', 'md', 'lg'], default: 'md' },
              showAddressOverlay: { type: 'boolean', default: true },
            },
          },
          {
            type: 'two_column', category: 'content', label: 'Iki Kolon',
            description: 'Iki kolonlu icerik blogu — metin/gorsel yan yana.',
            data_fields: {
              title: { type: 'string', optional: true },
              leftContent: { type: 'string', default: '' },
              rightContent: { type: 'string', default: '' },
              ratio: { type: 'enum', values: ['50-50', '60-40', '40-60'], default: '50-50' },
              style: { type: 'enum', values: ['default', 'card', 'glass'], default: 'default' },
            },
          },
          {
            type: 'booking', category: 'functional', label: 'Randevu',
            description: 'Online randevu yonlendirme blogu — buton ile /book sayfasina yonlendirir.',
            data_fields: {
              title: { type: 'string', default: 'Online Randevu' },
              subtitle: { type: 'string', optional: true },
              buttonLabel: { type: 'string', default: 'Randevu Al' },
              buttonHref: { type: 'string', default: '/book' },
            },
          },
          {
            type: 'contact_form', category: 'functional', label: 'Iletisim Formu',
            description: 'Iletisim formu blogu — ziyaretciler mesaj gonderebilir.',
            data_fields: {
              title: { type: 'string', default: 'Bize Ulaşın' },
            },
          },
        ],
        categories: {
          hero: 'Ana banner / giris bolumu',
          data: 'CMS verilerini gosteren dinamik bloklar (services, products, news, blog, faq, testimonials, team)',
          content: 'Statik icerik bloklari (text, cta, features_grid, stats, working_model, two_column)',
          media: 'Gorsel ve galeri bloklari (image, gallery)',
          utility: 'Yardimci bloklar (spacer, map)',
          functional: 'Interaktif bloklar (booking, contact_form)',
        },
        notes: [
          'Her blok bir id (otomatik), type, enabled (true/false) ve data iceriyordur.',
          'CMS-driven bloklar (services, products, news, blog, faq, testimonials, team) veritabanindan otomatik veri ceker.',
          'Statik bloklar (hero, text, cta, features_grid, stats, working_model) iceriklerini dogrudan data field\'larinda tasir.',
          'Bloklar sayfa bazli saklanir: theme.config.pageBlocks[page_id].blocks dizisi.',
        ],
      }),
    },

    {
      name: 'studio_blocks_list',
      description:
        'Bir sayfanin tum bloklarini sirasiyla listeler. Tema config\'inden pageBlocks[page_id].blocks dizisini okur.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          theme_id: { type: 'string', description: 'Draft tema UUID (zorunlu)' },
          page_id: { type: 'string', description: 'Sayfa UUID (zorunlu — slug DEGIL, studio_pages_list\'ten donen id kullanin)' },
        },
        required: ['theme_id', 'page_id'],
      },
      handler: async (args: Record<string, unknown>) => {
        const { config } = await getThemeConfig(hasura, args.theme_id as string)
        const pageBlocks = config.pageBlocks?.[args.page_id as string]
        return {
          page_id: args.page_id,
          blocks: pageBlocks?.blocks || [],
          count: pageBlocks?.blocks?.length || 0,
        }
      },
    },

    {
      name: 'studio_blocks_add',
      description:
        'Sayfaya yeni blok ekler. Blok tipi ve opsiyonel data verin — varsayilan degerler otomatik uygulanir. ' +
        'position ile istenen siraya eklenebilir (varsayilan: sona).',
      inputSchema: {
        type: 'object' as const,
        properties: {
          theme_id: { type: 'string', description: 'Draft tema UUID (zorunlu)' },
          page_id: { type: 'string', description: 'Sayfa UUID (zorunlu — slug DEGIL, studio_pages_list\'ten donen id kullanin)' },
          block_type: {
            type: 'string',
            description:
              'Blok tipi (zorunlu). Gecerli tipler: hero, services, products, news, blog, faq, ' +
              'testimonials, gallery, team, cta, text, image, spacer, features_grid, stats, ' +
              'working_model, map, two_column, booking, contact_form',
          },
          data: {
            type: 'object',
            description: 'Blok verisi (opsiyonel). Verilmezse varsayilan degerler kullanilir. Tiplere gore field\'lar icin studio_block_types tool\'unu kullanin.',
          },
          position: {
            type: 'integer',
            description: 'Ekleme pozisyonu — 0 = en basa, verilmezse sona eklenir (opsiyonel)',
          },
          enabled: {
            type: 'boolean',
            description: 'Blok aktif mi? (opsiyonel, varsayilan: true)',
          },
        },
        required: ['theme_id', 'page_id', 'block_type'],
      },
      handler: async (args: Record<string, unknown>) => {
        const blockType = args.block_type as string
        const defaultFactory = DEFAULT_BLOCK_DATA[blockType]
        if (!defaultFactory) throw new Error(`Gecersiz blok tipi: ${blockType}. studio_block_types ile gecerli tipleri gorun.`)

        const { id: themeId, config } = await getThemeConfig(hasura, args.theme_id as string)
        const pageId = args.page_id as string

        if (!config.pageBlocks) config.pageBlocks = {}
        if (!config.pageBlocks[pageId]) config.pageBlocks[pageId] = { blocks: [] }

        const newBlock = {
          id: makeBlockId(),
          type: blockType,
          enabled: args.enabled !== undefined ? args.enabled : true,
          data: { ...defaultFactory(), ...(args.data as any || {}) },
        }

        const blocks = config.pageBlocks[pageId].blocks
        const pos = args.position as number | undefined
        if (pos !== undefined && pos >= 0 && pos < blocks.length) {
          blocks.splice(pos, 0, newBlock)
        } else {
          blocks.push(newBlock)
        }

        await saveThemeConfig(hasura, themeId, config)
        return { added_block: newBlock, total_blocks: blocks.length }
      },
    },

    {
      name: 'studio_blocks_update',
      description:
        'Mevcut bir blogun data field\'larini gunceller. Sadece degisen field\'lari gonderin, geri kalani korunur.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          theme_id: { type: 'string', description: 'Draft tema UUID (zorunlu)' },
          page_id: { type: 'string', description: 'Sayfa UUID (zorunlu — slug DEGIL, studio_pages_list\'ten donen id kullanin)' },
          block_id: { type: 'string', description: 'Blok UUID (zorunlu)' },
          data: {
            type: 'object',
            description: 'Guncellenecek data field\'lari (zorunlu). Mevcut data ile merge edilir.',
          },
        },
        required: ['theme_id', 'page_id', 'block_id', 'data'],
      },
      handler: async (args: Record<string, unknown>) => {
        const { id: themeId, config } = await getThemeConfig(hasura, args.theme_id as string)
        const blocks = config.pageBlocks?.[args.page_id as string]?.blocks
        if (!blocks) throw new Error('Sayfa bloklari bulunamadi')

        const block = blocks.find((b: any) => b.id === args.block_id)
        if (!block) throw new Error(`Blok bulunamadi: ${args.block_id}`)

        block.data = { ...block.data, ...(args.data as any) }
        await saveThemeConfig(hasura, themeId, config)
        return { updated_block: block }
      },
    },

    {
      name: 'studio_blocks_remove',
      description: 'Sayfadan bir blogu kaldirir.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          theme_id: { type: 'string', description: 'Draft tema UUID (zorunlu)' },
          page_id: { type: 'string', description: 'Sayfa UUID (zorunlu — slug DEGIL, studio_pages_list\'ten donen id kullanin)' },
          block_id: { type: 'string', description: 'Silinecek blok UUID (zorunlu)' },
        },
        required: ['theme_id', 'page_id', 'block_id'],
      },
      handler: async (args: Record<string, unknown>) => {
        const { id: themeId, config } = await getThemeConfig(hasura, args.theme_id as string)
        const pageBlocks = config.pageBlocks?.[args.page_id as string]
        if (!pageBlocks?.blocks) throw new Error('Sayfa bloklari bulunamadi')

        const before = pageBlocks.blocks.length
        pageBlocks.blocks = pageBlocks.blocks.filter((b: any) => b.id !== args.block_id)
        if (pageBlocks.blocks.length === before) throw new Error(`Blok bulunamadi: ${args.block_id}`)

        await saveThemeConfig(hasura, themeId, config)
        return { removed: args.block_id, remaining_blocks: pageBlocks.blocks.length }
      },
    },

    {
      name: 'studio_blocks_reorder',
      description:
        'Bir blogun sayfadaki sirasini degistirir. from_index\'ten to_index\'e tasir.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          theme_id: { type: 'string', description: 'Draft tema UUID (zorunlu)' },
          page_id: { type: 'string', description: 'Sayfa UUID (zorunlu — slug DEGIL, studio_pages_list\'ten donen id kullanin)' },
          block_id: { type: 'string', description: 'Tasinacak blok UUID (zorunlu)' },
          to_index: { type: 'integer', description: 'Hedef pozisyon (0-tabanli, zorunlu)' },
        },
        required: ['theme_id', 'page_id', 'block_id', 'to_index'],
      },
      handler: async (args: Record<string, unknown>) => {
        const { id: themeId, config } = await getThemeConfig(hasura, args.theme_id as string)
        const blocks = config.pageBlocks?.[args.page_id as string]?.blocks
        if (!blocks) throw new Error('Sayfa bloklari bulunamadi')

        const fromIndex = blocks.findIndex((b: any) => b.id === args.block_id)
        if (fromIndex === -1) throw new Error(`Blok bulunamadi: ${args.block_id}`)

        const [block] = blocks.splice(fromIndex, 1)
        const toIndex = Math.max(0, Math.min(args.to_index as number, blocks.length))
        blocks.splice(toIndex, 0, block)

        await saveThemeConfig(hasura, themeId, config)
        return { block_id: args.block_id, new_index: toIndex, total_blocks: blocks.length }
      },
    },

    {
      name: 'studio_blocks_duplicate',
      description:
        'Bir blogu kopyalar — orijinalin hemen altina ayni data ile yeni ID\'li kopya ekler.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          theme_id: { type: 'string', description: 'Draft tema UUID (zorunlu)' },
          page_id: { type: 'string', description: 'Sayfa UUID (zorunlu — slug DEGIL, studio_pages_list\'ten donen id kullanin)' },
          block_id: { type: 'string', description: 'Kopyalanacak blok UUID (zorunlu)' },
        },
        required: ['theme_id', 'page_id', 'block_id'],
      },
      handler: async (args: Record<string, unknown>) => {
        const { id: themeId, config } = await getThemeConfig(hasura, args.theme_id as string)
        const blocks = config.pageBlocks?.[args.page_id as string]?.blocks
        if (!blocks) throw new Error('Sayfa bloklari bulunamadi')

        const index = blocks.findIndex((b: any) => b.id === args.block_id)
        if (index === -1) throw new Error(`Blok bulunamadi: ${args.block_id}`)

        const clone = JSON.parse(JSON.stringify(blocks[index]))
        clone.id = makeBlockId()
        blocks.splice(index + 1, 0, clone)

        await saveThemeConfig(hasura, themeId, config)
        return { original_id: args.block_id, clone: clone, total_blocks: blocks.length }
      },
    },

    {
      name: 'studio_blocks_bulk_set',
      description:
        'Bir sayfanin TUM bloklarini tek seferde degistirir (mevcut bloklar silinir, yenileri yazilir). ' +
        'Toplu islemler icin kullanin — ornegin sayfa sifirdan kurulum veya import.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          theme_id: { type: 'string', description: 'Draft tema UUID (zorunlu)' },
          page_id: { type: 'string', description: 'Sayfa UUID (zorunlu — slug DEGIL, studio_pages_list\'ten donen id kullanin)' },
          blocks: {
            type: 'array',
            description:
              'Yeni blok dizisi (zorunlu). Her blok: { type, enabled?, data }. ' +
              'id verilmezse otomatik olusturulur. Sirasi onemli — ilk eleman en uste.',
            items: { type: 'object' },
          },
        },
        required: ['theme_id', 'page_id', 'blocks'],
      },
      handler: async (args: Record<string, unknown>) => {
        const { id: themeId, config } = await getThemeConfig(hasura, args.theme_id as string)
        const pageId = args.page_id as string
        const inputBlocks = args.blocks as Array<{ type: string; enabled?: boolean; data?: any; id?: string }>

        if (!config.pageBlocks) config.pageBlocks = {}

        const blocks = inputBlocks.map((b) => {
          const defaultFactory = DEFAULT_BLOCK_DATA[b.type]
          if (!defaultFactory) throw new Error(`Gecersiz blok tipi: ${b.type}`)
          return {
            id: b.id || makeBlockId(),
            type: b.type,
            enabled: b.enabled !== undefined ? b.enabled : true,
            data: { ...defaultFactory(), ...(b.data || {}) },
          }
        })

        config.pageBlocks[pageId] = { blocks }
        await saveThemeConfig(hasura, themeId, config)
        return { page_id: pageId, blocks, count: blocks.length }
      },
    },

    {
      name: 'studio_blocks_toggle',
      description:
        'Bir blogu aktif/pasif yapar (gorsel olarak gizler/gosterir, silmez).',
      inputSchema: {
        type: 'object' as const,
        properties: {
          theme_id: { type: 'string', description: 'Draft tema UUID (zorunlu)' },
          page_id: { type: 'string', description: 'Sayfa UUID (zorunlu — slug DEGIL, studio_pages_list\'ten donen id kullanin)' },
          block_id: { type: 'string', description: 'Blok UUID (zorunlu)' },
          enabled: { type: 'boolean', description: 'Aktif mi? (zorunlu)' },
        },
        required: ['theme_id', 'page_id', 'block_id', 'enabled'],
      },
      handler: async (args: Record<string, unknown>) => {
        const { id: themeId, config } = await getThemeConfig(hasura, args.theme_id as string)
        const blocks = config.pageBlocks?.[args.page_id as string]?.blocks
        if (!blocks) throw new Error('Sayfa bloklari bulunamadi')

        const block = blocks.find((b: any) => b.id === args.block_id)
        if (!block) throw new Error(`Blok bulunamadi: ${args.block_id}`)

        block.enabled = args.enabled as boolean
        await saveThemeConfig(hasura, themeId, config)
        return { block_id: args.block_id, enabled: block.enabled }
      },
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // SAYFA YONETIMI — CMS pages tam CRUD + atomik islemler
    // ═══════════════════════════════════════════════════════════════════════════

    {
      name: 'studio_pages_list',
      description:
        'Urunun tum sayfalarini sirasiyla listeler. Her sayfa: id, title, slug, sort_order, ' +
        'show_in_header, show_in_footer, is_homepage, parent_id, meta_title, meta_description.',
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
            pages(
              where: { product_id: { _eq: $product_id } }
              order_by: { sort_order: asc }
            ) {
              id title slug sort_order show_in_header show_in_footer
              is_homepage parent_id meta_title meta_description status created_at updated_at
            }
          }`,
          variables: { product_id: args.product_id },
        }),
    },

    {
      name: 'studio_pages_create',
      description:
        'Yeni sayfa olusturur. Varsayilan olarak header ve footer\'da gorunur, status: published. ' +
        'Slug otomatik olusturulmaz — siz gonderin (ornek: "about", "services", "contact").',
      inputSchema: {
        type: 'object' as const,
        properties: {
          product_id: { type: 'string', description: 'Urun ID (zorunlu)' },
          title: { type: 'string', description: 'Sayfa basligi (zorunlu, ornek: "Hakkimizda")' },
          slug: { type: 'string', description: 'URL slug (zorunlu — title\'dan uret: kucuk harf, Turkce cevir [ç→c, ş→s, ğ→g, ı→i, ö→o, ü→u], ozel karakter sil, bosluk→tire. Ornek: "Hakkımızda" → "hakkimizda"). Anasayfa icin bos string gonderin.' },
          show_in_header: { type: 'boolean', description: 'Header menusunde gorunur mu? (varsayilan: true)' },
          show_in_footer: { type: 'boolean', description: 'Footer menusunde gorunur mu? (varsayilan: true)' },
          is_homepage: { type: 'boolean', description: 'Anasayfa mi? (varsayilan: false). True ise diger sayfalarin is_homepage otomatik temizlenmez — studio_pages_set_homepage kullanin.' },
          parent_id: { type: 'string', description: 'Ust sayfa UUID (opsiyonel, hiyerarsik yapilar icin)' },
          sort_order: { type: 'integer', description: 'Siralama (opsiyonel, kucuk sayi = onde)' },
          meta_title: { type: 'string', description: 'SEO baslik (opsiyonel)' },
          meta_description: { type: 'string', description: 'SEO aciklama (opsiyonel)' },
        },
        required: ['product_id', 'title', 'slug'],
      },
      handler: async (args: Record<string, unknown>) =>
        hasura.query({
          query: `mutation($input: pages_insert_input!) {
            insert_pages_one(object: $input) {
              id title slug sort_order show_in_header show_in_footer is_homepage parent_id meta_title meta_description
            }
          }`,
          variables: {
            input: {
              product_id: args.product_id,
              title: args.title,
              slug: args.slug,
              status: 'published',
              show_in_header: args.show_in_header ?? true,
              show_in_footer: args.show_in_footer ?? true,
              is_homepage: args.is_homepage ?? false,
              parent_id: args.parent_id ?? null,
              sort_order: args.sort_order ?? null,
              meta_title: args.meta_title ?? null,
              meta_description: args.meta_description ?? null,
            },
          },
        }),
    },

    {
      name: 'studio_pages_update',
      description:
        'Sayfa ozelliklerini gunceller — baslik, slug, menude gorunurluk, SEO bilgileri, siralama.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          page_id: { type: 'string', description: 'Sayfa UUID (zorunlu — slug DEGIL, studio_pages_list\'ten donen id kullanin)' },
          title: { type: 'string', description: 'Yeni baslik (opsiyonel)' },
          slug: { type: 'string', description: 'Yeni URL slug (opsiyonel)' },
          show_in_header: { type: 'boolean', description: 'Header menusunde gorunur mu? (opsiyonel)' },
          show_in_footer: { type: 'boolean', description: 'Footer menusunde gorunur mu? (opsiyonel)' },
          parent_id: { type: 'string', description: 'Ust sayfa UUID (opsiyonel, null = kok sayfa)' },
          sort_order: { type: 'integer', description: 'Yeni siralama (opsiyonel)' },
          meta_title: { type: 'string', description: 'SEO baslik (opsiyonel)' },
          meta_description: { type: 'string', description: 'SEO aciklama (opsiyonel)' },
        },
        required: ['page_id'],
      },
      handler: async (args: Record<string, unknown>) => {
        const setFields: Record<string, unknown> = {}
        for (const key of ['title', 'slug', 'show_in_header', 'show_in_footer', 'parent_id', 'sort_order', 'meta_title', 'meta_description']) {
          if (args[key] !== undefined) setFields[key] = args[key]
        }
        if (Object.keys(setFields).length === 0) throw new Error('En az bir alan guncellenmelidir')
        return hasura.query({
          query: `mutation($id: uuid!, $changes: pages_set_input!) {
            update_pages_by_pk(pk_columns: { id: $id }, _set: $changes) {
              id title slug sort_order show_in_header show_in_footer is_homepage parent_id meta_title meta_description
            }
          }`,
          variables: { id: args.page_id, changes: setFields },
        })
      },
    },

    {
      name: 'studio_pages_delete',
      description:
        'Sayfayi siler. Ayrica tema config\'inden o sayfanin bloklarini da temizler (theme_id verilirse). ' +
        'NOT: Silme sonrasi sort_order degerleri otomatik sikistirilmaz — studio_pages_reorder ile yeniden siralayabilirsiniz.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          page_id: { type: 'string', description: 'Silinecek sayfa UUID (zorunlu)' },
          theme_id: { type: 'string', description: 'Draft tema UUID (opsiyonel — verilirse pageBlocks\'tan da temizlenir)' },
        },
        required: ['page_id'],
      },
      handler: async (args: Record<string, unknown>) => {
        // Delete page from DB
        const result = await hasura.query({
          query: `mutation($id: uuid!) {
            delete_pages_by_pk(id: $id) { id title }
          }`,
          variables: { id: args.page_id },
        })

        // Clean up pageBlocks from theme config if theme_id provided
        if (args.theme_id) {
          try {
            const { id: themeId, config } = await getThemeConfig(hasura, args.theme_id as string)
            if (config.pageBlocks?.[args.page_id as string]) {
              delete config.pageBlocks[args.page_id as string]
              await saveThemeConfig(hasura, themeId, config)
            }
          } catch { /* non-critical cleanup */ }
        }

        return result
      },
    },

    {
      name: 'studio_pages_reorder',
      description:
        'Sayfalarin sirasini toplu gunceller. Her sayfa icin yeni sort_order degeri gonderin.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          pages: {
            type: 'array',
            description: 'Siralama listesi (zorunlu). Her eleman: { page_id: string, sort_order: number }',
            items: {
              type: 'object',
              properties: {
                page_id: { type: 'string' },
                sort_order: { type: 'integer' },
              },
            },
          },
        },
        required: ['pages'],
      },
      handler: async (args: Record<string, unknown>) => {
        const pages = args.pages as Array<{ page_id: string; sort_order: number }>
        if (!pages?.length) throw new Error('En az bir sayfa gonderin')

        // Build individual update mutations aliased by index
        const mutations = pages.map((p, i) =>
          `p${i}: update_pages_by_pk(pk_columns: { id: "${p.page_id}" }, _set: { sort_order: ${p.sort_order} }) { id sort_order }`
        ).join('\n')

        return hasura.query({
          query: `mutation { ${mutations} }`,
          variables: {},
        })
      },
    },

    {
      name: 'studio_pages_set_homepage',
      description:
        'Atomik homepage atama — tum sayfalardaki is_homepage\'i temizler, belirtilen sayfayi homepage yapar.',
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

    // ═══════════════════════════════════════════════════════════════════════════
    // BLOK ONIZLEME — CMS verilerini preview icin ceker
    // ═══════════════════════════════════════════════════════════════════════════

    {
      name: 'studio_preview_services',
      description: 'Blok onizleme icin limitli servis listesi (services blogu verisi).',
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
      description: 'Blok onizleme icin limitli yayinlanmis haber listesi (news blogu verisi).',
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
      description: 'Blok onizleme icin limitli yayinlanmis blog yazisi listesi (blog blogu verisi).',
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
      description: 'Blok onizleme icin FAQ maddeleri (faq blogu verisi, maks 8).',
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
      description: 'Blok onizleme icin aktif ekip uyeleri listesi (team blogu verisi).',
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
      description: 'Blok onizleme icin aktif urun katalogu listesi (products blogu verisi).',
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

    // ═══════════════════════════════════════════════════════════════════════════
    // ONBOARDING — icerik doldurulma durumu
    // ═══════════════════════════════════════════════════════════════════════════

    {
      name: 'studio_onboarding_status',
      description:
        'Baslangic rehberi — tum icerik turlerinin doldurulma durumunu dondurur. ' +
        'Hangi bolumler dolu, hangileri bos: site_info, working_hours, contact_info, policies, ' +
        'pages, services, blog_posts, news, faq_items, members.',
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

    // ═══════════════════════════════════════════════════════════════════════════
    // TAM DURUM — editor icin tek cagirimda tum veri
    // ═══════════════════════════════════════════════════════════════════════════

    {
      name: 'studio_get_full_state',
      description:
        'Editor\'un tam durumunu tek cagirimda getirir: draft tema (config dahil), published tema, ' +
        'tum sayfalar ve onboarding durumu. AI\'nin storefront\'u anlamasi icin ilk cagri bu olmalidir.',
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
            pages(
              where: { product_id: { _eq: $product_id } }
              order_by: { sort_order: asc }
            ) {
              id title slug sort_order show_in_header show_in_footer
              is_homepage parent_id meta_title meta_description status
            }
            site_info(where: { product_id: { _eq: $product_id } }) {
              company_name company_description slogan logo_light logo_dark favicon
              footer_text footer_copyright website_url meta_description meta_keywords
            }
            contact_info(where: { product_id: { _eq: $product_id } }) {
              email phone address linkedin_url youtube_url twitter_url
              instagram_url facebook_url tiktok_url
            }
          }`,
          variables: { product_id: args.product_id },
        }),
    },

    {
      name: 'studio_get_page_with_blocks',
      description:
        'Bir sayfanin CMS bilgilerini VE bloklarini birlikte getirir. ' +
        'Sayfa detayi DB\'den, bloklar tema config\'inden okunur.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          product_id: { type: 'string', description: 'Urun ID (zorunlu)' },
          theme_id: { type: 'string', description: 'Draft tema UUID (zorunlu)' },
          page_id: { type: 'string', description: 'Sayfa UUID (zorunlu — slug DEGIL, studio_pages_list\'ten donen id kullanin)' },
        },
        required: ['product_id', 'theme_id', 'page_id'],
      },
      handler: async (args: Record<string, unknown>) => {
        // Fetch page from DB and theme config in parallel
        const [pageResult, themeData] = await Promise.all([
          hasura.query({
            query: `query($id: uuid!) {
              pages_by_pk(id: $id) {
                id title slug sort_order show_in_header show_in_footer
                is_homepage parent_id meta_title meta_description status created_at updated_at
              }
            }`,
            variables: { id: args.page_id },
          }),
          getThemeConfig(hasura, args.theme_id as string),
        ])

        const page = (pageResult as any)?.pages_by_pk
        const blocks = themeData.config.pageBlocks?.[args.page_id as string]?.blocks || []

        return {
          page,
          blocks,
          block_count: blocks.length,
          block_summary: blocks.map((b: any) => ({
            id: b.id,
            type: b.type,
            enabled: b.enabled,
            title: b.data?.title || b.data?.content?.slice(0, 50) || b.type,
          })),
        }
      },
    },
  ]
}
