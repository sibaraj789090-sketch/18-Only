import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  Lock,
  ArrowLeft,
  LogOut,
  Plus,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  Check,
  X,
  Upload,
  Film,
  Sparkles,
  Layers,
  Search,
  ExternalLink,
  AlertCircle,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { Video, Category } from '../types/database';
import {
  signInAdmin,
  signOutAdmin,
  verifyCurrentAdminUser,
  fetchAllAdminVideos,
  createAdminVideo,
  updateAdminVideo,
  deleteAdminVideo,
  createAdminCategory,
  deleteAdminCategory,
  uploadToStorage,
  fetchCategories,
} from '../lib/supabase';
import { useToast } from './Toast';

interface AdminPanelProps {
  onBackToSite: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ onBackToSite }) => {
  const { showToast } = useToast();

  // Authentication State
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Dashboard Data State
  const [adminVideos, setAdminVideos] = useState<Video[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [activeTab, setActiveTab] = useState<'videos' | 'new-video' | 'categories'>('videos');
  const [searchFilter, setSearchFilter] = useState('');

  // New / Edit Video Form State
  const [editingVideo, setEditingVideo] = useState<Video | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formVideoUrl, setFormVideoUrl] = useState('');
  const [formThumbnailUrl, setFormThumbnailUrl] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formDuration, setFormDuration] = useState('');
  const [formIsPublished, setFormIsPublished] = useState(true);
  const [formFeatured, setFormFeatured] = useState(false);
  const [isSavingVideo, setIsSavingVideo] = useState(false);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);

  // New Category Form State
  const [newCatName, setNewCatName] = useState('');
  const [isAddingCat, setIsAddingCat] = useState(false);

  // Delete confirmation
  const [deletingVideoId, setDeletingVideoId] = useState<string | number | null>(null);

  // 1. Check existing verified admin session
  const checkAuth = useCallback(async () => {
    setIsCheckingAuth(true);
    const user = await verifyCurrentAdminUser();
    setCurrentUser(user);
    setIsCheckingAuth(false);
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // 2. Load dashboard data once authenticated
  const loadDashboardData = useCallback(async () => {
    if (!currentUser) return;
    setIsLoadingData(true);
    const [vids, cats] = await Promise.all([
      fetchAllAdminVideos(),
      fetchCategories(),
    ]);
    setAdminVideos(vids);
    setCategories(cats);
    if (cats.length > 0 && !formCategory) {
      setFormCategory(cats[0].name);
    }
    setIsLoadingData(false);
  }, [currentUser, formCategory]);

  useEffect(() => {
    if (currentUser) {
      loadDashboardData();
    }
  }, [currentUser, loadDashboardData]);

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if (!loginEmail.trim() || !loginPassword.trim()) {
      setLoginError('Please enter both email and password.');
      return;
    }

    setIsLoggingIn(true);
    const res = await signInAdmin(loginEmail, loginPassword);
    setIsLoggingIn(false);

    if (res.success && res.user) {
      setCurrentUser(res.user);
      showToast('Admin session verified successfully');
      setLoginPassword('');
    } else {
      setLoginError(res.error || 'Authentication failed. Access restricted to authorized admins.');
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    await signOutAdmin();
    setCurrentUser(null);
    showToast('Signed out of Admin Panel');
  };

  // Toggle Video Published Status
  const handleTogglePublished = async (video: Video) => {
    const nextStatus = !video.is_published;
    const res = await updateAdminVideo(video.id, { is_published: nextStatus });
    if (res.success) {
      setAdminVideos((prev) =>
        prev.map((v) => (v.id === video.id ? { ...v, is_published: nextStatus } : v))
      );
      showToast(nextStatus ? 'Video published to live site' : 'Video moved to drafts');
    } else {
      showToast(res.error || 'Failed to update video status', 'error');
    }
  };

  // Toggle Video Featured Status
  const handleToggleFeatured = async (video: Video) => {
    const nextStatus = !video.featured;
    const res = await updateAdminVideo(video.id, { featured: nextStatus });
    if (res.success) {
      setAdminVideos((prev) =>
        prev.map((v) => (v.id === video.id ? { ...v, featured: nextStatus } : v))
      );
      showToast(nextStatus ? 'Marked as Featured Spotlight' : 'Removed from Featured');
    } else {
      showToast(res.error || 'Failed to update featured status', 'error');
    }
  };

  // Delete Video
  const handleConfirmDeleteVideo = async () => {
    if (!deletingVideoId) return;
    const res = await deleteAdminVideo(deletingVideoId);
    if (res.success) {
      setAdminVideos((prev) => prev.filter((v) => v.id !== deletingVideoId));
      showToast('Video deleted successfully');
      setDeletingVideoId(null);
    } else {
      showToast(res.error || 'Failed to delete video', 'error');
    }
  };

  // Open Edit Form
  const handleStartEdit = (video: Video) => {
    setEditingVideo(video);
    setFormTitle(video.title);
    setFormDescription(video.description || '');
    setFormVideoUrl(video.video_url || '');
    setFormThumbnailUrl(video.thumbnail_url || '');
    setFormCategory(
      typeof video.category === 'object' && video.category
        ? video.category.name
        : String(video.category || 'Entertainment')
    );
    setFormDuration(video.duration ? String(video.duration) : '');
    setFormIsPublished(video.is_published ?? true);
    setFormFeatured(video.featured ?? false);
    setActiveTab('new-video');
  };

  // Clear Form
  const resetForm = () => {
    setEditingVideo(null);
    setFormTitle('');
    setFormDescription('');
    setFormVideoUrl('');
    setFormThumbnailUrl('');
    setFormDuration('');
    setFormIsPublished(true);
    setFormFeatured(false);
  };

  // Save (Create or Update) Video
  const handleSaveVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formVideoUrl.trim()) {
      showToast('Please provide both Title and Video URL', 'error');
      return;
    }

    setIsSavingVideo(true);

    const payload: Partial<Video> = {
      title: formTitle.trim(),
      description: formDescription.trim(),
      video_url: formVideoUrl.trim(),
      thumbnail_url: formThumbnailUrl.trim() || null,
      category: formCategory || 'Entertainment',
      duration: formDuration.trim() || undefined,
      is_published: formIsPublished,
      featured: formFeatured,
    };

    if (editingVideo) {
      const res = await updateAdminVideo(editingVideo.id, payload);
      setIsSavingVideo(false);
      if (res.success) {
        showToast('Video updated successfully');
        resetForm();
        setActiveTab('videos');
        loadDashboardData();
      } else {
        showToast(res.error || 'Failed to update video', 'error');
      }
    } else {
      const res = await createAdminVideo(payload);
      setIsSavingVideo(false);
      if (res.success && res.video) {
        showToast('Video uploaded & published successfully');
        resetForm();
        setActiveTab('videos');
        loadDashboardData();
      } else {
        showToast(res.error || 'Failed to create video', 'error');
      }
    }
  };

  // Upload file to Supabase storage bucket 'videos'
  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'video' | 'thumbnail'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingMedia(true);
    showToast(`Uploading ${type}...`);

    const folder = type === 'video' ? 'videos' : 'thumbnails';
    const res = await uploadToStorage(file, 'videos', folder);
    setIsUploadingMedia(false);

    if (res.success && res.url) {
      if (type === 'video') {
        setFormVideoUrl(res.url);
      } else {
        setFormThumbnailUrl(res.url);
      }
      showToast(`${type === 'video' ? 'Video' : 'Thumbnail'} uploaded to Supabase storage`);
    } else {
      showToast(res.error || 'Upload failed', 'error');
    }
  };

  // Add Category
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    setIsAddingCat(true);
    const res = await createAdminCategory(newCatName.trim());
    setIsAddingCat(false);

    if (res.success && res.category) {
      setCategories((prev) => [...prev, res.category!]);
      setNewCatName('');
      showToast(`Category "${res.category.name}" added`);
    } else {
      showToast(res.error || 'Failed to add category', 'error');
    }
  };

  // Delete Category
  const handleDeleteCategory = async (cat: Category) => {
    if (!confirm(`Are you sure you want to delete category "${cat.name}"?`)) return;
    const res = await deleteAdminCategory(cat.id);
    if (res.success) {
      setCategories((prev) => prev.filter((c) => c.id !== cat.id));
      showToast(`Category "${cat.name}" deleted`);
    } else {
      showToast(res.error || 'Failed to delete category', 'error');
    }
  };

  // Filtered admin videos list
  const filteredVideos = adminVideos.filter((v) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      v.title.toLowerCase().includes(q) ||
      (v.description || '').toLowerCase().includes(q) ||
      String(v.category || '').toLowerCase().includes(q)
    );
  });

  // Calculate Metrics
  const totalCount = adminVideos.length;
  const publishedCount = adminVideos.filter((v) => v.is_published).length;
  const draftCount = totalCount - publishedCount;

  // 1. Loading View while checking session
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-[#06090e] flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-red-500 animate-spin mb-3" />
        <span className="text-xs text-slate-400 font-medium">Verifying authorization...</span>
      </div>
    );
  }

  // 2. Unauthenticated Visitor -> Secure Login Gate
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#06090e] text-slate-100 flex flex-col justify-between p-4 max-w-md mx-auto">
        {/* Top return bar */}
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={onBackToSite}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-2 py-1.5 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to cardingx.in</span>
          </button>
          <span className="text-[11px] text-red-500 font-mono font-bold tracking-wider">
            /admin
          </span>
        </div>

        {/* Secure Sign-in Card */}
        <div className="my-auto py-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-red-950 to-slate-900 border border-red-500/30 flex items-center justify-center text-red-400 mx-auto mb-4 shadow-xl shadow-red-950/40">
            <Lock className="w-7 h-7" />
          </div>

          <div className="text-center mb-6">
            <h1 className="text-xl font-bold text-white font-['Outfit']">
              Cardingx Administrator Portal
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Authorized admin authentication & management
            </p>
          </div>

          <form
            onSubmit={handleLogin}
            className="bg-[#0e1628] rounded-2xl border border-slate-800 p-5 space-y-3.5 shadow-2xl"
          >
            {loginError && (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/80 text-rose-200 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span className="leading-tight">{loginError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Admin Email
              </label>
              <input
                type="email"
                autoComplete="email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="admin@cardingx.in"
                className="w-full bg-[#080d19] border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Password
              </label>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-[#080d19] border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-red-950 flex items-center justify-center gap-2 active:scale-[0.99] mt-2"
            >
              {isLoggingIn ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4" />
                  <span>Sign In as Administrator</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center text-[10px] text-slate-600 pb-2">
          Protected by Supabase Authentication &middot; RLS Enforced
        </div>
      </div>
    );
  }

  // 3. Authenticated Admin Dashboard
  return (
    <div className="min-h-screen bg-[#06090e] text-slate-100 flex flex-col font-['Outfit'] pb-20">
      {/* Top Admin Header */}
      <header className="sticky top-0 z-30 bg-[#0a101f]/95 backdrop-blur-md border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="bg-red-600 text-white font-extrabold px-2 py-0.5 rounded text-xs">
            ADMIN
          </div>
          <div>
            <h1 className="text-sm font-bold text-white leading-tight">Cardingx Control Panel</h1>
            <p className="text-[10px] text-emerald-400 font-mono truncate max-w-[160px]">
              {currentUser.email}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onBackToSite}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-medium text-slate-300 transition-colors"
            title="View Live Website"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Live Site</span>
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-950/40 border border-rose-900/60 hover:bg-rose-900/40 rounded-lg text-xs font-semibold text-rose-300 transition-colors"
            title="Sign Out"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* Main Admin View Container */}
      <div className="w-full max-w-4xl mx-auto p-4 space-y-4">
        {/* Metrics Summary Strip */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="bg-[#0e1628] border border-slate-800 rounded-xl p-3 text-center">
            <span className="text-[11px] text-slate-400 block font-medium">Total Videos</span>
            <span className="text-lg font-black text-white">{totalCount}</span>
          </div>
          <div className="bg-[#0e1628] border border-slate-800 rounded-xl p-3 text-center">
            <span className="text-[11px] text-emerald-400 block font-medium">Published</span>
            <span className="text-lg font-black text-emerald-400">{publishedCount}</span>
          </div>
          <div className="bg-[#0e1628] border border-slate-800 rounded-xl p-3 text-center">
            <span className="text-[11px] text-amber-400 block font-medium">Drafts</span>
            <span className="text-lg font-black text-amber-400">{draftCount}</span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center bg-[#0d1424] p-1 rounded-xl border border-slate-800 text-xs font-semibold gap-1">
          <button
            onClick={() => {
              setActiveTab('videos');
              resetForm();
            }}
            className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
              activeTab === 'videos'
                ? 'bg-red-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            <span>Manage Videos ({adminVideos.length})</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('new-video');
              if (!editingVideo) resetForm();
            }}
            className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
              activeTab === 'new-video'
                ? 'bg-red-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{editingVideo ? 'Edit Video' : 'Add Video'}</span>
          </button>

          <button
            onClick={() => setActiveTab('categories')}
            className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
              activeTab === 'categories'
                ? 'bg-red-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Categories ({categories.length})</span>
          </button>
        </div>

        {/* Tab 1: Video Management List */}
        {activeTab === 'videos' && (
          <div className="space-y-3">
            {/* Search and Action Bar */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Filter videos by title or category..."
                  className="w-full bg-[#0e1628] border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
                />
              </div>
              <button
                onClick={() => {
                  resetForm();
                  setActiveTab('new-video');
                }}
                className="px-3.5 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shrink-0 shadow-md transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Add Video</span>
              </button>
            </div>

            {isLoadingData ? (
              <div className="py-12 text-center">
                <Loader2 className="w-6 h-6 text-red-500 animate-spin mx-auto mb-2" />
                <span className="text-xs text-slate-400">Loading videos from database...</span>
              </div>
            ) : filteredVideos.length > 0 ? (
              <div className="space-y-2.5">
                {filteredVideos.map((video) => (
                  <div
                    key={video.id}
                    className="bg-[#0e1628] border border-slate-800/80 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-700 transition-colors"
                  >
                    {/* Video Left Thumbnail & Info */}
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-24 aspect-video bg-black rounded-lg overflow-hidden shrink-0 relative">
                        {video.thumbnail_url ? (
                          <img
                            src={video.thumbnail_url}
                            alt={video.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-600 text-xs">
                            No Thumb
                          </div>
                        )}
                        {video.duration && (
                          <span className="absolute bottom-1 right-1 bg-black/80 text-[9px] font-mono px-1 rounded text-white">
                            {video.duration}
                          </span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                              video.is_published
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            }`}
                          >
                            {video.is_published ? 'Published' : 'Draft'}
                          </span>
                          {video.featured && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-600/30 text-red-300 border border-red-500/30 font-bold flex items-center gap-0.5">
                              <Sparkles className="w-2.5 h-2.5" />
                              <span>Featured</span>
                            </span>
                          )}
                          <span className="text-[11px] text-slate-400">
                            {typeof video.category === 'object' && video.category
                              ? video.category.name
                              : String(video.category || 'General')}
                          </span>
                        </div>

                        <h3 className="text-xs font-bold text-white truncate mt-1">
                          {video.title}
                        </h3>

                        <p className="text-[11px] text-slate-400 truncate max-w-sm">
                          {video.video_url}
                        </p>
                      </div>
                    </div>

                    {/* Action Controls */}
                    <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                      {/* Publish/Unpublish */}
                      <button
                        onClick={() => handleTogglePublished(video)}
                        className={`p-2 rounded-lg border text-xs font-semibold flex items-center gap-1 transition-colors ${
                          video.is_published
                            ? 'bg-amber-950/20 border-amber-800/60 text-amber-300 hover:bg-amber-900/30'
                            : 'bg-emerald-950/20 border-emerald-800/60 text-emerald-300 hover:bg-emerald-900/30'
                        }`}
                        title={video.is_published ? 'Unpublish to Draft' : 'Publish to Live Site'}
                      >
                        {video.is_published ? (
                          <>
                            <EyeOff className="w-3.5 h-3.5" />
                            <span className="hidden md:inline">Unpublish</span>
                          </>
                        ) : (
                          <>
                            <Eye className="w-3.5 h-3.5" />
                            <span className="hidden md:inline">Publish</span>
                          </>
                        )}
                      </button>

                      {/* Featured toggle */}
                      <button
                        onClick={() => handleToggleFeatured(video)}
                        className={`p-2 rounded-lg border text-xs font-semibold transition-colors ${
                          video.featured
                            ? 'bg-red-600/20 border-red-500/40 text-red-300'
                            : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:text-white'
                        }`}
                        title="Toggle Featured Spotlight"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                      </button>

                      {/* Edit */}
                      <button
                        onClick={() => handleStartEdit(video)}
                        className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                        title="Edit Details"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => setDeletingVideoId(video.id)}
                        className="p-2 rounded-lg bg-rose-950/40 border border-rose-900/60 hover:bg-rose-900/40 text-rose-300 transition-colors"
                        title="Delete Video"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center bg-[#0e1628] rounded-xl border border-slate-800 p-6">
                <Film className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <h4 className="text-xs font-bold text-slate-200">No videos found</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                  {searchFilter
                    ? 'No videos match your search term.'
                    : 'Your videos table is currently empty. Click "Add Video" to upload your first stream!'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Add or Edit Video Form */}
        {activeTab === 'new-video' && (
          <form
            onSubmit={handleSaveVideo}
            className="bg-[#0e1628] border border-slate-800 rounded-2xl p-5 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Film className="w-4 h-4 text-red-500" />
                <span>{editingVideo ? 'Edit Video Details' : 'Upload & Add New Video'}</span>
              </h2>
              {editingVideo && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Cancel Edit
                </button>
              )}
            </div>

            {/* Video Title */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Video Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Enter video title..."
                className="w-full bg-[#080d19] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
              />
            </div>

            {/* Video Description */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Description
              </label>
              <textarea
                rows={3}
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Video overview and details..."
                className="w-full bg-[#080d19] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
              />
            </div>

            {/* Video URL & File Upload to Bucket */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-300">
                  Video URL or Storage Path <span className="text-red-500">*</span>
                </label>
                <label className="text-[11px] text-red-400 hover:text-red-300 font-semibold cursor-pointer flex items-center gap-1">
                  <Upload className="w-3 h-3" />
                  <span>Upload MP4 to Storage</span>
                  <input
                    type="file"
                    accept="video/mp4,video/webm"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e, 'video')}
                    disabled={isUploadingMedia}
                  />
                </label>
              </div>
              <input
                type="text"
                required
                value={formVideoUrl}
                onChange={(e) => setFormVideoUrl(e.target.value)}
                placeholder="https://... or bucket file path (e.g. clip.mp4)"
                className="w-full bg-[#080d19] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-red-500"
              />
            </div>

            {/* Thumbnail URL & File Upload */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-300">
                  Thumbnail URL (Optional)
                </label>
                <label className="text-[11px] text-red-400 hover:text-red-300 font-semibold cursor-pointer flex items-center gap-1">
                  <Upload className="w-3 h-3" />
                  <span>Upload Poster Image</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e, 'thumbnail')}
                    disabled={isUploadingMedia}
                  />
                </label>
              </div>
              <input
                type="text"
                value={formThumbnailUrl}
                onChange={(e) => setFormThumbnailUrl(e.target.value)}
                placeholder="https://... or image path"
                className="w-full bg-[#080d19] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-red-500"
              />
            </div>

            {/* Category & Duration */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Category
                </label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full bg-[#080d19] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
                >
                  {categories.map((c) => (
                    <option key={c.id || c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Duration (e.g. 14:20)
                </label>
                <input
                  type="text"
                  value={formDuration}
                  onChange={(e) => setFormDuration(e.target.value)}
                  placeholder="14:20"
                  className="w-full bg-[#080d19] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
                />
              </div>
            </div>

            {/* Status Checkboxes */}
            <div className="pt-2 flex flex-wrap items-center gap-4 text-xs text-slate-300">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={formIsPublished}
                  onChange={(e) => setFormIsPublished(e.target.checked)}
                  className="rounded text-red-600 focus:ring-0 bg-slate-800"
                />
                <span>Publish to live site immediately</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={formFeatured}
                  onChange={(e) => setFormFeatured(e.target.checked)}
                  className="rounded text-red-600 focus:ring-0 bg-slate-800"
                />
                <span>Set as Featured Video Spotlight</span>
              </label>
            </div>

            {/* Submit Action */}
            <div className="pt-3 flex items-center gap-2">
              <button
                type="submit"
                disabled={isSavingVideo}
                className="flex-1 py-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-colors shadow-lg shadow-red-950 flex items-center justify-center gap-2"
              >
                {isSavingVideo ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving Video Record...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>{editingVideo ? 'Update Video Record' : 'Save & Publish Video'}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setActiveTab('videos');
                }}
                className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Tab 3: Categories Management */}
        {activeTab === 'categories' && (
          <div className="space-y-4">
            {/* Add Category Form */}
            <form
              onSubmit={handleAddCategory}
              className="bg-[#0e1628] border border-slate-800 rounded-2xl p-4 flex items-center gap-2"
            >
              <input
                type="text"
                required
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="New Category Name (e.g. Comedy, Podcast)..."
                className="flex-1 bg-[#080d19] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
              />
              <button
                type="submit"
                disabled={isAddingCat || !newCatName.trim()}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-colors flex items-center gap-1.5 shrink-0"
              >
                {isAddingCat ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                <span>Add</span>
              </button>
            </form>

            {/* Categories List */}
            <div className="bg-[#0e1628] border border-slate-800 rounded-2xl divide-y divide-slate-800/80 overflow-hidden">
              {categories.map((cat) => (
                <div
                  key={cat.id || cat.name}
                  className="p-3.5 flex items-center justify-between text-xs hover:bg-slate-800/30 transition-colors"
                >
                  <div>
                    <h4 className="font-bold text-white">{cat.name}</h4>
                    <span className="text-[11px] text-slate-400 font-mono">
                      slug: {cat.slug || cat.name.toLowerCase()}
                    </span>
                  </div>

                  <button
                    onClick={() => handleDeleteCategory(cat)}
                    className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition-colors"
                    title="Delete Category"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deletingVideoId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
          <div className="bg-[#0e1628] border border-slate-800 rounded-2xl p-5 max-w-sm w-full space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500" />
              <span>Confirm Video Deletion</span>
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to delete this video from the database? This action cannot be undone.
            </p>
            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                onClick={() => setDeletingVideoId(null)}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeleteVideo}
                className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
