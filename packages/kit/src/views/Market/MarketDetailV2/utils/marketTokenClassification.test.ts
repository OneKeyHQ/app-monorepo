import { isMarketStockToken } from './marketTokenClassification';

describe('isMarketStockToken', () => {
  test('returns false when stock metadata is missing', () => {
    expect(isMarketStockToken(undefined, {})).toBe(false);
  });

  test('recognizes preview stock metadata without an underlying ticker', () => {
    expect(
      isMarketStockToken({
        stock: {
          subtitle: 'NVIDIA',
          sourceLogoUri: '',
        },
      }),
    ).toBe(true);
  });

  test('keeps stock classification stable from preview to detail', () => {
    const preview = {
      stock: {
        subtitle: 'NVIDIA',
        sourceLogoUri: '',
      },
    };
    const detail = {
      stock: {
        subtitle: 'NVIDIA',
        sourceLogoUri: '',
        underlyingAssetTicker: 'NVDA',
      },
    };

    expect(isMarketStockToken(preview)).toBe(true);
    expect(isMarketStockToken(detail)).toBe(true);
  });
});
