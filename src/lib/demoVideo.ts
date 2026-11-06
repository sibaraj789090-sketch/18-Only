import { Video } from '../types/database';

export const PRIMARY_DEMO_URL =
  'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';

export const PRIMARY_DEMO_THUMBNAIL =
  'https://storage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg';

/**
 * Public reliable fallback mirrors for the Big Buck Bunny demo video
 * in case Google's sample storage bucket returns 403 Forbidden.
 */
export const DEMO_BACKUP_URLS: string[] = [
  'https://archive.org/download/BigBuckBunny_124/Content/big_buck_bunny_720p_surround.mp4',
  'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_1MB.mp4',
  'https://vjs.zencdn.net/v/oceans.mp4',
];

export const DEMO_BACKUP_THUMBNAIL =
  'https://archive.org/download/BigBuckBunny_124/BigBuckBunny_124.thumbs/Content/big_buck_bunny_720p_surround_000001.jpg';

export const TEMPORARY_DEMO_VIDEO: Video = {
  id: 'demo-player-testing',
  title: 'Demo Video – Player Testing',
  description:
    'Temporary demo video for testing the video player, mobile playback controls, and HilltopAds VAST 3.0 pre-roll advertisement integration. Not saved to database.',
  video_url: PRIMARY_DEMO_URL,
  thumbnail_url: PRIMARY_DEMO_THUMBNAIL,
  views: 1250,
  duration: '9:56',
  category: 'Entertainment',
  category_id: 'entertainment',
  created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
  is_published: true,
  featured: false,
  author_name: 'Temporary Demo · System Test',
  author_avatar: null,
  likes: 48,
};

export function isDemoVideo(id: string | number | undefined | null): boolean {
  return String(id) === TEMPORARY_DEMO_VIDEO.id;
}
