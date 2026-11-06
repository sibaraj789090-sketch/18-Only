import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Video, Category, Comment, SupabaseConfig } from '../types/database';
import { TEMPORARY_DEMO_VIDEO, isDemoVideo } from './demoVideo';

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'all', name: 'All' },
  { id: 'hindi', name: 'Hindi' },
  { id: 'english', name: 'English' },
  { id: 'entertainment', name: 'Entertainment' },
  { id: 'education', name: 'Education' },
  { id: 'technology', name: 'Technology' },
  { id: 'music', name: 'Music' },
  { id: 'other', name: 'Other' },
];

export let cachedCategories: Category[] = [...DEFAULT_CATEGORIES];

export function findCategoryRecord(identifier?: string | number | Category | null): Category | undefined {
  if (identifier === undefined || identifier === null) return undefined;
  if (typeof identifier === 'object' && identifier !== null) {
    if ('name' in identifier) return identifier as Category;
  }
  const str = String(identifier).trim().toLowerCase();
  return (
    cachedCategories.find(
      (c) =>
        String(c.id).toLowerCase() === str ||
        c.name.toLowerCase() === str ||
        (c.slug && c.slug.toLowerCase() === str)
    ) ||
    DEFAULT_CATEGORIES.find(
      (c) =>
        String(c.id).toLowerCase() === str ||
        c.name.toLowerCase() === str ||
        (c.slug && c.slug.toLowerCase() === str)
    )
  );
}

export let cachedColumns: Set<string> | null = null;

export async function getVideosTableColumns(client?: SupabaseClient | null): Promise<Set<string> | null> {
  if (cachedColumns && cachedColumns.size > 0) return cachedColumns;
  const supabase = client || getSupabaseClient();
  if (!supabase) return null;
  try {
    const { data } = await supabase.from('videos').select('*').limit(1);
    if (data && data.length > 0 && typeof data[0] === 'object') {
      cachedColumns = new Set(Object.keys(data[0]));
      return cachedColumns;
    }
  } catch {}
  return null;
}

export function normalizeVideo(v: any): Video {
  if (!v) return v;
  const rawCat = v.category;
  const catObj = findCategoryRecord(
    v.category_id || (typeof rawCat === 'object' ? rawCat?.name : rawCat)
  );
  const categoryName =
    typeof rawCat === 'string' && rawCat.trim()
      ? rawCat.trim()
      : catObj
      ? catObj.name
      : v.category_id
      ? String(v.category_id)
      : 'General';

  return {
    ...v,
    id: v.id ?? ('vid_' + Math.random().toString(36).substring(2, 9)),
    title: v.title || 'Untitled Video',
    description: v.description || '',
    video_url: v.video_url || v.url || v.video_path || '',
    thumbnail_url: v.thumbnail_url || v.thumbnail || v.poster_url || null,
    category: categoryName,
    category_id: v.category_id ?? (catObj ? catObj.id : null),
    views: typeof v.views === 'number' ? v.views : 0,
    duration: v.duration ? String(v.duration) : '',
    is_published: v.is_published ?? (v.published ?? true),
    featured: v.featured ?? false,
    author_name: v.author_name || v.author || '18+Only Creator',
  };
}

const STORAGE_KEY_URL = '18plus_supabase_url';
const STORAGE_KEY_ANON = '18plus_supabase_anon_key';

function isValidHttpUrl(string?: string | null): boolean {
  if (!string) return false;
  const trimmed = string.trim();
  if (
    trimmed.includes('your-project') ||
    trimmed.includes('xyzcompany') ||
    trimmed.includes('example.supabase.co') ||
    trimmed.includes('placeholder')
  ) {
    return false;
  }
  try {
    const url = new URL(trimmed);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isValidAnonKey(key?: string | null): boolean {
  if (!key) return false;
  const trimmed = key.trim();
  return (
    trimmed.length > 20 &&
    !trimmed.includes('your-anon-key') &&
    !trimmed.includes('placeholder')
  );
}

export function getSupabaseCredentials(): SupabaseConfig {
  const envUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
  const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

  const localUrl = typeof window !== 'undefined' ? (localStorage.getItem(STORAGE_KEY_URL) || '').trim() : '';
  const localKey = typeof window !== 'undefined' ? (localStorage.getItem(STORAGE_KEY_ANON) || '').trim() : '';

  if (isValidHttpUrl(envUrl) && isValidAnonKey(envKey)) {
    return {
      url: envUrl,
      anonKey: envKey,
      isConfigured: true,
      source: 'env',
    };
  }

  if (isValidHttpUrl(localUrl) && isValidAnonKey(localKey)) {
    return {
      url: localUrl,
      anonKey: localKey,
      isConfigured: true,
      source: 'localStorage',
    };
  }

  return {
    url: envUrl || localUrl || '',
    anonKey: envKey || localKey || '',
    isConfigured: false,
    source: 'none',
  };
}

export function saveSupabaseCredentials(url: string, anonKey: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY_URL, url.trim());
    localStorage.setItem(STORAGE_KEY_ANON, anonKey.trim());
    supabaseClientInstance = null; // reset singleton
  }
}

export function clearSupabaseCredentials() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY_URL);
    localStorage.removeItem(STORAGE_KEY_ANON);
    supabaseClientInstance = null;
  }
}

let supabaseClientInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  const creds = getSupabaseCredentials();
  if (!creds.isConfigured || !creds.url || !creds.anonKey) {
    return null;
  }

  if (!supabaseClientInstance) {
    try {
      supabaseClientInstance = createClient(creds.url, creds.anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      });
    } catch (err) {
      console.warn('Could not initialize Supabase client:', err);
      return null;
    }
  }

  return supabaseClientInstance;
}

/**
 * Detects whether a URL is an external link (http://, https://, blob:, data:).
 * External URLs play directly in the HTML5 player and are never passed through Supabase storage.
 */
export function isExternalUrl(url?: string | null): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  return (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('data:')
  );
}

/**
 * Resolves a video or thumbnail URL.
 * External URLs are returned directly as-is.
 * Relative paths stored in the public 'videos' bucket are resolved with the Supabase project storage URL.
 */
export function resolveMediaUrl(pathOrUrl?: string | null, bucket = 'videos'): string {
  if (!pathOrUrl) return '';
  const trimmed = pathOrUrl.trim();

  if (isExternalUrl(trimmed)) {
    return trimmed;
  }

  const creds = getSupabaseCredentials();
  if (!creds.url) return trimmed;

  const cleanUrl = creds.url.replace(/\/+$/, '');
  const cleanPath = trimmed.replace(/^\/+/, '');
  return `${cleanUrl}/storage/v1/object/public/${bucket}/${cleanPath}`;
}

/**
 * Fetch categories dynamically from the 'categories' table.
 */
export async function fetchCategories(): Promise<Category[]> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return DEFAULT_CATEGORIES;
  }

  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name', { ascending: true });

    if (error || !data || data.length === 0) {
      cachedCategories = [...DEFAULT_CATEGORIES];
      return DEFAULT_CATEGORIES;
    }

    cachedCategories = [...data];
    // Ensure 'All' is at the top
    const hasAll = data.some((c) => c.name.toLowerCase() === 'all');
    if (!hasAll) {
      return [{ id: 'all', name: 'All' }, ...data];
    }
    return data;
  } catch (err) {
    console.warn('Error fetching categories from Supabase, using defaults:', err);
    cachedCategories = [...DEFAULT_CATEGORIES];
    return DEFAULT_CATEGORIES;
  }
}

export interface FetchVideosOptions {
  categoryId?: string | number | null;
  searchQuery?: string;
  limit?: number;
  offset?: number;
  featuredOnly?: boolean;
}

/**
 * Fetch published videos from Supabase with flexible fallback for column variations.
 */
