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

export function getSupabaseCredentials(): SupabaseConfig {
  const envUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

  const localUrl = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_URL) || '' : '';
  const localKey = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_ANON) || '' : '';

  if (envUrl && envKey && !envUrl.includes('your-project')) {
    return {
      url: envUrl.trim(),
      anonKey: envKey.trim(),
      isConfigured: true,
      source: 'env',
    };
  }

  if (localUrl && localKey) {
    return {
      url: localUrl.trim(),
      anonKey: localKey.trim(),
      isConfigured: true,
      source: 'localStorage',
    };
  }

  return {
    url: envUrl || '',
    anonKey: envKey || '',
    isConfigured: Boolean(envUrl && envKey && !envUrl.includes('your-project')),
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
  if (!creds.url || !creds.anonKey) {
    return null;
  }

  if (!supabaseClientInstance) {
    try {
      supabaseClientInstance = createClient(creds.url, creds.anonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
    } catch (err) {
      console.error('Failed to initialize Supabase client:', err);
      return null;
    }
  }

  return supabaseClientInstance;
}

/**
 * Resolves a video or thumbnail URL.
 * Supports full URLs as well as relative paths stored in the public 'videos' bucket.
 */
export function resolveMediaUrl(pathOrUrl?: string | null, bucket = 'videos'): string {
  if (!pathOrUrl) return '';
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://') || pathOrUrl.startsWith('data:')) {
    return pathOrUrl;
  }

  const creds = getSupabaseCredentials();
  if (!creds.url) return pathOrUrl;

  const cleanUrl = creds.url.replace(/\/+$/, '');
  const cleanPath = pathOrUrl.replace(/^\/+/, '');
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
      console.error('Error fetching videos from Supabase:', error.message);
      return { videos: [], count: 0 };
    }

    return {
      videos: (data as Video[]) || [],
      count: count ?? (data?.length || 0),
    };
  } catch (err) {
    console.error('Unexpected error fetching videos:', err);
    return { videos: [], count: 0 };
  }
}

/**
 * Fetch a single video by ID
 */
export async function fetchVideoById(id: string | number): Promise<Video | null> {
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
    console.error('Error fetching video by ID:', err);
    return null;
  }
}

/**
 * Increment view count for a video.
 */
export async function incrementVideoViews(video: Video): Promise<number> {
  const supabase = getSupabaseClient();
  const currentViews = video.views ?? 0;
  const newViews = currentViews + 1;

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
