import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { shouldRenderNativeHomeDiagnostic } from './nativeHomeRendererDecision';

import type { IHomeWalletRendererProps } from './HomeWalletRenderer';

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
  const useNativeRenderer = shouldRenderNativeHomeDiagnostic({
    isEligible: eligible,
    isNativeIOS: !!platformEnv.isNativeIOS,
    isNativeMainRuntime: !!platformEnv.isNativeMainThread,
  });

  if (!useNativeRenderer) {
    return legacy;
  }

  const NativeHomeDiagnosticPage = loadNativeHomeDiagnosticPage();
  return <NativeHomeDiagnosticPage sceneName={sceneName} />;
}
