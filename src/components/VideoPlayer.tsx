import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  RotateCcw,
  AlertCircle,
  Loader2,
  Gauge,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';
import { Video } from '../types/database';
import { resolveMediaUrl, isExternalUrl } from '../lib/supabase';
import { isDemoVideo, DEMO_BACKUP_URLS, DEMO_BACKUP_THUMBNAIL } from '../lib/demoVideo';
import { formatPlayerTime } from '../lib/formatters';
import {
  HILLTOPADS_VAST_TAG_URL,
  fetchAndParseVast,
  pingTrackingUrl,
  VastAdData,
} from '../lib/vast';

interface VideoPlayerProps {
  video: Video;
  onEnded?: () => void;
  autoPlay?: boolean;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ video, onEnded, autoPlay = true }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const adContainerRef = useRef<HTMLDivElement>(null);

  // Main video state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showControls, setShowControls] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  // Ad states
  const [isAdPlaying, setIsAdPlaying] = useState(false);
  const [adTimeRemaining, setAdTimeRemaining] = useState<number>(0);
  const [adDuration, setAdDuration] = useState<number>(0);
  const [canSkipAd, setCanSkipAd] = useState(false);
  const [adSkipCountdown, setAdSkipCountdown] = useState(5);
  const [adClickThrough, setAdClickThrough] = useState<string | null>(null);
  const [adMode, setAdMode] = useState<'ima' | 'fallback' | 'none'>('none');

  // Ad references
  const hasPlayedPreRollForVideoIdRef = useRef<string | number | null>(null);
  const adsManagerRef = useRef<any>(null);
  const adsLoaderRef = useRef<any>(null);
  const adDisplayContainerRef = useRef<any>(null);
  const currentFallbackAdRef = useRef<VastAdData | null>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const adSafetyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isDemo = isDemoVideo(video.id);
  const initialSource = resolveMediaUrl(video.video_url, 'videos');
  const [currentVideoSrc, setCurrentVideoSrc] = useState<string>(initialSource);
  const fallbackMirrorIndexRef = useRef<number>(0);

  const posterSrc = isDemo
    ? DEMO_BACKUP_THUMBNAIL
    : resolveMediaUrl(video.thumbnail_url, 'videos');

  useEffect(() => {
    const raw = resolveMediaUrl(video.video_url, 'videos');
    setCurrentVideoSrc(raw);
    fallbackMirrorIndexRef.current = 0;
  }, [video.id, video.video_url]);

  const resetControlsTimeout = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (isPlaying && !isAdPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
        setShowSpeedMenu(false);
      }, 3500);
    }
  }, [isPlaying, isAdPlaying]);

  useEffect(() => {
    resetControlsTimeout();
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [isPlaying, isAdPlaying, resetControlsTimeout]);

  // Handle Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  /**
   * Finishes ad playback and transitions to main video.
   * Ensures the main video starts playing automatically.
   */
  const finishAdAndStartMainVideo = useCallback(() => {
    if (adSafetyTimeoutRef.current) {
      clearTimeout(adSafetyTimeoutRef.current);
      adSafetyTimeoutRef.current = null;
    }

    if (adsManagerRef.current) {
      try {
        adsManagerRef.current.destroy();
      } catch {}
      adsManagerRef.current = null;
    }

    setIsAdPlaying(false);
    setAdMode('none');
    setCanSkipAd(false);
    setAdClickThrough(null);
    currentFallbackAdRef.current = null;
    hasPlayedPreRollForVideoIdRef.current = video.id;

    // Restore main video
    if (videoRef.current) {
      const currentSrc = videoRef.current.src;
      const targetSrc = currentVideoSrc;
      if (currentSrc !== targetSrc) {
        videoRef.current.src = targetSrc;
        videoRef.current.load();
      }
      videoRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
          setIsLoading(false);
        })
        .catch((err) => {
          console.warn('Main video auto-play prevented (will wait for tap):', err);
          setIsPlaying(false);
          setIsLoading(false);
        });
    }
  }, [video.id, currentVideoSrc]);

  /**
   * Native Fallback VAST Player if Google IMA is blocked or errors.
   */
  const startFallbackVastAd = useCallback(async () => {
    try {
      const vastData = await fetchAndParseVast(HILLTOPADS_VAST_TAG_URL);
      if (!vastData || !vastData.mediaUrl || !videoRef.current) {
        // No ad fill or parse error -> proceed to main video immediately
        finishAdAndStartMainVideo();
        return;
      }

      currentFallbackAdRef.current = vastData;
      setAdMode('fallback');
      setIsAdPlaying(true);
      setAdDuration(vastData.duration);
      setAdTimeRemaining(vastData.duration);
      setAdClickThrough(vastData.clickThroughUrl || null);
      setCanSkipAd(vastData.skipOffset <= 0);
      setAdSkipCountdown(vastData.skipOffset);

      // Ping impression and start trackings
      vastData.impressions.forEach(pingTrackingUrl);
      vastData.trackStart.forEach(pingTrackingUrl);

      // Play ad video stream
      videoRef.current.src = vastData.mediaUrl;
      videoRef.current.load();
      videoRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
          setIsLoading(false);
        })
        .catch(() => {
          // If fallback ad play fails, skip straight to content
          finishAdAndStartMainVideo();
        });
    } catch {
      finishAdAndStartMainVideo();
    }
  }, [finishAdAndStartMainVideo]);

  /**
   * Initializes Google IMA SDK and requests pre-roll ad.
   */
  const requestPreRollAd = useCallback(() => {
    // Safety timeout: if ad network hangs or times out, start main video within 5.5s
    adSafetyTimeoutRef.current = setTimeout(() => {
      console.warn('Ad request timed out, proceeding to main video content');
      finishAdAndStartMainVideo();
    }, 5500);

    const googleIma = window.google?.ima;

    if (!googleIma || !adContainerRef.current || !videoRef.current) {
      // IMA SDK script not loaded (e.g. adblocker) -> use fallback VAST parser
      startFallbackVastAd();
      return;
    }

    try {
      // 1. Create AdDisplayContainer
      if (!adDisplayContainerRef.current) {
        adDisplayContainerRef.current = new googleIma.AdDisplayContainer(
          adContainerRef.current,
          videoRef.current
        );
      }

      // Initialize on user interaction / gesture
      try {
        adDisplayContainerRef.current.initialize();
      } catch {}

      // 2. Create AdsLoader
      if (!adsLoaderRef.current) {
        adsLoaderRef.current = new googleIma.AdsLoader(adDisplayContainerRef.current);
      }

      const adsLoader = adsLoaderRef.current;

      // Handle AdsManagerLoaded
      const onAdsManagerLoaded = (adsManagerLoadedEvent: any) => {
        if (adSafetyTimeoutRef.current) {
          clearTimeout(adSafetyTimeoutRef.current);
          adSafetyTimeoutRef.current = null;
        }

        const adsRenderingSettings = new googleIma.AdsRenderingSettings();
        adsRenderingSettings.restoreCustomPlaybackStateOnAdBreakComplete = true;

        const adsManager = adsManagerLoadedEvent.getAdsManager(
          videoRef.current,
          adsRenderingSettings
        );
        adsManagerRef.current = adsManager;

        // AdsManager Event Listeners
        adsManager.addEventListener(googleIma.AdErrorEvent.Type.AD_ERROR, (err: any) => {
          console.warn('IMA Ad Error:', err.getError?.());
          finishAdAndStartMainVideo();
        });

        adsManager.addEventListener(googleIma.AdEvent.Type.CONTENT_PAUSE_REQUESTED, () => {
          setIsAdPlaying(true);
          setAdMode('ima');
          if (videoRef.current) {
            videoRef.current.pause();
          }
        });

        adsManager.addEventListener(googleIma.AdEvent.Type.CONTENT_RESUME_REQUESTED, () => {
          finishAdAndStartMainVideo();
        });

        adsManager.addEventListener(googleIma.AdEvent.Type.ALL_ADS_COMPLETED, () => {
          finishAdAndStartMainVideo();
        });

        adsManager.addEventListener(googleIma.AdEvent.Type.COMPLETE, () => {
          finishAdAndStartMainVideo();
        });

        adsManager.addEventListener(googleIma.AdEvent.Type.SKIPPED, () => {
          finishAdAndStartMainVideo();
        });

        adsManager.addEventListener(googleIma.AdEvent.Type.STARTED, (adEvent: any) => {
          setIsAdPlaying(true);
          setAdMode('ima');
          const ad = adEvent.getAd();
          if (ad) {
            setAdDuration(ad.getDuration?.() || 30);
          }
        });

        adsManager.addEventListener(googleIma.AdEvent.Type.AD_PROGRESS, (adEvent: any) => {
          const adData = adEvent.getAdData?.();
          if (adData) {
            setAdTimeRemaining(Math.max(0, Math.round(adData.remainingTime || 0)));
          }
        });

        try {
          const width = containerRef.current?.clientWidth || 360;
          const height = containerRef.current?.clientHeight || 202;
          adsManager.init(width, height, googleIma.ViewMode.NORMAL);
          adsManager.start();
        } catch (initErr) {
          console.warn('Error starting IMA adsManager:', initErr);
          finishAdAndStartMainVideo();
        }
      };

      // Handle AdError on loader
      const onAdLoaderError = (adErrorEvent: any) => {
        console.warn('IMA Loader Ad Error (switching to VAST fallback):', adErrorEvent.getError?.());
        adsLoader.removeEventListener(googleIma.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED, onAdsManagerLoaded);
        adsLoader.removeEventListener(googleIma.AdErrorEvent.Type.AD_ERROR, onAdLoaderError);
        startFallbackVastAd();
      };

      adsLoader.addEventListener(
        googleIma.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED,
        onAdsManagerLoaded,
        { once: true }
      );
      adsLoader.addEventListener(
        googleIma.AdErrorEvent.Type.AD_ERROR,
        onAdLoaderError,
        { once: true }
      );

      // 3. Create AdsRequest
      const adsRequest = new googleIma.AdsRequest();
      adsRequest.adTagUrl = HILLTOPADS_VAST_TAG_URL;
      const width = containerRef.current?.clientWidth || 360;
      const height = containerRef.current?.clientHeight || 202;
      adsRequest.linearAdSlotWidth = width;
      adsRequest.linearAdSlotHeight = height;
      adsRequest.nonLinearAdSlotWidth = width;
      adsRequest.nonLinearAdSlotHeight = height;
      adsRequest.setAdWillAutoPlay(true);
      adsRequest.setAdWillPlayMuted(false);

      adsLoader.requestAds(adsRequest);
    } catch (err) {
      console.warn('IMA setup caught exception, running fallback:', err);
      startFallbackVastAd();
    }
  }, [finishAdAndStartMainVideo, startFallbackVastAd]);

  /**
   * Reset states when a new video is selected.
   * Only triggers pre-roll ad for a NEW video, NOT on pause/resume!
   */
  useEffect(() => {
    setIsLoading(true);
    setHasError(false);
    setErrorMessage('');
    setCurrentTime(0);
    setDuration(0);
    setShowControls(true);

    // If pre-roll hasn't been played for this video ID, trigger it
    if (hasPlayedPreRollForVideoIdRef.current !== video.id) {
      requestPreRollAd();
    } else {
      // Same video reloaded without ad
      if (videoRef.current) {
        videoRef.current.src = currentVideoSrc;
        videoRef.current.load();
        if (autoPlay) {
          videoRef.current.play().catch(() => {});
        }
      }
    }

    return () => {
      if (adSafetyTimeoutRef.current) {
        clearTimeout(adSafetyTimeoutRef.current);
      }
      if (adsManagerRef.current) {
        try {
          adsManagerRef.current.destroy();
        } catch {}
      }
    };
  }, [video.id, currentVideoSrc, requestPreRollAd, autoPlay]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch((err) => {
        console.warn('Playback request error:', err);
      });
    }
    resetControlsTimeout();
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isAdPlaying) return; // Do not allow seeking during pre-roll advertisement
    const targetTime = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = targetTime;
      setCurrentTime(targetTime);
    }
    resetControlsTimeout();
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const nextMuted = !isMuted;
    videoRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
    resetControlsTimeout();
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;

    try {
      if (!document.fullscreenElement) {
        if (containerRef.current.requestFullscreen) {
          await containerRef.current.requestFullscreen();
        } else if ((videoRef.current as any)?.webkitEnterFullscreen) {
          (videoRef.current as any).webkitEnterFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
      }
    } catch (err) {
      console.warn('Fullscreen toggle failed:', err);
    }
    resetControlsTimeout();
  };

  const handleSpeedSelect = (speed: number) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
      setPlaybackSpeed(speed);
      setShowSpeedMenu(false);
    }
    resetControlsTimeout();
  };

  const handleSkipAd = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (adMode === 'ima' && adsManagerRef.current) {
      try {
        adsManagerRef.current.skip();
      } catch {}
    }
    finishAdAndStartMainVideo();
  };

  const handleVisitAdvertiser = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (adClickThrough) {
      window.open(adClickThrough, '_blank', 'noopener,noreferrer');
    }
  };

  const retryPlayback = () => {
    setHasError(false);
    setIsLoading(true);
    if (videoRef.current) {
      videoRef.current.src = currentVideoSrc;
      videoRef.current.load();
      videoRef.current.play().catch(() => {});
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full aspect-video bg-black overflow-hidden select-none group ${
        isFullscreen ? 'w-screen h-screen' : ''
      }`}
      onClick={resetControlsTimeout}
    >
      {/* HTML5 Video Element (Handles main video as well as fallback VAST ad) */}
      <video
        ref={videoRef}
        src={isAdPlaying ? undefined : currentVideoSrc}
        poster={posterSrc || undefined}
        playsInline
        webkit-playsinline="true"
        autoPlay={autoPlay}
        preload="auto"
        className="w-full h-full object-contain"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={() => {
          if (!videoRef.current) return;
          const curr = videoRef.current.currentTime;
          const dur = videoRef.current.duration || 0;

          if (isAdPlaying && adMode === 'fallback') {
            const rem = Math.max(0, Math.ceil(dur - curr));
            setAdTimeRemaining(rem);

            const skipOff = currentFallbackAdRef.current?.skipOffset || 5;
            if (curr >= skipOff) {
              setCanSkipAd(true);
            } else {
              setAdSkipCountdown(Math.ceil(skipOff - curr));
            }
          } else if (!isAdPlaying) {
            setCurrentTime(curr);
          }
        }}
        onLoadedMetadata={() => {
          if (videoRef.current) {
            if (!isAdPlaying) {
              setDuration(videoRef.current.duration || 0);
            }
            setIsLoading(false);
          }
        }}
        onProgress={() => {
          if (!isAdPlaying && videoRef.current && videoRef.current.buffered.length > 0) {
            const bufferedEnd = videoRef.current.buffered.end(videoRef.current.buffered.length - 1);
            setBuffered((bufferedEnd / (videoRef.current.duration || 1)) * 100);
          }
        }}
        onWaiting={() => setIsLoading(true)}
        onPlaying={() => setIsLoading(false)}
        onEnded={() => {
          if (isAdPlaying) {
            // Ad ended -> complete tracking and start main video
            currentFallbackAdRef.current?.trackComplete.forEach(pingTrackingUrl);
            finishAdAndStartMainVideo();
          } else {
            setIsPlaying(false);
            setShowControls(true);
            onEnded?.();
          }
        }}
        onError={() => {
          if (isAdPlaying) {
            // Ad error -> gracefully proceed to main video
            console.warn('Ad playback error, transitioning to main video content');
            finishAdAndStartMainVideo();
          } else {
            // For the demo video: if the primary demo link fails (e.g. 403 AccessDenied from GCS), switch to reliable backup mirror
            if (isDemo && fallbackMirrorIndexRef.current < DEMO_BACKUP_URLS.length) {
              const nextMirror = DEMO_BACKUP_URLS[fallbackMirrorIndexRef.current++];
              console.info(`Primary demo URL unreachable, switching to backup stream mirror: ${nextMirror}`);
              setCurrentVideoSrc(nextMirror);
              if (videoRef.current) {
                videoRef.current.src = nextMirror;
                videoRef.current.load();
                videoRef.current.play().catch(() => {});
              }
              return;
            }

            setIsLoading(false);
            setHasError(true);
            const isExt = isExternalUrl(video.video_url);
            if (isExt) {
              setErrorMessage('Unable to load external video stream. The media host may be unreachable or restricting access.');
            } else {
              setErrorMessage('Unable to load video stream from Supabase storage.');
            }
          }
        }}
      />

      {/* Google IMA SDK Ad Display Container */}
      <div
        ref={adContainerRef}
        className="absolute inset-0 z-30"
        style={{
          display: isAdPlaying && adMode === 'ima' ? 'block' : 'none',
          pointerEvents: isAdPlaying ? 'auto' : 'none',
        }}
      />

      {/* Fallback Native VAST Pre-Roll UI Overlay */}
      {isAdPlaying && (
        <div className="absolute inset-0 z-30 pointer-events-none flex flex-col justify-between p-3">
          {/* Top Ad Info Badge */}
          <div className="flex items-center justify-between pointer-events-auto">
            <div className="flex items-center gap-2 bg-black/80 backdrop-blur-xs px-2.5 py-1 rounded-md border border-white/10 shadow-lg">
              <span className="bg-amber-400 text-black text-[10px] font-extrabold px-1.5 py-0.5 rounded tracking-wide uppercase">
                Ad
              </span>
              <span className="text-[11px] font-semibold text-slate-200">
                18+Only &middot; {adTimeRemaining > 0 ? `${adTimeRemaining}s` : 'Sponsored'}
              </span>
            </div>

            {adClickThrough && (
              <button
                onClick={handleVisitAdvertiser}
                className="flex items-center gap-1.5 bg-black/80 hover:bg-slate-900 border border-white/20 text-white text-[11px] font-semibold px-2.5 py-1.5 rounded-lg backdrop-blur-xs shadow-lg transition-transform active:scale-95"
              >
                <span>Visit Site</span>
                <ExternalLink className="w-3 h-3 text-red-400" />
              </button>
            )}
          </div>

          {/* Bottom Right Skip Button */}
          <div className="flex justify-end pointer-events-auto">
            {canSkipAd ? (
              <button
                onClick={handleSkipAd}
                className="flex items-center gap-1.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-xl transition-all active:scale-95"
              >
                <span>Skip Ad</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <div className="bg-black/80 backdrop-blur-xs text-slate-300 text-[11px] font-semibold px-3 py-1.5 rounded-xl border border-white/10">
                Skip in {adSkipCountdown}s
              </div>
            )}
          </div>
        </div>
      )}

      {/* Buffering Spinner */}
      {isLoading && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none z-20">
          <Loader2 className="w-10 h-10 text-red-500 animate-spin" />
        </div>
      )}

      {/* Error Fallback Overlay for Main Video */}
      {hasError && !isAdPlaying && (
        <div className="absolute inset-0 bg-[#080d18] flex flex-col items-center justify-center p-6 text-center z-20">
          <AlertCircle className="w-10 h-10 text-rose-500 mb-2" />
          <h4 className="text-sm font-bold text-white mb-1">Playback Error</h4>
          <p className="text-xs text-slate-400 max-w-xs mb-3">
            {errorMessage || 'Video stream could not be loaded.'}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={retryPlayback}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg shadow transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
          <span className="text-[11px] text-slate-500 mt-3 max-w-xs break-all">
            Source: {video.video_url || 'No URL specified'}
          </span>
        </div>
      )}

      {/* Main Video Controls Overlay (Hidden during ad break) */}
      {!isAdPlaying && (
        <div
          className={`absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/40 transition-opacity duration-300 flex flex-col justify-between p-3 z-10 ${
            showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          {/* Top bar with Video title */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-200 truncate max-w-[80%]">
              {video.title}
            </span>
            {/* Speed selector button */}
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSpeedMenu((prev) => !prev);
                }}
                className="px-2 py-1 bg-black/60 backdrop-blur-xs rounded text-[11px] font-semibold text-slate-200 hover:text-white flex items-center gap-1"
              >
                <Gauge className="w-3 h-3 text-red-400" />
                <span>{playbackSpeed}x</span>
              </button>
              {showSpeedMenu && (
                <div className="absolute right-0 top-7 bg-[#0d1424] border border-slate-800 rounded-lg shadow-xl p-1 z-30 flex flex-col gap-0.5">
                  {[0.5, 0.75, 1, 1.25, 1.5, 2].map((speed) => (
                    <button
                      key={speed}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSpeedSelect(speed);
                      }}
                      className={`px-3 py-1 text-xs text-left rounded ${
                        playbackSpeed === speed
                          ? 'bg-red-600 text-white font-bold'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Center Big Play/Pause Touch Button */}
          <div className="flex items-center justify-center">
            <button
              onClick={togglePlay}
              className="w-14 h-14 rounded-full bg-black/60 hover:bg-red-600/90 text-white border border-white/20 flex items-center justify-center backdrop-blur-md transition-all active:scale-95 shadow-xl"
              aria-label={isPlaying ? 'Pause video' : 'Play video'}
            >
              {isPlaying ? (
                <Pause className="w-7 h-7 fill-current" />
              ) : (
                <Play className="w-7 h-7 fill-current translate-x-0.5" />
              )}
            </button>
          </div>

          {/* Bottom Bar: Scrubber & Controls */}
          <div className="w-full space-y-1.5" onClick={(e) => e.stopPropagation()}>
            {/* Scrubber Progress bar */}
            <div className="relative w-full flex items-center h-4 cursor-pointer group/scrub">
              {/* Buffered track */}
              <div className="absolute left-0 right-0 h-1 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white/40 transition-all duration-150"
                  style={{ width: `${buffered}%` }}
                />
              </div>
              {/* Played track */}
              <div
                className="absolute left-0 h-1 bg-red-600 rounded-full pointer-events-none"
                style={{
                  width: `${duration ? (currentTime / duration) * 100 : 0}%`,
                }}
              />
              {/* Hidden native input for touch dragging */}
              <input
                type="range"
                min={0}
                max={duration || 100}
                step={0.1}
                value={currentTime}
                onChange={handleSeek}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>

            {/* Time & Action buttons */}
            <div className="flex items-center justify-between text-xs text-slate-200">
              <div className="flex items-center gap-3">
                <button
                  onClick={togglePlay}
                  className="hover:text-white p-1"
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
                </button>

                <button
                  onClick={toggleMute}
                  className="hover:text-white p-1"
                  aria-label={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
                </button>

                <span className="text-[11px] font-mono tabular-nums text-slate-300">
                  {formatPlayerTime(currentTime)} / {formatPlayerTime(duration)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={toggleFullscreen}
                  className="hover:text-white p-1"
                  aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                >
                  {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
