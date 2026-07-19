import platformEnv from '@onekeyhq/shared/src/platformEnv';

// Readable copy for every SDK error code that can surface inline on the buy
// page (quote stage and checkout events). The raw SDK messages are technical
// and must never reach the user. Hardcoded English pending the i18n pass,
// same as the rest of the Headless UI. Codes mirror the SDK's
// `OnramperErrorCode` union (1.1.0).
const ERROR_COPY: Record<string, string> = {
  // User-fixable input errors. `quoteUnavailable` (backend 40003) also covers
  // below-minimum amounts — Onramper doesn't expose the limits at quote time,
  // so the copy points at the amount as the actionable lever.
  amountOutOfRange: 'Amount is outside the provider limits. Adjust the amount',
  quoteUnavailable:
    'No quote available for this amount. It may be outside the provider limits — adjust the amount and try again',
  // Transient environment errors.
  networkError: 'Network error. Check your connection and try again',
  timeout: 'Request timed out. Try again',
  temporaryFailure: 'Service temporarily unavailable. Try again later',
  invalidRequest: 'Unable to process this request right now. Try again later',
  decodingError: 'Failed to parse the response. Try again',
  // Stale page / intent state.
  notInitialized: 'This page has expired. Try again',
  initializationFailed: 'Initialization failed. Try again',
  invalidState: 'This page has expired. Try again',
  invalidStateTransition: 'This page has expired. Try again',
  intentInvalidated: 'The quote has expired. Try again',
  intentAlreadyConsumed: 'The quote was already used. Get a new quote',
  requirementNotSatisfied: 'A verification step is incomplete. Try again',
  // Login / session state.
  userTokenInvalid: 'Your login has expired. Try again',
  userTokenRefreshFailed: 'Your login has expired. Try again',
  sessionExpirationHandlerFailed: 'The session has expired. Try again',
  oidcFlowCancelled: 'Identity verification canceled',
  oidcFlowFailed: 'Identity verification failed. Try again',
  oidcTokenExchangeFailed: 'Identity verification failed. Try again',
  // Payment surface.
  webviewLoadFailed: 'Unable to open the payment page. Try again',
  deepLinkFailed: 'Unable to open the payment page. Try again',
  // Device security (retry copy; genuinely blocked devices surface structural
  // codes and go to the web fallback instead).
  securityStorageFailed: 'Device security check failed. Try again',
  securityTrustFailed: 'Device security check failed. Try again',
};

const DEFAULT_ERROR_COPY =
  'Unable to complete the purchase right now. Try again later';

function toAmountText(value: unknown): string | undefined {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? String(n) : undefined;
}

export function getOnramperErrorMessage(err: {
  code?: string;
  message?: string;
  info?: Record<string, unknown>;
}): string {
  let copy = (err?.code && ERROR_COPY[err.code]) || DEFAULT_ERROR_COPY;
  // `amountOutOfRange` is validated locally by the SDK and its `info` carries
  // the provider's min/max in the source fiat (per the official docs) — show
  // the real bounds instead of the generic "adjust the amount" copy. The
  // thrown-rejection path loses `info` at the Nitro bridge, so this upgrade
  // only fires on the structured `failed`-event path.
  const min = toAmountText(err?.info?.min);
  const max = toAmountText(err?.info?.max);
  if (min !== undefined && max !== undefined) {
    copy = `Enter an amount between $${min} and $${max}`;
  } else if (min !== undefined) {
    copy = `The minimum purchase is $${min}. Adjust the amount`;
  } else if (max !== undefined) {
    copy = `The maximum purchase is $${max}. Adjust the amount`;
  }
  // Dev builds append the raw code so on-device QA screenshots map back to the
  // SDK error without a log capture.
  return platformEnv.isDev && err?.code ? `${copy} (${err.code})` : copy;
}
