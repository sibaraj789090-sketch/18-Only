/**
 * Popunder & Direct Ad Network Integration
 * Handles smart popunder / new tab opening for ad networks (HilltopAds, Monetag, or Custom Direct Links).
 * Features frequency capping, ignore elements, and graceful fallback.
 */
import { getAdConfig, sanitizeAdUrl, DEFAULT_DIRECT_AD_URL } from './vast';

const STORAGE_LAST_POP = '18plus_last_pop_time';

let popInitialized = false;

export function initAdPopunder() {
  if (typeof window === 'undefined' || popInitialized) return;
  popInitialized = true;

  const handleInteraction = (e: MouseEvent | TouchEvent) => {
    try {
      const config = getAdConfig();
      // If user disabled popunders in Admin Panel, exit immediately
      if (config.popunderEnabled === false) return;

      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Ignore administrative buttons, inputs, modals, close buttons,
      // and explicit ad banner cards/buttons so banner clicks open directly without duplicate tabs
      if (
        target.closest('input') ||
        target.closest('textarea') ||
        target.closest('select') ||
        target.closest('[data-no-pop]') ||
        target.closest('.admin-portal') ||
        target.closest('.config-modal') ||
        target.closest('button[aria-label="Close"]') ||
        target.closest('button[aria-label="Close ad"]') ||
        target.closest('.ad-banner-link') ||
        target.closest('[data-ad-banner]')
      ) {
        return;
      }

      // Check frequency cooldown
      const cooldownMs = (config.popunderCooldownSeconds || 60) * 1000;
      const now = Date.now();
      const lastPop = parseInt(localStorage.getItem(STORAGE_LAST_POP) || '0', 10);
      if (now - lastPop < cooldownMs) {
        return;
      }

      const targetUrl = sanitizeAdUrl(
        config.popunderUrl || config.directAdUrl,
        DEFAULT_DIRECT_AD_URL
      );
      if (!targetUrl) return;

      // Record this trigger
      localStorage.setItem(STORAGE_LAST_POP, String(now));

      // Trigger pop in new tab
      const win = window.open(targetUrl, '_blank', 'noopener,noreferrer');
      if (win) {
        win.blur?.();
        window.focus?.();
      }
    } catch {
      // Ignore pop-blocker restrictions
    }
  };

  // Bind to click across the document
  window.addEventListener('click', handleInteraction, { capture: true, passive: true });
}
