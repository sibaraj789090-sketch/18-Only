/**
 * VAST 3.0 Pre-Roll Ad Integration & Parser
 * Supports HilltopAds, Monetag, Google Ad Manager, and standard VAST XML feeds.
 */

export const GOOGLE_SAMPLE_VAST_TAG_URL =
  'https://pubads.g.doubleclick.net/gampad/ads?iu=/21775744923/external/single_preroll_skippable&sz=640x480&ciu_szs=300x250%2C728x90&gdfp_req=1&output=vast&unviewed_position_start=1&env=vp&impl=s&correlator=';

export const HILLTOPADS_VAST_TAG_URL =
  'https://expensive-pollution.com/dumOF/z.dHGNNwvuZTGVUi/keemp9EuHZFU/lik/P/T/cd2TMxDGA/5/NnTicqtFNkzfY/wKM/D/kT2vMrQj';

export const PTEKUWINY_AD_URL_1 = 'https://ptekuwiny.pro/412';
export const PTEKUWINY_AD_URL_2 = 'https://ptekuwiny.pro/417';
export const PTEKUWINY_DIRECT_URL = PTEKUWINY_AD_URL_1;

export const SHAMEFUL_FARM_AD_SCRIPT_URL_1 =
  '//shameful-farm.com/bvX.VHswdrGVlb0MYbWacn/Tenmx9euFZ_UblTkVPET/cp2_MvDCEy4CMlz/MTtONqzTYowCMWTEgbzhNIw-';

export const SHAMEFUL_FARM_AD_SCRIPT_URL_2 =
  '//shameful-farm.com/bpXRVDs.dXGOlg0VYKWFcQ/KeymW9tuYZCU/lOkoPOT/c/2nMpDiEr4MNfjKEXtTN-zFYXw/MmTngt2RNTQa';

export const SHAMEFUL_FARM_AD_SCRIPT_URL_3 =
  '//shameful-farm.com/bXXEV.sTdcGPli0iYJWmcS/XeMmZ9FufZ/UBlgk/PzT/cx2wMSDxES4JOhD-UitfNpzZY/wPMWT/gl4BOKQY';

export const SHAMEFUL_FARM_AD_SCRIPT_URL = SHAMEFUL_FARM_AD_SCRIPT_URL_1;

export interface VastAdData {
  mediaUrl: string;
  clickThroughUrl?: string;
  skipOffset: number; // in seconds, default 5
  duration: number; // in seconds
  impressions: string[];
  trackStart: string[];
  trackComplete: string[];
  title?: string;
  isFallback?: boolean;
}

export interface AdConfig {
  enabled: boolean;
  tagUrl: string;
  enableFallbackAd: boolean;
  allowFallback?: boolean;
  skipOffset: number;
  skipOffsetSeconds?: number;
  bannerAdsEnabled?: boolean;
  bannerScriptUrl?: string;
  bannerScriptUrl2?: string;
  bannerScriptUrl3?: string;
}

const STORAGE_KEY_AD_CONFIG = '18plus_ad_config';

export const DEFAULT_AD_CONFIG: AdConfig = {
  enabled: true,
  // By default, use Google's working sample tag so ads immediately run out-of-the-box!
  tagUrl: GOOGLE_SAMPLE_VAST_TAG_URL,
  enableFallbackAd: true,
  allowFallback: true,
  skipOffset: 5,
  skipOffsetSeconds: 5,
  bannerAdsEnabled: true,
  bannerScriptUrl: SHAMEFUL_FARM_AD_SCRIPT_URL_1,
  bannerScriptUrl2: SHAMEFUL_FARM_AD_SCRIPT_URL_2,
  bannerScriptUrl3: SHAMEFUL_FARM_AD_SCRIPT_URL_3,
};