export async function fetchVideos(options: FetchVideosOptions = {}): Promise<{ videos: Video[]; count: number }> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { videos: [], count: 0 };
  }

  const limit = options.limit ?? 12;
  const offset = options.offset ?? 0;
  const cols = await getVideosTableColumns(supabase);

  try {
    // Attempt query with is_published filtering
    let query = supabase
      .from('videos')
      .select('*', { count: 'exact' });

    // Try filtering is_published: true
    if (!cols || cols.has('is_published')) {
      query = query.eq('is_published', true);
    } else if (cols.has('published')) {
      query = query.eq('published', true);
    }

    if (options.featuredOnly) {
      if (!cols || cols.has('featured')) {
        query = query.eq('featured', true);
      }
    }

    if (options.categoryId && options.categoryId !== 'all') {
      const catObj = findCategoryRecord(options.categoryId);
      const catId = catObj ? catObj.id : options.categoryId;
      const catName = catObj ? catObj.name : String(options.categoryId);

      if (cols) {
        if (cols.has('category_id') && cols.has('category')) {
          query = query.or(`category_id.eq.${catId},category.ilike.%${catName}%`);
        } else if (cols.has('category_id')) {
          query = query.eq('category_id', catId);
        } else if (cols.has('category')) {
          query = query.ilike('category', `%${catName}%`);
        }
      } else {
        query = query.eq('category_id', catId);
      }
    }

    if (options.searchQuery && options.searchQuery.trim()) {
      const q = options.searchQuery.trim();
      query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`);
    }

    if (!cols || cols.has('created_at')) {
      query = query.order('created_at', { ascending: false });
    }
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.warn('Notice: Primary fetchVideos query returned error, applying safe fallback:', error.message);

      const missingMatch = error.message.match(/Could not find the '([^']+)' column/i);
      if (missingMatch && missingMatch[1] && cachedColumns) {
        cachedColumns.delete(missingMatch[1]);
      }

      let retryQuery = supabase
        .from('videos')
        .select('*', { count: 'exact' });

      if (options.searchQuery && options.searchQuery.trim()) {
        const q = options.searchQuery.trim();
        retryQuery = retryQuery.ilike('title', `%${q}%`);
      }

      retryQuery = retryQuery.range(offset, offset + limit - 1);
      const retryResult = await retryQuery;

      if (!retryResult.error && retryResult.data) {
        if (retryResult.data.length > 0 && typeof retryResult.data[0] === 'object') {
          cachedColumns = new Set(Object.keys(retryResult.data[0]));
        }
        let list = retryResult.data.map(normalizeVideo);
        if (options.categoryId && options.categoryId !== 'all') {
          const target = String(options.categoryId).toLowerCase();
          list = list.filter(
            (v) =>
              String(v.category_id).toLowerCase() === target ||
              (typeof v.category === 'string' && v.category.toLowerCase() === target)
          );
        }
        return { videos: list, count: retryResult.count ?? list.length };
      }

      return { videos: [], count: 0 };
    }

    if (data && data.length > 0 && typeof data[0] === 'object') {
      cachedColumns = new Set(Object.keys(data[0]));
    }

    return {
      videos: (data || []).map(normalizeVideo),
      count: count ?? (data?.length || 0),
    };
  } catch (err) {
    console.warn('Notice: Network error fetching videos from Supabase:', err);
    return { videos: [], count: 0 };
  }
}

/**
 * Fetch a single video by ID
 */
export async function fetchVideoById(id: string | number): Promise<Video | null> {
  if (isDemoVideo(id)) {
    return TEMPORARY_DEMO_VIDEO;
  }

  const supabase = getSupabaseClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      console.warn('Video not found:', error?.message);
      return null;
    }

    return normalizeVideo(data);
  } catch (err) {
    console.warn('Notice: fetchVideoById error:', err);
    return null;
  }
}

/**
 * Increment view count for a video.
 */
export async function incrementVideoViews(video: Video): Promise<number> {
  const currentViews = video.views ?? 0;
  const newViews = currentViews + 1;

  if (isDemoVideo(video.id)) {
    return newViews;
  }

  const supabase = getSupabaseClient();
  if (!supabase) return newViews;

  try {
    // Attempt standard update
    await supabase
      .from('videos')
      .update({ views: newViews })
      .eq('id', video.id);
  } catch (err) {
    console.warn('Could not increment view count on server (RLS or column restriction):', err);
  }

  return newViews;
}

/**
 * Fetch comments for a specific video.
 */
export async function fetchVideoComments(videoId: string | number): Promise<Comment[]> {
  if (isDemoVideo(videoId)) {
    return [
      {
        id: 'demo-comment-1',
        video_id: TEMPORARY_DEMO_VIDEO.id,
        user_name: 'Ad Tester',
        comment_text: 'HilltopAds VAST 3.0 pre-roll ad and player test comment.',
        created_at: new Date(Date.now() - 1800000).toISOString(),
      },
    ];
  }

  const supabase = getSupabaseClient();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .eq('video_id', videoId)
      .order('created_at', { ascending: false });

    if (error || !data) {
      return [];
    }

    // Normalize comment fields if column is content instead of comment_text
    return data.map((item: Record<string, unknown>) => ({
      id: (item.id as string | number) || Math.random().toString(),
      video_id: videoId,
      user_name: (item.user_name as string) || (item.author as string) || 'Anonymous Viewer',
      comment_text: (item.comment_text as string) || (item.content as string) || (item.text as string) || '',
      created_at: (item.created_at as string) || new Date().toISOString(),
    }));
  } catch (err) {
    console.warn('Error fetching comments:', err);
    return [];
  }
}

/**
 * Post a new comment for a video.
 */
export async function postVideoComment(
  videoId: string | number,
  userName: string,
  commentText: string
): Promise<{ success: boolean; comment?: Comment; error?: string }> {
  if (isDemoVideo(videoId)) {
    return {
      success: true,
      comment: {
        id: 'demo-comment-' + Date.now(),
        video_id: TEMPORARY_DEMO_VIDEO.id,
        user_name: userName.trim() || 'Anonymous Viewer',
        comment_text: commentText.trim(),
        created_at: new Date().toISOString(),
      },
    };
  }

  const supabase = getSupabaseClient();
  const fallbackComment: Comment = {
    id: 'local-' + Date.now(),
    video_id: videoId,
    user_name: userName.trim() || 'Anonymous Viewer',
    comment_text: commentText.trim(),
    created_at: new Date().toISOString(),
  };

  if (!supabase) {
    return { success: true, comment: fallbackComment };
  }

  try {
    // Insert into comments table
    const { data, error } = await supabase
      .from('comments')
      .insert([
        {
          video_id: videoId,
          user_name: userName.trim() || 'Anonymous Viewer',
          comment_text: commentText.trim(),
        },
      ])
      .select()
      .single();

    if (error) {
      // Try with content column if comment_text failed
      const retry = await supabase
        .from('comments')
        .insert([
          {
            video_id: videoId,
            user_name: userName.trim() || 'Anonymous Viewer',
            content: commentText.trim(),
          },
        ])
        .select()
        .single();

      if (retry.error) {
        return { success: false, error: retry.error.message };
      }

      return {
        success: true,
        comment: {
          id: retry.data.id,
          video_id: videoId,
          user_name: retry.data.user_name || userName,
          comment_text: retry.data.content || commentText,
          created_at: retry.data.created_at || new Date().toISOString(),
        },
      };
    }

    return {
      success: true,
      comment: {
        id: data.id,
        video_id: videoId,
        user_name: data.user_name || userName,
        comment_text: data.comment_text || commentText,
        created_at: data.created_at || new Date().toISOString(),
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to post comment';
    return { success: false, error: message };
  }
}

/**
 * Diagnostics function to test Supabase connection and table availability.
 */
export async function testSupabaseConnection(): Promise<{
  connected: boolean;
  message: string;
  tables: {
    videos: { exists: boolean; count?: number; error?: string };
    categories: { exists: boolean; count?: number; error?: string };
    comments: { exists: boolean; error?: string };
    admin_users: { exists: boolean; error?: string };
  };
  storageBucket: { exists: boolean; note?: string };
}> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return {
      connected: false,
      message: 'Supabase URL or Anon Key is missing. Configure in .env or via Settings.',
      tables: {
        videos: { exists: false },
        categories: { exists: false },
        comments: { exists: false },
        admin_users: { exists: false },
      },
      storageBucket: { exists: false, note: 'Not connected' },
    };
  }

  const results = {
    connected: false,
    message: '',
    tables: {
      videos: { exists: false } as { exists: boolean; count?: number; error?: string },
      categories: { exists: false } as { exists: boolean; count?: number; error?: string },
      comments: { exists: false } as { exists: boolean; error?: string },
      admin_users: { exists: false } as { exists: boolean; error?: string },
    },
    storageBucket: { exists: true, note: 'Public "videos" bucket expected for streaming' },
  };

  try {
    // 1. Test videos table
    const { count: vCount, error: vErr } = await supabase
      .from('videos')
      .select('*', { count: 'exact', head: true });

    if (vErr) {
      results.tables.videos = { exists: false, error: vErr.message };
    } else {
      results.tables.videos = { exists: true, count: vCount ?? 0 };
      try {
        const { data: sampleRow } = await supabase.from('videos').select('*').limit(1);
        if (sampleRow && sampleRow.length > 0 && typeof sampleRow[0] === 'object') {
          cachedColumns = new Set(Object.keys(sampleRow[0]));
        }
      } catch {}
    }

    // 2. Test categories table
    const { count: cCount, error: cErr } = await supabase
      .from('categories')
      .select('*', { count: 'exact', head: true });

    if (cErr) {
      results.tables.categories = { exists: false, error: cErr.message };
    } else {
      results.tables.categories = { exists: true, count: cCount ?? 0 };
    }

    // 3. Test comments table
    const { error: comErr } = await supabase
      .from('comments')
      .select('id', { head: true, count: 'exact' });

    results.tables.comments = {
      exists: !comErr,
      error: comErr ? comErr.message : undefined,
    };

    // 4. Test admin_users table (without exposing data or breaking RLS)
    const { error: admErr } = await supabase
      .from('admin_users')
      .select('id', { head: true, count: 'exact' });

    results.tables.admin_users = {
      exists: !admErr,
      error: admErr ? admErr.message : undefined,
    };

    results.connected = results.tables.videos.exists || results.tables.categories.exists;
    results.message = results.connected
      ? 'Successfully connected to your Supabase project!'
      : 'Supabase responded, but tables may need RLS policies or creation.';

    return results;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown connection error';
    return {
      ...results,
      connected: false,
      message: `Connection failed: ${errorMsg}`,
    };
  }
}

// ========================================================
// ADMIN SYSTEM AUTHENTICATION & CRUD OPERATIONS
// ========================================================

/**
 * Strict Security Lockdown: Only the verified owner Gmail is permitted to access the admin portal.
 * Any other Gmail or email account is strictly rejected.
 */
export const AUTHORIZED_ADMIN_EMAILS: string[] = ['ladandas22@gmail.com'];

export async function signInAdmin(
  email: string,
  pass: string
): Promise<{ success: boolean; user?: any; error?: string }> {
  const cleanEmail = email.trim().toLowerCase();

  // Strict check: Block any unauthorized Gmail or other email upfront
  if (!AUTHORIZED_ADMIN_EMAILS.includes(cleanEmail)) {
    return {
      success: false,
      error: `Access Denied: Only the verified administrator email (${AUTHORIZED_ADMIN_EMAILS[0]}) is authorized to log into this portal. Other accounts are strictly blocked.`,
    };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Supabase client is not configured.' };
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: pass,
    });

    if (error || !data.user) {
      return { success: false, error: error?.message || 'Invalid credentials' };
    }

    // Verify authorized presence in admin_users table
    let isAuthorized = false;

    try {
      const { data: byEmail } = await supabase
        .from('admin_users')
        .select('*')
        .eq('email', cleanEmail)
        .maybeSingle();
      if (byEmail) isAuthorized = true;
    } catch {}

    if (!isAuthorized) {
      try {
        const { data: byId } = await supabase
          .from('admin_users')
          .select('*')
          .eq('id', data.user.id)
          .maybeSingle();
        if (byId) isAuthorized = true;
      } catch {}
    }

    if (!isAuthorized) {
      try {
        const { data: byUserId } = await supabase
          .from('admin_users')
          .select('*')
          .eq('user_id', data.user.id)
          .maybeSingle();
        if (byUserId) isAuthorized = true;
      } catch {}
    }

    if (!isAuthorized) {
      try {
        const { count } = await supabase
          .from('admin_users')
          .select('*', { count: 'exact', head: true });

        // If the table is empty (initial project setup), auto-register the verified owner
        if (count === 0 || count === null) {
          await supabase.from('admin_users').insert([
            { id: data.user.id, email: cleanEmail, role: 'superadmin' }
          ]);
          isAuthorized = true;
        }
      } catch {}
    }

    if (!isAuthorized) {
      // If table exists but user is not in admin_users, reject access
      await supabase.auth.signOut();
      return {
        success: false,
        error: `Access Denied: ${cleanEmail} is not registered in the admin_users table.`,
      };
    }

    return { success: true, user: data.user };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Login failed';
    return { success: false, error: message };
  }
}

export async function resetAdminPassword(email: string): Promise<{ success: boolean; message: string }> {
  const cleanEmail = email.trim().toLowerCase();

  // Strict check: Block password resets for any other email
  if (!AUTHORIZED_ADMIN_EMAILS.includes(cleanEmail)) {
    return {
      success: false,
      message: `Access Denied: Password reset is restricted strictly to ${AUTHORIZED_ADMIN_EMAILS[0]}.`,
    };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, message: 'Supabase client is not configured.' };
  }

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/admin/siba` : undefined,
    });
    if (error) {
      return { success: false, message: error.message };
    }
    return { success: true, message: `Password reset email sent to ${cleanEmail}! Check your Gmail inbox.` };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to send reset email';
    return { success: false, message: msg };
  }
}

