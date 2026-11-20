// RevenueCat hybrid-common and purchases-js use different codes after 25.
const COMMON_ERROR_NAMES: Record<string, string> = {
  '0': 'UNKNOWN_ERROR',
  '1': 'PURCHASE_CANCELLED_ERROR',
  '2': 'STORE_PROBLEM_ERROR',
  '3': 'PURCHASE_NOT_ALLOWED_ERROR',
  '4': 'PURCHASE_INVALID_ERROR',
  '5': 'PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR',
  '6': 'PRODUCT_ALREADY_PURCHASED_ERROR',
  '7': 'RECEIPT_ALREADY_IN_USE_ERROR',
  '8': 'INVALID_RECEIPT_ERROR',
  '9': 'MISSING_RECEIPT_FILE_ERROR',
  '10': 'NETWORK_ERROR',
  '11': 'INVALID_CREDENTIALS_ERROR',
  '12': 'UNEXPECTED_BACKEND_RESPONSE_ERROR',
  '14': 'INVALID_APP_USER_ID_ERROR',
  '15': 'OPERATION_ALREADY_IN_PROGRESS_ERROR',
  '16': 'UNKNOWN_BACKEND_ERROR',
  '17': 'INVALID_APPLE_SUBSCRIPTION_KEY_ERROR',
  '18': 'INELIGIBLE_ERROR',
  '19': 'INSUFFICIENT_PERMISSIONS_ERROR',
  '20': 'PAYMENT_PENDING_ERROR',
  '21': 'INVALID_SUBSCRIBER_ATTRIBUTES_ERROR',
  '22': 'LOG_OUT_ANONYMOUS_USER_ERROR',
  '23': 'CONFIGURATION_ERROR',
  '24': 'UNSUPPORTED_ERROR',
  '25': 'EMPTY_SUBSCRIBER_ATTRIBUTES_ERROR',
};

const NATIVE_ERROR_NAMES: Record<string, string> = {
  ...COMMON_ERROR_NAMES,
  '13': 'RECEIPT_IN_USE_BY_OTHER_SUBSCRIBER_ERROR',
  '26': 'PRODUCT_DISCOUNT_MISSING_IDENTIFIER_ERROR',
  '28': 'PRODUCT_DISCOUNT_MISSING_SUBSCRIPTION_GROUP_IDENTIFIER_ERROR',
  '29': 'CUSTOMER_INFO_ERROR',
  '30': 'SYSTEM_INFO_ERROR',
  '31': 'BEGIN_REFUND_REQUEST_ERROR',
  '32': 'PRODUCT_REQUEST_TIMED_OUT_ERROR',
  '33': 'API_ENDPOINT_BLOCKED',
  '34': 'INVALID_PROMOTIONAL_OFFER_ERROR',
  '35': 'OFFLINE_CONNECTION_ERROR',
  '42': 'TEST_STORE_SIMULATED_PURCHASE_ERROR',
};

const WEB_ERROR_NAMES: Record<string, string> = {
  ...COMMON_ERROR_NAMES,
  '28': 'CUSTOMER_INFO_ERROR',
  '36': 'SIGNATURE_VERIFICATION_ERROR',
  '38': 'INVALID_EMAIL_ERROR',
};

export type IPrimeUnderlyingErrorCategory =
  | 'billingUnavailable'
  | 'network'
  | 'storeConfig'
  | 'storeAccount'
  | 'productUnavailable'
  | 'unknown';

// Which paywall fail state a package-loading error maps to.
export type IPrimePackagesFailureKind =
  | 'network'
  | 'storeUnavailable'
  | 'purchaseNotAllowed'
  | 'productUnavailable'
  | 'unknown';

export type IPrimePurchaseErrorAnalytics = {
  errorCode?: string;
  errorName: string;
  underlyingErrorCategory: IPrimeUnderlyingErrorCategory;
};

