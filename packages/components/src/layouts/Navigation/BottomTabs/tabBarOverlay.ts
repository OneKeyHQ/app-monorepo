import { Platform } from 'react-native';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

export const ANDROID_TAB_BAR_STYLE = 'floating' as const;

// iOS and the floating Android tab bar draw over the scene, so scrollable tab
// content must reserve the measured tab bar height at its end. The docked
// Android bar sits below the scene and needs no reserve.
export const isNativeTabBarOverlayingContent =
  platformEnv.isNativeIOS ||
  (platformEnv.isNativeAndroid && ANDROID_TAB_BAR_STYLE === 'floating');

// The floating capsule reads as glass only while it samples the scene behind it.
// Android renders that live backdrop with RenderEffect from API 31, but the
// native view only opts in by default on Android 16+; without the flag the
// capsule falls back to a flat, nearly opaque surface. Android reports the API
// level through Platform.Version, and the native view still guards the level
// itself, so requesting it here is safe on older devices.
export const isAndroidTabBarBlurEnabled =
  platformEnv.isNativeAndroid && Number(Platform.Version) >= 31;
