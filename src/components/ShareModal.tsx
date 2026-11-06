import React from 'react';
import { X, Copy, Check, MessageCircle, Send, Share2 } from 'lucide-react';
import { Video } from '../types/database';
import { useToast } from './Toast';

interface ShareModalProps {
  video: Video | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({ video, isOpen, onClose }) => {
  const { showToast } = useToast();
  if (!isOpen || !video) return null;

  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';

  const handleCopyLink = () => {
    navigator.clipboard.writeText(currentUrl);
    showToast('Link copied to clipboard!');
    onClose();
  };

  const handleWhatsAppShare = () => {
    const text = encodeURIComponent(`Watch "${video.title}" on 18+Only: ${currentUrl}`);
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
    onClose();
  };

  const handleTelegramShare = () => {
    const text = encodeURIComponent(`Watch "${video.title}" on 18+Only`);
    const url = encodeURIComponent(currentUrl);
    window.open(`https://t.me/share/url?url=${url}&text=${text}`, '_blank');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-sm bg-[#0e1628] border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-2xl p-4 shadow-2xl text-slate-100 animate-in slide-in-from-bottom-6">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Share2 className="w-4 h-4 text-red-500" />
            <h3 className="text-sm font-bold text-white">Share Video</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white rounded-full hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-300 font-medium py-3 truncate">
          {video.title}
        </p>

        {/* Quick share buttons */}
        <div className="grid grid-cols-3 gap-2.5 py-2">
          <button
            onClick={handleCopyLink}
            className="flex flex-col items-center justify-center gap-2 p-3 bg-slate-900/80 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs transition-colors"
          >
            <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-slate-200">
              <Copy className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-medium text-slate-300">Copy Link</span>
          </button>

          <button
            onClick={handleWhatsAppShare}
            className="flex flex-col items-center justify-center gap-2 p-3 bg-slate-900/80 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs transition-colors"
          >
            <div className="w-9 h-9 rounded-full bg-emerald-600/20 text-emerald-400 flex items-center justify-center">
              <MessageCircle className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-medium text-slate-300">WhatsApp</span>
          </button>

          <button
            onClick={handleTelegramShare}
            className="flex flex-col items-center justify-center gap-2 p-3 bg-slate-900/80 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs transition-colors"
          >
            <div className="w-9 h-9 rounded-full bg-sky-600/20 text-sky-400 flex items-center justify-center">
              <Send className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-medium text-slate-300">Telegram</span>
          </button>
        </div>

        {/* URL Bar */}
        <div className="mt-3 flex items-center gap-2 bg-slate-950 p-2 rounded-xl border border-slate-800">
          <input
            type="text"
            readOnly
            value={currentUrl}
            className="flex-1 bg-transparent text-[11px] text-slate-400 focus:outline-none truncate"
          />
          <button
            onClick={handleCopyLink}
            className="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg text-xs shrink-0 transition-colors"
          >
            Copy
          </button>
        </div>
      </div>
    </div>
  );
};
