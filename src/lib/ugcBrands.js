// src/lib/ugcBrands.js
// Brand UGC profiles — mirrors ugc.js pattern for characters

import { supabase } from '@/lib/supabase'

// ── Storage helpers ───────────────────────────────────────────

async function uploadBrandAsset(userId, brandId, assetKey, file) {
  const ext         = file.name.split('.').pop() || 'jpg'
  const storagePath = `${userId}/brands/${brandId}/${assetKey}.${ext}`

  const { error: upErr } = await supabase.storage
    .from('ugc-profiles')
    .upload(storagePath, file, { upsert: true, cacheControl: '3600' })

  if (upErr) throw new Error(upErr.message)

  const { data: { publicUrl } } = supabase.storage
    .from('ugc-profiles')
    .getPublicUrl(storagePath)

  return publicUrl
}

async function deleteBrandAsset(userId, brandId, assetKey) {
  // Try common extensions
  for (const ext of ['png', 'jpg', 'jpeg', 'webp', 'svg']) {
    const path = `${userId}/brands/${brandId}/${assetKey}.${ext}`
    await supabase.storage.from('ugc-profiles').remove([path])
  }
}

// ── CRUD ─────────────────────────────────────────────────────

export const ugcBrandProfiles = {
  getAll: async (userId) => {
    return supabase
      .from('ugc_brand_profiles')
      .select('*')
      .eq('user_id', userId)
      .neq('status', 'archived')
      .order('created_at', { ascending: false })
  },

  getById: async (brandId) => {
    return supabase
      .from('ugc_brand_profiles')
      .select('*')
      .eq('id', brandId)
      .single()
  },

  create: async (userId, payload) => {
    return supabase
      .from('ugc_brand_profiles')
      .insert({ user_id: userId, status: 'draft', ...payload })
      .select()
      .single()
  },

  update: async (brandId, payload) => {
    return supabase
      .from('ugc_brand_profiles')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', brandId)
      .select()
      .single()
  },

  activate: async (brandId) => {
    return supabase
      .from('ugc_brand_profiles')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .eq('id', brandId)
      .select()
      .single()
  },

  archive: async (brandId) => {
    return supabase
      .from('ugc_brand_profiles')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('id', brandId)
  },

  edit: async (brandId, payload) => {
    return supabase
      .from('ugc_brand_profiles')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', brandId)
      .select()
      .single()
  },

  uploadLogo: (userId, brandId, file) =>
    uploadBrandAsset(userId, brandId, 'logo', file),

  deleteLogo: (userId, brandId) =>
    deleteBrandAsset(userId, brandId, 'logo'),
}

// ── Brand generations (mirrors ugcGenerations) ────────────────

export const ugcBrandGenerations = {
  create: async (payload) => {
    return supabase
      .from('ugc_brand_generations')
      .insert(payload)
      .select()
      .single()
  },
}

// ── Brand products / services (photo library for "/" picker) ──

export const ugcBrandProducts = {
  getAll: async (brandId) => {
    return supabase
      .from('ugc_brand_products')
      .select('*')
      .eq('brand_id', brandId)
      .order('sort_order', { ascending: true })
  },

  getById: async (productId) => {
    return supabase
      .from('ugc_brand_products')
      .select('*')
      .eq('id', productId)
      .single()
  },

  create: async (payload) => {
    return supabase
      .from('ugc_brand_products')
      .insert(payload)
      .select()
      .single()
  },

  update: async (productId, payload) => {
    return supabase
      .from('ugc_brand_products')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', productId)
      .select()
      .single()
  },

  remove: async (productId) => {
    return supabase
      .from('ugc_brand_products')
      .delete()
      .eq('id', productId)
  },

  reorder: async (productId, sortOrder) => {
    return supabase
      .from('ugc_brand_products')
      .update({ sort_order: sortOrder, updated_at: new Date().toISOString() })
      .eq('id', productId)
      .select()
      .single()
  },

  uploadPhoto: (userId, brandId, productId, file) =>
    uploadBrandAsset(userId, brandId, `products/${productId}`, file),

  deletePhoto: (userId, brandId, productId) =>
    deleteBrandAsset(userId, brandId, `products/${productId}`),
}

// ── Wizard field options ──────────────────────────────────────

export const INDUSTRY_OPTIONS = [
  { value: 'fashion',           label: '👗 Fashion & Apparel'     },
  { value: 'beauty',            label: '💄 Beauty & Skincare'     },
  { value: 'food_beverage',     label: '🍽️ Food & Beverage'       },
  { value: 'health_wellness',   label: '💪 Health & Wellness'     },
  { value: 'tech',              label: '💻 Technology'            },
  { value: 'finance',           label: '💰 Finance & Fintech'     },
  { value: 'real_estate',       label: '🏠 Real Estate'           },
  { value: 'entertainment',     label: '🎬 Entertainment'         },
  { value: 'education',         label: '📚 Education'             },
  { value: 'ecommerce',         label: '🛒 E-Commerce'            },
  { value: 'automotive',        label: '🚗 Automotive'            },
  { value: 'travel',            label: '✈️ Travel & Hospitality'  },
  { value: 'sports',            label: '⚽ Sports & Fitness'      },
  { value: 'nonprofit',         label: '🤝 Non-Profit'            },
  { value: 'other',             label: '🔧 Other'                 },
]

