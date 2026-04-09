export interface IFeaturedItem {
  tabLabel: string; // Tab pill text, e.g. "⚡ 0 手续费"
  title?: string; // Feature title — optional, not shown when empty
  description?: string; // Feature description — optional, not shown when empty
  mediaUrl: string; // Remote image or video URL
  mediaType: 'image' | 'video';
  ctaText?: string; // CTA button text, e.g. "立即体验" — optional, falls back to "Done"
  ctaDeeplink?: string; // Deep link for post-install CTA — optional, no link = just close modal
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
