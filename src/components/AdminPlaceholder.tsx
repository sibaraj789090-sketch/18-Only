import React from 'react';
import { Shield, Lock, ArrowLeft, Database, CheckCircle2 } from 'lucide-react';

interface AdminPlaceholderProps {
  onBack: () => void;
  onOpenConfig: () => void;
}

export const AdminPlaceholder: React.FC<AdminPlaceholderProps> = ({ onBack, onOpenConfig }) => {
  return (
    <div className="min-h-screen bg-[#06090e] text-slate-100 flex flex-col justify-between p-4 max-w-md mx-auto">
      {/* Top Header */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-2 py-1.5 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to 18+Only</span>
        </button>

        <span className="text-[11px] text-red-500 font-mono font-bold tracking-wider">
          /admin
        </span>
      </div>

      {/* Main Lock Shield Presentation */}
      <div className="my-auto py-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-red-950 to-slate-900 border border-red-500/30 flex items-center justify-center text-red-400 mx-auto mb-4 shadow-xl shadow-red-950/40">
          <Shield className="w-8 h-8" />
        </div>

        <h1 className="text-xl font-bold text-white mb-2 font-['Outfit']">
          Admin Architecture Ready
        </h1>

        <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed mb-6">
          The administrative gateway for <strong>18+Only</strong> is architected for secure backend authentication. In accordance with project security policies, public registration is disabled.
        </p>

        <div className="bg-[#0e1628] rounded-2xl border border-slate-800 p-4 text-left space-y-2.5 max-w-sm mx-auto text-xs">
          <div className="flex items-center gap-2 text-slate-200 font-semibold text-xs border-b border-slate-800 pb-2">
            <Lock className="w-3.5 h-3.5 text-red-400" />
            <span>Security Specifications</span>
          </div>

          <div className="space-y-1.5 text-[11px] text-slate-400">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <span>Public visitors have zero write or delete permissions.</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <span>Supabase Row Level Security (RLS) is strictly enforced.</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <span>Verified admin records are designated in the <code className="text-red-400">admin_users</code> table.</span>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2 max-w-xs mx-auto">
          <button
            onClick={onOpenConfig}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            <Database className="w-3.5 h-3.5 text-red-400" />
            <span>View Database Architecture</span>
          </button>

          <button
            onClick={onBack}
            className="w-full py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-colors shadow-md shadow-red-950"
          >
            Return to Stream Feed
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-[10px] text-slate-600 pb-2">
        18+Only Administrative Security System &middot; RLS Active
      </div>
    </div>
  );
};
