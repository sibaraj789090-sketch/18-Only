import React, { useState, useEffect } from 'react';
import {
  FolderArchive,
  Clock,
  ThumbsUp,
  History,
  Database,
  Trash2,
  Play,
  Cloud,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import { Video, SupabaseConfig } from '../types/database';
import {
  getWatchHistory,
  clearWatchHistory,
  getLikedVideoIds,
  getWatchLaterVideos,
  HistoryItem,
} from '../lib/storage';
import { formatTimeAgo, formatViews } from '../lib/formatters';
import { useToast } from './Toast';

interface LibraryViewProps {
  allVideos: Video[];
  config: SupabaseConfig;
  isConnected: boolean;
  onOpenConfig: () => void;
  onSelectVideo: (video: Video) => void;
  onNavigateToAdmin: () => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  allVideos,
  config,
  isConnected,
  onOpenConfig,
  onSelectVideo,
  onNavigateToAdmin,
}) => {
  const { showToast } = useToast();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [watchLater, setWatchLater] = useState<Video[]>([]);
  const [likedVideos, setLikedVideos] = useState<Video[]>([]);
  const [activeTab, setActiveTab] = useState<'history' | 'liked' | 'later'>('history');

  useEffect(() => {
    setHistory(getWatchHistory());
    setWatchLater(getWatchLaterVideos());

    const likedIds = getLikedVideoIds();
    const matchedLiked = allVideos.filter((v) => likedIds.includes(v.id));
    setLikedVideos(matchedLiked);
  }, [allVideos]);

  const handleClearHistory = () => {
    clearWatchHistory();
    setHistory([]);
    showToast('Watch history cleared');
  };

  return (
    <div className="min-h-screen bg-[#06090e] pb-24 text-slate-100">
      {/* Library Header */}
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-lg font-bold text-white font-['Outfit']">Library</h1>
        <p className="text-xs text-slate-400">
          Your watch history, saved playlists, and cloud connection
        </p>
      </div>

      {/* Supabase Connection Status Banner */}
      <div className="px-3 py-2">
        <div
          onClick={onOpenConfig}
          className="bg-gradient-to-r from-[#0d1527] to-[#121c33] border border-slate-800 rounded-2xl p-3.5 cursor-pointer hover:border-slate-700 transition-colors shadow-md"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  isConnected
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                }`}
              >
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>Supabase Backend</span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      isConnected
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-amber-500/20 text-amber-300'
                    }`}
                  >
                    {isConnected ? 'Active' : 'Setup Required'}
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400 truncate max-w-[220px]">
                  {config.url ? config.url.replace(/^https?:\/\//, '') : 'No Supabase URL set'}
                </p>
              </div>
            </div>

            <ChevronRight className="w-4 h-4 text-slate-500" />
          </div>
        </div>
      </div>

      {/* Tab Switcher for History, Liked, Watch Later */}
      <div className="px-3 pt-3">
        <div className="flex items-center gap-2 bg-[#0d1424] p-1 rounded-xl border border-slate-800/80">
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
              activeTab === 'history'
                ? 'bg-red-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>History ({history.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('later')}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
              activeTab === 'later'
                ? 'bg-red-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Watch Later ({watchLater.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('liked')}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
              activeTab === 'liked'
                ? 'bg-red-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ThumbsUp className="w-3.5 h-3.5" />
            <span>Liked ({likedVideos.length})</span>
          </button>
        </div>
      </div>

      {/* Tab Content Display */}
      <div className="px-3 pt-4">
        {activeTab === 'history' && (
          <div>
            <div className="flex items-center justify-between px-1 mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Recently Watched
              </span>
              {history.length > 0 && (
                <button
                  onClick={handleClearHistory}
                  className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 font-medium"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Clear History</span>
                </button>
              )}
            </div>

            {history.length > 0 ? (
              <div className="space-y-3">
                {history.map((item, idx) => (
                  <div
                    key={`${item.video.id}-${idx}`}
                    onClick={() => onSelectVideo(item.video)}
                    className="flex items-center gap-3 bg-[#0d1424] p-2 rounded-xl border border-slate-800/60 cursor-pointer hover:border-slate-700 transition-colors"
                  >
                    <div className="w-28 aspect-video bg-black rounded-lg overflow-hidden shrink-0 relative">
                      {item.video.thumbnail_url ? (
                        <img
                          src={item.video.thumbnail_url}
                          alt={item.video.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-red-500">
                          <Play className="w-5 h-5 fill-current" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-white line-clamp-2 leading-snug">
                        {item.video.title}
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                        {item.video.author_name || '18+Only Creator'}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-1">
                        Watched {formatTimeAgo(item.watchedAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center bg-[#0d1424] rounded-2xl border border-slate-800/60 p-4">
                <History className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <h4 className="text-xs font-bold text-slate-200">No watch history</h4>
                <p className="text-xs text-slate-400 mt-1">
                  Videos you stream will automatically appear here.
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'later' && (
          <div>
            <div className="px-1 mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Saved for Later
              </span>
            </div>

            {watchLater.length > 0 ? (
              <div className="space-y-3">
                {watchLater.map((video) => (
                  <div
                    key={video.id}
                    onClick={() => onSelectVideo(video)}
                    className="flex items-center gap-3 bg-[#0d1424] p-2 rounded-xl border border-slate-800/60 cursor-pointer hover:border-slate-700 transition-colors"
                  >
                    <div className="w-28 aspect-video bg-black rounded-lg overflow-hidden shrink-0 relative">
                      {video.thumbnail_url ? (
                        <img
                          src={video.thumbnail_url}
                          alt={video.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-red-500">
                          <Play className="w-5 h-5 fill-current" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-white line-clamp-2 leading-snug">
                        {video.title}
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                        {video.author_name || '18+Only Creator'}
                      </p>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-1">
                        <span>{formatViews(video.views)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center bg-[#0d1424] rounded-2xl border border-slate-800/60 p-4">
                <Clock className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <h4 className="text-xs font-bold text-slate-200">No videos saved</h4>
                <p className="text-xs text-slate-400 mt-1">
                  Tap "Save to Watch Later" on any video to bookmark it here.
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'liked' && (
          <div>
            <div className="px-1 mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Videos You Liked
              </span>
            </div>

            {likedVideos.length > 0 ? (
              <div className="space-y-3">
                {likedVideos.map((video) => (
                  <div
                    key={video.id}
                    onClick={() => onSelectVideo(video)}
                    className="flex items-center gap-3 bg-[#0d1424] p-2 rounded-xl border border-slate-800/60 cursor-pointer hover:border-slate-700 transition-colors"
                  >
                    <div className="w-28 aspect-video bg-black rounded-lg overflow-hidden shrink-0 relative">
                      {video.thumbnail_url ? (
                        <img
                          src={video.thumbnail_url}
                          alt={video.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-red-500">
                          <Play className="w-5 h-5 fill-current" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-white line-clamp-2 leading-snug">
                        {video.title}
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                        {video.author_name || '18+Only Creator'}
                      </p>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-1">
                        <span>{formatViews(video.views)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center bg-[#0d1424] rounded-2xl border border-slate-800/60 p-4">
                <ThumbsUp className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <h4 className="text-xs font-bold text-slate-200">No liked videos yet</h4>
                <p className="text-xs text-slate-400 mt-1">
                  Hit the like button on videos you enjoy to view them here anytime.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Admin Architecture Portal Link (Clean, secure placeholder ready for /admin) */}
      <div className="px-3 pt-6">
        <button
          onClick={onNavigateToAdmin}
          className="w-full bg-[#0a0f1d] hover:bg-[#11192e] border border-slate-800/60 rounded-xl p-3 flex items-center justify-between text-left text-xs transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-4 h-4 text-slate-500" />
            <div>
              <span className="font-semibold text-slate-300">Admin Architecture</span>
              <p className="text-[11px] text-slate-500">System gate ready for /admin</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-600" />
        </button>
      </div>
    </div>
  );
};
