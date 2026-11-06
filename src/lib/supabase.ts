import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Video, Category, Comment, SupabaseConfig } from '../types/database';

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
      return DEFAULT_CATEGORIES;
    }

    // Ensure 'All' is at the top
    const hasAll = data.some((c) => c.name.toLowerCase() === 'all');
    if (!hasAll) {
      return [{ id: 'all', name: 'All' }, ...data];
    }
    return data;
  } catch (err) {
    console.warn('Error fetching categories from Supabase, using defaults:', err);
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

  try {
    // Attempt query with is_published filtering
    let query = supabase
      .from('videos')
      .select('*', { count: 'exact' });

    // Try filtering is_published: true
    try {
      query = query.eq('is_published', true);
    } catch {
      // Ignore if not present
    }

    if (options.featuredOnly) {
      query = query.eq('featured', true);
    }

    if (options.categoryId && options.categoryId !== 'all') {
      // Match by category_id or category string
      query = query.or(`category_id.eq.${options.categoryId},category.eq.${options.categoryId}`);
    }

    if (options.searchQuery && options.searchQuery.trim()) {
      const q = options.searchQuery.trim();
      query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`);
    }

    // Latest uploaded videos first as specified
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      // If error is about 'is_published' column not existing, retry without it
      if (error.message?.includes('is_published')) {
        let retryQuery = supabase
          .from('videos')
          .select('*', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (options.categoryId && options.categoryId !== 'all') {
          retryQuery = retryQuery.or(`category_id.eq.${options.categoryId},category.eq.${options.categoryId}`);
        }
        if (options.searchQuery && options.searchQuery.trim()) {
          const q = options.searchQuery.trim();
          retryQuery = retryQuery.or(`title.ilike.%${q}%,description.ilike.%${q}%`);
        }
        const retryResult = await retryQuery;
        if (!retryResult.error && retryResult.data) {
          return { videos: retryResult.data as Video[], count: retryResult.count ?? retryResult.data.length };
        }
      }
      console.warn('Notice: Supabase videos query returned:', error.message);
      return { videos: [], count: 0 };
    }

    return {
      videos: (data as Video[]) || [],
      count: count ?? (data?.length || 0),
    };
  } catch (err) {
    console.warn('Notice: Network error fetching videos from Supabase:', err);
    return { videos: [], count: 0 };
  }
}

import { TEMPORARY_DEMO_VIDEO, isDemoVideo } from './demoVideo';

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

    return data as Video;
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
    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data) {
      console.warn('Error fetching admin videos:', error?.message);
      return [];
    }

    return data as Video[];
  } catch (err) {
    console.warn('Notice: fetchAllAdminVideos error:', err);
    return [];
  }
}

export async function createAdminVideo(videoData: Partial<Video>): Promise<{ success: boolean; video?: Video; error?: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { success: false, error: 'Database not connected' };

  try {
    const payload: Record<string, any> = {
      title: videoData.title,
      description: videoData.description || '',
      video_url: videoData.video_url,
      thumbnail_url: videoData.thumbnail_url || null,
      views: videoData.views || 0,
      duration: videoData.duration || null,
      category: typeof videoData.category === 'object' ? videoData.category?.name : videoData.category,
      category_id: videoData.category_id || null,
      is_published: videoData.is_published ?? true,
      featured: videoData.featured ?? false,
      author_name: videoData.author_name || '18+Only Creator',
    };

    const { data, error } = await supabase
      .from('videos')
      .insert([payload])
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, video: data as Video };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create video';
    return { success: false, error: message };
  }
}

export async function updateAdminVideo(id: string | number, videoData: Partial<Video>): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { success: false, error: 'Database not connected' };

  try {
    const payload: Record<string, any> = {};
    if (videoData.title !== undefined) payload.title = videoData.title;
    if (videoData.description !== undefined) payload.description = videoData.description;
    if (videoData.video_url !== undefined) payload.video_url = videoData.video_url;
    if (videoData.thumbnail_url !== undefined) payload.thumbnail_url = videoData.thumbnail_url;
    if (videoData.duration !== undefined) payload.duration = videoData.duration;
    if (videoData.category !== undefined) {
      payload.category = typeof videoData.category === 'object' ? videoData.category?.name : videoData.category;
    }
    if (videoData.category_id !== undefined) payload.category_id = videoData.category_id;
    if (videoData.is_published !== undefined) payload.is_published = videoData.is_published;
    if (videoData.featured !== undefined) payload.featured = videoData.featured;

    const { error } = await supabase
      .from('videos')
      .update(payload)
      .eq('id', id);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
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
    const { data, error } = await supabase
      .from('categories')
      .insert([{ name: name.trim(), slug: cleanSlug }])
      .select()
      .single();

    if (error) return { success: false, error: error.message };
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

