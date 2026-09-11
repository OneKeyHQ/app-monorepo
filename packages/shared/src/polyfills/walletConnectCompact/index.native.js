// oxlint-disable unicorn/prefer-global-this
/* eslint-disable unicorn/prefer-global-this */
import {
  getApplicationModule,
  getPayModule,
} from '@walletconnect/react-native-compat/module';

// global.Application used by @walletconnect/core
if (typeof global?.Application === 'undefined') {
  try {
    const module = getApplicationModule();
    if (typeof module.getConstants === 'function') {
      global.Application = {
        ...module.getConstants(),
        isAppInstalled: module.isAppInstalled,
      };
    } else {
      global.Application = module;
    }
  } catch (_e) {
    // eslint-disable-next-line no-console
    console.error('react-native-compat: Application module is not available');
  }
}

// @walletconnect/pay (bundled in @reown/walletkit >= 1.5) discovers its native
// provider through `globalThis.ReactNative.NativeModules.RNWalletConnectPay`.
// The upstream `@walletconnect/react-native-compat` entry wires that global,
// but only the UI runtime imports that entry; WalletKit is created in the
// background runtime, which loads this curated polyfill instead. Mirror the
// wiring here so `WalletKit.init` attaches `client.pay` on native — without it
// every Pay request fails with "WalletConnect Pay is not available".
try {
  const payModule = getPayModule();
  if (payModule) {
    if (typeof globalThis.ReactNative === 'undefined') {
      globalThis.ReactNative = { NativeModules: {} };
    } else if (!globalThis.ReactNative.NativeModules) {
      globalThis.ReactNative.NativeModules = {};
    }
    globalThis.ReactNative.NativeModules.RNWalletConnectPay = payModule;
  }
} catch (_e) {
  // The Pay native module is optional; WalletKit then reports Pay as
  // unavailable instead of failing to initialize.
  // eslint-disable-next-line no-console
  console.warn('react-native-compat: Pay native module is not available');
}