export async function signOutAdmin(): Promise<void> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase.auth.signOut();
    } catch {}
  }
}

export async function verifyCurrentAdminUser(): Promise<any | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  try {
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) return null;

    const userEmail = (user.email || '').trim().toLowerCase();
    // Strict lockdown: verify email belongs to AUTHORIZED_ADMIN_EMAILS
    if (!AUTHORIZED_ADMIN_EMAILS.includes(userEmail)) {
      await supabase.auth.signOut();
      return null;
    }

    let isAuthorized = false;

    try {
      const { data: byEmail } = await supabase
        .from('admin_users')
        .select('*')
        .eq('email', userEmail)
        .maybeSingle();
      if (byEmail) isAuthorized = true;
    } catch {}

    if (!isAuthorized) {
      try {
        const { data: byId } = await supabase
          .from('admin_users')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();
        if (byId) isAuthorized = true;
      } catch {}
    }

    if (!isAuthorized) {
      try {
        const { data: byUserId } = await supabase
          .from('admin_users')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();
        if (byUserId) isAuthorized = true;
      } catch {}
    }

    if (!isAuthorized) {
      try {
        const { count } = await supabase
          .from('admin_users')
          .select('*', { count: 'exact', head: true });

        if (count === 0 || count === null) {
          await supabase.from('admin_users').insert([
            { id: user.id, email: userEmail, role: 'superadmin' }
          ]);
          isAuthorized = true;
        }
      } catch {}
    }

    if (!isAuthorized) {
      return null;
    }

    return user;
  } catch {
    return null;
  }
}

