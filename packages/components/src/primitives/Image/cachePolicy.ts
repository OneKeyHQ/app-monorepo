import platformEnv from '@onekeyhq/shared/src/platformEnv';

// Glide owns the resource lifecycle for each View target. Passing an Expo
// ImageRef instead would share one mutable Drawable across Android views.
export const DEFAULT_CACHE_POLICY = platformEnv.isNativeAndroid
  ? 'memory-disk'
  : 'disk';
