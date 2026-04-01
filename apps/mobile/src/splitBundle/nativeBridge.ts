/**
 * Native bridge adapter (Phase 2)
 *
 * Connects the TurboModule SplitBundleLoader to the ISplitBundleNativeLoader
 * interface used by installProdBundleLoader.
 *
 * Uses TurboModuleRegistry directly to avoid a hard compile-time dependency
 * on @onekeyfe/react-native-split-bundle-loader (which may not be installed yet).
 */

import { TurboModuleRegistry } from 'react-native';

import type {
  ISplitBundleNativeLoader,
  LoadSegmentParams,
  RuntimeBundleContext,
} from './types';
import type { TurboModule } from 'react-native';

interface SplitBundleLoaderSpec extends TurboModule {
  getRuntimeBundleContext(): Promise<{
    runtimeKind: string;
    sourceKind: string;
    bundleRoot: string;
    builtinExtractRoot?: string;
    nativeVersion: string;
    bundleVersion?: string;
  }>;
  loadSegment(
    segmentId: number,
    segmentKey: string,
    relativePath: string,
    sha256: string,
  ): Promise<void>;
}

let cachedLoader: ISplitBundleNativeLoader | null = null;

export function getNativeSplitBundleLoader(): ISplitBundleNativeLoader {
  if (cachedLoader) {
    return cachedLoader;
  }

  const nativeModule =
    TurboModuleRegistry.getEnforcing<SplitBundleLoaderSpec>(
      'SplitBundleLoader',
    );

  cachedLoader = {
    getRuntimeBundleContext(): Promise<RuntimeBundleContext> {
      return nativeModule.getRuntimeBundleContext() as Promise<RuntimeBundleContext>;
    },
    loadSegment(params: LoadSegmentParams): Promise<void> {
      return nativeModule.loadSegment(
        params.segmentId,
        params.segmentKey,
        params.relativePath,
        params.sha256,
      );
    },
  };

  return cachedLoader;
}