export function getAdConfig(): AdConfig {
  if (typeof window === 'undefined') return DEFAULT_AD_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_AD_CONFIG);
    if (!raw) return DEFAULT_AD_CONFIG;
    const parsed = JSON.parse(raw);
    const fallback = parsed.enableFallbackAd ?? parsed.allowFallback ?? true;
    const skip = typeof parsed.skipOffset === 'number'
      ? parsed.skipOffset
      : (typeof parsed.skipOffsetSeconds === 'number' ? parsed.skipOffsetSeconds : 5);

    return {
      enabled: parsed.enabled ?? true,
      tagUrl: (parsed.tagUrl && parsed.tagUrl.trim()) ? parsed.tagUrl.trim() : GOOGLE_SAMPLE_VAST_TAG_URL,
      enableFallbackAd: fallback,
      allowFallback: fallback,
      skipOffset: skip,
      skipOffsetSeconds: skip,
      bannerAdsEnabled: parsed.bannerAdsEnabled ?? true,
      bannerScriptUrl: parsed.bannerScriptUrl || SHAMEFUL_FARM_AD_SCRIPT_URL_1,
      bannerScriptUrl2: parsed.bannerScriptUrl2 || SHAMEFUL_FARM_AD_SCRIPT_URL_2,
      bannerScriptUrl3: parsed.bannerScriptUrl3 || SHAMEFUL_FARM_AD_SCRIPT_URL_3,
    };
  } catch {
    return DEFAULT_AD_CONFIG;
  }
}

export function saveAdConfig(config: Partial<AdConfig>): AdConfig {
  const current = getAdConfig();
  const fallback = config.enableFallbackAd ?? config.allowFallback ?? current.enableFallbackAd;
  const skip = config.skipOffset ?? config.skipOffsetSeconds ?? current.skipOffset;

  const next: AdConfig = {
    ...current,
    ...config,
    enableFallbackAd: fallback,
    allowFallback: fallback,
    skipOffset: skip,
    skipOffsetSeconds: skip,
  };
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY_AD_CONFIG, JSON.stringify(next));
    } catch {}
  }
  return next;
}

export function resetAdConfig(): AdConfig {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(STORAGE_KEY_AD_CONFIG);
    } catch {}
  }
  return DEFAULT_AD_CONFIG;
}

export function parseDurationToSeconds(durationStr?: string | null): number {
  if (!durationStr) return 0;
  const parts = durationStr.trim().split(':');
  if (parts.length === 3) {
    const hours = parseFloat(parts[0]) || 0;
    const mins = parseFloat(parts[1]) || 0;
    const secs = parseFloat(parts[2]) || 0;
    return hours * 3600 + mins * 60 + secs;
  }
  const parsed = parseFloat(durationStr);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Diagnostic function to test if a given VAST URL responds with valid XML.
 */
export async function testVastTag(tagUrl: string): Promise<{
  valid: boolean;
  success: boolean;
  status?: number;
  message: string;
  duration?: number;
  mediaUrl?: string;
}> {
  if (!tagUrl || !tagUrl.trim()) {
    return { valid: false, success: false, message: 'Please provide a VAST tag URL.' };
  }

  const cleanUrl = tagUrl.trim();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(cleanUrl, {
      signal: controller.signal,
      headers: { Accept: 'application/xml, text/xml, */*' },
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        valid: false,
        success: false,
        status: response.status,
        message: `Ad server responded with HTTP ${response.status} (${response.statusText || 'Error'}). Check if tag is active.`,
      };
    }

    const xmlText = await response.text();
    if (!xmlText || !xmlText.includes('<VAST')) {
      return {
        valid: false,
        success: false,
        message: 'Response does not contain valid VAST XML data (ad network may have no fill).',
      };
    }

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
      return { valid: false, success: false, message: 'XML parsing error in ad response.' };
    }

    const mediaNodes = xmlDoc.getElementsByTagName('MediaFile');
    if (mediaNodes.length === 0) {
      return { valid: false, success: false, message: 'VAST XML received, but contains no MediaFile video stream.' };
    }

    const durationNode = xmlDoc.getElementsByTagName('Duration')[0];
    const duration = parseDurationToSeconds(durationNode?.textContent);

    return {
      valid: true,
      success: true,
      status: 200,
      message: `Active VAST 3.0 ad stream found! (${duration || 15}s duration, ${mediaNodes.length} media source${mediaNodes.length > 1 ? 's' : ''}).`,
      duration: duration || 15,
      mediaUrl: mediaNodes[0]?.textContent?.trim(),
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Network / CORS error';
    return {
      valid: false,
      success: false,
      message: `Could not fetch ad tag: ${msg}. If this is a cross-origin tag, it may work inside Google IMA SDK.`,
    };
  }
}

/**
 * High-reliability fallback ad when third-party ad tag has 0 fill, 404, or is offline.
 */
