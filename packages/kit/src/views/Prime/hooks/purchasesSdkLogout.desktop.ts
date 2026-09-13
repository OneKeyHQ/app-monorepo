import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { getSanitizedErrorLogText } from '@onekeyhq/shared/src/utils/sensitiveErrorMessageUtils';

import { logoutPurchasesSdk as logoutPurchasesSdkWeb } from './purchasesSdkLogoutWeb';

let logoutPromise: Promise<boolean> | undefined;

async function logoutMacAppStorePurchasesSdk(): Promise<boolean> {
  try {
    const api = globalThis.desktopApiProxy?.inAppPurchase;
    // Older application shells cannot have initialized the RevenueCat bridge.
    if (!api?.revenueCatLogOut) {
      return true;
    }
    await api.revenueCatLogOut();
    return true;
  } catch (error) {
    console.error(
      '[Prime] RevenueCat desktop logout error:',
      getSanitizedErrorLogText(error),
    );
    return false;
  }
}

export function logoutPurchasesSdk(): Promise<boolean> {
  if (!platformEnv.isMas) {
    return logoutPurchasesSdkWeb();
  }
  logoutPromise ??= logoutMacAppStorePurchasesSdk().finally(() => {
    logoutPromise = undefined;
  });
  return logoutPromise;
}
