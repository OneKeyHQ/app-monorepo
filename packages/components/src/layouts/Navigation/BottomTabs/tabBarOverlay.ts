import platformEnv from '@onekeyhq/shared/src/platformEnv';

export const ANDROID_TAB_BAR_STYLE = 'floating' as const;

// iOS and the floating Android tab bar draw over the scene, so scrollable tab
// content must reserve the measured tab bar height at its end. The docked
// Android bar sits below the scene and needs no reserve.
export const isNativeTabBarOverlayingContent =
  platformEnv.isNativeIOS ||
  (platformEnv.isNativeAndroid && ANDROID_TAB_BAR_STYLE === 'floating');
