import PurchasesReactNative from 'react-native-purchases';

// Reset the RevenueCat SDK to a fresh anonymous user so the next OneKey ID
// login on this device does not alias / transfer the previous user's Apple
// Store entitlement. Only call this on explicit OneKey ID logout, never in
// hot paths like Dashboard re-renders (would churn anonymous customers).
export async function logoutPurchasesSdk() {
  try {
    await PurchasesReactNative.logOut();
  } catch (e) {
    // RevenueCat throws when the SDK is already in anonymous state; ignore.
    console.error('[Prime] PurchasesReactNative.logOut error:', e);
  }
}
