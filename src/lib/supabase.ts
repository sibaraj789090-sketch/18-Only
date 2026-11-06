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

export async function signInAdmin(
  email: string,
  pass: string
): Promise<{ success: boolean; user?: any; error?: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Supabase client is not configured.' };
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: pass,
    });

    if (error || !data.user) {
      return { success: false, error: error?.message || 'Invalid credentials' };
    }

    // Verify authorized presence in admin_users table
    const cleanEmail = email.trim().toLowerCase();
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

        // If the table is empty (initial project setup), auto-register the authenticated user
        if (count === 0 || count === null) {
          await supabase.from('admin_users').insert([
            { id: data.user.id, email: cleanEmail, role: 'admin' }
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
        error: 'Access Denied: This account is not registered in the admin_users table.',
      };
    }

    return { success: true, user: data.user };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Login failed';
    return { success: false, error: message };
  }
}

export async function resetAdminPassword(email: string): Promise<{ success: boolean; message: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, message: 'Supabase client is not configured.' };
  }

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/admin/siba` : undefined,
    });
    if (error) {
      return { success: false, message: error.message };
    }
    return { success: true, message: 'Password reset email sent! Check your Gmail inbox.' };
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

    let isAuthorized = false;

    if (user.email) {
      try {
        const { data: byEmail } = await supabase
          .from('admin_users')
          .select('*')
          .eq('email', user.email.toLowerCase())
          .maybeSingle();
        if (byEmail) isAuthorized = true;
      } catch {}
    }

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

export async function uploadToStorage(
  file: File,
  bucket = 'videos',
  folder = 'uploads'
): Promise<{ success: boolean; url?: string; error?: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { success: false, error: 'Database not connected' };

  try {
    const ext = file.name.split('.').pop() || 'mp4';
    const cleanFileName = `${folder}/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(cleanFileName, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      return { success: false, error: uploadError.message };
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(cleanFileName);
    return { success: true, url: data.publicUrl };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    return { success: false, error: message };
  }
}

