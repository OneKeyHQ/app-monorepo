import { isPro2TestModeEnabled } from './devSettings';

describe('isPro2TestModeEnabled', () => {
  it('requires both global dev settings and the Pro 2 test switch', () => {
    expect(
      isPro2TestModeEnabled({
        enabled: true,
        settings: { enablePro2TestMode: true },
      }),
    ).toBe(true);
    expect(
      isPro2TestModeEnabled({
        enabled: false,
        settings: { enablePro2TestMode: true },
      }),
    ).toBe(false);
    expect(
      isPro2TestModeEnabled({
        enabled: true,
        settings: { enablePro2TestMode: false },
      }),
    ).toBe(false);
  });
});
