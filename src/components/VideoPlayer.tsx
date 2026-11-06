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
} from 'lucide-react';
import { Video } from '../types/database';
import { resolveMediaUrl } from '../lib/supabase';
import { formatPlayerTime } from '../lib/formatters';

interface VideoPlayerProps {
  video: Video;
  onEnded?: () => void;
  autoPlay?: boolean;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ video, onEnded, autoPlay = true }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showControls, setShowControls] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const videoSrc = resolveMediaUrl(video.video_url, 'videos');
  const posterSrc = resolveMediaUrl(video.thumbnail_url, 'videos');

  const resetControlsTimeout = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
        setShowSpeedMenu(false);
      }, 3500);
    }
  }, [isPlaying]);

  useEffect(() => {
    resetControlsTimeout();
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [isPlaying, resetControlsTimeout]);

  // Handle Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Reset states when video source changes
  useEffect(() => {
    setIsLoading(true);
    setHasError(false);
    setErrorMessage('');
    setCurrentTime(0);
    setDuration(0);
    setShowControls(true);
  }, [videoSrc]);

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

  const retryPlayback = () => {
    setHasError(false);
    setIsLoading(true);
    if (videoRef.current) {
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
      {/* HTML5 Video Element */}
      <video
        ref={videoRef}
        src={videoSrc}
        poster={posterSrc || undefined}
        playsInline
        webkit-playsinline="true"
        autoPlay={autoPlay}
        preload="auto"
        className="w-full h-full object-contain"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={() => {
          if (videoRef.current) {
            setCurrentTime(videoRef.current.currentTime);
          }
        }}
        onLoadedMetadata={() => {
          if (videoRef.current) {
            setDuration(videoRef.current.duration || 0);
            setIsLoading(false);
          }
        }}
        onProgress={() => {
          if (videoRef.current && videoRef.current.buffered.length > 0) {
            const bufferedEnd = videoRef.current.buffered.end(videoRef.current.buffered.length - 1);
            setBuffered((bufferedEnd / (videoRef.current.duration || 1)) * 100);
          }
        }}
        onWaiting={() => setIsLoading(true)}
        onPlaying={() => setIsLoading(false)}
        onEnded={() => {
          setIsPlaying(false);
          setShowControls(true);
          onEnded?.();
        }}
        onError={(e) => {
          setIsLoading(false);
          setHasError(true);
          setErrorMessage('Unable to load video stream from Supabase storage.');
        }}
      />

      {/* Buffering Spinner */}
      {isLoading && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
          <Loader2 className="w-10 h-10 text-red-500 animate-spin" />
        </div>
      )}

      {/* Error Fallback Overlay */}
      {hasError && (
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

      {/* Controls Overlay */}
      <div
        className={`absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/40 transition-opacity duration-300 flex flex-col justify-between p-3 ${
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
    </div>
  );
};
