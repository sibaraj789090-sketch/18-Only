import React, { useState } from 'react';
import { Play, Sparkles } from 'lucide-react';
import { Video } from '../types/database';
import { formatViews, formatTimeAgo, formatDuration } from '../lib/formatters';
import { resolveMediaUrl } from '../lib/supabase';

interface FeaturedVideoProps {
  video: Video;
  onPlay: (video: Video) => void;
}

export const FeaturedVideo: React.FC<FeaturedVideoProps> = ({ video, onPlay }) => {
  const [imgError, setImgError] = useState(false);
  const resolvedThumb = resolveMediaUrl(video.thumbnail_url, 'videos');
  const durationText = formatDuration(video.duration);

  return (
    <div className="w-full px-3 pt-3 pb-2">
      <div
        onClick={() => onPlay(video)}
        className="group relative w-full aspect-[16/9] rounded-2xl overflow-hidden cursor-pointer shadow-xl border border-red-500/20 bg-[#0d1424] transition-all active:scale-[0.99]"
      >
        {/* Backdrop thumbnail */}
        {!imgError && resolvedThumb ? (
          <img
            src={resolvedThumb}
            alt={video.title}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-tr from-red-950/40 via-[#0e1628] to-[#070b13] flex items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-500 shadow-lg shadow-red-950">
              <Play className="w-7 h-7 fill-current translate-x-0.5" />
            </div>
          </div>
        )}

        {/* Cinematic gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#06090e] via-[#06090e]/40 to-transparent" />

        {/* Featured Badge */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-red-600 text-white text-[11px] font-bold px-2.5 py-1 rounded-md shadow-md uppercase tracking-wider">
          <Sparkles className="w-3 h-3 fill-current" />
          <span>Featured</span>
        </div>

        {/* Duration badge */}
        {durationText && (
          <div className="absolute top-3 right-3 bg-black/80 backdrop-blur-xs text-white text-[11px] font-semibold px-2 py-0.5 rounded tracking-wide">
            {durationText}
          </div>
        )}

        {/* Bottom details & Quick Play CTA */}
        <div className="absolute bottom-0 left-0 right-0 p-3.5 flex items-end justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-white leading-tight line-clamp-2 drop-shadow-sm font-['Outfit']">
              {video.title}
            </h2>
            <div className="flex items-center gap-2 text-xs text-slate-300 mt-1">
              <span>{video.author_name || '18+Only Creator'}</span>
              <span aria-hidden="true" className="text-slate-500">·</span>
              <span>{formatViews(video.views)}</span>
              <span aria-hidden="true" className="text-slate-500">·</span>
              <span>{formatTimeAgo(video.created_at)}</span>
            </div>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onPlay(video);
            }}
            className="w-11 h-11 shrink-0 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-600/30 transition-transform active:scale-95"
            aria-label="Play featured video"
          >
            <Play className="w-5 h-5 fill-current translate-x-0.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
