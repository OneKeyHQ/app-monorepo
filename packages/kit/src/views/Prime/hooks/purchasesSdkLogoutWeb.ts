import purchaseSdkUtils from '../purchasesSdk/purchaseSdkUtils';
import {
  isPurchasesSdkWebLoaded,
  loadPurchasesSdkWeb,
} from '../purchasesSdk/purchasesSdkWebLoader';

let logoutPurchasesSdkPromise: Promise<boolean> | undefined;

async function logoutPurchasesSdkInternal(): Promise<boolean> {
  // Never initialize RevenueCat (and therefore Stripe.js) just to log out. On
  // cold start or for users who never opened Prime checkout, the SDK was never
  // loaded, so there is nothing to reset.
  if (!isPurchasesSdkWebLoaded()) {
    return true;
  }
  try {
    const { Purchases } = await loadPurchasesSdkWeb();
    if (!Purchases.isConfigured()) {
      return true;
    }
    const purchases = Purchases.getSharedInstance();
    if (purchases.getAppUserId().startsWith('$RCAnonymousID:')) {
      return true;
    }
    await purchases.changeUser(
      purchaseSdkUtils.generateRevenueCatAnonymousAppUserId(),
    );
    return true;
  } catch (e) {
    console.error(
      '[Prime] Purchases.changeUser anonymous error:',
      e instanceof Error ? e.message : String(e),
    );
    return false;
  }
}

export function logoutPurchasesSdk(): Promise<boolean> {
  logoutPurchasesSdkPromise ??= logoutPurchasesSdkInternal().finally(() => {
    logoutPurchasesSdkPromise = undefined;
  });
  return logoutPurchasesSdkPromise;
}
