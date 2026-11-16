import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { isPrimeAppleStorePayment } from '@onekeyhq/shared/src/prime/primePaymentCapabilities';
import type {
  IPrimePackagesFailureKind,
  IPrimePurchaseErrorAnalytics,
} from '@onekeyhq/shared/src/utils/primePurchaseErrorAnalytics';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IRevenueCatStorefront } from '@onekeyhq/shared/types/prime/revenueCat';

export type IPrimePackagesFetchFailure = {
  kind: IPrimePackagesFailureKind;
  // Purchase account Storefront: ISO 3166-1 alpha-3 on Apple, alpha-2 on
  // Google Play. Never derived from the system region, language or IP.
  storefrontCountryCode?: string;
};

// Error codes follow PURCHASES_ERROR_CODE in
// @revenuecat/purchases-typescript-internal. The native mappings below were
// checked against the SDK sources bundled by react-native-purchases 10.4.3
// (purchases-ios 5.80.3, purchases-android 10.13.0):
// - 2 STORE_PROBLEM: Play ERROR / SERVICE_UNAVAILABLE / SERVICE_DISCONNECTED /
//   SERVICE_TIMEOUT; StoreKit cloud service and system errors. Transient.
// - 3 PURCHASE_NOT_ALLOWED: Play BILLING_UNAVAILABLE / FEATURE_NOT_SUPPORTED;
//   SKError paymentNotAllowed / clientInvalid / cloudServicePermissionDenied.
// - 5 PRODUCT_NOT_AVAILABLE_FOR_PURCHASE: Play ITEM_UNAVAILABLE; StoreKit
//   storeProductNotAvailable / notAvailableInStorefront.
// - 23 CONFIGURATION_ERROR: the store returned none of the offering products.
//   On iOS the store request error, if any, is kept as the underlying error.
const NETWORK_ERROR_CODES = new Set([
  '10', // NETWORK_ERROR
  '32', // PRODUCT_REQUEST_TIMED_OUT_ERROR
  '33', // API_ENDPOINT_BLOCKED
  '35', // OFFLINE_CONNECTION_ERROR
]);

export function getPrimePackagesFailureKind({
  errorCode,
  underlyingErrorCategory,
  isEmptyOffering,
}: Pick<
  IPrimePurchaseErrorAnalytics,
  'errorCode' | 'underlyingErrorCategory'
> & {
  isEmptyOffering?: boolean;
}): IPrimePackagesFailureKind {
  if (
    (errorCode && NETWORK_ERROR_CODES.has(errorCode)) ||
    underlyingErrorCategory === 'network'
  ) {
    return 'network';
  }
  if (errorCode === '2') {
    return 'storeUnavailable';
  }
  if (errorCode === '3') {
    return 'purchaseNotAllowed';
  }
  // Only product-specific configuration errors justify account/storefront copy.
  if (
    errorCode === '5' ||
    (errorCode === '23' && underlyingErrorCategory === 'productUnavailable') ||
    isEmptyOffering
  ) {
    return 'productUnavailable';
  }
  return 'unknown';
}

export function isPrimeTransientPackagesFailure(
  kind: IPrimePackagesFailureKind,
): boolean {
  return kind === 'network' || kind === 'storeUnavailable';
}

export async function getPrimeStorefrontCountryCode(
  getStorefront?: () => Promise<IRevenueCatStorefront | null>,
): Promise<string | undefined> {
  if (!getStorefront) {
    return undefined;
  }
  try {
    const storefront = await timerUtils.timeout(getStorefront(), 1500);
    const countryCode = storefront?.countryCode;
    // Only forward a plain ISO country code to telemetry.
    return typeof countryCode === 'string' && /^[A-Z]{2,3}$/.test(countryCode)
      ? countryCode
      : undefined;
  } catch {
    // Older native shells and unavailable store accounts have no Storefront.
    return undefined;
  }
}

// Only states seen in production get dedicated copy (PostHog
// fetchPackagesFailed, 90 days to 2026-11-12). Rare ones keep the title and
// Retry: Apple code 2 (0 users), Apple code 3 (0, StoreKit raises it only on
// purchase), Google Play codes 5 / 23 (3).
export function getPrimePackagesFailureDescriptionId({
  kind,
  storefrontCountryCode,
}: IPrimePackagesFetchFailure): ETranslations | undefined {
  const isAppStore = isPrimeAppleStorePayment();
  // APK builds also load plans from Play Billing first, so their store errors
  // are Google Play errors too.
  const isGooglePlay = !isAppStore && platformEnv.isNativeAndroid;
  switch (kind) {
    case 'network':
      return ETranslations.prime_plans_network_error__desc;
    case 'storeUnavailable':
      return isGooglePlay
        ? ETranslations.prime_plans_google_play_unavailable__desc
        : undefined;
    case 'purchaseNotAllowed':
      // Play Billing BILLING_UNAVAILABLE / FEATURE_NOT_SUPPORTED.
      return isGooglePlay
        ? ETranslations.prime_plans_google_play_not_allowed__desc
        : undefined;
    case 'productUnavailable':
      if (!isAppStore) {
        return undefined;
      }
      // Prime's Apple IAP products are not sold in mainland China. Judge by
      // the purchase account's Storefront, never the system region or IP.
      return storefrontCountryCode === 'CHN'
        ? ETranslations.prime_subscription_china_storefront__msg
        : ETranslations.prime_plans_app_store_no_plans__desc;
    default:
      return undefined;
  }
}
