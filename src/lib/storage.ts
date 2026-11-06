import { Video } from '../types/database';

const KEYS = {
  LIKED_VIDEOS: '18plus_liked_videos',
  WATCH_LATER: '18plus_watch_later',
  HISTORY: '18plus_watch_history',
  SEARCH_HISTORY: '18plus_search_history',
};

function getArray<T>(key: string): T[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setArray<T>(key: string, items: T[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch (e) {
    console.error('LocalStorage write error:', e);
  }
}

// Liked videos
export function getLikedVideoIds(): (string | number)[] {
  return getArray<string | number>(KEYS.LIKED_VIDEOS);
}

export function toggleLikedVideo(id: string | number): boolean {
  const current = getLikedVideoIds();
  const exists = current.includes(id);
  const updated = exists ? current.filter((x) => x !== id) : [...current, id];
  setArray(KEYS.LIKED_VIDEOS, updated);
  return !exists;
}

export function isVideoLiked(id: string | number): boolean {
  return getLikedVideoIds().includes(id);
}

// Watch Later
export function getWatchLaterVideos(): Video[] {
  return getArray<Video>(KEYS.WATCH_LATER);
}

export function toggleWatchLater(video: Video): boolean {
  const list = getWatchLaterVideos();
  const index = list.findIndex((v) => v.id === video.id);
  if (index >= 0) {
    list.splice(index, 1);
    setArray(KEYS.WATCH_LATER, list);
    return false;
  } else {
    list.unshift(video);
    setArray(KEYS.WATCH_LATER, list.slice(0, 50));
    return true;
  }
}

export function isWatchLater(id: string | number): boolean {
  return getWatchLaterVideos().some((v) => v.id === id);
}

// Watch History
export interface HistoryItem {
  video: Video;
  watchedAt: string;
}

export function getWatchHistory(): HistoryItem[] {
  return getArray<HistoryItem>(KEYS.HISTORY);
}

export function addToWatchHistory(video: Video) {
  const list = getWatchHistory().filter((item) => item.video.id !== video.id);
  list.unshift({
    video,
    watchedAt: new Date().toISOString(),
  });
  setArray(KEYS.HISTORY, list.slice(0, 40));
}

export function clearWatchHistory() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(KEYS.HISTORY);
  }
}

// Search History
export function getSearchHistory(): string[] {
  return getArray<string>(KEYS.SEARCH_HISTORY);
}

export function addToSearchHistory(term: string) {
  const clean = term.trim();
  if (!clean) return;
  const list = getSearchHistory().filter((t) => t.toLowerCase() !== clean.toLowerCase());
  list.unshift(clean);
  setArray(KEYS.SEARCH_HISTORY, list.slice(0, 10));
}

export function clearSearchHistory() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(KEYS.SEARCH_HISTORY);
  }
}
