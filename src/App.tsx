import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Video,
  Category,
  SupabaseConfig,
} from './types/database';
import {
  fetchVideos,
  fetchCategories,
  fetchVideoById,
  getSupabaseCredentials,
  testSupabaseConnection,
  DEFAULT_CATEGORIES,
} from './lib/supabase';
import { TEMPORARY_DEMO_VIDEO } from './lib/demoVideo';
import { ToastProvider, useToast } from './components/Toast';
import { Header } from './components/Header';
import { CategoryBar } from './components/CategoryBar';
import { FeaturedVideo } from './components/FeaturedVideo';
import { VideoCard } from './components/VideoCard';
import { WatchPage } from './components/WatchPage';
import { SearchView } from './components/SearchView';
import { ExploreView } from './components/ExploreView';
import { LibraryView } from './components/LibraryView';
import { BottomNav, TabType } from './components/BottomNav';
import { ShareModal } from './components/ShareModal';
import { AdminPanel } from './components/AdminPanel';
import { AdBanner } from './components/AdBanner';
import { initAdPopunder } from './lib/adPopunder';
import {
  Loader2,
  RefreshCw,
  Film,
  AlertCircle,
  Sparkles,
} from 'lucide-react';

function MainApp() {
  const { showToast } = useToast();

  useEffect(() => {
    initAdPopunder();
  }, []);

  // Navigation & View State
  const [currentTab, setCurrentTab] = useState<TabType>('home');
  const [activeVideo, setActiveVideo] = useState<Video | null>(null);
  const [isAdminView, setIsAdminView] = useState(false);
  const [shareVideo, setShareVideo] = useState<Video | null>(null);

  // Supabase State
  const [config, setConfig] = useState<SupabaseConfig>(getSupabaseCredentials());
  const [isConnected, setIsConnected] = useState(false);

  // Video Data State
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [videos, setVideos] = useState<Video[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const PAGE_SIZE = 10;

  // Check initial URL parameters for deep linking (?v=id or /admin/siba)
  useEffect(() => {
    const checkUrlRoute = async () => {
      if (typeof window === 'undefined') return;

      const pathLower = window.location.pathname.toLowerCase().replace(/\/+$/, '');
      const hashLower = window.location.hash.toLowerCase().replace(/\/+$/, '');
      const searchParams = new URLSearchParams(window.location.search);
      const videoId = searchParams.get('v');
      const routeParam = (searchParams.get('route') || searchParams.get('page') || searchParams.get('admin') || '').toLowerCase().replace(/\/+$/, '');

      // Requirement 1 & 2: Admin dashboard must open at /admin/siba.
      const isAdminRoute =
        pathLower === '/admin/siba' ||
        pathLower.endsWith('/admin/siba') ||
        hashLower === '#admin/siba' ||
        hashLower === '#/admin/siba' ||
        hashLower.endsWith('admin/siba') ||
        routeParam === 'admin/siba' ||
        routeParam === '/admin/siba' ||
        routeParam === 'siba' ||
        searchParams.get('admin') === 'siba' ||
        searchParams.get('admin') === 'true' ||
        searchParams.get('admin') === '1';

      if (isAdminRoute) {
        setIsAdminView(true);
        setActiveVideo(null);
        return;
      }

      // If a visitor accesses /admin or #admin, rewrite to /admin/siba so the admin panel opens smoothly
      if (
        pathLower === '/admin' ||
        pathLower.endsWith('/admin') ||
        hashLower === '#admin' ||
        hashLower === '#/admin'
      ) {
        window.history.replaceState({}, '', '/admin/siba');
        setIsAdminView(true);
        setActiveVideo(null);
        return;
      }

      setIsAdminView(false);

      if (videoId) {
        const found = await fetchVideoById(videoId);
        if (found) {
          setActiveVideo(found);
        }
      }
    };

    checkUrlRoute();
    window.addEventListener('popstate', checkUrlRoute);
    window.addEventListener('hashchange', checkUrlRoute);
    return () => {
      window.removeEventListener('popstate', checkUrlRoute);
      window.removeEventListener('hashchange', checkUrlRoute);
    };
  }, []);

  const handleOpenAdmin = useCallback(() => {
    setIsAdminView(true);
    setActiveVideo(null);
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', '/admin/siba');
    }
  }, []);

  // Update URL search params when activeVideo changes
  const handleSelectVideo = useCallback((video: Video) => {
    setActiveVideo(video);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('v', String(video.id));
      window.history.pushState({}, '', url.toString());
    }
  }, []);

  const handleBackFromWatch = useCallback(() => {
    setActiveVideo(null);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('v');
      window.history.pushState({}, '', url.toString());
    }
  }, []);

  // Test Supabase Connection & Load Categories
  const initSupabase = useCallback(async () => {
    const creds = getSupabaseCredentials();
    setConfig(creds);

    const test = await testSupabaseConnection();
    setIsConnected(test.connected);

    // Fetch dynamic categories from Supabase
    const loadedCategories = await fetchCategories();
    setCategories(loadedCategories);
  }, []);

  useEffect(() => {
    initSupabase();
  }, [initSupabase]);

  // Load published videos from Supabase
  const loadVideos = useCallback(
    async (catName: string, isInitial = false) => {
      if (isInitial) {
        setIsLoading(true);
        setOffset(0);
      } else {
        setIsLoadingMore(true);
      }

      const currentOffset = isInitial ? 0 : offset;
      const result = await fetchVideos({
        categoryId: catName.toLowerCase() === 'all' ? null : catName,
        limit: PAGE_SIZE,
        offset: currentOffset,
      });

      const isDemoCategory = catName.toLowerCase() === 'all' || catName.toLowerCase() === 'entertainment';

      if (isInitial) {
        const initialList = isDemoCategory
          ? [TEMPORARY_DEMO_VIDEO, ...result.videos.filter((v) => v.id !== TEMPORARY_DEMO_VIDEO.id)]
          : result.videos;

        setVideos(initialList);
        setOffset(result.videos.length);
        setTotalCount(result.count + (isDemoCategory ? 1 : 0));
      } else {
        setVideos((prev) => [...prev, ...result.videos]);
        setOffset((prev) => prev + result.videos.length);
        setTotalCount(result.count + (isDemoCategory ? 1 : 0));
      }

      setIsLoading(false);
      setIsLoadingMore(false);
    },
    [offset]
  );

  // Trigger video reload on category switch or config change
  useEffect(() => {
    loadVideos(selectedCategory, true);
  }, [selectedCategory, config.url, config.anonKey]);

  const handleLoadMore = () => {
    if (videos.length < totalCount && !isLoadingMore) {
      loadVideos(selectedCategory, false);
    }
  };

  const handleCategorySelect = (catName: string) => {
    setSelectedCategory(catName);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Featured video selection: either video with featured === true or first latest video
  const featuredVideo = useMemo(() => {
    if (selectedCategory.toLowerCase() !== 'all') return null;
    const explicitlyFeatured = videos.find((v) => v.featured);
    return explicitlyFeatured || (videos.length > 1 ? videos.find((v) => v.id !== TEMPORARY_DEMO_VIDEO.id) || null : null);
  }, [videos, selectedCategory]);

  // Feed videos (excluding featured if displayed)
  const feedVideos = useMemo(() => {
    if (selectedCategory.toLowerCase() === 'all' && featuredVideo) {
      return videos.filter((v) => v.id !== featuredVideo.id);
    }
    return videos;
  }, [videos, selectedCategory, featuredVideo]);

  // Handler for sharing
  const handleOpenShare = (video: Video) => {
    setShareVideo(video);
  };

  // Render Admin View
  if (isAdminView) {
    return (
      <AdminPanel
        onBackToSite={() => {
          setIsAdminView(false);
          if (typeof window !== 'undefined') {
            if (window.location.pathname.includes('/admin')) {
              window.history.pushState({}, '', '/');
            }
            if (window.location.hash.includes('admin')) {
              window.history.pushState({}, '', '/');
            }
          }
          loadVideos(selectedCategory, true);
        }}
        isConfigured={config.isConfigured}
      />
    );
  }

  // Render Watch Page if a video is active
  if (activeVideo) {
    return (
      <WatchPage
        video={activeVideo}
        allVideos={videos}
        onBack={handleBackFromWatch}
        onSelectRelatedVideo={handleSelectVideo}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#06090e] text-[#f1f5f9] flex flex-col font-['Outfit']">
      {/* Mobile container - centered frame for high-end preview and responsive mobile on phones */}
      <div className="w-full max-w-md mx-auto min-h-screen flex flex-col bg-[#06090e] shadow-2xl relative">
        {/* Header (18+Only Brand + Search) */}
        <Header
          onOpenSearch={() => setCurrentTab('search')}
        />

        {/* Tab 1: Home View */}
        {currentTab === 'home' && (
          <main className="flex-1 pb-24">
            {/* Horizontal Categories Bar (Dynamic from Supabase) */}
            <CategoryBar
              categories={categories}
              selectedCategory={selectedCategory}
              onSelectCategory={handleCategorySelect}
              isLoading={isLoading && categories.length <= 1}
            />

            {/* Top Header Sponsor Ad Banner */}
            <AdBanner placement="header" variant={1} />

            {/* Featured Video Section */}
            {!isLoading && featuredVideo && selectedCategory.toLowerCase() === 'all' && (
              <FeaturedVideo
                video={featuredVideo}
                onPlay={handleSelectVideo}
              />
            )}

            {/* Videos Feed Section */}
            <section className="px-3 pt-2">
              <div className="flex items-center justify-between px-1 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  {selectedCategory === 'All' ? 'Latest Videos' : `${selectedCategory} Videos`}
                </span>
                <span className="text-[11px] text-slate-500">
                  {totalCount} {totalCount === 1 ? 'video' : 'videos'}
                </span>
              </div>

              {isLoading ? (
                /* Loading Skeleton Feed */
                <div className="space-y-4 py-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="space-y-2">
                      <div className="w-full aspect-video bg-slate-900/80 rounded-xl animate-pulse" />
                      <div className="flex gap-3 px-1">
                        <div className="w-9 h-9 rounded-full bg-slate-800 animate-pulse shrink-0" />
                        <div className="flex-1 space-y-1.5 py-1">
                          <div className="h-3.5 bg-slate-800 rounded w-4/5 animate-pulse" />
                          <div className="h-3 bg-slate-800/60 rounded w-1/2 animate-pulse" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : feedVideos.length > 0 ? (
                /* Real Video Cards List */
                <div className="space-y-4">
                  {feedVideos.map((video, idx) => (
                    <React.Fragment key={video.id}>
                      <VideoCard
                        video={video}
                        onSelectVideo={handleSelectVideo}
                        onShare={handleOpenShare}
                      />
                      {/* In-feed Sponsored Ad Banner placed every 2 videos with alternating creatives */}
                      {(idx + 1) % 2 === 0 && (
                        <AdBanner
                          placement="feed"
                          variant={((idx / 2) % 3 + 1) as 1 | 2 | 3}
                        />
                      )}
                    </React.Fragment>
                  ))}

                  {/* Interstitial Ad Banner before Load More */}
                  <AdBanner placement="compact" variant={3} className="my-3" />

                  {/* Infinite Scroll / Load More Button */}
                  {videos.length < totalCount && (
                    <div className="pt-4 pb-2 text-center">
                      <button
                        onClick={handleLoadMore}
                        disabled={isLoadingMore}
                        className="w-full py-3 bg-[#0d1424] hover:bg-[#152038] border border-slate-800/80 rounded-xl text-xs font-semibold text-slate-200 transition-colors flex items-center justify-center gap-2 active:scale-95"
                      >
                        {isLoadingMore ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                            <span>Loading more videos...</span>
                          </>
                        ) : (
                          <span>Load More Videos ({totalCount - videos.length} remaining)</span>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* Clean Empty Feed State for Normal Public Users */
                <div className="py-16 px-4 text-center bg-[#090e1a] rounded-2xl border border-slate-800/80 my-4 shadow-inner">
                  <div className="w-14 h-14 rounded-full bg-red-950/40 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-3">
                    <Film className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-white mb-1">
                    No Videos Available Yet
                  </h3>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed mb-4">
                    New content is currently being uploaded and processed. Please check back soon or try selecting another category.
                  </p>
                  <div className="flex flex-col gap-2 max-w-xs mx-auto">
                    <button
                      onClick={() => loadVideos(selectedCategory, true)}
                      className="py-2.5 px-4 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl shadow-md transition-colors flex items-center justify-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Refresh Feed</span>
                    </button>
                  </div>
                </div>
              )}
            </section>
          </main>
        )}

        {/* Tab 2: Explore View */}
        {currentTab === 'explore' && (
          <ExploreView
            videos={videos}
            categories={categories}
            onSelectCategory={(catName) => {
              setSelectedCategory(catName);
              setCurrentTab('home');
            }}
            onSelectVideo={handleSelectVideo}
            onShareVideo={handleOpenShare}
          />
        )}

        {/* Tab 3: Search View */}
        {currentTab === 'search' && (
          <SearchView
            videos={videos}
            categories={categories}
            initialCategory={selectedCategory}
            onBack={() => setCurrentTab('home')}
            onSelectVideo={handleSelectVideo}
            onShareVideo={handleOpenShare}
          />
        )}

        {/* Tab 4: Library View */}
        {currentTab === 'library' && (
          <LibraryView
            allVideos={videos}
            onSelectVideo={handleSelectVideo}
            onOpenAdmin={handleOpenAdmin}
          />
        )}

        {/* Sticky Mobile Floating Ad Banner */}
        <AdBanner placement="sticky" />

        {/* Bottom Navigation (Home, Explore, Search, Library) */}
        <BottomNav currentTab={currentTab} onChangeTab={setCurrentTab} />

        {/* Share Video Modal */}
        <ShareModal
          video={shareVideo}
          isOpen={Boolean(shareVideo)}
          onClose={() => setShareVideo(null)}
        />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <MainApp />
    </ToastProvider>
  );
}
