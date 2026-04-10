import { ENotificationPushMessageMode } from '../../types/notification';

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

const VALID_MODE_VALUES = new Set<number>([
  ENotificationPushMessageMode.page,
  ENotificationPushMessageMode.dialog,
  ENotificationPushMessageMode.openInBrowser,
  ENotificationPushMessageMode.openInApp,
  ENotificationPushMessageMode.openInDapp,
  ENotificationPushMessageMode.command,
]);

function optionalTrimmedString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeFeaturedItem(raw: unknown): IFeaturedItem | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const src = raw as Partial<IFeaturedItem>;

  const tabLabel = optionalTrimmedString(src.tabLabel);
  const mediaUrl = optionalTrimmedString(src.mediaUrl);
  if (!tabLabel || !mediaUrl) return undefined;

  if (src.mediaType !== 'image' && src.mediaType !== 'video') return undefined;

  const hrefType =
    src.hrefType === 'internal' || src.hrefType === 'external'
      ? src.hrefType
      : undefined;

  const mode =
    typeof src.mode === 'number' && VALID_MODE_VALUES.has(src.mode)
      ? src.mode
      : undefined;

  return {
    tabLabel,
    title: optionalTrimmedString(src.title),
    description: optionalTrimmedString(src.description),
    mediaUrl,
    mediaType: src.mediaType,
    ctaText: optionalTrimmedString(src.ctaText),
    href: optionalTrimmedString(src.href),
    hrefType,
    mode,
    payload: optionalTrimmedString(src.payload),
    useSystemBrowser:
      typeof src.useSystemBrowser === 'boolean'
        ? src.useSystemBrowser
        : undefined,
  };
}

export function normalizeFeaturedChangelog(
  raw: unknown,
): IFeaturedChangelog | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const src = raw as Partial<IFeaturedChangelog>;

  const version = optionalTrimmedString(src.version);
  if (!version || !Array.isArray(src.features)) return undefined;

  const features = src.features
    .map((f) => normalizeFeaturedItem(f))
    .filter((f): f is IFeaturedItem => f !== undefined);

  if (features.length === 0) return undefined;

  return {
    version,
    headline: optionalTrimmedString(src.headline),
    subheadline: optionalTrimmedString(src.subheadline),
    features,
  };
}
