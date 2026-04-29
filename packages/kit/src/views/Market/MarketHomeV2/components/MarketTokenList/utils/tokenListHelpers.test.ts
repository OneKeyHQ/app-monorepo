import { shouldShowStockSubtitleForTokens } from './tokenListHelpers';

describe('shouldShowStockSubtitleForTokens', () => {
  test('returns false for empty data', () => {
    expect(shouldShowStockSubtitleForTokens([])).toBe(false);
  });

  test('returns true when more than one tenth of rows are stocks', () => {
    expect(
      shouldShowStockSubtitleForTokens([
        { stock: { subtitle: 'Apple', sourceLogoUri: '' } },
        { stock: { subtitle: 'Tesla', sourceLogoUri: '' } },
        { stock: undefined },
        { stock: undefined },
        { stock: undefined },
        { stock: undefined },
        { stock: undefined },
        { stock: undefined },
        { stock: undefined },
        { stock: undefined },
      ]),
    ).toBe(true);
  });

  test('returns false when stock rows are not more than one tenth', () => {
    expect(
      shouldShowStockSubtitleForTokens([
        { stock: { subtitle: 'Apple', sourceLogoUri: '' } },
        { stock: undefined },
        { stock: undefined },
        { stock: undefined },
        { stock: undefined },
        { stock: undefined },
        { stock: undefined },
        { stock: undefined },
        { stock: undefined },
        { stock: undefined },
      ]),
    ).toBe(false);
  });
});
