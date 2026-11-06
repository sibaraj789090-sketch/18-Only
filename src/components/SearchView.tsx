import React, { useState, useEffect, useMemo } from 'react';
import { Search, X, ArrowLeft, Clock, Sparkles } from 'lucide-react';
import { Video, Category } from '../types/database';
import { VideoCard } from './VideoCard';
import {
  getSearchHistory,
  addToSearchHistory,
  clearSearchHistory,
} from '../lib/storage';

interface SearchViewProps {
  videos: Video[];
  categories: Category[];
  initialCategory?: string;
  onBack: () => void;
  onSelectVideo: (video: Video) => void;
  onShareVideo: (video: Video) => void;
}

export const SearchView: React.FC<SearchViewProps> = ({
  videos,
  categories,
  initialCategory = 'All',
  onBack,
  onSelectVideo,
  onShareVideo,
}) => {
  const [query, setQuery] = useState('');
  const [selectedCat, setSelectedCat] = useState(initialCategory);
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => {
    setHistory(getSearchHistory());
  }, []);

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (query.trim()) {
      addToSearchHistory(query.trim());
      setHistory(getSearchHistory());
    }
  };

  const handleSelectHistory = (term: string) => {
    setQuery(term);
    addToSearchHistory(term);
  };

  const handleClearHistory = () => {
    clearSearchHistory();
    setHistory([]);
  };

  // Matching algorithm: searches by title, description, and category
  const filteredVideos = useMemo(() => {
    const q = query.trim().toLowerCase();

    return videos.filter((video) => {
      // Category match
      if (selectedCat && selectedCat.toLowerCase() !== 'all') {
        const catName = typeof video.category === 'object' && video.category
          ? video.category.name.toLowerCase()
          : String(video.category || '').toLowerCase();

        if (catName !== selectedCat.toLowerCase() && String(video.category_id) !== selectedCat) {
          return false;
        }
      }

      // Query match (title, description, author)
      if (!q) return true;

      const titleMatch = video.title.toLowerCase().includes(q);
      const descMatch = (video.description || '').toLowerCase().includes(q);
      const authorMatch = (video.author_name || '').toLowerCase().includes(q);

      return titleMatch || descMatch || authorMatch;
    });
  }, [videos, query, selectedCat]);

  return (
    <div className="min-h-screen bg-[#06090e] pb-24 text-slate-100">
      {/* Search Header Bar with Input */}
      <div className="sticky top-0 z-30 bg-[#06090e]/95 backdrop-blur-md px-3 py-2 border-b border-slate-900/60">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-300 hover:text-white rounded-full -ml-1 transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="relative flex-1 flex items-center">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title, description, or topic..."
              className="w-full bg-[#101726] border border-slate-800 rounded-full pl-9 pr-9 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500/60 transition-colors shadow-inner"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2.5 p-1 text-slate-400 hover:text-white rounded-full"
                aria-label="Clear text"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </form>

        {/* Category Filters Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-2 pb-0.5">
          {categories.map((cat) => {
            const isSelected = selectedCat.toLowerCase() === cat.name.toLowerCase();
            return (
              <button
                key={cat.id || cat.name}
                onClick={() => setSelectedCat(cat.name)}
                className={`whitespace-nowrap shrink-0 px-3 py-1 rounded-full text-[11px] font-medium transition-all ${
                  isSelected
                    ? 'bg-red-600 text-white font-bold shadow-md shadow-red-950'
                    : 'bg-[#101726] text-slate-300 hover:text-white border border-slate-800/80'
                }`}
              >
                {cat.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content: Recent Searches or Results */}
      <div className="px-3 pt-3">
        {!query && history.length > 0 && (
          <div className="mb-4 bg-[#0d1424] rounded-xl p-3 border border-slate-800/60">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Recent Searches
              </span>
              <button
                onClick={handleClearHistory}
                className="text-[11px] text-red-400 hover:text-red-300 font-medium"
              >
                Clear all
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {history.map((term, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelectHistory(term)}
                  className="px-2.5 py-1 bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 text-xs rounded-lg transition-colors"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Search Results Summary */}
        <div className="flex items-center justify-between pb-3 px-1 text-xs text-slate-400">
          <span>
            {query
              ? `Found ${filteredVideos.length} ${filteredVideos.length === 1 ? 'video' : 'videos'} for "${query}"`
              : `Showing ${filteredVideos.length} ${filteredVideos.length === 1 ? 'video' : 'videos'}`}
          </span>
          {selectedCat !== 'All' && (
            <span className="text-red-400 font-medium">in {selectedCat}</span>
          )}
        </div>

        {/* Video Cards Grid/List */}
        {filteredVideos.length > 0 ? (
          <div className="space-y-4">
            {filteredVideos.map((video) => (
              <VideoCard
                key={video.id}
                video={video}
                onSelectVideo={onSelectVideo}
                onShare={onShareVideo}
              />
            ))}
          </div>
        ) : (
          /* Empty Search State */
          <div className="py-16 text-center px-4">
            <div className="w-14 h-14 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mx-auto mb-3">
              <Search className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-200 mb-1">No videos found</h3>
            <p className="text-xs text-slate-400 max-w-xs mx-auto mb-4">
              We couldn't find any videos matching "{query || selectedCat}". Try different keywords or browse all categories.
            </p>
            <button
              onClick={() => {
                setQuery('');
                setSelectedCat('All');
              }}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-semibold shadow-md transition-colors"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
