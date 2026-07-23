import PurchasesReactNative from 'react-native-purchases';

let logoutPurchasesSdkPromise: Promise<boolean> | undefined;

// Reset the RevenueCat SDK to a fresh anonymous user so the next OneKey ID
// login on this device does not alias / transfer the previous user's Apple
// Store entitlement. Only call this on explicit OneKey ID logout, never in
// hot paths like Dashboard re-renders (would churn anonymous customers).
async function logoutPurchasesSdkInternal(): Promise<boolean> {
  try {
    await PurchasesReactNative.logOut();
    return true;
  } catch (e) {
    // RevenueCat throws when the SDK is already in anonymous state; ignore.
    const message = e instanceof Error ? e.message : String(e);
    console.error('[Prime] PurchasesReactNative.logOut error:', message);
    return message.toLowerCase().includes('anonymous');
  }
}

export function logoutPurchasesSdk(): Promise<boolean> {
  logoutPurchasesSdkPromise ??= logoutPurchasesSdkInternal().finally(() => {
    logoutPurchasesSdkPromise = undefined;
  });
  return logoutPurchasesSdkPromise;
}