export async function fetchAllAdminVideos(): Promise<Video[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  try {
    let { data, error } = await supabase
      .from('videos')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      // Retry without order('created_at') in case created_at column doesn't exist
      const retry = await supabase.from('videos').select('*');
      data = retry.data;
      error = retry.error;
    }

    if (error || !data) {
      console.warn('Error fetching admin videos:', error?.message);
      return [];
    }

    if (data.length > 0 && typeof data[0] === 'object') {
      cachedColumns = new Set(Object.keys(data[0]));
    }

    return data.map(normalizeVideo);
  } catch (err) {
    console.warn('Notice: fetchAllAdminVideos error:', err);
    return [];
  }
}

export async function createAdminVideo(videoData: Partial<Video>): Promise<{ success: boolean; video?: Video; error?: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { success: false, error: 'Database not connected' };

  try {
    const cols = await getVideosTableColumns(supabase);
    const catObj = findCategoryRecord(videoData.category || videoData.category_id);
    const catName = typeof videoData.category === 'object'
      ? videoData.category?.name
      : (videoData.category || (catObj ? catObj.name : 'Entertainment'));
    const catId = videoData.category_id ?? (catObj ? catObj.id : null);

    const payload: Record<string, any> = {
      title: videoData.title,
    };

    if (!cols || cols.has('description')) {
      payload.description = videoData.description || '';
    }

    // Video URL mapping (support video_url or url)
    if (cols && !cols.has('video_url') && cols.has('url')) {
      payload.url = videoData.video_url;
    } else {
      payload.video_url = videoData.video_url;
    }

    // Thumbnail URL mapping
    if (cols && !cols.has('thumbnail_url') && cols.has('thumbnail')) {
      payload.thumbnail = videoData.thumbnail_url || null;
    } else if (cols && !cols.has('thumbnail_url') && cols.has('poster_url')) {
      payload.poster_url = videoData.thumbnail_url || null;
    } else {
      payload.thumbnail_url = videoData.thumbnail_url || null;
    }

    // Category handling: if table has category column, include it; if table has category_id, include it
    if (cols) {
      if (cols.has('category')) {
        payload.category = catName;
      }
      if (cols.has('category_id') && catId !== null && catId !== undefined) {
        payload.category_id = catId;
      }
    } else {
      // If schema unknown, start with category_id if available, and category
      if (catId !== null && catId !== undefined) {
        payload.category_id = catId;
      }
      if (!payload.category_id) {
        payload.category = catName;
      }
    }

    if (!cols || cols.has('views')) {
      payload.views = videoData.views || 0;
    }

    if (videoData.duration && (!cols || cols.has('duration'))) {
      payload.duration = videoData.duration;
    }

    if (cols && !cols.has('is_published') && cols.has('published')) {
      payload.published = videoData.is_published ?? true;
    } else if (!cols || cols.has('is_published')) {
      payload.is_published = videoData.is_published ?? true;
    }

    if (!cols || cols.has('featured')) {
      payload.featured = videoData.featured ?? false;
    }

    if (cols && !cols.has('author_name') && cols.has('author')) {
      payload.author = videoData.author_name || '18+Only Creator';
    } else if (!cols || cols.has('author_name')) {
      payload.author_name = videoData.author_name || '18+Only Creator';
    }

    const workingPayload = { ...payload };
    let attempts = 0;
    let lastError = 'Failed to create video';

    while (attempts < 15) {
      attempts++;

      const { data, error } = await supabase
        .from('videos')
        .insert([workingPayload])
        .select();

      if (!error) {
        if (data && data.length > 0) {
          cachedColumns = new Set(Object.keys(data[0]));
          return { success: true, video: normalizeVideo(data[0]) };
        }
        return { success: true, video: normalizeVideo(workingPayload) };
      }

      lastError = error.message;

      // Detect missing column error from PostgREST/Postgres
      const missingMatch =
        error.message.match(/Could not find the '([^']+)' column/i) ||
        error.message.match(/column ["']?([^"'\s]+)["']? of relation/i) ||
        error.message.match(/column ["']?([^"'\s]+)["']? does not exist/i);

      if (missingMatch && missingMatch[1]) {
        const missingCol = missingMatch[1].trim();
        if (cachedColumns) cachedColumns.delete(missingCol);
        if (missingCol in workingPayload) {
          delete workingPayload[missingCol];

          // If category was missing, try category_id if available
          if (missingCol === 'category' && catId && !('category_id' in workingPayload)) {
            workingPayload.category_id = catId;
          }
          if (missingCol === 'video_url' && !('url' in workingPayload)) {
            workingPayload.url = videoData.video_url;
          }
          if (missingCol === 'thumbnail_url' && !('thumbnail' in workingPayload)) {
            workingPayload.thumbnail = videoData.thumbnail_url;
          }
          continue;
        }
      }

      // Foreign key error (e.g. on category_id)
      if (error.message.toLowerCase().includes('foreign key') || error.code === '23503') {
        if ('category_id' in workingPayload) {
          delete workingPayload.category_id;
          continue;
        }
      }

      // Integer/UUID syntax error
      if (
        error.message.includes('invalid input syntax for type integer') ||
        error.message.includes('invalid input syntax for type uuid')
      ) {
        if ('category_id' in workingPayload) {
          const num = parseInt(String(workingPayload.category_id), 10);
          if (!isNaN(num) && typeof workingPayload.category_id !== 'number') {
            workingPayload.category_id = num;
          } else {
            delete workingPayload.category_id;
          }
          continue;
        }
        if ('duration' in workingPayload) {
          delete workingPayload.duration;
          continue;
        }
      }

      // RLS error on select
      if (
        error.message.includes('row-level security') ||
        error.code === '42501' ||
        error.code === 'PGRST116'
      ) {
        const plainInsert = await supabase.from('videos').insert([workingPayload]);
        if (!plainInsert.error) {
          return {
            success: true,
            video: normalizeVideo({ ...workingPayload, id: 'vid_' + Date.now() }),
          };
        }
      }

      break;
    }

    return { success: false, error: lastError };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create video';
    return { success: false, error: message };
  }
}

