import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  ThumbsUp,
  ThumbsDown,
  Share2,
  Clock,
  ChevronDown,
  ChevronUp,
  Send,
  MessageSquare,
  Check,
  Sparkles,
} from 'lucide-react';
import { Video, Comment } from '../types/database';
import { VideoPlayer } from './VideoPlayer';
import { formatViews, formatTimeAgo } from '../lib/formatters';
import {
  fetchVideoComments,
  postVideoComment,
  incrementVideoViews,
} from '../lib/supabase';
import { isVideoLiked, toggleLikedVideo, isWatchLater, toggleWatchLater, addToWatchHistory } from '../lib/storage';
import { isDemoVideo } from '../lib/demoVideo';
import { useToast } from './Toast';
import { AdBanner } from './AdBanner';

interface WatchPageProps {
  video: Video;
  allVideos: Video[];
  onBack: () => void;
  onSelectRelatedVideo: (video: Video) => void;
}

export const WatchPage: React.FC<WatchPageProps> = ({
  video,
  allVideos,
  onBack,
  onSelectRelatedVideo,
}) => {
  const { showToast } = useToast();
  const [descExpanded, setDescExpanded] = useState(false);
  const [isLiked, setIsLiked] = useState(() => isVideoLiked(video.id));
  const [isDisliked, setIsDisliked] = useState(false);
  const [isSaved, setIsSaved] = useState(() => isWatchLater(video.id));
  const [likeCount, setLikeCount] = useState(() => video.likes ?? 42);
  const [currentViews, setCurrentViews] = useState(() => video.views ?? 0);

  // Comments state
  const [comments, setComments] = useState<Comment[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [userName, setUserName] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(true);

  // Add to watch history and increment views once when mounting this video
  useEffect(() => {
    addToWatchHistory(video);
    incrementVideoViews(video).then((newCount) => {
      setCurrentViews(newCount);
    });
  }, [video.id]);

  // Load comments from Supabase comments table
  useEffect(() => {
    let isMounted = true;
    setCommentsLoading(true);
    fetchVideoComments(video.id).then((data) => {
      if (isMounted) {
        setComments(data);
        setCommentsLoading(false);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [video.id]);

  // Reset page scroll to top when video changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setDescExpanded(false);
    setIsLiked(isVideoLiked(video.id));
    setIsSaved(isWatchLater(video.id));
  }, [video.id]);

  const handleLike = () => {
    const next = toggleLikedVideo(video.id);
    setIsLiked(next);
    setLikeCount((prev) => (next ? prev + 1 : Math.max(0, prev - 1)));
    if (next && isDisliked) setIsDisliked(false);
    showToast(next ? 'Added to Liked Videos' : 'Removed from Liked Videos');
  };

  const handleDislike = () => {
    setIsDisliked((prev) => !prev);
    if (!isDisliked && isLiked) {
      setIsLiked(false);
      setLikeCount((prev) => Math.max(0, prev - 1));
      toggleLikedVideo(video.id);
    }
  };

  const handleWatchLater = () => {
    const next = toggleWatchLater(video);
    setIsSaved(next);
    showToast(next ? 'Saved to Watch Later' : 'Removed from Watch Later');
  };

  const handleShare = () => {
    if (navigator.share) {
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

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;

    setIsSubmittingComment(true);
    const author = userName.trim() || 'Anonymous Viewer';

    const result = await postVideoComment(video.id, author, newCommentText);
    setIsSubmittingComment(false);

    if (result.success && result.comment) {
      setComments((prev) => [result.comment!, ...prev]);
      setNewCommentText('');
      showToast('Comment posted successfully');
    } else {
      showToast(result.error || 'Could not post comment', 'error');
    }
  };

  // Filter related videos (same category or others, excluding current)
  const relatedVideos = allVideos
    .filter((v) => String(v.id) !== String(video.id))
    .slice(0, 8);

  const author = video.author_name || '18+Only Creator';

  return (
    <div className="min-h-screen bg-[#06090e] pb-24 text-slate-100">
      {/* Top sticky bar with back button */}
      <div className="sticky top-0 z-30 bg-[#06090e]/95 backdrop-blur-md px-3 h-12 flex items-center justify-between border-b border-slate-900/60">
        <button
          onClick={onBack}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-300 hover:text-white rounded-full transition-colors active:bg-slate-800/60 -ml-2"
          aria-label="Back to home"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <span className="text-xs font-semibold text-slate-300 truncate max-w-[200px]">
          18+Only Player
        </span>

        <button
          onClick={handleShare}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-300 hover:text-white rounded-full transition-colors active:bg-slate-800/60 -mr-2"
          aria-label="Share video"
        >
          <Share2 className="w-4 h-4" />
        </button>
      </div>

      {/* Embedded Video Player */}
      <div className="w-full sticky top-12 z-20 shadow-2xl bg-black">
        <VideoPlayer video={video} autoPlay={true} />
      </div>

      {/* Temporary Demo Notice */}
      {isDemoVideo(video.id) && (
        <div className="mx-4 mt-3 bg-amber-500/10 border border-amber-500/30 rounded-xl p-2.5 flex items-start gap-2.5 text-xs text-amber-300">
          <div className="w-2 h-2 rounded-full bg-amber-400 shrink-0 mt-1" />
          <div className="leading-tight">
            <span className="font-bold">Temporary Demo Video:</span>
            <span className="text-amber-200/90 ml-1">
              Not saved to Supabase. Created for testing mobile playback & HilltopAds VAST 3.0 pre-roll ad integration.
            </span>
          </div>
        </div>
      )}

      {/* Video Information Header */}
      <div className="px-4 pt-3.5 pb-2">
        <h1 className="text-base sm:text-lg font-bold text-white leading-snug font-['Outfit']">
          {video.title}
        </h1>

        <div className="flex items-center gap-2 text-xs text-slate-400 mt-1.5">
          <span className="font-medium text-slate-300">{formatViews(currentViews)}</span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span>{formatTimeAgo(video.created_at)}</span>
          {video.category && (
            <>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="text-red-400 font-medium">
                {typeof video.category === 'object' ? video.category.name : video.category}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Mobile Action Buttons Bar (Like, Dislike, Share, Save) */}
      <div className="px-4 py-2 border-y border-slate-900/80 overflow-x-auto no-scrollbar flex items-center gap-2">
        {/* Like & Dislike Segment */}
        <div className="flex items-center bg-[#101726] rounded-full border border-slate-800/80 divide-x divide-slate-800 shrink-0">
          <button
            onClick={handleLike}
            className={`min-h-[40px] px-3.5 flex items-center gap-1.5 text-xs font-semibold rounded-l-full transition-colors ${
              isLiked ? 'text-red-500 bg-red-500/10' : 'text-slate-300 hover:text-white'
            }`}
          >
            <ThumbsUp className={`w-3.5 h-3.5 ${isLiked ? 'fill-current' : ''}`} />
            <span>{likeCount}</span>
          </button>
          <button
            onClick={handleDislike}
            className={`min-h-[40px] px-3 flex items-center text-xs font-semibold rounded-r-full transition-colors ${
              isDisliked ? 'text-red-500 bg-red-500/10' : 'text-slate-300 hover:text-white'
            }`}
            aria-label="Dislike"
          >
            <ThumbsDown className={`w-3.5 h-3.5 ${isDisliked ? 'fill-current' : ''}`} />
          </button>
        </div>

        {/* Share Button */}
        <button
          onClick={handleShare}
          className="min-h-[40px] px-3.5 bg-[#101726] border border-slate-800/80 hover:bg-slate-800 rounded-full flex items-center gap-1.5 text-xs font-semibold text-slate-200 shrink-0 transition-colors"
        >
          <Share2 className="w-3.5 h-3.5" />
          <span>Share</span>
        </button>

        {/* Watch Later Button */}
        <button
          onClick={handleWatchLater}
          className={`min-h-[40px] px-3.5 border rounded-full flex items-center gap-1.5 text-xs font-semibold shrink-0 transition-colors ${
            isSaved
              ? 'bg-red-500/10 text-red-400 border-red-500/30'
              : 'bg-[#101726] text-slate-200 border-slate-800/80 hover:bg-slate-800'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>{isSaved ? 'Saved' : 'Watch Later'}</span>
        </button>
      </div>

      {/* Author Channel Strip */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-slate-900/60">
        <div className="flex items-center gap-2.5">
          {video.author_avatar ? (
            <img
              src={video.author_avatar}
              alt={author}
              className="w-10 h-10 rounded-full object-cover border border-slate-800"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-600 to-slate-900 text-white font-bold flex items-center justify-center text-xs shadow-inner">
              {author.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <h3 className="text-xs font-bold text-white">{author}</h3>
            <p className="text-[11px] text-slate-400">Verified Creator</p>
          </div>
        </div>

        <button
          onClick={() => showToast('Subscribed to channel updates')}
          className="min-h-[36px] px-3.5 rounded-full bg-white text-slate-950 font-bold text-xs hover:bg-slate-200 transition-colors active:scale-95 shadow-sm"
        >
          Subscribe
        </button>
      </div>

      {/* Description Box (Collapsible) */}
      <div className="px-4 py-3">
        <div
          onClick={() => setDescExpanded((prev) => !prev)}
          className="bg-[#0e1524] rounded-xl p-3 border border-slate-800/60 cursor-pointer hover:border-slate-700/80 transition-colors"
        >
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-1">
            <span>Description</span>
            <span className="text-slate-400 flex items-center gap-1">
              {descExpanded ? 'Show less' : 'Show more'}
              {descExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </span>
          </div>

          <p
            className={`text-xs text-slate-300 leading-relaxed whitespace-pre-line ${
              descExpanded ? '' : 'line-clamp-2'
            }`}
          >
            {video.description || 'No description provided for this video.'}
          </p>
        </div>
      </div>

      {/* Promoted Ad Slot Under Video Player */}
      <AdBanner placement="watch" />

      {/* Comments Section */}
      <section className="px-4 py-3 border-t border-slate-900/80">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-red-500" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Comments ({comments.length})
            </h2>
          </div>
        </div>

        {/* Comment Input Box */}
        <form onSubmit={handleCommentSubmit} className="mb-4 bg-[#0e1524] rounded-xl p-3 border border-slate-800/80 space-y-2">
          <input
            type="text"
            placeholder="Your name or handle (optional)"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            className="w-full bg-slate-900/60 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500/50"
          />
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Add a public comment..."
              value={newCommentText}
              onChange={(e) => setNewCommentText(e.target.value)}
              className="flex-1 bg-slate-900/60 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500/50"
            />
            <button
              type="submit"
              disabled={isSubmittingComment || !newCommentText.trim()}
              className="min-h-[36px] px-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors active:scale-95 shadow-md shadow-red-950"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>

        {/* Comments List */}
        <div className="space-y-3">
          {commentsLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="h-12 bg-slate-800/40 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : comments.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-2">
              No comments yet. Be the first to share your thoughts!
            </p>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="flex items-start gap-2.5 text-xs">
                <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center font-bold text-slate-300 shrink-0 text-[10px]">
                  {comment.user_name.slice(0, 1).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-slate-200 truncate">
                      {comment.user_name}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {formatTimeAgo(comment.created_at)}
                    </span>
                  </div>
                  <p className="text-slate-300 mt-0.5 leading-relaxed break-words">
                    {comment.comment_text}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Related Videos Section */}
      <section className="px-4 py-3 border-t border-slate-900/80">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
          Related Videos
        </h2>

        <div className="space-y-3">
          {relatedVideos.map((item, idx) => (
            <React.Fragment key={item.id}>
              <div
                onClick={() => onSelectRelatedVideo(item)}
                className="flex items-center gap-3 cursor-pointer group active:opacity-90"
              >
                <div className="w-32 aspect-video bg-[#0c121e] rounded-lg overflow-hidden shrink-0 relative">
                  {item.thumbnail_url ? (
                    <img
                      src={item.thumbnail_url}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full bg-[#11192b] flex items-center justify-center text-red-500">
                      <Sparkles className="w-4 h-4" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-semibold text-slate-200 line-clamp-2 leading-snug group-hover:text-red-400 transition-colors">
                    {item.title}
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                    {item.author_name || '18+Only Creator'}
                  </p>
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-0.5">
                    <span>{formatViews(item.views)}</span>
                    <span>·</span>
                    <span>{formatTimeAgo(item.created_at)}</span>
                  </div>
                </div>
              </div>

              {/* In-stream Ad after second related video */}
              {idx === 1 && <AdBanner placement="feed" className="my-2" />}
            </React.Fragment>
          ))}
        </div>
      </section>
    </div>
  );
};
