/**
 * Native bridge adapter (Phase 2)
 *
 * Connects the TurboModule `@onekeyfe/react-native-split-bundle-loader`
 * to the ISplitBundleNativeLoader interface used by installProdBundleLoader.
 */

import type {
  ISplitBundleNativeLoader,
  LoadSegmentParams,
  RuntimeBundleContext,
} from './types';

let cachedLoader: ISplitBundleNativeLoader | null = null;

export function getNativeSplitBundleLoader(): ISplitBundleNativeLoader {
  if (cachedLoader) {
    return cachedLoader;
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { SplitBundleLoader } =
    require('@onekeyfe/react-native-split-bundle-loader') as typeof import('@onekeyfe/react-native-split-bundle-loader');

  cachedLoader = {
    getRuntimeBundleContext(): Promise<RuntimeBundleContext> {
      return SplitBundleLoader.getRuntimeBundleContext() as Promise<RuntimeBundleContext>;
    },
    loadSegment(params: LoadSegmentParams): Promise<void> {
      return SplitBundleLoader.loadSegment(
        params.segmentId,
        params.segmentKey,
        params.relativePath,
        params.sha256,
      );
    },
  };

  return cachedLoader;
}