export function getSafeFallbackAd(skipOffset = 5): VastAdData {
  return {
    mediaUrl: 'https://vjs.zencdn.net/v/oceans.mp4',
    clickThroughUrl: 'https://hilltopads.com',
    skipOffset,
    duration: 15,
    impressions: [],
    trackStart: [],
    trackComplete: [],
    title: 'Featured Sponsor &middot; High Speed Video',
    isFallback: true,
  };
}

/**
 * Fetches and parses a VAST XML tag, extracting media streams, skip duration, and tracking beacons.
 */
export async function fetchAndParseVast(
  tagUrl: string,
  allowFallback = true
): Promise<VastAdData | null> {
  const config = getAdConfig();
  if (!config.enabled) return null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(tagUrl, {
      signal: controller.signal,
      headers: {
        Accept: 'application/xml, text/xml, */*',
      },
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const xmlText = await response.text();
      if (xmlText && xmlText.includes('<VAST')) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

        if (xmlDoc.getElementsByTagName('parsererror').length === 0) {
          const mediaNodes = xmlDoc.getElementsByTagName('MediaFile');
          if (mediaNodes.length > 0) {
            let selectedMediaUrl = '';
            for (let i = 0; i < mediaNodes.length; i++) {
              const node = mediaNodes[i];
              const type = node.getAttribute('type') || '';
              const content = node.textContent?.trim() || '';
              if (content && (type.includes('mp4') || content.includes('.mp4'))) {
                selectedMediaUrl = content;
                break;
              }
            }
            if (!selectedMediaUrl && mediaNodes[0].textContent) {
              selectedMediaUrl = mediaNodes[0].textContent.trim();
            }

            if (selectedMediaUrl) {
              let skipOffset = config.skipOffset;
              const linearNode = xmlDoc.getElementsByTagName('Linear')[0];
              if (linearNode) {
                const skipAttr = linearNode.getAttribute('skipoffset');
                if (skipAttr) {
                  skipOffset = parseDurationToSeconds(skipAttr);
                }
              }

              const durationNode = xmlDoc.getElementsByTagName('Duration')[0];
              const duration = parseDurationToSeconds(durationNode?.textContent);

              const clickThroughNode = xmlDoc.getElementsByTagName('ClickThrough')[0];
              const clickThroughUrl = clickThroughNode?.textContent?.trim() || undefined;

              const titleNode = xmlDoc.getElementsByTagName('AdTitle')[0];
              const adTitle = titleNode?.textContent?.trim() || undefined;

              const impressionNodes = xmlDoc.getElementsByTagName('Impression');
              const impressions: string[] = [];
              for (let i = 0; i < impressionNodes.length; i++) {
                const text = impressionNodes[i].textContent?.trim();
                if (text) impressions.push(text);
              }

              const trackingNodes = xmlDoc.getElementsByTagName('Tracking');
              const trackStart: string[] = [];
              const trackComplete: string[] = [];

              for (let i = 0; i < trackingNodes.length; i++) {
                const event = trackingNodes[i].getAttribute('event');
                const url = trackingNodes[i].textContent?.trim();
                if (url) {
                  if (event === 'start') trackStart.push(url);
                  if (event === 'complete') trackComplete.push(url);
                }
              }

              return {
                mediaUrl: selectedMediaUrl,
                clickThroughUrl,
                skipOffset,
                duration: duration || 15,
                impressions,
                trackStart,
                trackComplete,
                title: adTitle,
                isFallback: false,
              };
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('VAST fetch error for primary tag:', err);
  }

  // If primary tag failed (e.g. 404 or CORS) and fallback is allowed:
  if (allowFallback && config.enableFallbackAd) {
    // If current tag wasn't already Google's sample tag, try Google's official sample tag
    if (tagUrl !== GOOGLE_SAMPLE_VAST_TAG_URL) {
      console.info('Attempting fallback to Google VAST Sample ad feed...');
      const fallbackResult = await fetchAndParseVast(GOOGLE_SAMPLE_VAST_TAG_URL, false);
      if (fallbackResult) {
        return fallbackResult;
      }
    }

    // Ultimate fail-safe: safe progressive video ad
    return getSafeFallbackAd(config.skipOffset);
  }

  return null;
}

export function pingTrackingUrl(url?: string | null) {
  if (!url) return;
  try {
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon(url);
    } else {
      const img = new Image();
      img.src = url;
    }
  } catch {
    // Silent catch
  }
}
