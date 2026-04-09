export interface IFeaturedItem {
  tabLabel: string; // Tab pill text, e.g. "⚡ 0 手续费"
  title: string; // Feature title, ≤15 chars
  description: string; // Feature description, ≤40 chars
  mediaUrl: string; // Remote image or video URL
  mediaType: 'image' | 'video';
  ctaText: string; // CTA button text, e.g. "立即体验"
  ctaDeeplink: string; // Deep link for CTA action
}

export interface IFeaturedChangelog {
  version: string; // Target version, e.g. "6.1.0"
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
