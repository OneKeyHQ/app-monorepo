/**
 * Native bridge adapter for background runtime (Phase 3)
 *
 * Uses BackgroundThread.loadSegmentInBackground() to register segments
 * with the background Hermes runtime instead of the main runtime.
 * Uses SplitBundleLoader.resolveSegmentPath() to handle OTA/builtin
 * path resolution and Android asset extraction before registration.
 */

import type {
  ILoadSegmentParams,
  IRuntimeBundleContext,
  ISplitBundleNativeLoader,
} from './types';

let cachedLoader: ISplitBundleNativeLoader | null = null;

export function getBackgroundNativeSplitBundleLoader(): ISplitBundleNativeLoader {
  if (cachedLoader) {
    return cachedLoader;
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { SplitBundleLoader } =
    require('@onekeyfe/react-native-split-bundle-loader') as typeof import('@onekeyfe/react-native-split-bundle-loader');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { BackgroundThread } =
    require('@onekeyfe/react-native-background-thread') as typeof import('@onekeyfe/react-native-background-thread');

  cachedLoader = {
    getRuntimeBundleContext(): Promise<IRuntimeBundleContext> {
      return SplitBundleLoader.getRuntimeBundleContext() as Promise<IRuntimeBundleContext>;
    },
    async loadSegment(params: ILoadSegmentParams): Promise<void> {
      // Resolve absolute path (handles OTA, builtin, Android asset extraction)
      const absolutePath = await SplitBundleLoader.resolveSegmentPath(
        params.relativePath,
        params.sha256,
      );
      // Register segment in the BACKGROUND Hermes runtime
      await BackgroundThread.loadSegmentInBackground(
        params.segmentId,
        absolutePath,
      );
    },
  };

  return cachedLoader;
}
