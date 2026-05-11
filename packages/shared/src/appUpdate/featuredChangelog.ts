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
  // Record<string, unknown> is honest about untrusted input — every field is
  // validated below. Casting to Partial<IFeaturedItem> would imply present
  // fields already have the right type, which we cannot trust.
  const src = raw as Record<string, unknown>;

  const tabLabel = optionalTrimmedString(src.tabLabel);
  const mediaUrl = optionalTrimmedString(src.mediaUrl);
  if (!tabLabel || !mediaUrl) return undefined;

  const mediaType = src.mediaType;
  if (mediaType !== 'image' && mediaType !== 'video') return undefined;

  const rawHrefType = src.hrefType;
  const hrefType =
    rawHrefType === 'internal' || rawHrefType === 'external'
      ? rawHrefType
      : undefined;

  const rawMode = src.mode;
  const mode =
    typeof rawMode === 'number' && VALID_MODE_VALUES.has(rawMode)
      ? (rawMode as ENotificationPushMessageMode)
      : undefined;

  return {
    tabLabel,
    title: optionalTrimmedString(src.title),
    description: optionalTrimmedString(src.description),
    mediaUrl,
    mediaType,
    ctaText: optionalTrimmedString(src.ctaText),
    href: optionalTrimmedString(src.href),
    hrefType,
    mode,
  };
}

export function normalizeFeaturedChangelog(
  raw: unknown,
): IFeaturedChangelog | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const src = raw as Record<string, unknown>;

  const version = optionalTrimmedString(src.version);
  if (!version || !Array.isArray(src.features)) return undefined;

  const features = src.features
    .map((f) => normalizeFeaturedItem(f))
    .filter((f): f is IFeaturedItem => f !== undefined);

  if (features.length === 0) return undefined;

  return {
    version,
    features,
  };
}
