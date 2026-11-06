import React, { useState } from 'react';
import { MoreVertical, Clock, Share2, ThumbsUp, Play, Check } from 'lucide-react';
import { Video } from '../types/database';
import { formatViews, formatTimeAgo, formatDuration } from '../lib/formatters';
import { resolveMediaUrl } from '../lib/supabase';
import { isWatchLater, toggleWatchLater, isVideoLiked, toggleLikedVideo } from '../lib/storage';
import { useToast } from './Toast';

interface VideoCardProps {
  video: Video;
  onSelectVideo: (video: Video) => void;
  onShare?: (video: Video) => void;
}

export const VideoCard: React.FC<VideoCardProps> = ({ video, onSelectVideo, onShare }) => {
  const { showToast } = useToast();
  const [imgError, setImgError] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [savedToLater, setSavedToLater] = useState(() => isWatchLater(video.id));
  const [liked, setLiked] = useState(() => isVideoLiked(video.id));

  const resolvedThumb = resolveMediaUrl(video.thumbnail_url, 'videos');
  const author = video.author_name || '18+Only Creator';
  const durationText = formatDuration(video.duration);

  const handleToggleWatchLater = (e: React.MouseEvent) => {
    e.stopPropagation();
    const isSaved = toggleWatchLater(video);
    setSavedToLater(isSaved);
    showToast(isSaved ? 'Saved to Watch Later' : 'Removed from Watch Later');
    setShowMenu(false);
  };

  const handleToggleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    const isNowLiked = toggleLikedVideo(video.id);
    setLiked(isNowLiked);
    showToast(isNowLiked ? 'Added to Liked Videos' : 'Removed from Liked Videos');
    setShowMenu(false);
  };

  const handleShareClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    if (onShare) {
      onShare(video);
    } else if (navigator.share) {
      navigator.share({
        title: video.title,
        text: `Watch "${video.title}" on 18+Only`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      showToast('Video link copied to clipboard');
    }
  };

  return (
    <article className="w-full pb-4 border-b border-slate-900/60 last:border-0 relative">
      {/* 16:9 Thumbnail Container */}
      <div
        onClick={() => onSelectVideo(video)}
        className="relative w-full aspect-video bg-[#0c121e] overflow-hidden cursor-pointer active:opacity-95 transition-opacity rounded-xl mx-auto"
      >
        {!imgError && resolvedThumb ? (
          <img
            src={resolvedThumb}
            alt={video.title}
            onError={() => setImgError(true)}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover transition-transform duration-300 hover:scale-102"
          />
        ) : (
          /* Graceful stylized fallback if thumbnail is not provided or fails */
          <div className="w-full h-full bg-gradient-to-br from-[#0c121e] via-[#131b2e] to-[#090d16] flex flex-col items-center justify-center p-4 text-center">
            <div className="w-12 h-12 rounded-full bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-500 mb-2">
              <Play className="w-6 h-6 fill-current translate-x-0.5" />
            </div>
            <p className="text-xs font-medium text-slate-300 line-clamp-2 max-w-[85%]">
              {video.title}
            </p>
          </div>
        )}

        {/* Video Duration Badge */}
        {durationText && (
          <div className="absolute bottom-2 right-2 bg-black/80 backdrop-blur-xs text-white text-[11px] font-semibold px-1.5 py-0.5 rounded tracking-wider">
            {durationText}
          </div>
        )}
      </div>

      {/* Video Details & Meta */}
      <div className="flex items-start gap-3 pt-3 px-1">
        {/* Channel / Author Avatar */}
        <div
          onClick={() => onSelectVideo(video)}
          className="cursor-pointer shrink-0"
        >
          {video.author_avatar ? (
            <img
              src={video.author_avatar}
              alt={author}
              className="w-9 h-9 rounded-full object-cover border border-slate-800"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-red-600 to-slate-800 flex items-center justify-center text-white text-xs font-bold border border-slate-700/60 shadow-inner">
              {author.slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>

        {/* Text Details */}
        <div
          onClick={() => onSelectVideo(video)}
          className="flex-1 min-w-0 cursor-pointer pr-1"
        >
          <h3 className="text-sm font-semibold text-slate-100 leading-snug line-clamp-2 hover:text-white transition-colors">
            {video.title}
          </h3>
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400 mt-1">
            <span className="truncate max-w-[140px] font-medium text-slate-300">{author}</span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span>{formatViews(video.views)}</span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span>{formatTimeAgo(video.created_at)}</span>
          </div>
        </div>

        {/* 3-Dots Action Menu Trigger (min 44x44px hitbox) */}
        <div className="relative shrink-0 -mr-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu((prev) => !prev);
            }}
            className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-white rounded-full transition-colors active:bg-slate-800/60"
            aria-label="More options"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {/* Context Menu Dropdown */}
          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-40 bg-transparent"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(false);
                }}
              />
              <div className="absolute right-0 top-10 z-50 w-52 bg-[#0d1424] border border-slate-800 rounded-xl shadow-2xl p-1.5 text-xs text-slate-200 animate-in fade-in zoom-in-95">
                <button
                  onClick={handleToggleWatchLater}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-slate-800/80 transition-colors text-left"
                >
                  <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="truncate">
                    {savedToLater ? 'Remove from Watch Later' : 'Save to Watch Later'}
                  </span>
                </button>
                <button
                  onClick={handleToggleLike}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-slate-800/80 transition-colors text-left"
                >
                  <ThumbsUp className={`w-4 h-4 shrink-0 ${liked ? 'text-red-500 fill-current' : 'text-slate-400'}`} />
                  <span className="truncate">{liked ? 'Liked Video' : 'Like Video'}</span>
                </button>
                <button
                  onClick={handleShareClick}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-slate-800/80 transition-colors text-left"
                >
                  <Share2 className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="truncate">Share Video</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </article>
  );
};
