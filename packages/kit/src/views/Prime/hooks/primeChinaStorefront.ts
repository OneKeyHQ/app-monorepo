import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IRevenueCatStorefront } from '@onekeyhq/shared/types/prime/revenueCat';

export async function shouldShowPrimeChinaStorefrontHint(
  error: unknown,
  getStorefront?: () => Promise<IRevenueCatStorefront | null>,
): Promise<boolean> {
  const details = error as { code?: unknown; message?: unknown } | null;
  const code =
    typeof details?.code === 'number' || typeof details?.code === 'string'
      ? String(details.code)
      : undefined;
  const isProductUnavailable =
    code === '5' ||
    ((code === '23' || code === undefined) &&
      typeof details?.message === 'string' &&
      details.message.includes(
        'None of the products registered in the RevenueCat dashboard could be fetched',
      ));
  // A failed request or empty offering alone is not evidence of a region limit.
  if (!isProductUnavailable || !getStorefront) return false;
  try {
    const storefront = await timerUtils.timeout(getStorefront(), 1500);
    // Prime's Apple IAP products are not sold in mainland China. Use the
    // purchase account's Storefront, never the system region, language or IP.
    return storefront?.countryCode === 'CHN';
  } catch {
    // Older native shells and unavailable StoreKit accounts keep the fallback.
    return false;
  }
}
