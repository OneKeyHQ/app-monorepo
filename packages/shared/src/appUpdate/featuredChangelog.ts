import { ENotificationPushMessageMode } from '../../types/notification';
import { ONEKEY_APP_DEEP_LINK_NAME } from '../consts/deeplinkConsts';

export interface IFeaturedItem {
  title?: string;
  description?: string;
  mediaUrl: string;
  // Auto-detected by backend from uploaded file MIME type
  mediaType: 'image' | 'video';
  // CTA text — falls back to "Done" when absent
  ctaText?: string;
  // CTA action — same pattern as IWalletBanner. When `mode` is set, `payload`
  // carries the URL/payload string and is dispatched via parseNotificationPayload.
  // When `mode` is absent, `href` + `hrefType` drive a simpler external/internal split.
  href?: string;
  hrefType?: 'internal' | 'external';
  mode?: ENotificationPushMessageMode;
  payload?: string;
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

// Modes whose `payload` is a URL the runtime dispatches to. These payloads
// must clear the same allowlist as `href`; the JSON-payload modes (page /
// dialog / command) parse their payload server-side and aren't URL targets.
const URL_PAYLOAD_MODES = new Set<number>([
  ENotificationPushMessageMode.openInBrowser,
  ENotificationPushMessageMode.openInApp,
  ENotificationPushMessageMode.openInDapp,
]);

// Cap the visible features. The UI / spec is designed for 1-3; an oversized
// list would flood the indicator and leave force-update users stuck in an
// unwieldy blocker.
const MAX_FEATURED_ITEMS = 3;

function optionalTrimmedString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

// Featured Changelog is a high-trust update surface: media is rendered
// directly and CTAs can open external content. Enforce HTTPS for media and
// for CTA URLs that open externally; allow OneKey deep links for in-app
// navigation. Exported so the dialog's runtime dispatch reuses the same list
// (defense in depth — no chance of the two lists drifting).
export const ALLOWED_FEATURED_HREF_PROTOCOLS = new Set([
  'https:',
  `${ONEKEY_APP_DEEP_LINK_NAME}:`,
  'onekey:',
]);

function isHttps(url: string): boolean {
  return url.startsWith('https://');
}

export function isAllowedFeaturedHref(url: string | undefined): url is string {
  if (!url) return false;
  try {
    return ALLOWED_FEATURED_HREF_PROTOCOLS.has(new URL(url).protocol);
  } catch {
    return false;
  }
}

function normalizeFeaturedItem(raw: unknown): IFeaturedItem | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  // Record<string, unknown> is honest about untrusted input — every field is
  // validated below. Casting to Partial<IFeaturedItem> would imply present
  // fields already have the right type, which we cannot trust.
  const src = raw as Record<string, unknown>;

  const mediaUrl = optionalTrimmedString(src.mediaUrl);
  if (!mediaUrl || !isHttps(mediaUrl)) return undefined;

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

  const rawHref = optionalTrimmedString(src.href);
  const href = isAllowedFeaturedHref(rawHref) ? rawHref : undefined;

  // For URL-class modes the payload IS the dispatch target; gate it on the
  // same allowlist as href. JSON-payload modes (page/dialog/command) keep the
  // trimmed payload as-is because parseNotificationPayload JSON.parses it.
  const rawPayload = optionalTrimmedString(src.payload);
  const payload =
    mode !== undefined &&
    URL_PAYLOAD_MODES.has(mode) &&
    !isAllowedFeaturedHref(rawPayload)
      ? undefined
      : rawPayload;

  return {
    title: optionalTrimmedString(src.title),
    description: optionalTrimmedString(src.description),
    mediaUrl,
    mediaType,
    ctaText: optionalTrimmedString(src.ctaText),
    href,
    hrefType,
    mode,
    payload,
  };
}

export function normalizeFeaturedChangelog(
  raw: unknown,
  // The parent response's app version. When provided, the payload's own
  // `version` field must match exactly — featured content authored for a
  // different release would mislead users on the current update path and
  // could occupy a force-update blocker with the wrong copy.
  expectedVersion?: string,
): IFeaturedChangelog | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const src = raw as Record<string, unknown>;

  const version = optionalTrimmedString(src.version);
  if (!version || !Array.isArray(src.features)) return undefined;
  if (expectedVersion !== undefined && version !== expectedVersion) {
    return undefined;
  }

  const features = src.features
    .map((f) => normalizeFeaturedItem(f))
    .filter((f): f is IFeaturedItem => f !== undefined)
    .slice(0, MAX_FEATURED_ITEMS);

  if (features.length === 0) return undefined;

  return {
    version,
    features,
  };
}
