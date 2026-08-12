import { shouldRenderNativeHomeDiagnostic } from './nativeHomeRendererDecision';

describe('Native Home renderer decision', () => {
  const eligibleIOSMain = {
    isEligible: true,
    isNativeIOS: true,
    isNativeMainRuntime: true,
  };

  it('enables only the eligible iOS main-runtime diagnostic path', () => {
    expect(shouldRenderNativeHomeDiagnostic(eligibleIOSMain)).toBe(true);
  });

  it.each([
    ['the Home path is not eligible', { isEligible: false }],
    ['the platform is not iOS', { isNativeIOS: false }],
    ['the runtime is not main', { isNativeMainRuntime: false }],
  ])('keeps Legacy Home when %s', (_name, override) => {
    expect(
      shouldRenderNativeHomeDiagnostic({
        ...eligibleIOSMain,
        ...override,
      }),
    ).toBe(false);
  });
});
