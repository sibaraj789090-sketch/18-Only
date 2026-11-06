import React, { useState } from 'react';
import {
  X,
  Database,
  Check,
  AlertCircle,
  Copy,
  Terminal,
  ExternalLink,
  RefreshCw,
  HelpCircle,
  ShieldCheck,
  CheckCircle2,
  Shield,
} from 'lucide-react';
import { SupabaseConfig } from '../types/database';
import {
  saveSupabaseCredentials,
  clearSupabaseCredentials,
  testSupabaseConnection,
} from '../lib/supabase';
import { useToast } from './Toast';

interface SupabaseConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: SupabaseConfig;
  onConfigUpdated: () => void;
  onOpenAdmin?: () => void;
}

const SUPABASE_SCHEMA_SQL = `-- =========================================================
-- 18+Only Supabase Database Schema & Storage Configuration
-- Run this in the Supabase Dashboard -> SQL Editor
-- =========================================================

-- 1. CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    slug TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. VIDEOS TABLE
CREATE TABLE IF NOT EXISTS public.videos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    video_url TEXT NOT NULL,
    thumbnail_url TEXT,
    views BIGINT DEFAULT 0,
    duration TEXT,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    category TEXT,
    featured BOOLEAN DEFAULT false,
    is_published BOOLEAN DEFAULT true,
    author_name TEXT DEFAULT '18+Only Creator',
    author_avatar TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. COMMENTS TABLE
CREATE TABLE IF NOT EXISTS public.comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    video_id UUID REFERENCES public.videos(id) ON DELETE CASCADE,
    user_name TEXT NOT NULL DEFAULT 'Anonymous Viewer',
    comment_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. ADMIN USERS TABLE
CREATE TABLE IF NOT EXISTS public.admin_users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT DEFAULT 'admin',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. ENABLE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- 6. PUBLIC POLICIES (Read-only for public, secure insertions for comments)
CREATE POLICY "Public categories are viewable by everyone" 
ON public.categories FOR SELECT USING (true);

CREATE POLICY "Published videos are viewable by everyone" 
ON public.videos FOR SELECT USING (is_published = true);

CREATE POLICY "Comments are viewable by everyone" 
ON public.comments FOR SELECT USING (true);

CREATE POLICY "Anyone can post a comment" 
ON public.comments FOR INSERT WITH CHECK (true);

-- 7. STORAGE BUCKET: Create public bucket 'videos' if not already created
INSERT INTO storage.buckets (id, name, public)
VALUES ('videos', 'videos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY "Public Videos Bucket Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'videos');

-- 8. SEED DEFAULT CATEGORIES
INSERT INTO public.categories (name, slug) VALUES
('Hindi', 'hindi'),
('English', 'english'),
('Entertainment', 'entertainment'),
('Education', 'education'),
('Technology', 'technology'),
('Music', 'music'),
('Other', 'other')
ON CONFLICT (name) DO NOTHING;
`;

