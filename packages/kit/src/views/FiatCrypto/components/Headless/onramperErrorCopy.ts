import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

// Copy follows what the user can do next, not which SDK code fired: every
// code the buy page can show maps to one of these groups, and each group has
// one line saying what happened and what to do. The amount slot shows two
// $bodySm lines at most and cuts the rest, so lines stay short.
type IErrorCopyGroup =
  | 'amountOutOfRange'
  | 'noQuote'
  | 'network'
  | 'service'
  | 'quoteExpired'
  | 'verification'
  | 'paymentPage'
  | 'applePaySetup'
  | 'paymentFailed'
  | 'paymentUnknown'
  | 'deviceCheck'
  | 'unavailable';

// Codes mirror the SDK's `OnramperErrorCode` union (1.3.1) plus our own init
// codes. `oidcFlowCancelled` is absent on purpose: a closed sign-in is not
// shown as an error. The self-healing codes (expired / used quote, state
// errors) are only shown when the quiet re-prepare already ran once.
const ERROR_COPY_GROUP: Record<string, IErrorCopyGroup> = {
  // `quoteUnavailable` (backend 40003) also covers below-minimum amounts:
  // Onramper doesn't expose the limits at quote time.
  amountOutOfRange: 'amountOutOfRange',
  quoteUnavailable: 'noQuote',
  networkError: 'network',
  timeout: 'service',
  temporaryFailure: 'service',
  invalidRequest: 'service',
  decodingError: 'service',
  notInitialized: 'service',
  initializationFailed: 'service',
  // Our own codes for an init that failed before the SDK named a cause.
  sessionMintFailed: 'service',
  clientInitFailed: 'service',
  clientDestroyed: 'service',
  invalidState: 'service',
  invalidStateTransition: 'service',
  sessionExpirationHandlerFailed: 'service',
  intentInvalidated: 'quoteExpired',
  intentAlreadyConsumed: 'quoteExpired',
  requirementNotSatisfied: 'verification',
  userTokenInvalid: 'verification',
  userTokenRefreshFailed: 'verification',
  oidcFlowFailed: 'verification',
  oidcTokenExchangeFailed: 'verification',
  webviewLoadFailed: 'paymentPage',
  deepLinkFailed: 'paymentPage',
  applePayNotConfigured: 'applePaySetup',
  // Every provider-side decline lands here (Coinbase reports region
  // mismatch, weekly limits and card declines alike as a failed
  // authorization), so the copy must not guess a cause such as the card.
  paymentFailed: 'paymentFailed',
  // The payment surface broke without confirming the outcome: the order is
  // kept, and the page offers it instead of a one-tap retry.
  providerFailed: 'paymentUnknown',
  securityStorageFailed: 'deviceCheck',
  securityTrustFailed: 'deviceCheck',
  // Structural failures: the page hands over to the web widget.
  checkoutForbidden: 'unavailable',
  deviceBlocked: 'unavailable',
  configurationError: 'unavailable',
  attestationFailed: 'unavailable',
  platformUnsupported: 'unavailable',
};

const ERROR_COPY: Record<IErrorCopyGroup, ETranslations> = {
  amountOutOfRange: ETranslations.buy_error_amount_out_of_range__msg,
  noQuote: ETranslations.buy_error_no_quote__msg,
  network: ETranslations.global_network_error_help_text,
  service: ETranslations.buy_error_service__msg,
  quoteExpired: ETranslations.buy_error_quote_expired__msg,
  verification: ETranslations.buy_error_verification__msg,
  paymentPage: ETranslations.buy_error_payment_page__msg,
  applePaySetup: ETranslations.buy_error_apple_pay_setup__msg,
  paymentFailed: ETranslations.buy_error_payment_failed__msg,
  paymentUnknown: ETranslations.buy_error_payment_unknown__msg,
  deviceCheck: ETranslations.buy_error_device_check__msg,
  unavailable: ETranslations.buy_error_unavailable__msg,
};

function toAmountText(value: unknown): string | undefined {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? `$${n}` : undefined;
}

export function getOnramperErrorMessage(err: {
  code?: string;
  message?: string;
  info?: Record<string, unknown>;
  // SDK 1.3+ customer-safe copy and support code (absent on older payloads).
  userMessage?: string;
  supportCode?: string;
}): string {
  // Resolved at call time: the message is stored as text on the page state.
  const { intl } = appLocale;
  const group = err?.code ? ERROR_COPY_GROUP[err.code] : undefined;
  // For a code we do not know, the SDK's own customer copy beats the generic
  // line — but it is English-only, so other locales keep the generic line.
  const sdkCopy = appLocale.getLocale().startsWith('en')
    ? err?.userMessage?.trim()
    : undefined;
  let copy =
    (group && intl.formatMessage({ id: ERROR_COPY[group] })) ||
    sdkCopy ||
    intl.formatMessage({ id: ETranslations.buy_error_generic__msg });
  // `amountOutOfRange` is validated locally by the SDK and its `info` carries
  // the provider's min/max in the source fiat (per the official docs) — show
  // the real bounds instead of the generic line. The thrown-rejection path
  // loses `info` at the Nitro bridge, so this only fires on the structured
  // `failed`-event path.
  const min = toAmountText(err?.info?.min);
  const max = toAmountText(err?.info?.max);
  if (min !== undefined && max !== undefined) {
    copy = intl.formatMessage(
      { id: ETranslations.buy_error_amount_between__msg },
      { min, max },
    );
  } else if (min !== undefined) {
    copy = intl.formatMessage(
      { id: ETranslations.buy_error_amount_min__msg },
      { amount: min },
    );
  } else if (max !== undefined) {
    copy = intl.formatMessage(
      { id: ETranslations.buy_error_amount_max__msg },
      { amount: max },
    );
  }
  // Dev builds append the raw code (and the SDK support code when it differs)
  // so on-device QA screenshots map back to the SDK error without a log
  // capture.
  if (!platformEnv.isDev || !err?.code) {
    return copy;
  }
  const supportCode =
    err.supportCode && err.supportCode !== err.code
      ? ` · ${err.supportCode}`
      : '';
  return `${copy} (${err.code}${supportCode})`;
}
