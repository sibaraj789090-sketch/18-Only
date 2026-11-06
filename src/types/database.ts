export interface Category {
  id: string | number;
  name: string;
  slug?: string;
  icon?: string;
  created_at?: string;
}

export interface Video {
  id: string | number;
  title: string;
  description?: string | null;
  video_url: string;
  thumbnail_url?: string | null;
  views?: number;
  duration?: string | number; // e.g. "14:20" or seconds
  category_id?: string | number | null;
  category?: string | Category | null;
  created_at?: string;
  is_published?: boolean;
  featured?: boolean;
  author_name?: string | null;
  author_avatar?: string | null;
  likes?: number;
}

export interface Comment {
  id: string | number;
  video_id: string | number;
  user_name: string;
  comment_text: string;
  created_at: string;
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  isConfigured: boolean;
  source: 'env' | 'localStorage' | 'none';
}
