import React from 'react';
import {
  Compass,
  TrendingUp,
  Film,
  Music2,
  GraduationCap,
  Cpu,
  Tv,
  Globe2,
  Sparkles,
} from 'lucide-react';
import { Video, Category } from '../types/database';
import { VideoCard } from './VideoCard';
import { AdBanner } from './AdBanner';

interface ExploreViewProps {
  videos: Video[];
  categories: Category[];
  onSelectCategory: (catName: string) => void;
  onSelectVideo: (video: Video) => void;
  onShareVideo: (video: Video) => void;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  Hindi: <Globe2 className="w-5 h-5 text-amber-400" />,
  English: <Globe2 className="w-5 h-5 text-sky-400" />,
  Entertainment: <Film className="w-5 h-5 text-rose-400" />,
  Education: <GraduationCap className="w-5 h-5 text-emerald-400" />,
  Technology: <Cpu className="w-5 h-5 text-cyan-400" />,
  Music: <Music2 className="w-5 h-5 text-fuchsia-400" />,
  Other: <Tv className="w-5 h-5 text-violet-400" />,
};

export const ExploreView: React.FC<ExploreViewProps> = ({
  videos,
  categories,
  onSelectCategory,
  onSelectVideo,
  onShareVideo,
}) => {
  // Sort by views descending for Trending section
  const trendingVideos = [...videos]
    .sort((a, b) => (b.views || 0) - (a.views || 0))
    .slice(0, 6);

  return (
    <div className="min-h-screen bg-[#06090e] pb-24 text-slate-100">
      {/* Explore Page Header */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-2 mb-1">
          <Compass className="w-5 h-5 text-red-500" />
          <h1 className="text-lg font-bold text-white font-['Outfit']">Explore</h1>
        </div>
        <p className="text-xs text-slate-400">
          Discover top genres, trending creators, and popular videos
        </p>
      </div>

      {/* Category Discovery Cards Grid */}
      <div className="px-3 py-3">
        <div className="grid grid-cols-2 gap-2.5">
          {categories
            .filter((c) => c.name.toLowerCase() !== 'all')
            .map((cat) => {
              const icon = CATEGORY_ICONS[cat.name] || (
                <Sparkles className="w-5 h-5 text-red-400" />
              );

              // Count videos matching this category
              const count = videos.filter((v) => {
                const cName =
                  typeof v.category === 'object' && v.category
                    ? v.category.name
                    : String(v.category || '');
                return (
                  cName.toLowerCase() === cat.name.toLowerCase() ||
                  String(v.category_id) === String(cat.id)
                );
              }).length;

              return (
                <button
                  key={cat.id || cat.name}
                  onClick={() => onSelectCategory(cat.name)}
                  className="bg-[#0f172a] hover:bg-[#16223d] active:scale-[0.98] border border-slate-800/80 rounded-xl p-3 flex items-center justify-between text-left transition-all shadow-sm"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-800">
                      {icon}
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-white leading-tight">
                        {cat.name}
                      </h3>
                      <span className="text-[10px] text-slate-400">
                        {count} {count === 1 ? 'video' : 'videos'}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
        </div>
      </div>

      {/* Sponsored Ad Banner in Explore */}
      <AdBanner placement="explore" />

      {/* Trending Section */}
      <div className="px-3 pt-2">
        <div className="flex items-center gap-2 px-1 mb-3">
          <TrendingUp className="w-4 h-4 text-red-500" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">
            Trending Now
          </h2>
        </div>

        {trendingVideos.length > 0 ? (
          <div className="space-y-4">
            {trendingVideos.map((video) => (
              <VideoCard
                key={video.id}
                video={video}
                onSelectVideo={onSelectVideo}
                onShare={onShareVideo}
              />
            ))}
          </div>
        ) : (
          <div className="p-8 text-center bg-[#0d1424] rounded-2xl border border-slate-800/60 my-2">
            <TrendingUp className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-xs text-slate-400">
              Trending videos will appear as viewers stream content.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
