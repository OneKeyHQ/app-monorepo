import { loadPurchasesSdkWeb } from '../purchasesSdk/purchasesSdkWebLoader';

let logoutPurchasesSdkPromise: Promise<boolean> | undefined;

async function logoutPurchasesSdkInternal(): Promise<boolean> {
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
      Purchases.generateRevenueCatAnonymousAppUserId(),
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
