/**
 * HilltopAds VAST 3.0 ad integration & parser
 */

export const HILLTOPADS_VAST_TAG_URL =
  'https://expensive-pollution.com/dumOF/z.dHGNNwvuZTGVUi/keemp9EuHZFU/lik/P/T/cd2TMxDGA/5/NnTicqtFNkzfY/wKM/D/kT2vMrQj';

export interface VastAdData {
  mediaUrl: string;
  clickThroughUrl?: string;
  skipOffset: number; // in seconds, default 5
  duration: number; // in seconds
  impressions: string[];
  trackStart: string[];
  trackComplete: string[];
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

export async function fetchAndParseVast(tagUrl: string): Promise<VastAdData | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);

    const response = await fetch(tagUrl, {
      signal: controller.signal,
      headers: {
        Accept: 'application/xml, text/xml, */*',
      },
    });
    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const xmlText = await response.text();
    if (!xmlText || !xmlText.includes('<VAST')) return null;

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

    // Check parse errors
    if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
      return null;
    }

    // Extract MediaFiles
    const mediaNodes = xmlDoc.getElementsByTagName('MediaFile');
    if (mediaNodes.length === 0) return null;

    let selectedMediaUrl = '';
    // Prefer progressive mp4
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

    if (!selectedMediaUrl) return null;

    // Extract SkipOffset
    let skipOffset = 5;
    const linearNode = xmlDoc.getElementsByTagName('Linear')[0];
    if (linearNode) {
      const skipAttr = linearNode.getAttribute('skipoffset');
      if (skipAttr) {
        skipOffset = parseDurationToSeconds(skipAttr);
      }
    }

    // Extract Duration
    const durationNode = xmlDoc.getElementsByTagName('Duration')[0];
    const duration = parseDurationToSeconds(durationNode?.textContent);

    // Extract ClickThrough
    const clickThroughNode = xmlDoc.getElementsByTagName('ClickThrough')[0];
    const clickThroughUrl = clickThroughNode?.textContent?.trim() || undefined;

    // Extract Impressions
    const impressionNodes = xmlDoc.getElementsByTagName('Impression');
    const impressions: string[] = [];
    for (let i = 0; i < impressionNodes.length; i++) {
      const text = impressionNodes[i].textContent?.trim();
      if (text) impressions.push(text);
    }

    // Extract Tracking events
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
      duration: duration || 30,
      impressions,
      trackStart,
      trackComplete,
    };
  } catch (err) {
    console.warn('VAST fetch/parsing error (fallback will play main content):', err);
    return null;
  }
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
