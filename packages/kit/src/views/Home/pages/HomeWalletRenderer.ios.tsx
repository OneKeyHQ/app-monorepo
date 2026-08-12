import { useSyncExternalStore } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { shouldRenderNativeHomeDiagnostic } from './nativeHomeRendererDecision';

import type { IHomeWalletRendererProps } from './HomeWalletRenderer';

type TNativeHomeRendererMode = 'legacy' | 'native';

let nativeHomeRendererMode: TNativeHomeRendererMode = 'native';
const nativeHomeRendererListeners = new Set<() => void>();

function setNativeHomeRendererMode(mode: TNativeHomeRendererMode) {
  if (mode !== 'legacy' && mode !== 'native') {
    return nativeHomeRendererMode;
  }
  if (nativeHomeRendererMode !== mode) {
    nativeHomeRendererMode = mode;
    nativeHomeRendererListeners.forEach((listener) => listener());
  }
  return nativeHomeRendererMode;
}

const nativeHomeRendererController = {
  get: () => nativeHomeRendererMode,
  set: setNativeHomeRendererMode,
  toggle: () =>
    setNativeHomeRendererMode(
      nativeHomeRendererMode === 'native' ? 'legacy' : 'native',
    ),
};

if (__DEV__ && platformEnv.isNativeIOS && platformEnv.isNativeMainThread) {
  Object.assign(globalThis, {
    $onekeyNativeHomeRenderer: nativeHomeRendererController,
  });
}

function subscribeNativeHomeRenderer(listener: () => void) {
  nativeHomeRendererListeners.add(listener);
  return () => nativeHomeRendererListeners.delete(listener);
}

function loadNativeHomeDiagnosticPage() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const module =
    require('./NativeHomeDiagnosticPage') as typeof import('./NativeHomeDiagnosticPage');
  return module.NativeHomeDiagnosticPage;
}

export function HomeWalletRenderer({
  eligible,
  legacy,
  sceneName,
}: IHomeWalletRendererProps) {
  const rendererMode = useSyncExternalStore(
    subscribeNativeHomeRenderer,
    nativeHomeRendererController.get,
    nativeHomeRendererController.get,
  );
  const useNativeRenderer = shouldRenderNativeHomeDiagnostic({
    isEligible: eligible,
    isNativeIOS: !!platformEnv.isNativeIOS,
    isNativeMainRuntime: !!platformEnv.isNativeMainThread,
    rendererMode: __DEV__ ? rendererMode : 'native',
  });

  if (!useNativeRenderer) {
    return legacy;
  }

  const NativeHomeDiagnosticPage = loadNativeHomeDiagnosticPage();
  return <NativeHomeDiagnosticPage sceneName={sceneName} />;
}
