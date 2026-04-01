/**
 * Native bridge adapter for background runtime (Phase 3)
 *
 * Uses BackgroundThread.loadSegmentInBackground() to register segments
 * with the background Hermes runtime instead of the main runtime.
 * Uses SplitBundleLoader.resolveSegmentPath() to handle OTA/builtin
 * path resolution and Android asset extraction before registration.
 */

import type {
  ISplitBundleNativeLoader,
  LoadSegmentParams,
  RuntimeBundleContext,
} from './types';

// resolveSegmentPath is added in Phase 3 but may not be in the published types yet
interface SplitBundleLoaderWithResolve {
  getRuntimeBundleContext(): Promise<Record<string, unknown>>;
  resolveSegmentPath(relativePath: string, sha256: string): Promise<string>;
}

let cachedLoader: ISplitBundleNativeLoader | null = null;

export function getBackgroundNativeSplitBundleLoader(): ISplitBundleNativeLoader {
  if (cachedLoader) {
    return cachedLoader;
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { SplitBundleLoader } =
    require('@onekeyfe/react-native-split-bundle-loader') as {
      SplitBundleLoader: SplitBundleLoaderWithResolve;
    };
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { BackgroundThread } =
    require('@onekeyfe/react-native-background-thread') as typeof import('@onekeyfe/react-native-background-thread');

  cachedLoader = {
    getRuntimeBundleContext(): Promise<RuntimeBundleContext> {
      return SplitBundleLoader.getRuntimeBundleContext() as Promise<RuntimeBundleContext>;
    },
    async loadSegment(params: LoadSegmentParams): Promise<void> {
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
