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
  ImageIcon,
  Megaphone,
  RefreshCw,
  Sliders,
  PlaySquare,
  HelpCircle,
} from 'lucide-react';
import {
  getAdConfig,
  saveAdConfig,
  resetAdConfig,
  testVastTag,
  GOOGLE_SAMPLE_VAST_TAG_URL,
  HILLTOPADS_VAST_TAG_URL,
  AdConfig,
} from '../lib/vast';
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
  uploadPosterImage,
  resolveMediaUrl,
  fetchCategories,
  resetAdminPassword,
  DEFAULT_CATEGORIES,
} from '../lib/supabase';
import { useToast } from './Toast';

interface AdminPanelProps {
  onBackToSite: () => void;
  onOpenConfig?: () => void;
  isConfigured?: boolean;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  onBackToSite,
  onOpenConfig,
  isConfigured = true,
}) => {
  const { showToast } = useToast();

  // Authentication State
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [loginEmail, setLoginEmail] = useState('ladandas22@gmail.com');
  const [loginPassword, setLoginPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Dashboard Data State
  const [adminVideos, setAdminVideos] = useState<Video[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [activeTab, setActiveTab] = useState<'videos' | 'new-video' | 'categories' | 'ads'>('videos');
  const [searchFilter, setSearchFilter] = useState('');

  // Ad Settings State
  const [adConfig, setAdConfigState] = useState<AdConfig>(getAdConfig());
  const [isTestingAdTag, setIsTestingAdTag] = useState(false);
  const [adTestStatus, setAdTestStatus] = useState<{
    tested: boolean;
    success: boolean;
    message: string;
    mediaUrl?: string | null;
  } | null>(null);
  const [isSavingAdConfig, setIsSavingAdConfig] = useState(false);

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
  const [isUploadingPoster, setIsUploadingPoster] = useState(false);
  const [posterUploadNote, setPosterUploadNote] = useState('');

  // New Category Form State
  const [newCatName, setNewCatName] = useState('');
  const [isAddingCat, setIsAddingCat] = useState(false);

  // Delete confirmation
  const [deletingVideoId, setDeletingVideoId] = useState<string | number | null>(null);

  const handleSaveAdConfig = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSavingAdConfig(true);
    try {
      saveAdConfig(adConfig);
      showToast('Ad configuration saved! Changes are now live.', 'success');
    } catch {
      showToast('Failed to save ad settings.', 'error');
    } finally {
      setIsSavingAdConfig(false);
    }
  };

  const handleTestAdTag = async () => {
    if (!adConfig.tagUrl.trim()) {
      showToast('Please enter a VAST Tag URL to test.', 'error');
      return;
    }
    setIsTestingAdTag(true);
    setAdTestStatus(null);
    try {
      const result = await testVastTag(adConfig.tagUrl);
      setAdTestStatus({
        tested: true,
        success: result.success,
        message: result.message,
        mediaUrl: result.mediaUrl,
      });
      if (result.success) {
        showToast('VAST Tag test passed! Ad XML and media file detected.', 'success');
      } else {
        showToast(result.message, 'error');
      }
    } catch (err: any) {
      setAdTestStatus({
        tested: true,
        success: false,
        message: err?.message || 'Failed to ping VAST tag URL.',
      });
      showToast('VAST Tag test failed.', 'error');
    } finally {
      setIsTestingAdTag(false);
    }
  };

  const handleResetAdConfig = () => {
    const def = resetAdConfig();
    setAdConfigState(def);
    setAdTestStatus(null);
    showToast('Reset ad settings to default working configuration.', 'info');
  };

  // 1. Check existing verified admin session with 2.5s safety timeout
  const checkAuth = useCallback(async () => {
    setIsCheckingAuth(true);
    try {
      const authPromise = verifyCurrentAdminUser();
      const timeoutPromise = new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), 2500)
      );
      const user = await Promise.race([authPromise, timeoutPromise]);
      setCurrentUser(user);
    } catch (err) {
      console.warn('Session verification notice:', err);
      setCurrentUser(null);
    } finally {
      setIsCheckingAuth(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // 2. Load dashboard data once authenticated
  const loadDashboardData = useCallback(async () => {
    if (!currentUser) return;
    setIsLoadingData(true);
    try {
      const [vids, cats] = await Promise.all([
        fetchAllAdminVideos(),
        fetchCategories(),
      ]);
      setAdminVideos(vids);
      setCategories(cats);
      if (cats.length > 0 && !formCategory) {
        setFormCategory(cats[0].name);
      }
    } catch (e) {
      console.warn('Admin dashboard load warning:', e);
    } finally {
      setIsLoadingData(false);
    }
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

    if (loginEmail.trim().toLowerCase() !== 'ladandas22@gmail.com') {
      setLoginError('Security Restriction: Only the owner email (ladandas22@gmail.com) is authorized to log in. Dusra koi bhi Gmail se login allowed nahi hai.');
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

  // Handle Forgot Password
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const handleForgotPassword = async () => {
    if (!loginEmail.trim()) {
      setLoginError('Please enter your email above first to receive the reset link.');
      return;
    }
    if (loginEmail.trim().toLowerCase() !== 'ladandas22@gmail.com') {
      setLoginError('Password reset is restricted strictly to the owner email (ladandas22@gmail.com).');
      return;
    }
    setIsResettingPassword(true);
    setLoginError('');
    const res = await resetAdminPassword(loginEmail);
    setIsResettingPassword(false);
    if (res.success) {
      showToast(res.message);
    } else {
      setLoginError(res.message);
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
    setPosterUploadNote(video.thumbnail_url ? 'Existing poster loaded' : '');
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
    setPosterUploadNote('');
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

    const matchedCategory = (categories.length > 0 ? categories : DEFAULT_CATEGORIES).find(
      (c) =>
        c.name.toLowerCase() === (formCategory || '').toLowerCase() ||
        String(c.id).toLowerCase() === (formCategory || '').toLowerCase()
    );

    const payload: Partial<Video> = {
      title: formTitle.trim(),
      description: formDescription.trim(),
      video_url: formVideoUrl.trim(),
      thumbnail_url: formThumbnailUrl.trim() || null,
      category: formCategory || 'Entertainment',
      category_id: matchedCategory ? matchedCategory.id : formCategory,
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

  // Upload file (video file or poster image with universal format support & compression)
  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'video' | 'thumbnail'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (type === 'thumbnail') {
      setIsUploadingPoster(true);
      showToast('Processing & optimizing poster image...');
      try {
        const res = await uploadPosterImage(file);
        setIsUploadingPoster(false);
        if (res.success && res.url) {
          setFormThumbnailUrl(res.url);
          setPosterUploadNote(res.note || 'Poster ready');
          showToast(res.note || 'Poster photo uploaded successfully');
        } else {
          showToast(res.error || 'Failed to process poster image', 'error');
        }
      } catch (err: unknown) {
        setIsUploadingPoster(false);
        const msg = err instanceof Error ? err.message : 'Poster upload failed';
        showToast(msg, 'error');
      }
      e.target.value = '';
      return;
    }

    // Video upload
    setIsUploadingMedia(true);
    showToast('Uploading video file to storage...');
    const res = await uploadToStorage(file, 'videos', 'videos');
    setIsUploadingMedia(false);

    if (res.success && res.url) {
      setFormVideoUrl(res.url);
      showToast('Video file uploaded successfully');
    } else {
      showToast(res.error || 'Video upload failed', 'error');
    }
    e.target.value = '';
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
            /admin/siba
          </span>
        </div>

        {/* Secure Sign-in Card */}
        <div className="my-auto py-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-red-950 to-slate-900 border border-red-500/30 flex items-center justify-center text-red-500 mx-auto mb-4 shadow-xl shadow-red-950/40">
            <Lock className="w-8 h-8" />
          </div>

          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-1.5 bg-red-600/15 border border-red-500/30 px-3 py-1 rounded-full mb-2.5">
              <span className="bg-red-600 text-white font-extrabold px-1.5 py-0.5 rounded text-[10px] leading-none">18+</span>
              <span className="text-xs font-bold text-white tracking-wide font-['Outfit']">Cardingx Video</span>
            </div>
            <h1 className="text-xl font-bold text-white font-['Outfit']">
              Cardingx Admin Console
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
              18+Only Video Streaming Platform Management. Authenticate with verified administrator credentials.
            </p>
          </div>

          <form
            onSubmit={handleLogin}
            className="bg-[#0e1628] rounded-2xl border border-slate-800 p-5 space-y-3.5 shadow-2xl"
          >
            {!isConfigured && onOpenConfig && (
              <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-800/80 text-amber-200 text-xs flex items-center justify-between gap-2">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span className="leading-tight">Supabase is not configured yet.</span>
                </div>
                <button
                  type="button"
                  onClick={onOpenConfig}
                  className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] rounded-lg shrink-0 transition-colors"
                >
                  Setup Keys
                </button>
              </div>
            )}

            {loginError && (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/80 text-rose-200 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span className="leading-tight">{loginError}</span>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-300">
                  Authorized Admin Gmail
                </label>
                <span className="text-[10px] text-emerald-400 bg-emerald-950/40 border border-emerald-800/60 px-2 py-0.5 rounded-full font-mono font-bold">
                  Owner Restricted
                </span>
              </div>
              <input
                type="email"
                autoComplete="email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="ladandas22@gmail.com"
                className="w-full bg-[#080d19] border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500 font-mono transition-colors"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Security Lock: Sirf <strong className="text-white">ladandas22@gmail.com</strong> ko admin portal access karne ki permission hai. Dusra koi bhi Gmail login nahi kar sakta.
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-300">
                  Admin Password
                </label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={isResettingPassword}
                  className="text-[11px] text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                >
                  {isResettingPassword ? 'Sending...' : 'Forgot / Reset Password?'}
                </button>
              </div>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-[#080d19] border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500 transition-colors"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Enter the password you created in your Supabase Authentication dashboard.
              </p>
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
        <div className="grid grid-cols-2 sm:grid-cols-4 bg-[#0d1424] p-1.5 rounded-xl border border-slate-800 text-xs font-semibold gap-1.5">
          <button
            onClick={() => {
              setActiveTab('videos');
              resetForm();
            }}
            className={`py-2 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
              activeTab === 'videos'
                ? 'bg-red-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Film className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Videos ({adminVideos.length})</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('new-video');
              if (!editingVideo) resetForm();
            }}
            className={`py-2 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
              activeTab === 'new-video'
                ? 'bg-red-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Plus className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{editingVideo ? 'Edit' : 'Add Video'}</span>
          </button>

          <button
            onClick={() => setActiveTab('categories')}
            className={`py-2 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
              activeTab === 'categories'
                ? 'bg-red-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Categories ({categories.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('ads')}
            className={`py-2 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors relative ${
              activeTab === 'ads'
                ? 'bg-red-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Megaphone className="w-3.5 h-3.5 shrink-0 text-amber-400" />
            <span className="truncate">Ad Settings</span>
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                adConfig.enabled ? 'bg-emerald-400 shadow-xs shadow-emerald-400' : 'bg-slate-500'
              }`}
              title={adConfig.enabled ? 'Ads Active' : 'Ads Disabled'}
            />
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

            {/* Video Poster Photo (Thumbnail) Upload & Preview */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-300">
                  Video Poster / Thumbnail Photo
                </label>
                <span className="text-[10px] text-slate-400">
                  All image types supported (JPG, PNG, WEBP, AVIF, HEIC, GIF, SVG)
                </span>
              </div>

              {/* Upload Drop Zone / Live Preview Box */}
              {formThumbnailUrl ? (
                <div className="relative rounded-2xl overflow-hidden border border-slate-700/80 bg-slate-900/60 p-2.5">
                  <div className="flex items-start gap-3">
                    <div className="relative w-36 aspect-video rounded-xl overflow-hidden bg-black/40 border border-slate-800 flex-shrink-0">
                      <img
                        src={resolveMediaUrl(formThumbnailUrl)}
                        alt="Poster preview"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80';
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0 py-0.5">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>Poster Photo Ready</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                        {posterUploadNote || 'Optimized photo for crisp streaming'}
                      </p>

                      <div className="flex items-center gap-2 mt-2.5">
                        <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium cursor-pointer transition-colors">
                          <Upload className="w-3 h-3 text-red-400" />
                          <span>Change Photo</span>
                          <input
                            type="file"
                            accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.avif,.jfif,.svg,.heic"
                            className="hidden"
                            onChange={(e) => handleFileUpload(e, 'thumbnail')}
                            disabled={isUploadingPoster}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setFormThumbnailUrl('');
                            setPosterUploadNote('');
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-red-950/40 hover:bg-red-900/50 text-red-400 text-xs font-medium transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Remove</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <label
                  className={`relative flex flex-col items-center justify-center p-4 border-2 border-dashed rounded-2xl transition-all cursor-pointer ${
                    isUploadingPoster
                      ? 'border-red-500/50 bg-red-950/10'
                      : 'border-slate-800 hover:border-red-500/50 bg-[#080d19]/80 hover:bg-slate-900/40'
                  }`}
                >
                  <input
                    type="file"
                    accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.avif,.jfif,.svg,.heic"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e, 'thumbnail')}
                    disabled={isUploadingPoster}
                  />
                  {isUploadingPoster ? (
                    <div className="flex flex-col items-center gap-2 py-2">
                      <Loader2 className="w-6 h-6 text-red-500 animate-spin" />
                      <span className="text-xs text-red-400 font-medium">
                        Optimizing & uploading poster photo...
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Processing image for crisp mobile playback
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-center gap-1.5 py-1">
                      <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center">
                        <ImageIcon className="w-5 h-5" />
                      </div>
                      <div className="text-xs font-semibold text-slate-200">
                        Click or tap to upload Poster Photo
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Supports all formats: <span className="text-slate-300">JPG, PNG, WEBP, AVIF, HEIC, GIF, SVG</span>
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Auto-compressed client-side so upload never fails
                      </div>
                    </div>
                  )}
                </label>
              )}

              {/* Direct URL input fallback */}
              <div className="pt-0.5">
                <input
                  type="text"
                  value={formThumbnailUrl}
                  onChange={(e) => setFormThumbnailUrl(e.target.value)}
                  placeholder="Or paste direct image URL (https://... or data:image/...)"
                  className="w-full bg-[#080d19] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-red-500"
                />
              </div>
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
                  {(categories.length > 0 ? categories : DEFAULT_CATEGORIES).map((c) => (
                    <option key={String(c.id) + '_' + c.name} value={c.name}>
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

        {/* Tab 4: Ad & Monetization Settings */}
        {activeTab === 'ads' && (
          <div className="space-y-4 animate-in fade-in">
            {/* Master Toggle Card */}
            <div className="bg-[#0e1628] border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${adConfig.enabled ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60' : 'bg-slate-800 text-slate-400'}`}>
                    <Megaphone className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <span>Video Pre-Roll Ads</span>
                      <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded ${adConfig.enabled ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'}`}>
                        {adConfig.enabled ? 'Active' : 'Disabled'}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Plays a VAST/IMA video advertisement before user plays any video.
                    </p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={adConfig.enabled}
                    onChange={(e) => setAdConfigState({ ...adConfig, enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  <span className="ml-2.5 text-xs font-semibold text-slate-300">
                    {adConfig.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </label>
              </div>

              {/* Tag URL Input & Presets */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span>VAST Tag URL</span>
                    <span className="text-rose-400">*</span>
                  </label>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Supported: HilltopAds, Monetag, Google Ad Manager, VAST 2.0/3.0/4.0
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="url"
                    value={adConfig.tagUrl}
                    onChange={(e) => {
                      setAdConfigState({ ...adConfig, tagUrl: e.target.value });
                      setAdTestStatus(null);
                    }}
                    placeholder="https://your-ad-network.com/vast/tag?..."
                    className="flex-1 bg-[#080d19] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-red-500"
                  />
                  <button
                    type="button"
                    onClick={handleTestAdTag}
                    disabled={isTestingAdTag || !adConfig.tagUrl.trim()}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shrink-0"
                  >
                    {isTestingAdTag ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                    ) : (
                      <PlaySquare className="w-3.5 h-3.5 text-amber-400" />
                    )}
                    <span>Test Tag</span>
                  </button>
                </div>

                {/* Quick Presets */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-[11px] text-slate-400 font-medium">Quick Presets:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setAdConfigState({
                        ...adConfig,
                        tagUrl: GOOGLE_SAMPLE_VAST_TAG_URL,
                        allowFallback: true,
                      });
                      setAdTestStatus(null);
                      showToast('Google IMA sample tag selected (100% ad fill rate for testing).', 'info');
                    }}
                    className="text-[11px] px-2.5 py-1 bg-blue-950/40 hover:bg-blue-900/40 border border-blue-800/50 text-blue-300 rounded-lg font-semibold transition-colors flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-3 h-3 text-blue-400" />
                    <span>Google IMA Test Tag (100% Fill)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAdConfigState({
                        ...adConfig,
                        tagUrl: HILLTOPADS_VAST_TAG_URL,
                        allowFallback: true,
                      });
                      setAdTestStatus(null);
                      showToast('HilltopAds tag selected.', 'info');
                    }}
                    className="text-[11px] px-2.5 py-1 bg-amber-950/40 hover:bg-amber-900/40 border border-amber-800/50 text-amber-300 rounded-lg font-semibold transition-colors"
                  >
                    HilltopAds Tag
                  </button>
                </div>

                {/* Live Test Diagnostic Output */}
                {adTestStatus && (
                  <div
                    className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                      adTestStatus.success
                        ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-200'
                        : 'bg-rose-950/30 border-rose-800/60 text-rose-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold">
                      {adTestStatus.success ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      )}
                      <span>{adTestStatus.message}</span>
                    </div>

                    {adTestStatus.mediaUrl && (
                      <p className="text-[11px] text-slate-300 font-mono truncate">
                        Media stream: {adTestStatus.mediaUrl}
                      </p>
                    )}

                    {!adTestStatus.success && (
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        Tip: Because your "Guaranteed Video Ad Fallback" is enabled below, the video player will automatically display an ad even if your ad network returns 404 or empty inventory!
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Multi-Placement Display & Banner Ads Card */}
            <div className="bg-[#0e1628] border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${adConfig.bannerAdsEnabled ? 'bg-amber-950/60 text-amber-400 border border-amber-800/60' : 'bg-slate-800 text-slate-400'}`}>
                    <Megaphone className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <span>In-Page & Multi-Placement Banner Ads</span>
                      <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded ${adConfig.bannerAdsEnabled ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-slate-800 text-slate-400'}`}>
                        {adConfig.bannerAdsEnabled ? 'Active (4 Placements)' : 'Disabled'}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Loads display banners, popunders & in-page push ads across multiple key spots in the app.
                    </p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={adConfig.bannerAdsEnabled ?? true}
                    onChange={(e) => setAdConfigState({ ...adConfig, bannerAdsEnabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                  <span className="ml-2.5 text-xs font-semibold text-slate-300">
                    {adConfig.bannerAdsEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </label>
              </div>

              {/* Script URL Inputs & Live Placements Grid */}
              <div className="space-y-3">
                <div className="space-y-2">
                  <div>
                    <label className="text-[11px] font-bold text-slate-300 block mb-1">
                      Ad Script 1 (In-Page Push / Popunder / Native)
                    </label>
                    <input
                      type="text"
                      value={adConfig.bannerScriptUrl || ''}
                      onChange={(e) => setAdConfigState({ ...adConfig, bannerScriptUrl: e.target.value })}
                      placeholder="//shameful-farm.com/bvX..."
                      className="w-full bg-[#080d19] border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-red-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-300 block mb-1">
                      Ad Script 2 (Display Banner / Social Bar / Floating)
                    </label>
                    <input
                      type="text"
                      value={adConfig.bannerScriptUrl2 || ''}
                      onChange={(e) => setAdConfigState({ ...adConfig, bannerScriptUrl2: e.target.value })}
                      placeholder="//shameful-farm.com/bpX..."
                      className="w-full bg-[#080d19] border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-red-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-300 block mb-1">
                      Ad Script 3 (Multi-Placement Popunder / Interstitial / Dialog)
                    </label>
                    <input
                      type="text"
                      value={adConfig.bannerScriptUrl3 || ''}
                      onChange={(e) => setAdConfigState({ ...adConfig, bannerScriptUrl3: e.target.value })}
                      placeholder="//shameful-farm.com/bXXEV..."
                      className="w-full bg-[#080d19] border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-red-500"
                    />
                  </div>
                </div>

                <div className="bg-[#080d19] border border-slate-800/80 rounded-xl p-3.5 space-y-2">
                  <span className="text-xs font-bold text-slate-200 block">
                    Active Ad Placements (Site-wide Multi-Placement):
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-2 text-slate-300 bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span><strong>Global Head:</strong> Popunder / Direct / In-Page Push</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-300 bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span><strong>Watch Page:</strong> Under video player & related</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-300 bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span><strong>Home Feed:</strong> In-stream between videos</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-300 bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span><strong>Search View:</strong> Between search results</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-300 bg-slate-900/80 p-2 rounded-lg border border-slate-800 col-span-1 sm:col-span-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span><strong>Explore & Mobile Bottom:</strong> Trending section & sticky floating bar</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Save & Reset Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveAdConfig}
                  disabled={isSavingAdConfig}
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-colors flex items-center gap-2 shadow-lg shadow-red-600/20 active:scale-95"
                >
                  {isSavingAdConfig ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  <span>Save Ad Configuration</span>
                </button>

                <button
                  type="button"
                  onClick={handleResetAdConfig}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reset Defaults</span>
                </button>
              </div>

              <button
                type="button"
                onClick={onBackToSite}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
              >
                <span>Preview On Video Player</span>
                <ExternalLink className="w-3 h-3 text-red-400" />
              </button>
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
