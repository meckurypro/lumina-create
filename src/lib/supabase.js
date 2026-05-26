import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
})

export const auth = {
  signUpWithEmail: (email) => supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/auth/callback` } }),
  verifyOTP: (email, token) => supabase.auth.verifyOtp({ email, token, type: 'email' }),
  signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
  signInWithGoogle: () => supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/auth/callback`, queryParams: { access_type: 'offline', prompt: 'consent' } } }),
  signOut: () => supabase.auth.signOut(),
  resetPassword: (email) => supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` }),
  updatePassword: (newPassword) => supabase.auth.updateUser({ password: newPassword }),
  getSession: () => supabase.auth.getSession(),
  getUser: () => supabase.auth.getUser(),
  exchangeCodeForSession: (code) => supabase.auth.exchangeCodeForSession(code),
}

export const profiles = {
  getById: (userId) => supabase.from('profiles').select('*').eq('id', userId).single(),
  getByUsername: (username) => supabase.from('profiles').select('id, username, display_name, avatar_url, bio, tier, total_generations, created_at').eq('username', username).single(),
  update: (userId, updates) => supabase.from('profiles').update(updates).eq('id', userId).select().single(),
  checkUsername: async (username) => {
    const { data, error } = await supabase.from('profiles').select('username').eq('username', username).maybeSingle()
    return { available: !data && !error, error }
  },
  completeOnboarding: (userId, payload) => supabase.from('profiles').update({ ...payload, onboarding_completed: true }).eq('id', userId).select().single(),
}

export const userRoles = {
  getForUser: async (userId) => {
    const { data, error } = await supabase.from('user_roles').select('role').eq('user_id', userId)
    if (error) return { data: [], error }
    return { data: data?.map((r) => r.role) || [], error: null }
  },
}

export const templates = {
  getPublic: () => supabase.from('templates').select('*').eq('is_active', true).eq('visibility', 'public').order('sort_order'),
  getAll: () => supabase.from('templates').select('*').eq('is_active', true).order('sort_order'),
  getPromptIQ: () => supabase.from('templates').select('*').eq('is_active', true).eq('visibility', 'promptiq').order('sort_order'),
  getBySlug: (slug) => supabase.from('templates').select('*').eq('slug', slug).eq('is_active', true).single(),
  getFeatured: () => supabase.from('templates').select('*').eq('is_active', true).eq('is_featured', true).order('sort_order'),
  toggleVisibility: (adminId, templateId) => supabase.rpc('toggle_template_visibility', { p_admin_id: adminId, p_template_id: templateId }),
  adminUpdate: (templateId, updates) => supabase.from('templates').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', templateId).select().single(),
}

export const templatePrompts = {
  getVersions: (templateId) => supabase.from('template_prompts').select('*').eq('template_id', templateId).order('version_number', { ascending: false }),
  getActive: (templateSlug) => supabase.rpc('get_active_prompt', { p_template_slug: templateSlug }),
  saveVersion: (adminId, templateId, promptText, notes) => supabase.rpc('save_prompt_version', { p_admin_id: adminId, p_template_id: templateId, p_prompt_text: promptText, p_notes: notes || null }),
  rollback: (adminId, promptId) => supabase.rpc('rollback_prompt_version', { p_admin_id: adminId, p_prompt_id: promptId }),
}

export const templateAssets = {
  BUCKET: 'template-assets',
  getForTemplate: (templateId) => supabase.from('template_assets').select('*').eq('template_id', templateId).order('created_at', { ascending: false }),
  upload: async (templateId, file, assetKey) => {
    const ext = file.name.split('.').pop()
    const path = `${templateId}/${assetKey}.${ext}`
    const { error: storageErr } = await supabase.storage.from('template-assets').upload(path, file, { upsert: true, cacheControl: '3600' })
    if (storageErr) return { url: null, error: storageErr }
    const { data: { publicUrl } } = supabase.storage.from('template-assets').getPublicUrl(path)
    const { data, error: dbErr } = await supabase.from('template_assets').upsert({ template_id: templateId, asset_key: assetKey, file_name: file.name, file_type: file.type, storage_path: path, public_url: publicUrl, updated_at: new Date().toISOString() }, { onConflict: 'template_id,asset_key' }).select().single()
    return { url: publicUrl, data, error: dbErr }
  },
  delete: async (templateId, assetKey, storagePath) => {
    await supabase.storage.from('template-assets').remove([storagePath])
    return supabase.from('template_assets').delete().eq('template_id', templateId).eq('asset_key', assetKey)
  },
  getPublicUrl: (storagePath) => supabase.storage.from('template-assets').getPublicUrl(storagePath).data.publicUrl,
}

export const generations = {
  create: (data) => supabase.from('generations').insert(data).select().single(),
  update: (id, updates) => supabase.from('generations').update(updates).eq('id', id).select().single(),
  getById: (id) => supabase.from('generations').select('*, templates(name, slug)').eq('id', id).single(),
  getUserGenerations: (userId, { limit = 20, offset = 0 } = {}) => supabase.from('generations').select('*, templates(name, slug, thumbnail_url)', { count: 'exact' }).eq('user_id', userId).order('created_at', { ascending: false }).range(offset, offset + limit - 1),
  deductCredits: (userId, amount, generationId) => supabase.rpc('deduct_credits', { p_user_id: userId, p_amount: amount, p_generation_id: generationId }),
  deductStaffPool: (staffId, generationId, amount, templateId) => supabase.rpc('deduct_staff_pool', { p_staff_id: staffId, p_generation_id: generationId, p_amount: amount, p_template_id: templateId || null }),
}

export const feed = {
  // Trending posts — decay-weighted by likes + views + recency
  // Used on the main FeedPage (limited, no pagination)
  getTrending: ({ limit = 8 } = {}) =>
    supabase
      .from('feed_posts')
      .select('*, profiles!feed_posts_user_id_fkey(username, display_name, avatar_url), templates(name, slug)')
      .eq('status', 'approved')
      .order('likes_count', { ascending: false })
      .order('published_at', { ascending: false })
      .limit(limit),
  // All community posts — chronological, paginated
  // Used on CommunityFeedPage (infinite scroll)
  getAllCommunity: ({ limit = 20, offset = 0 } = {}) =>
    supabase
      .from('feed_posts')
      .select('*, profiles!feed_posts_user_id_fkey(username, display_name, avatar_url), templates(name, slug)', { count: 'exact' })
      .eq('status', 'approved')
      .order('published_at', { ascending: false })
      .range(offset, offset + limit - 1),
  // Keep getPosts for backward compat (ResultPage etc. may use it)
  getPosts: ({ limit = 20, offset = 0, templateId = null } = {}) => {
    let q = supabase
      .from('feed_posts')
      .select('*, profiles!feed_posts_user_id_fkey(username, display_name, avatar_url), templates(name, slug)', { count: 'exact' })
      .eq('status', 'approved')
      .order('published_at', { ascending: false })
      .range(offset, offset + limit - 1)
    if (templateId) q = q.eq('template_id', templateId)
    return q
  },
  submit: (data) => supabase.from('feed_posts').insert({ ...data, status: 'pending' }),
  toggleLike: (userId, postId) =>
    supabase.rpc('toggle_feed_like', { p_user_id: userId, p_post_id: postId }),
  getUserLikes: async (userId) => {
    const { data, error } = await supabase.from('feed_likes').select('post_id').eq('user_id', userId)
    return { data: data?.map((l) => l.post_id) || [], error }
  },
}

export const credits = {
  getPackages: () => supabase.from('credit_packages').select('*').eq('is_active', true).order('sort_order'),
  getTransactions: (userId, { limit = 20, offset = 0 } = {}) => supabase.from('credit_transactions').select('*', { count: 'exact' }).eq('user_id', userId).order('created_at', { ascending: false }).range(offset, offset + limit - 1),
  addCredits: ({ userId, amount, bonusAmount, paymentRef, amountNgn }) => supabase.rpc('add_credits', { p_user_id: userId, p_amount: amount, p_bonus_amount: bonusAmount || 0, p_payment_reference: paymentRef, p_payment_provider: 'paystack', p_amount_ngn: amountNgn, p_description: 'Credit pack purchase' }),
}

export const staff = {
  promote: (adminId, userId, note) => supabase.rpc('promote_to_staff', { p_admin_id: adminId, p_user_id: userId, p_note: note || null }),
  demote: (adminId, userId) => supabase.rpc('demote_from_staff', { p_admin_id: adminId, p_user_id: userId }),
  getSummary: () => supabase.rpc('get_staff_summary'),
  getMyActivity: (staffId, { limit = 20, offset = 0 } = {}) => supabase.from('staff_activity').select('*, templates(name, slug)', { count: 'exact' }).eq('staff_id', staffId).order('created_at', { ascending: false }).range(offset, offset + limit - 1),
  getPoolBalance: async () => {
    const { data: setting } = await supabase.from('app_settings').select('value').eq('key', 'staff_pool_user_id').single()
    if (!setting?.value) return { balance: null, error: 'Pool not configured' }
    const { data, error } = await supabase.from('profiles').select('credits, username').eq('id', setting.value).single()
    return { balance: data?.credits ?? null, username: data?.username, error }
  },
}

export const notifications = {
  getAll: (userId, { limit = 30 } = {}) => supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(limit),
  markRead: (id) => supabase.from('notifications').update({ is_read: true }).eq('id', id),
  markAllRead: (userId) => supabase.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false),
}
