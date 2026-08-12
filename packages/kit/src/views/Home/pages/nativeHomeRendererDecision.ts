export interface INativeHomeRendererDecisionInput {
  isEligible: boolean;
  isNativeIOS: boolean;
  isNativeMainRuntime: boolean;
  rendererMode?: 'legacy' | 'native';
}

export function shouldRenderNativeHomeDiagnostic({
  isEligible,
  isNativeIOS,
  isNativeMainRuntime,
  rendererMode = 'native',
}: INativeHomeRendererDecisionInput): boolean {
  return (
    rendererMode === 'native' &&
    isEligible &&
    isNativeIOS &&
    isNativeMainRuntime
  );
}
