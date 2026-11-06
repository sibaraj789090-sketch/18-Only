/**
 * Popunder & Direct Ad Network Integration
 * Handles smart popunder/tab opening for ad networks (ptekuwiny.pro / shameful-farm.com).
 * Features frequency capping, ignore elements, and graceful fallback.
 */

const DEFAULT_POP_URL = 'https://ptekuwiny.pro/412';
const STORAGE_LAST_POP = '18plus_last_pop_time';
const POP_COOLDOWN_MS = 60 * 1000; // 60 seconds cooldown between pops

let popInitialized = false;

export function initAdPopunder(adUrl = DEFAULT_POP_URL) {
  if (typeof window === 'undefined' || popInitialized) return;
  popInitialized = true;

  const handleInteraction = (e: MouseEvent | TouchEvent) => {
    try {
      const target = (e.target as HTMLElement | null);
      if (!target) return;

      // Ignore administrative buttons, inputs, modals, close buttons
      if (
        target.closest('input') ||
        target.closest('textarea') ||
        target.closest('select') ||
        target.closest('[data-no-pop]') ||
        target.closest('.admin-portal') ||
        target.closest('.config-modal') ||
        target.closest('button[aria-label="Close"]')
      ) {
        return;
      }

      // Check frequency cooldown
      const now = Date.now();
      const lastPop = parseInt(localStorage.getItem(STORAGE_LAST_POP) || '0', 10);
      if (now - lastPop < POP_COOLDOWN_MS) {
        return;
      }

      // Record this trigger
      localStorage.setItem(STORAGE_LAST_POP, String(now));

      // Trigger pop in new tab
      const win = window.open(adUrl, '_blank');
      if (win) {
        win.blur?.();
        window.focus?.();
      }
    } catch {
      // Ignore pop-blocker restrictions
    }
  };

  // Bind to touchstart and click across the document
  window.addEventListener('click', handleInteraction, { capture: true, passive: true });
}
