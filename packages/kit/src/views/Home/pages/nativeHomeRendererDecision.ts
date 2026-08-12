export interface INativeHomeRendererDecisionInput {
  isEligible: boolean;
  isNativeIOS: boolean;
  isNativeMainRuntime: boolean;
}

export function shouldRenderNativeHomeDiagnostic({
  isEligible,
  isNativeIOS,
  isNativeMainRuntime,
}: INativeHomeRendererDecisionInput): boolean {
  return isEligible && isNativeIOS && isNativeMainRuntime;
}
