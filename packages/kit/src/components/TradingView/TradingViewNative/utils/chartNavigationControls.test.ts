import { getTradingViewNativeNavigationLayout } from './chartNavigationControls';

describe('getTradingViewNativeNavigationLayout', () => {
  it('centers the primary buttons when reset fits beside them', () => {
    // Four 25px buttons with 6px gaps span 118px.
    expect(
      getTradingViewNativeNavigationLayout({
        buttonSize: 25,
        chartWidth: 600,
        gap: 6,
      }),
    ).toEqual({ primaryTrailingInset: 0, resetButtonLeft: 365 });
  });

  it.each([
    { buttonSize: 25, chartWidth: 160, gap: 6 },
    { buttonSize: 28, chartWidth: 180, gap: 6 },
  ])(
    'moves the primary buttons left so reset stays inside a $chartWidth px chart',
    ({ buttonSize, chartWidth, gap }) => {
      const { primaryTrailingInset, resetButtonLeft } =
        getTradingViewNativeNavigationLayout({ buttonSize, chartWidth, gap });
      const primaryWidth = 4 * buttonSize + 3 * gap;
      const primaryRight =
        (chartWidth - primaryTrailingInset + primaryWidth) / 2;

      expect(primaryTrailingInset).toBeGreaterThan(0);
      expect(resetButtonLeft).toBe(primaryRight + gap);
      expect(resetButtonLeft + buttonSize).toBe(chartWidth);
    },
  );

  it('keeps reset beside the primary buttons when nothing fits', () => {
    expect(
      getTradingViewNativeNavigationLayout({
        buttonSize: 25,
        chartWidth: 100,
        gap: 6,
      }),
    ).toEqual({ primaryTrailingInset: 0, resetButtonLeft: 115 });
  });
});