export const BRAND_TONE_OPTIONS = [
  { value: 'bold',         label: '🔥 Bold'         },
  { value: 'luxurious',    label: '💎 Luxurious'    },
  { value: 'playful',      label: '😄 Playful'      },
  { value: 'trustworthy',  label: '🛡 Trustworthy'  },
  { value: 'innovative',   label: '🚀 Innovative'   },
  { value: 'minimal',      label: '⬜ Minimal'      },
  { value: 'authentic',    label: '🌱 Authentic'    },
  { value: 'rebellious',   label: '⚡ Rebellious'   },
  { value: 'warm',         label: '☀️ Warm'          },
  { value: 'professional', label: '💼 Professional' },
  { value: 'youthful',     label: '🎯 Youthful'     },
  { value: 'mysterious',   label: '🌙 Mysterious'   },
]

export const CONTENT_STYLE_OPTIONS = [
  { value: 'cinematic',    label: '🎬 Cinematic'     },
  { value: 'documentary',  label: '📽 Documentary'   },
  { value: 'lifestyle',    label: '🌅 Lifestyle'     },
  { value: 'product_focus',label: '📦 Product Focus' },
  { value: 'ugc_raw',      label: '📱 UGC / Raw'     },
  { value: 'editorial',    label: '🖼 Editorial'     },
  { value: 'animated',     label: '✨ Animated'      },
  { value: 'testimonial',  label: '💬 Testimonial'   },
]

export const PRICE_TIER_OPTIONS = [
  { value: 'budget',   label: '💚 Budget-friendly' },
  { value: 'mid',      label: '💛 Mid-range'       },
  { value: 'premium',  label: '🧡 Premium'         },
  { value: 'luxury',   label: '💎 Luxury'          },
]

export const AGE_RANGE_OPTIONS = [
  { value: '13_17',  label: '13–17'  },
  { value: '18_24',  label: '18–24'  },
  { value: '25_34',  label: '25–34'  },
  { value: '35_44',  label: '35–44'  },
  { value: '45_54',  label: '45–54'  },
  { value: '55_plus', label: '55+'   },
]

export const GENDER_AUDIENCE_OPTIONS = [
  { value: 'male',         label: 'Male'           },
  { value: 'female',       label: 'Female'         },
  { value: 'all',          label: 'All Genders'    },
  { value: 'non_binary',   label: 'Non-Binary'     },
]

export const PLATFORM_OPTIONS = [
  { value: 'instagram',  label: 'Instagram'  },
  { value: 'tiktok',     label: 'TikTok'     },
  { value: 'youtube',    label: 'YouTube'    },
  { value: 'twitter',    label: 'Twitter/X'  },
  { value: 'linkedin',   label: 'LinkedIn'   },
  { value: 'facebook',   label: 'Facebook'   },
  { value: 'pinterest',  label: 'Pinterest'  },
  { value: 'other',      label: 'Other'      },
]

export const OFFERING_TYPE_OPTIONS = [
  { value: 'products',  label: '📦 Products'          },
  { value: 'services',  label: '🛠 Services'          },
  { value: 'both',      label: '⚡ Products & Services' },
]

// Per-item type for individual ugc_brand_products rows — distinct from the
// brand-level OFFERING_TYPE_OPTIONS above, which describes the brand as a
// whole. This tags each library item so it renders correctly in the picker
// and gets described accurately to the model.
export const ITEM_TYPE_OPTIONS = [
  { value: 'product', label: '📦 Product' },
  { value: 'service', label: '🛠 Service' },
]

export const VISUAL_STYLE_OPTIONS = [
  { value: 'dark_moody',    label: '🖤 Dark & Moody'   },
  { value: 'light_airy',   label: '🤍 Light & Airy'   },
  { value: 'vibrant',      label: '🌈 Vibrant'        },
  { value: 'monochrome',   label: '⬛ Monochrome'     },
  { value: 'earthy',       label: '🍂 Earthy Tones'   },
  { value: 'neon',         label: '💡 Neon / Cyber'   },
  { value: 'pastel',       label: '🌸 Pastel'         },
  { value: 'film_grain',   label: '📷 Film / Grain'   },
]

export const BRAND_CREDIT_COST = 100
export const MAX_BRAND_PRODUCTS = 10
