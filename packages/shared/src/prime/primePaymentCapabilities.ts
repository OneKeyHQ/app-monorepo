import platformEnv from '../platformEnv';

export function isPrimeAppleStorePayment() {
  return Boolean(platformEnv.isNativeIOS || platformEnv.isMas);
}

export function isPrimeStorePayment() {
  return Boolean(platformEnv.isNative || platformEnv.isMas);
}

export function isPrimeStoreOnlyPayment() {
  return Boolean(
    isPrimeAppleStorePayment() || platformEnv.isNativeAndroidGooglePlay,
  );
}

export function isPrimeCryptoPaymentSupported() {
  return !isPrimeStoreOnlyPayment();
}
