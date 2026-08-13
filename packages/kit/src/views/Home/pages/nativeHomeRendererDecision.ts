import type { THomeWalletRendererEligibility } from './HomeWalletRenderer';

export interface INativeHomeRendererDecisionInput {
  eligibility: THomeWalletRendererEligibility;
  isNativeIOS: boolean;
  isNativeMainRuntime: boolean;
  rendererMode?: 'legacy' | 'native';
}

export function shouldRenderNativeHomeDiagnostic({
  eligibility,
  isNativeIOS,
  isNativeMainRuntime,
  rendererMode = 'native',
}: INativeHomeRendererDecisionInput): boolean {
  return (
    rendererMode === 'native' &&
    eligibility !== 'ineligible' &&
    isNativeIOS &&
    isNativeMainRuntime
  );
}
