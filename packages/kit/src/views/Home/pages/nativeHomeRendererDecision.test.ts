import { shouldRenderNativeHomeDiagnostic } from './nativeHomeRendererDecision';

describe('Native Home renderer decision', () => {
  const eligibleIOSMain = {
    eligibility: 'eligible' as const,
    isNativeIOS: true,
    isNativeMainRuntime: true,
  };

  it('enables only the eligible iOS main-runtime diagnostic path', () => {
    expect(shouldRenderNativeHomeDiagnostic(eligibleIOSMain)).toBe(true);
  });

  it('allows the development controller to select Legacy Home', () => {
    expect(
      shouldRenderNativeHomeDiagnostic({
        ...eligibleIOSMain,
        rendererMode: 'legacy',
      }),
    ).toBe(false);
  });

  it('keeps Native Home mounted while eligibility is pending', () => {
    expect(
      shouldRenderNativeHomeDiagnostic({
        ...eligibleIOSMain,
        eligibility: 'pending',
      }),
    ).toBe(true);
  });

  it.each([
    ['the Home path is not eligible', { eligibility: 'ineligible' as const }],
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
