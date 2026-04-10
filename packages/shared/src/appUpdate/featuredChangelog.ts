import type { ENotificationPushMessageMode } from '../../types/notification';

export interface IFeaturedItem {
  tabLabel: string;
  title?: string;
  description?: string;
  mediaUrl: string;
  // Auto-detected by backend from uploaded file MIME type
  mediaType: 'image' | 'video';
  // CTA text — falls back to "Done" when absent
  ctaText?: string;
  // CTA action — same pattern as IWalletBanner
  href?: string;
  hrefType?: 'internal' | 'external';
  mode?: ENotificationPushMessageMode;
  payload?: string;
  useSystemBrowser?: boolean;
}

export interface IFeaturedChangelog {
  version: string; // Target version, e.g. "6.1.0"
  headline?: string; // Main title, e.g. "交易零负担，畅享极致体验" — falls back to "What's new in v{ver}"
  subheadline?: string; // Subtitle, e.g. "本次更新带来 3 项重要升级" — falls back to generic text
  features: IFeaturedItem[]; // 1-3 items, ordered by priority
}

export function hasFeaturedChangelog(
  featuredChangelog: IFeaturedChangelog | undefined,
): featuredChangelog is IFeaturedChangelog {
  return (
    !!featuredChangelog &&
    Array.isArray(featuredChangelog.features) &&
    featuredChangelog.features.length > 0
  );
}