export async function updateAdminVideo(id: string | number, videoData: Partial<Video>): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { success: false, error: 'Database not connected' };

  try {
    const cols = await getVideosTableColumns(supabase);
    const catObj = findCategoryRecord(videoData.category || videoData.category_id);
    const catName = typeof videoData.category === 'object'
      ? videoData.category?.name
      : (videoData.category || (catObj ? catObj.name : undefined));
    const catId = videoData.category_id ?? (catObj ? catObj.id : undefined);

    const payload: Record<string, any> = {};
    if (videoData.title !== undefined) payload.title = videoData.title;
    if (videoData.description !== undefined && (!cols || cols.has('description'))) {
      payload.description = videoData.description;
    }

    if (videoData.video_url !== undefined) {
      if (cols && !cols.has('video_url') && cols.has('url')) {
        payload.url = videoData.video_url;
      } else {
        payload.video_url = videoData.video_url;
      }
    }

    if (videoData.thumbnail_url !== undefined) {
      if (cols && !cols.has('thumbnail_url') && cols.has('thumbnail')) {
        payload.thumbnail = videoData.thumbnail_url;
      } else if (cols && !cols.has('thumbnail_url') && cols.has('poster_url')) {
        payload.poster_url = videoData.thumbnail_url;
      } else {
        payload.thumbnail_url = videoData.thumbnail_url;
      }
    }

    if (videoData.duration !== undefined && (!cols || cols.has('duration'))) {
      payload.duration = videoData.duration;
    }

    if (videoData.category !== undefined || videoData.category_id !== undefined) {
      if (cols) {
        if (cols.has('category') && catName) {
          payload.category = catName;
        }
        if (cols.has('category_id') && catId !== undefined) {
          payload.category_id = catId;
        }
      } else {
        if (catId !== undefined && catId !== null) {
          payload.category_id = catId;
        } else if (catName) {
          payload.category = catName;
        }
      }
    }

    if (videoData.is_published !== undefined) {
      if (cols && !cols.has('is_published') && cols.has('published')) {
        payload.published = videoData.is_published;
      } else if (!cols || cols.has('is_published')) {
        payload.is_published = videoData.is_published;
      }
    }

    if (videoData.featured !== undefined && (!cols || cols.has('featured'))) {
      payload.featured = videoData.featured;
    }

    const workingPayload = { ...payload };
    let attempts = 0;
    let lastError = 'Failed to update video';

    while (attempts < 15) {
      attempts++;
      const { error } = await supabase
        .from('videos')
        .update(workingPayload)
        .eq('id', id);

      if (!error) {
        return { success: true };
      }

      lastError = error.message;

      const missingMatch =
        error.message.match(/Could not find the '([^']+)' column/i) ||
        error.message.match(/column ["']?([^"'\s]+)["']? of relation/i) ||
        error.message.match(/column ["']?([^"'\s]+)["']? does not exist/i);

      if (missingMatch && missingMatch[1]) {
        const missingCol = missingMatch[1].trim();
        if (cachedColumns) cachedColumns.delete(missingCol);
        if (missingCol in workingPayload) {
          delete workingPayload[missingCol];
          if (missingCol === 'category' && catId && !('category_id' in workingPayload)) {
            workingPayload.category_id = catId;
          }
          continue;
        }
      }

      if (error.message.toLowerCase().includes('foreign key') || error.code === '23503') {
        if ('category_id' in workingPayload) {
          delete workingPayload.category_id;
          continue;
        }
      }

      if (
        error.message.includes('invalid input syntax for type integer') ||
        error.message.includes('invalid input syntax for type uuid')
      ) {
        if ('category_id' in workingPayload) {
          delete workingPayload.category_id;
          continue;
        }
      }

      break;
    }

    return { success: false, error: lastError };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update video';
    return { success: false, error: message };
  }
}

