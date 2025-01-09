import platformEnv from '../platformEnv';

/** only support on iphone or android(tablet), not include ipad */
export const supportedHaptics =
  platformEnv.isNativeIOSPhone || platformEnv.isNativeAndroid;

/** native ios default is true, native android default is false */
export const defaultHapticStatus = !!(
  platformEnv.isNativeIOSPhone && supportedHaptics
);

export const doHapticsWhenEnabled = supportedHaptics
  ? () => {
      // eslint-disable-next-line no-console
    }
  : () => {};
