import type * as PurchasesSdk from '@revenuecat/purchases-js';

let purchasesSdkPromise: Promise<typeof PurchasesSdk> | undefined;
let verboseLogLevelApplied = false;

export async function loadPurchasesSdkWeb() {
  purchasesSdkPromise ||= import('@revenuecat/purchases-js').then((sdk) => {
    if (process.env.NODE_ENV !== 'production' && !verboseLogLevelApplied) {
      console.log('Purchases.setLogLevel Verbose');
      sdk.Purchases.setLogLevel(sdk.LogLevel.Verbose);
      verboseLogLevelApplied = true;
    }
    return sdk;
  });
  return purchasesSdkPromise;
}
