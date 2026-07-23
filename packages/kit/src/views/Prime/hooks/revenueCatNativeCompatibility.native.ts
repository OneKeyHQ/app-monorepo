import { NativeModules } from 'react-native';
import PurchasesReactNative from 'react-native-purchases';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

type IRevenueCatNativeModule = {
  getVirtualCurrencies?: (...args: unknown[]) => unknown;
  setupPurchases?: (...args: unknown[]) => void;
};

function getRevenueCatNativeModule(): IRevenueCatNativeModule | undefined {
  return NativeModules.RNPurchases as IRevenueCatNativeModule | undefined;
}

function isLegacyRevenueCatNativeBridge(): boolean {
  const nativeModule = getRevenueCatNativeModule();
  // Virtual currencies exist in the 10.4.3 bridge but not in the 8.11.9
  // bridge that can host a newer JS bundle after an OTA update.
  return (
    platformEnv.isNative === true &&
    typeof nativeModule?.setupPurchases === 'function' &&
    typeof nativeModule.getVirtualCurrencies !== 'function'
  );
}

function configureRevenueCat({ apiKey }: { apiKey: string }): void {
  const nativeModule = getRevenueCatNativeModule();
  if (isLegacyRevenueCatNativeBridge() && nativeModule?.setupPurchases) {
    // React Native Purchases 8.11.9 used a 10-argument native bridge. OTA
    // bundles must preserve that signature when running on an older app shell.
    nativeModule.setupPurchases(
      apiKey,
      null,
      PurchasesReactNative.PURCHASES_ARE_COMPLETED_BY_TYPE.REVENUECAT,
      null,
      PurchasesReactNative.STOREKIT_VERSION.DEFAULT,
      false,
      true,
      PurchasesReactNative.ENTITLEMENT_VERIFICATION_MODE.DISABLED,
      false,
      false,
    );
    return;
  }

  PurchasesReactNative.configure({ apiKey });
}

function getRevenueCatRecurringPriceUnit(): 'major' | 'micros' {
  return platformEnv.isNativeAndroid && isLegacyRevenueCatNativeBridge()
    ? 'micros'
    : 'major';
}

export { configureRevenueCat, getRevenueCatRecurringPriceUnit };
