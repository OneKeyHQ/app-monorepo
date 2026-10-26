// Attribution policy for invite codes recovered from a store install referrer.
//
// Parsing lives in `modules/InstallAttribution/googlePlay.ts`, which already
// owns the Play referrer read and its double-encoding fallback. This file
// holds only the rules layered on top: which query key carries the code, what
// counts as a valid code, and how long an attributed code stays usable.

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The query key carrying the invite code inside the referrer string, as
 * agreed with growth. Intentionally the only key read: a bare `ref` is
 * generic enough that unrelated producers append it too, and the landing page
 * builds the Play link at click time, so there is no stale-link window that
 * would need an alias to cover.
 */
export const INSTALL_REFERRER_INVITE_CODE_KEY = 'ref_code';

/**
 * How long Google Play keeps serving this install's referrer.
 *
 * Documented at 90 days, after which the API returns nothing and the referrer
 * is unrecoverable. This bounds *capture*: an empty referrer inside the window
 * may still be a transient Play hiccup worth retrying on the next cold start,
 * but past it there is nothing left to wait for.
 *
 * https://developer.android.com/google/play/installreferrer/library
 */
export const INSTALL_REFERRER_CAPTURE_WINDOW_DAYS = 90;

/**
 * How long a code we already captured stays eligible for auto-fill, measured
 * from app install time.
 *
 * 999 days is a deliberate "effectively never", set by growth. It governs only
 * a code already stored on the device — it is NOT how long the code can still
 * be obtained. Play stops serving the referrer after
 * `INSTALL_REFERRER_CAPTURE_WINDOW_DAYS`, so an app first opened after that
 * window never captures anything for this TTL to act on.
 *
 * Distinct again from the server-side bind window (`REFERRAL_BIND_WINDOW_DAYS`),
 * which starts at wallet creation and is enforced by the rebate backend. That
 * is the limit users realistically hit; this one is kept wired up so the
 * policy can be tightened without re-plumbing the expiry path.
 *
 * Measured from install time because `expo-application` exposes the referrer
 * string but not Play's referrer-click timestamp; install time is the closest
 * proxy and, unlike the click timestamp, is always present.
 */
export const INSTALL_REFERRER_TTL_DAYS = 999;

/** Mirrors the invite-code rules enforced by the bind dialogs' form. */
const INVITE_CODE_PATTERN = /^[a-zA-Z0-9]{1,30}$/;

export enum EInviteCodeAttributionSource {
  androidInstallReferrer = 'androidInstallReferrer',
  iosAppClip = 'iosAppClip',
}

export function isValidInviteCode(value: string | undefined): boolean {
  return Boolean(value) && INVITE_CODE_PATTERN.test(value as string);
}

/**
 * Normalizes a raw referrer value into a usable invite code, rejecting
 * anything the bind form would refuse anyway.
 */
export function pickInviteCodeFromReferrerValue(
  value: string | undefined,
): string | undefined {
  const candidate = value?.trim();
  return isValidInviteCode(candidate) ? candidate : undefined;
}

/**
 * Whether Play has stopped serving this install's referrer, i.e. retrying the
 * capture can no longer succeed.
 */
export function isInstallReferrerCaptureWindowClosed({
  installedAt,
  now,
}: {
  installedAt: number;
  now?: number;
}): boolean {
  // Unknown install time: treat the window as closed rather than hitting the
  // store on every cold start forever.
  if (!Number.isFinite(installedAt) || installedAt <= 0) {
    return true;
  }
  const currentTime = now ?? Date.now();
  return (
    currentTime - installedAt > INSTALL_REFERRER_CAPTURE_WINDOW_DAYS * DAY_MS
  );
}

/**
 * Whether a capture that yielded no usable code is final — i.e. whether later
 * cold starts should stop asking the store.
 *
 * A non-empty referrer without a code is final: an organic install, or one
 * whose custom params Google Ads replaced. An empty referrer is final only
 * once Play's serving window has closed. Inside the window an empty answer may
 * be a transient store hiccup, and treating it as final would permanently
 * lose a real referral install's code.
 */
export function isInstallReferrerCaptureFinal({
  hasReferrer,
  installedAt,
  now,
}: {
  hasReferrer: boolean;
  installedAt: number;
  now?: number;
}): boolean {
  return (
    hasReferrer || isInstallReferrerCaptureWindowClosed({ installedAt, now })
  );
}

export function isInstallReferrerExpired({
  attributedAt,
  now,
  ttlDays = INSTALL_REFERRER_TTL_DAYS,
}: {
  attributedAt: number;
  now?: number;
  ttlDays?: number;
}): boolean {
  if (!Number.isFinite(attributedAt) || attributedAt <= 0) {
    return true;
  }
  const currentTime = now ?? Date.now();
  // A clock that moved backwards (timezone/NTP correction) must not make a
  // freshly attributed code look expired.
  if (attributedAt > currentTime) {
    return false;
  }
  return currentTime - attributedAt > ttlDays * DAY_MS;
}
