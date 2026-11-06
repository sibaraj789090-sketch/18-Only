import React, { useEffect, useState } from 'react';
import { ExternalLink, Sparkles, X, Flame, Gift } from 'lucide-react';
import {
  getAdConfig,
  sanitizeAdUrl,
  DEFAULT_DIRECT_AD_URL,
  DEFAULT_DIRECT_AD_URL_2,
} from '../lib/vast';

interface AdBannerProps {
  placement: 'watch' | 'feed' | 'explore' | 'sticky' | 'header' | 'compact';
  onClose?: () => void;
  className?: string;
  variant?: 1 | 2 | 3;
}

const AD_CREATIVES = [
  {
    tag: 'SPONSORED',
    title: 'Top Rated Streaming & Entertainment Network',
    desc: 'Instant access to viral trending videos, exclusive clips & bonus offers',
    cta: 'Stream Now',
    gradient: 'from-red-600 via-rose-600 to-amber-500',
    icon: Flame,
  },
  {
    tag: 'PARTNER AD',
    title: 'VIP Media Pass & High Speed Streaming',
    desc: 'Zero buffering, 4K quality releases, updated daily & 100% free browse',
    cta: 'Explore Deals',
    gradient: 'from-amber-500 via-orange-600 to-red-600',
    icon: Sparkles,
  },
  {
    tag: 'SPECIAL PROMO',
    title: 'Trending Content Hub & Hot Creator Updates',
    desc: 'Join millions of active viewers online & enjoy top unblocked media',
    cta: 'Claim Access',
    gradient: 'from-rose-600 via-red-700 to-pink-600',
    icon: Gift,
  },
];