export async function deleteAdminVideo(id: string | number): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { success: false, error: 'Database not connected' };

  try {
    const { error } = await supabase
      .from('videos')
      .delete()
      .eq('id', id);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete video';
    return { success: false, error: message };
  }
}

export async function createAdminCategory(name: string, slug?: string): Promise<{ success: boolean; category?: Category; error?: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { success: false, error: 'Database not connected' };

  try {
    const cleanSlug = slug?.trim() || name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
    let { data, error } = await supabase
      .from('categories')
      .insert([{ name: name.trim(), slug: cleanSlug }])
      .select()
      .single();

    if (error && (error.message?.includes('slug') || error.message?.includes('schema cache'))) {
      const retry = await supabase
        .from('categories')
        .insert([{ name: name.trim() }])
        .select()
        .single();
      if (!retry.error && retry.data) {
        cachedCategories.push(retry.data as Category);
        return { success: true, category: retry.data as Category };
      }
    }

    if (error) return { success: false, error: error.message };
    if (data) cachedCategories.push(data as Category);
    return { success: true, category: data as Category };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create category';
    return { success: false, error: message };
  }
}

export async function deleteAdminCategory(id: string | number): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { success: false, error: 'Database not connected' };

  try {
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id);

    if (error) return { success: false, error: error.message };
    cachedCategories = cachedCategories.filter((c) => c.id !== id);
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete category';
    return { success: false, error: message };
  }
}

/**
 * Optimizes and resizes any image file (JPG, PNG, WEBP, GIF, BMP, AVIF, HEIC, SVG)
 * so it never exceeds maximum dimensions or memory limits, ensuring 100% upload success.
 */
