import React, { useEffect, useRef, useState } from 'react';
import { ExternalLink, Sparkles, X, Megaphone } from 'lucide-react';
import {
  getAdConfig,
  SHAMEFUL_FARM_AD_SCRIPT_URL_1,
  SHAMEFUL_FARM_AD_SCRIPT_URL_2,
  SHAMEFUL_FARM_AD_SCRIPT_URL_3,
} from '../lib/vast';

interface AdBannerProps {
  placement: 'watch' | 'feed' | 'explore' | 'sticky';
  onClose?: () => void;
  className?: string;
}

export const AdBanner: React.FC<AdBannerProps> = ({
  placement,
  onClose,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [adConfig, setAdConfig] = useState(() => getAdConfig());
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    setAdConfig(getAdConfig());
  }, []);

  // Dynamically inject scripts into the ad slot container
  useEffect(() => {
    if (!adConfig.bannerAdsEnabled || isDismissed) return;
    const target = containerRef.current;
    if (!target) return;

    const createdScripts: HTMLScriptElement[] = [];

    try {
      // Determine which script URL(s) to load for this placement
      const scriptUrls: string[] = [];
      if (placement === 'watch') {
        // Under video player, inject tag formats for maximum reach
        scriptUrls.push(
          adConfig.bannerScriptUrl || SHAMEFUL_FARM_AD_SCRIPT_URL_1,
          adConfig.bannerScriptUrl2 || SHAMEFUL_FARM_AD_SCRIPT_URL_2,
          adConfig.bannerScriptUrl3 || SHAMEFUL_FARM_AD_SCRIPT_URL_3
        );
      } else if (placement === 'feed') {
        scriptUrls.push(
          adConfig.bannerScriptUrl3 || SHAMEFUL_FARM_AD_SCRIPT_URL_3,
          adConfig.bannerScriptUrl2 || SHAMEFUL_FARM_AD_SCRIPT_URL_2
        );
      } else if (placement === 'sticky') {
        scriptUrls.push(adConfig.bannerScriptUrl3 || SHAMEFUL_FARM_AD_SCRIPT_URL_3);
      } else {
        scriptUrls.push(
          adConfig.bannerScriptUrl || SHAMEFUL_FARM_AD_SCRIPT_URL_1,
          adConfig.bannerScriptUrl3 || SHAMEFUL_FARM_AD_SCRIPT_URL_3
        );
      }

      scriptUrls.forEach((url) => {
        const s = document.createElement('script');
        s.src = url;
        s.async = true;
        s.referrerPolicy = 'no-referrer-when-downgrade';
        target.appendChild(s);
        createdScripts.push(s);
      });

      return () => {
        createdScripts.forEach((s) => {
          try {
            if (target.contains(s)) {
              target.removeChild(s);
            }
          } catch {}
        });
      };
    } catch (e) {
      console.warn('Ad script injection warning:', e);
    }
  }, [
    adConfig.bannerAdsEnabled,
    adConfig.bannerScriptUrl,
    adConfig.bannerScriptUrl2,
    isDismissed,
    placement,
  ]);

  if (!adConfig.bannerAdsEnabled || isDismissed) {
    return null;
  }

  // 1. Sticky Bottom Banner Placement
  if (placement === 'sticky') {
    return (
      <div
        className={`fixed bottom-14 left-0 right-0 z-40 px-3 py-1.5 bg-[#090f1e]/95 backdrop-blur-md border-t border-red-500/30 flex items-center justify-between shadow-2xl animate-in slide-in-from-bottom duration-300 ${className}`}
      >
        <div ref={containerRef} className="hidden" aria-hidden="true" />
        <a
          href="https://shameful-farm.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 flex-1 min-w-0 pr-2"
        >
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-red-600 to-amber-500 flex items-center justify-center shrink-0 shadow-md">
            <Megaphone className="w-3.5 h-3.5 text-white animate-pulse" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="bg-amber-400 text-black text-[9px] font-black px-1.5 py-0.2 rounded uppercase">
                AD
              </span>
              <span className="text-[11px] font-bold text-white truncate">
                Sponsored Partner Offer
              </span>
            </div>
            <p className="text-[10px] text-slate-400 truncate">
              Tap here to explore exclusive trending content & deals
            </p>
          </div>
        </a>

        <div className="flex items-center gap-1.5 shrink-0">
          <a
            href="https://shameful-farm.com"
            target="_blank"
            rel="noopener noreferrer"
            className="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-sm"
          >
            <span>Visit</span>
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
          <button
            onClick={() => {
              setIsDismissed(true);
              onClose?.();
            }}
            className="p-1 text-slate-400 hover:text-white rounded-md"
            aria-label="Close ad"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  // 2. Watch Page Banner Placement (Under Player)
  if (placement === 'watch') {
    return (
      <div className={`mx-4 my-3 bg-gradient-to-r from-[#0d1629] via-[#111c33] to-[#0d1629] border border-amber-500/25 rounded-2xl p-3 shadow-lg relative overflow-hidden group ${className}`}>
        <div ref={containerRef} className="hidden" aria-hidden="true" />
        <div className="absolute top-0 right-0 w-24 h-24 bg-red-600/10 rounded-full blur-xl pointer-events-none" />

        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="bg-amber-400 text-black text-[10px] font-black px-1.5 py-0.5 rounded tracking-wide uppercase">
              Sponsored
            </span>
            <span className="text-[11px] font-bold text-slate-200">
              18+Only Partner Network
            </span>
          </div>

          <span className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>Recommended</span>
          </span>
        </div>

        <a
          href="https://shameful-farm.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between gap-3 bg-[#080d19]/90 hover:bg-[#0c1324] border border-slate-800 rounded-xl p-2.5 transition-all active:scale-[0.99]"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-red-600 flex items-center justify-center shrink-0 shadow">
              <Megaphone className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h4 className="text-xs font-bold text-white truncate">
                Special Streaming & Media Partner
              </h4>
              <p className="text-[10px] text-slate-400 truncate">
                Click to explore top rated exclusive streaming offers
              </p>
            </div>
          </div>

          <button
            type="button"
            className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold shrink-0 flex items-center gap-1 shadow-md shadow-red-950 transition-colors pointer-events-none"
          >
            <span>Open</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        </a>
      </div>
    );
  }

  // 3. Explore View Banner Placement
  if (placement === 'explore') {
    return (
      <div className={`mx-3 my-3 bg-[#0c1424] border border-slate-800 rounded-2xl p-3 shadow-md relative overflow-hidden ${className}`}>
        <div ref={containerRef} className="hidden" aria-hidden="true" />
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="bg-amber-400 text-black text-[10px] font-black px-1.5 py-0.5 rounded uppercase">
              Ad
            </span>
            <span className="text-xs font-bold text-white">Trending Sponsor Spotlight</span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">shameful-farm.com</span>
        </div>

        <a
          href="https://shameful-farm.com"
          target="_blank"
          rel="noopener noreferrer"
          className="block bg-gradient-to-r from-[#111c33] to-[#0c1424] border border-amber-500/20 hover:border-amber-500/40 rounded-xl p-3 transition-colors"
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-slate-200">
                Discover viral channels, trending creator updates & rewards
              </p>
              <span className="text-[10px] text-amber-400 font-medium mt-0.5 inline-block">
                Sponsored Link &middot; Verified Ad
              </span>
            </div>
            <div className="px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-lg text-[11px] font-bold shrink-0 flex items-center gap-1">
              <span>View</span>
              <ExternalLink className="w-3 h-3" />
            </div>
          </div>
        </a>
      </div>
    );
  }

  // 4. In-Feed Video Stream Banner (blends between video cards)
  return (
    <div className={`my-4 bg-[#0a101d] border border-amber-500/20 rounded-2xl p-3.5 shadow-lg relative overflow-hidden group hover:border-amber-500/40 transition-colors ${className}`}>
      <div ref={containerRef} className="hidden" aria-hidden="true" />
      <div className="flex items-center justify-between mb-2 px-0.5">
        <div className="flex items-center gap-2">
          <span className="bg-amber-400 text-black text-[10px] font-black px-1.5 py-0.5 rounded tracking-wider uppercase">
            Ad
          </span>
          <span className="text-xs font-bold text-slate-300">Sponsored Video & Media Partner</span>
        </div>
        <span className="text-[10px] text-slate-500">Promoted</span>
      </div>

      <a
        href="https://shameful-farm.com"
        target="_blank"
        rel="noopener noreferrer"
        className="block bg-gradient-to-br from-[#0f172a] via-[#131f38] to-[#0b1220] border border-slate-800/90 hover:border-slate-700 rounded-xl p-3 transition-transform active:scale-[0.99]"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-rose-600 via-red-600 to-amber-500 flex items-center justify-center shrink-0 shadow-lg shadow-red-950">
            <Megaphone className="w-6 h-6 text-white" />
          </div>

          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-bold text-white truncate">
              Special Viral Media & Entertainment Offers
            </h4>
            <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
              Instant access &bull; High speed streaming &bull; 100% free browse
            </p>
          </div>

          <div className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold shrink-0 flex items-center gap-1 shadow-md shadow-red-950">
            <span>Visit</span>
            <ExternalLink className="w-3 h-3" />
          </div>
        </div>
      </a>
    </div>
  );
};