export const AdBanner: React.FC<AdBannerProps> = ({
  placement,
  onClose,
  className = '',
  variant,
}) => {
  const [adConfig, setAdConfig] = useState(() => getAdConfig());
  const [isDismissed, setIsDismissed] = useState(false);

  // Pick ad creative index based on variant or random
  const [creativeIdx] = useState(() => {
    if (variant) return (variant - 1) % AD_CREATIVES.length;
    return Math.floor(Math.random() * AD_CREATIVES.length);
  });
  const creative = AD_CREATIVES[creativeIdx];
  const IconComponent = creative.icon;

  useEffect(() => {
    setAdConfig(getAdConfig());
  }, []);

  if (!adConfig.bannerAdsEnabled || isDismissed) {
    return null;
  }

  // Dynamically resolve target URL from adConfig, falling back to reliable working sponsor domains
  const destinationUrl = sanitizeAdUrl(
    creativeIdx === 1
      ? (adConfig.directAdUrl2 || adConfig.directAdUrl)
      : adConfig.directAdUrl,
    creativeIdx === 1 ? DEFAULT_DIRECT_AD_URL_2 : DEFAULT_DIRECT_AD_URL
  );

  const handleOpenAd = (e: React.MouseEvent) => {
    // Stop propagation so background popunders or touch handlers do not intercept
    e.stopPropagation();
  };

  // 1. Header Sponsor Strip (appears under top navigation)
  if (placement === 'header') {
    return (
      <div className={`mx-3 my-1.5 bg-gradient-to-r from-red-950/40 via-[#10192e] to-red-950/40 border border-red-500/30 rounded-xl px-3 py-2 flex items-center justify-between shadow-md group ${className}`}>
        <a
          href={destinationUrl}
          target="_blank"
          rel="noopener noreferrer"
          data-ad-banner="true"
          onClick={handleOpenAd}
          className="ad-banner-link flex items-center gap-2.5 flex-1 min-w-0"
        >
          <span className="bg-amber-400 text-black text-[9px] font-black px-1.5 py-0.5 rounded tracking-wider uppercase shrink-0">
            AD
          </span>
          <p className="text-xs font-semibold text-slate-200 truncate group-hover:text-amber-300 transition-colors">
            {creative.title} &middot; <span className="text-slate-400 font-normal text-[11px]">{creative.desc}</span>
          </p>
        </a>

        <a
          href={destinationUrl}
          target="_blank"
          rel="noopener noreferrer"
          data-ad-banner="true"
          onClick={handleOpenAd}
          className="ad-banner-link px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white rounded-lg text-[10px] font-bold shrink-0 ml-2 flex items-center gap-1 shadow-sm active:scale-95"
        >
          <span>{creative.cta}</span>
          <ExternalLink className="w-2.5 h-2.5" />
        </a>
      </div>
    );
  }

  // 2. Compact Banner Placement (ideal for comments, library lists, playlists)
  if (placement === 'compact') {
    return (
      <div className={`bg-[#0a101f] border border-amber-500/25 rounded-xl p-2.5 shadow-md relative overflow-hidden group hover:border-amber-500/50 transition-colors ${className}`}>
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <span className="bg-amber-400 text-black text-[8px] font-black px-1.5 py-0.2 rounded uppercase">
              Sponsored
            </span>
            <span className="text-[11px] font-bold text-slate-300">Partner Offer</span>
          </div>
          <span className="text-[9px] text-slate-500">Promoted</span>
        </div>

        <a
          href={destinationUrl}
          target="_blank"
          rel="noopener noreferrer"
          data-ad-banner="true"
          onClick={handleOpenAd}
          className="ad-banner-link flex items-center justify-between gap-2.5 bg-[#0e1629] p-2 rounded-lg border border-slate-800/80 hover:bg-[#131f38] transition-colors"
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${creative.gradient} flex items-center justify-center shrink-0`}>
              <IconComponent className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-white truncate">{creative.title}</p>
              <p className="text-[9px] text-slate-400 truncate">{creative.desc}</p>
            </div>
          </div>
          <div className="px-2 py-1 bg-red-600 text-white rounded-md text-[10px] font-bold shrink-0 flex items-center gap-1">
            <span>Open</span>
            <ExternalLink className="w-2.5 h-2.5" />
          </div>
        </a>
      </div>
    );
  }

  // 3. Sticky Bottom Banner Placement
  if (placement === 'sticky') {
    return (
      <div
        className={`fixed bottom-14 left-0 right-0 z-40 px-3 py-1.5 bg-[#090f1e]/95 backdrop-blur-md border-t border-red-500/30 flex items-center justify-between shadow-2xl animate-in slide-in-from-bottom duration-300 ${className}`}
      >
        <a
          href={destinationUrl}
          target="_blank"
          rel="noopener noreferrer"
          data-ad-banner="true"
          onClick={handleOpenAd}
          className="ad-banner-link flex items-center gap-2.5 flex-1 min-w-0 pr-2"
        >
          <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${creative.gradient} flex items-center justify-center shrink-0 shadow-md`}>
            <IconComponent className="w-3.5 h-3.5 text-white animate-pulse" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="bg-amber-400 text-black text-[9px] font-black px-1.5 py-0.2 rounded uppercase">
                AD
              </span>
              <span className="text-[11px] font-bold text-white truncate">
                {creative.title}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 truncate">
              {creative.desc}
            </p>
          </div>
        </a>

        <div className="flex items-center gap-1.5 shrink-0">
          <a
            href={destinationUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-ad-banner="true"
            onClick={handleOpenAd}
            className="ad-banner-link px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-sm"
          >
            <span>{creative.cta}</span>
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

  // 4. Watch Page Banner Placement (Under Player)
  if (placement === 'watch') {
    return (
      <div className={`mx-4 my-3 bg-gradient-to-r from-[#0d1629] via-[#111c33] to-[#0d1629] border border-amber-500/25 rounded-2xl p-3 shadow-lg relative overflow-hidden group ${className}`}>
        <div className="absolute top-0 right-0 w-24 h-24 bg-red-600/10 rounded-full blur-xl pointer-events-none" />

        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="bg-amber-400 text-black text-[10px] font-black px-1.5 py-0.5 rounded tracking-wide uppercase">
              {creative.tag}
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
          href={destinationUrl}
          target="_blank"
          rel="noopener noreferrer"
          data-ad-banner="true"
          onClick={handleOpenAd}
          className="ad-banner-link flex items-center justify-between gap-3 bg-[#080d19]/90 hover:bg-[#0c1324] border border-slate-800 rounded-xl p-2.5 transition-all active:scale-[0.99]"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${creative.gradient} flex items-center justify-center shrink-0 shadow`}>
              <IconComponent className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h4 className="text-xs font-bold text-white truncate">
                {creative.title}
              </h4>
              <p className="text-[10px] text-slate-400 truncate">
                {creative.desc}
              </p>
            </div>
          </div>

          <span
            className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold shrink-0 flex items-center gap-1 shadow-md shadow-red-950 transition-colors"
          >
            <span>{creative.cta}</span>
            <ExternalLink className="w-3 h-3" />
          </span>
        </a>
      </div>
    );
  }

  // 5. Explore View Banner Placement
  if (placement === 'explore') {
    return (
      <div className={`mx-3 my-3 bg-[#0c1424] border border-slate-800 rounded-2xl p-3 shadow-md relative overflow-hidden ${className}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="bg-amber-400 text-black text-[10px] font-black px-1.5 py-0.5 rounded uppercase">
              {creative.tag}
            </span>
            <span className="text-xs font-bold text-white">Trending Sponsor Spotlight</span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">Verified Ad Partner</span>
        </div>

        <a
          href={destinationUrl}
          target="_blank"
          rel="noopener noreferrer"
          data-ad-banner="true"
          onClick={handleOpenAd}
          className="ad-banner-link block bg-gradient-to-r from-[#111c33] to-[#0c1424] border border-amber-500/20 hover:border-amber-500/40 rounded-xl p-3 transition-colors"
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-slate-200">
                {creative.title}
              </p>
              <span className="text-[10px] text-amber-400 font-medium mt-0.5 inline-block">
                {creative.desc}
              </span>
            </div>
            <div className="px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-lg text-[11px] font-bold shrink-0 flex items-center gap-1">
              <span>{creative.cta}</span>
              <ExternalLink className="w-3 h-3" />
            </div>
          </div>
        </a>
      </div>
    );
  }

  // 6. In-Feed Video Stream Banner (blends between video cards)
  return (
    <div className={`my-4 bg-[#0a101d] border border-amber-500/20 rounded-2xl p-3.5 shadow-lg relative overflow-hidden group hover:border-amber-500/40 transition-colors ${className}`}>
      <div className="flex items-center justify-between mb-2 px-0.5">
        <div className="flex items-center gap-2">
          <span className="bg-amber-400 text-black text-[10px] font-black px-1.5 py-0.5 rounded tracking-wider uppercase">
            {creative.tag}
          </span>
          <span className="text-xs font-bold text-slate-300">Sponsored Video & Media Partner</span>
        </div>
        <span className="text-[10px] text-slate-500">Promoted</span>
      </div>

      <a
        href={destinationUrl}
        target="_blank"
        rel="noopener noreferrer"
        data-ad-banner="true"
        onClick={handleOpenAd}
        className="ad-banner-link block bg-gradient-to-br from-[#0f172a] via-[#131f38] to-[#0b1220] border border-slate-800/90 hover:border-slate-700 rounded-xl p-3 transition-transform active:scale-[0.99]"
      >
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl bg-gradient-to-tr ${creative.gradient} flex items-center justify-center shrink-0 shadow-lg shadow-red-950`}>
            <IconComponent className="w-6 h-6 text-white" />
          </div>

          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-bold text-white truncate">
              {creative.title}
            </h4>
            <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
              {creative.desc}
            </p>
          </div>

          <div className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold shrink-0 flex items-center gap-1 shadow-md shadow-red-950">
            <span>{creative.cta}</span>
            <ExternalLink className="w-3 h-3" />
          </div>
        </div>
      </a>
    </div>
  );
};
