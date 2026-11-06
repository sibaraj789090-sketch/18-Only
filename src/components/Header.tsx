import React from 'react';
import { Search, Database, Sparkles } from 'lucide-react';
import { SupabaseConfig } from '../types/database';

interface HeaderProps {
  onOpenSearch: () => void;
  onOpenConfig: () => void;
  config: SupabaseConfig;
  isConnected: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenSearch,
  onOpenConfig,
  config,
  isConnected,
}) => {
  return (
    <header className="sticky top-0 z-30 w-full bg-[#06090e]/95 backdrop-blur-md border-b border-slate-800/60 px-4 h-14 flex items-center justify-between transition-colors">
      {/* Brand Logo - 18+Only (YouTube Inspired styling) */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 cursor-pointer select-none" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <div className="bg-gradient-to-br from-red-600 to-rose-700 text-white font-extrabold px-2.5 py-1 rounded-lg text-sm tracking-tight shadow-md shadow-red-900/30 flex items-center gap-1">
            <span>18+</span>
          </div>
          <span className="text-lg font-bold tracking-tight text-white font-['Outfit']">
            Only<span className="text-red-500">.</span>
          </span>
        </div>
      </div>

      {/* Right Action Icons */}
      <div className="flex items-center gap-1">
        {/* Supabase Connection Status Pill */}
        <button
          onClick={onOpenConfig}
          className={`min-h-[44px] px-2.5 flex items-center gap-1.5 rounded-full text-xs font-medium transition-colors ${
            isConnected
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
              : config.isConfigured
              ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20 hover:bg-amber-500/20'
              : 'bg-rose-500/10 text-rose-300 border border-rose-500/20 hover:bg-rose-500/20 animate-pulse'
          }`}
          title="Supabase Connection & Database Settings"
        >
          <Database className="w-3.5 h-3.5" />
          <span className="hidden xs:inline">
            {isConnected ? 'Supabase' : config.isConfigured ? 'Connecting...' : 'Connect DB'}
          </span>
        </button>

        {/* Search Icon Trigger (min 44x44px hitbox) */}
        <button
          onClick={onOpenSearch}
          className="w-11 h-11 flex items-center justify-center rounded-full text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors"
          aria-label="Search videos"
        >
          <Search className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
};
