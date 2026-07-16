import { shouldRenderStockPositionsSkeleton } from './SwapProPositionsList.utils';

describe('SwapProPositionsList utils', () => {
  it('shows the Stock positions skeleton before the first request settles', () => {
    expect(
      shouldRenderStockPositionsSkeleton({
        isStockMetadataLoading: true,
        stockOnly: true,
        stockTokenListResolved: false,
      }),
    ).toBe(true);
  });

  it('stops the skeleton after the initial metadata request fails', () => {
    expect(
      shouldRenderStockPositionsSkeleton({
        isStockMetadataLoading: false,
        stockOnly: true,
        stockTokenListResolved: false,
      }),
    ).toBe(false);
  });

  it('keeps resolved Stock positions visible during refresh', () => {
    expect(
      shouldRenderStockPositionsSkeleton({
        isStockMetadataLoading: true,
        stockOnly: true,
        stockTokenListResolved: true,
      }),
    ).toBe(false);
  });
});
