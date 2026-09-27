import {
  isPrimeAppleStorePayment,
  isPrimeCryptoPaymentSupported,
  isPrimeStoreOnlyPayment,
  isPrimeStorePayment,
} from '@onekeyhq/shared/src/prime/primePaymentCapabilities';

const mockPlatform = {
  isNative: false,
  isNativeIOS: false,
  isNativeAndroidGooglePlay: false,
  isMas: false,
};

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    get isNative() {
      return mockPlatform.isNative;
    },
    get isNativeIOS() {
      return mockPlatform.isNativeIOS;
    },
    get isNativeAndroidGooglePlay() {
      return mockPlatform.isNativeAndroidGooglePlay;
    },
    get isMas() {
      return mockPlatform.isMas;
    },
  },
}));

describe('Prime payment capabilities', () => {
  it.each([
    ['Mac App Store', false, false, false, true, true, true, true],
    [
      'direct macOS / Windows / Linux / web',
      false,
      false,
      false,
      false,
      false,
      false,
      false,
    ],
    ['iOS', true, true, false, false, true, true, true],
    ['Google Play', true, false, true, false, false, true, true],
    ['direct Android', true, false, false, false, false, true, false],
  ])(
    '%s selects the supported payment channels',
    (
      _platform,
      isNative,
      isNativeIOS,
      isNativeAndroidGooglePlay,
      isMas,
      apple,
      store,
      storeOnly,
    ) => {
      Object.assign(mockPlatform, {
        isNative,
        isNativeIOS,
        isNativeAndroidGooglePlay,
        isMas,
      });
      expect(isPrimeAppleStorePayment()).toBe(apple);
      expect(isPrimeStorePayment()).toBe(store);
      expect(isPrimeStoreOnlyPayment()).toBe(storeOnly);
      expect(isPrimeCryptoPaymentSupported()).toBe(!storeOnly);
    },
  );
});