export async function optimizeImageFile(
  file: File,
  maxWidth = 1280,
  maxHeight = 720,
  quality = 0.85
): Promise<{
  blob: Blob;
  dataUrl: string;
  width: number;
  height: number;
  type: string;
}> {
  // If SVG, preserve vector quality directly
  if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        resolve({
          blob: file,
          dataUrl,
          width: maxWidth,
          height: maxHeight,
          type: 'image/svg+xml',
        });
      };
      reader.onerror = () => reject(new Error('Failed to read SVG file'));
      reader.readAsDataURL(file);
    });
  }

  // For all raster image formats (JPG, JPEG, PNG, WEBP, GIF, BMP, AVIF, HEIC, etc.)
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onerror = () => {
      // Fallback: return file with empty placeholder if unreadable
      resolve({
        blob: file,
        dataUrl: '',
        width: 0,
        height: 0,
        type: file.type || 'image/jpeg',
      });
    };

    reader.onload = () => {
      const img = new window.Image();
      img.onerror = () => {
        // If browser cannot decode canvas (rare camera format), return original dataUrl directly
        const rawDataUrl = reader.result as string;
        resolve({
          blob: file,
          dataUrl: rawDataUrl,
          width: maxWidth,
          height: maxHeight,
          type: file.type || 'image/jpeg',
        });
      };

      img.onload = () => {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        // Calculate aspect-preserving dimensions
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          const rawDataUrl = reader.result as string;
          resolve({
            blob: file,
            dataUrl: rawDataUrl,
            width,
            height,
            type: file.type || 'image/jpeg',
          });
          return;
        }

        // Draw image smoothly
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Try WebP first for ultra-lightweight storage & high fidelity, fallback to JPEG
        let mimeType = 'image/webp';
        let dataUrl = canvas.toDataURL(mimeType, quality);
        if (!dataUrl.startsWith('data:image/webp')) {
          mimeType = 'image/jpeg';
          dataUrl = canvas.toDataURL(mimeType, quality);
        }

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve({
                blob,
                dataUrl,
                width,
                height,
                type: mimeType,
              });
            } else {
              const rawDataUrl = reader.result as string;
              resolve({
                blob: file,
                dataUrl: rawDataUrl,
                width,
                height,
                type: file.type || 'image/jpeg',
              });
            }
          },
          mimeType,
          quality
        );
      };

      img.src = reader.result as string;
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Uploads a video poster / thumbnail photo supporting ALL image formats (JPG, PNG, WEBP, AVIF, HEIC, GIF, SVG, etc.).
 * 1. Optimizes and resizes the image client-side to ensure small footprint and instant loading.
 * 2. Attempts Supabase storage upload across available public buckets ('videos', 'thumbnails', 'public').
 * 3. If Supabase storage is unavailable, misconfigured, or rejects upload (e.g. RLS or missing bucket),
 *    gracefully falls back to the optimized base64 data URL stored directly in `thumbnail_url`.
 *    This ensures that poster uploads NEVER fail.
 */
export async function uploadPosterImage(
  file: File
): Promise<{ success: boolean; url?: string; note?: string; error?: string }> {
  try {
    // 1. Optimize image client-side first
    const optimized = await optimizeImageFile(file, 1280, 720, 0.85);

    // 2. Try Supabase Storage if configured
    const supabase = getSupabaseClient();
    if (supabase) {
      const ext = optimized.type.includes('webp')
        ? 'webp'
        : optimized.type.includes('png')
        ? 'png'
        : optimized.type.includes('svg')
        ? 'svg'
        : 'jpg';

      const fileName = `thumbnails/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;

      // Buckets to try in order
      const candidateBuckets = ['videos', 'thumbnails', 'public'];
      for (const bucket of candidateBuckets) {
        try {
          const { error: uploadErr } = await supabase.storage
            .from(bucket)
            .upload(fileName, optimized.blob, {
              cacheControl: '31536000',
              contentType: optimized.type,
              upsert: true,
            });

          if (!uploadErr) {
            const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
            if (data?.publicUrl) {
              return {
                success: true,
                url: data.publicUrl,
                note: `Uploaded to Supabase Storage (${bucket})`,
              };
            }
          }
        } catch {
          // Continue to next bucket or data URL fallback
        }
      }
    }

    // 3. Fail-safe fallback: Use optimized base64 Data URL
    // Stored directly in the text thumbnail_url column - 100% reliable, zero storage setup needed.
    if (optimized.dataUrl) {
      return {
        success: true,
        url: optimized.dataUrl,
        note: 'Poster optimized and embedded successfully',
      };
    }

    return { success: false, error: 'Could not process poster image' };
  } catch (err: unknown) {
    try {
      const rawDataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = () => reject(new Error('Cannot read file'));
        r.readAsDataURL(file);
      });
      return {
        success: true,
        url: rawDataUrl,
        note: 'Poster loaded successfully',
      };
    } catch {
      const msg = err instanceof Error ? err.message : 'Failed to process image';
      return { success: false, error: msg };
    }
  }
}

export async function uploadToStorage(
  file: File,
  bucket = 'videos',
  folder = 'uploads'
): Promise<{ success: boolean; url?: string; note?: string; error?: string }> {
  // If file is an image or destined for thumbnails, use the specialized universal poster uploader
  if (file.type.startsWith('image/') || folder === 'thumbnails' || /\.(jpe?g|png|webp|gif|bmp|avif|heic|svg|jfif)$/i.test(file.name)) {
    return uploadPosterImage(file);
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { success: false, error: 'Database not connected' };

  try {
    const rawExt = file.name.split('.').pop() || 'mp4';
    const ext = rawExt.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanFileName = `${folder}/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext || 'mp4'}`;

    const candidateBuckets = [bucket, 'videos', 'public'];
    let lastError = 'Upload failed';

    for (const b of candidateBuckets) {
      try {
        const { error: uploadError } = await supabase.storage
          .from(b)
          .upload(cleanFileName, file, {
            cacheControl: '3600',
            contentType: file.type || 'video/mp4',
            upsert: true,
          });

        if (!uploadError) {
          const { data } = supabase.storage.from(b).getPublicUrl(cleanFileName);
          return { success: true, url: data.publicUrl };
        } else {
          lastError = uploadError.message;
        }
      } catch (e) {
        lastError = e instanceof Error ? e.message : 'Upload failed';
      }
    }

    return { success: false, error: lastError };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    return { success: false, error: message };
  }
}