type IPrimePurchaseErrorDetails = {
  code?: unknown;
  errorCode?: unknown;
  domain?: unknown;
  message?: unknown;
  underlyingErrorMessage?: unknown;
  userInfo?: {
    underlyingErrorMessage?: unknown;
    NSLocalizedDescription?: unknown;
    NSUnderlyingError?: unknown;
  } | null;
};

// NSError messages can be localized; recognize transport failures by domain/code.
const URL_NETWORK_ERROR_CODES = new Set([
  '-1001', // Timed out.
  '-1003', // Cannot find host.
  '-1004', // Cannot connect to host.
  '-1005', // Connection lost.
  '-1006', // DNS lookup failed.
  '-1009', // Not connected to the internet.
  '-1200', // Secure connection failed.
  '-1202', // Untrusted server certificate.
]);

function classifyUnderlyingError(
  code: string | undefined,
  message: string,
  hasNativeNetworkError: boolean,
): IPrimeUnderlyingErrorCategory {
  const text = message.toLowerCase();
  if (
    code === '10' ||
    code === '35' ||
    hasNativeNetworkError ||
    /network|offline|connection/.test(text)
  ) {
    return 'network';
  }
  if (/billing.*unavailable|billing.*not available/.test(text)) {
    return 'billingUnavailable';
  }
  if (/account|not signed in|not logged in/.test(text)) {
    return 'storeAccount';
  }
  if (
    code === '5' ||
    /product.*unavailable/.test(text) ||
    text.includes(
      'none of the products registered in the revenuecat dashboard could be fetched',
    )
  ) {
    return 'productUnavailable';
  }
  if (code === '23' || /configuration/.test(text)) {
    return 'storeConfig';
  }
  return 'unknown';
}

export function getPrimePurchaseErrorAnalytics(
  error: unknown,
): IPrimePurchaseErrorAnalytics {
  const value = error as IPrimePurchaseErrorDetails | null | undefined;
  const rawCode = value?.errorCode ?? value?.code;
  // A bridge can throw arbitrary objects; never stringify them into telemetry.
  const numericCode =
    (typeof rawCode === 'number' && Number.isSafeInteger(rawCode)) ||
    (typeof rawCode === 'string' && /^-?\d{1,6}$/.test(rawCode))
      ? String(rawCode)
      : undefined;
  const names =
    value?.errorCode !== undefined ? WEB_ERROR_NAMES : NATIVE_ERROR_NAMES;
  const code =
    numericCode && (names[numericCode] || numericCode === '-99999')
      ? numericCode
      : undefined;

  const messages: string[] = [];
  let nativeError = value;
  let hasNativeNetworkError = false;
  // RN puts Android details in userInfo and serializes nested iOS NSErrors there.
  for (let depth = 0; nativeError && depth < 5; depth += 1) {
    for (const message of [
      nativeError.message,
      nativeError.underlyingErrorMessage,
      nativeError.userInfo?.underlyingErrorMessage,
      nativeError.userInfo?.NSLocalizedDescription,
    ]) {
      if (typeof message === 'string') messages.push(message);
    }
    const nativeCode = nativeError.code;
    if (
      nativeError.domain === 'NSURLErrorDomain' &&
      (typeof nativeCode === 'string' || typeof nativeCode === 'number') &&
      URL_NETWORK_ERROR_CODES.has(String(nativeCode))
    ) {
      hasNativeNetworkError = true;
    }
    const underlying = nativeError.userInfo?.NSUnderlyingError;
    nativeError =
      underlying && typeof underlying === 'object'
        ? (underlying as IPrimePurchaseErrorDetails)
        : undefined;
  }
  return {
    errorCode: code,
    errorName: (code && names[code]) || 'UNKNOWN_ERROR',
    underlyingErrorCategory: classifyUnderlyingError(
      code,
      messages.join('\n'),
      hasNativeNetworkError,
    ),
  };
}