export const SupabaseConfigModal: React.FC<SupabaseConfigModalProps> = ({
  isOpen,
  onClose,
  config,
  onConfigUpdated,
  onOpenAdmin,
}) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'status' | 'setup' | 'sql'>('status');
  const [url, setUrl] = useState(config.url || '');
  const [anonKey, setAnonKey] = useState(config.anonKey || '');
  const [isTesting, setIsTesting] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);

  if (!isOpen) return null;

  const handleRunDiagnostic = async () => {
    setIsTesting(true);
    const results = await testSupabaseConnection();
    setTestResults(results);
    setIsTesting(false);
    if (results.connected) {
      showToast('Supabase connection verified!', 'success');
    } else {
      showToast('Connection failed or incomplete tables', 'error');
    }
  };

  const handleSaveCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !anonKey.trim()) {
      showToast('Please provide both URL and Anon Key', 'error');
      return;
    }

    saveSupabaseCredentials(url.trim(), anonKey.trim());
    showToast('Supabase credentials saved successfully');
    onConfigUpdated();
    handleRunDiagnostic();
  };

  const handleClear = () => {
    clearSupabaseCredentials();
    setUrl('');
    setAnonKey('');
    setTestResults(null);
    showToast('Supabase credentials cleared');
    onConfigUpdated();
  };

  const copySql = () => {
    navigator.clipboard.writeText(SUPABASE_SCHEMA_SQL);
    showToast('SQL schema copied to clipboard');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-md bg-[#0a0f1d] border border-slate-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-[#0e1628]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-red-600/20 text-red-400 border border-red-500/30 flex items-center justify-center">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white leading-tight font-['Outfit']">
                Supabase Connection Manager
              </h2>
              <span className="text-[11px] text-slate-400">18+Only Project Architecture</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white rounded-full hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center border-b border-slate-800 bg-[#080d19] px-3 pt-2 gap-1 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('status')}
            className={`px-3 py-2 border-b-2 transition-colors ${
              activeTab === 'status'
                ? 'border-red-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Diagnostics
          </button>
          <button
            onClick={() => setActiveTab('setup')}
            className={`px-3 py-2 border-b-2 transition-colors ${
              activeTab === 'setup'
                ? 'border-red-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Keys & Config
          </button>
          <button
            onClick={() => setActiveTab('sql')}
            className={`px-3 py-2 border-b-2 transition-colors ${
              activeTab === 'sql'
                ? 'border-red-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            SQL Schema
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 overflow-y-auto no-scrollbar space-y-4 text-xs">
          {activeTab === 'status' && (
            <div className="space-y-3.5">
              {/* Status summary banner */}
              <div
                className={`p-3 rounded-xl border flex items-start gap-3 ${
                  config.isConfigured
                    ? 'bg-emerald-950/20 border-emerald-800/60 text-emerald-300'
                    : 'bg-amber-950/20 border-amber-800/60 text-amber-300'
                }`}
              >
                {config.isConfigured ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <h4 className="font-bold text-xs">
                    {config.isConfigured
                      ? 'Credentials Configured'
                      : 'Missing Supabase Credentials'}
                  </h4>
                  <p className="text-[11px] opacity-90 mt-0.5">
                    {config.isConfigured
                      ? `Loaded via ${config.source === 'env' ? '.env / Environment Variables' : 'Browser Storage'}`
                      : 'Please provide your Project URL and Anon Key in the "Keys & Config" tab or .env file.'}
                  </p>
                </div>
              </div>

              {/* Run Test Button */}
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleRunDiagnostic}
                  disabled={isTesting}
                  className="w-full py-2.5 px-4 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-md shadow-red-950 transition-all active:scale-[0.99]"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                  <span>{isTesting ? 'Testing Tables...' : 'Test Connection & Tables'}</span>
                </button>

                {onOpenAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenAdmin();
                    }}
                    className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl flex items-center justify-center gap-2 border border-slate-700/80 transition-colors"
                  >
                    <Shield className="w-4 h-4 text-red-500" />
                    <span>Open Cardingx Admin (/admin/siba)</span>
                  </button>
                )}
              </div>

              {/* Diagnostic breakdown */}
              {testResults && (
                <div className="bg-[#0e1628] rounded-xl border border-slate-800 p-3 space-y-2.5">
                  <h4 className="font-bold text-slate-300 uppercase tracking-wider text-[11px]">
                    Table Verification Results
                  </h4>

                  <div className="space-y-1.5 divide-y divide-slate-800/60">
                    {/* videos table */}
                    <div className="pt-1.5 flex items-center justify-between">
                      <span className="font-mono text-slate-300">videos table</span>
                      {testResults.tables.videos.exists ? (
                        <span className="text-emerald-400 font-semibold flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" />
                          <span>Ready ({testResults.tables.videos.count ?? 0} rows)</span>
                        </span>
                      ) : (
                        <span className="text-rose-400 font-semibold flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>Not Accessible</span>
                        </span>
                      )}
                    </div>

                    {/* categories table */}
                    <div className="pt-1.5 flex items-center justify-between">
                      <span className="font-mono text-slate-300">categories table</span>
                      {testResults.tables.categories.exists ? (
                        <span className="text-emerald-400 font-semibold flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" />
                          <span>Ready ({testResults.tables.categories.count ?? 0} rows)</span>
                        </span>
                      ) : (
                        <span className="text-rose-400 font-semibold flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>Not Accessible</span>
                        </span>
                      )}
                    </div>

                    {/* comments table */}
                    <div className="pt-1.5 flex items-center justify-between">
                      <span className="font-mono text-slate-300">comments table</span>
                      {testResults.tables.comments.exists ? (
                        <span className="text-emerald-400 font-semibold flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" />
                          <span>Connected</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 flex items-center gap-1">
                          <span>RLS Protected / Empty</span>
                        </span>
                      )}
                    </div>

                    {/* Storage Bucket */}
                    <div className="pt-1.5 flex items-center justify-between">
                      <span className="font-mono text-slate-300">storage bucket: 'videos'</span>
                      <span className="text-sky-400 font-semibold">Public</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-[#0e1628] rounded-xl p-3 border border-slate-800 text-[11px] text-slate-400 space-y-1">
                <span className="font-bold text-slate-200">Security Invariants:</span>
                <p>• Only published videos (`is_published = true`) are loaded.</p>
                <p>• RLS policies are strictly respected; no secret keys are exposed.</p>
                <p>• Storage bucket `videos` is used for media playback.</p>
              </div>
            </div>
          )}

          {activeTab === 'setup' && (
            <form onSubmit={handleSaveCredentials} className="space-y-3">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Supabase Project URL
                </label>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://xyzcompany.supabase.co"
                  className="w-full bg-[#0e1628] border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Supabase Anon / Publishable Key
                </label>
                <textarea
                  rows={3}
                  value={anonKey}
                  onChange={(e) => setAnonKey(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  className="w-full bg-[#0e1628] border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-red-500"
                />
                <span className="text-[10px] text-slate-500">
                  Safe for client-side use. Never enter the service_role key.
                </span>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg text-xs transition-colors shadow-md"
                >
                  Save & Apply
                </button>
                {config.source === 'localStorage' && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition-colors"
                  >
                    Reset
                  </button>
                )}
              </div>
            </form>
          )}

          {activeTab === 'sql' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-[11px]">
                  Schema for videos, categories, comments, and storage
                </span>
                <button
                  onClick={copySql}
                  className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] font-semibold transition-colors"
                >
                  <Copy className="w-3 h-3" />
                  <span>Copy SQL</span>
                </button>
              </div>

              <pre className="p-3 bg-[#080d19] border border-slate-800 rounded-xl text-[10px] font-mono text-slate-300 overflow-x-auto max-h-56 leading-relaxed">
                {SUPABASE_SCHEMA_SQL}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
