import { isDefaultStockTokenRequestPending } from './swapStockDefaultTokenUtils';

describe('isDefaultStockTokenRequestPending', () => {
  it('keeps the Stock input in its skeleton state before the first scoped result', () => {
    expect(
      isDefaultStockTokenRequestPending({
        isLoading: false,
        requestReady: true,
        requestScope: '1:stocks',
        resultScope: '',
        shouldLoad: true,
      }),
    ).toBe(true);
  });

  it('keeps loading while the Stock category owner has not landed', () => {
    expect(
      isDefaultStockTokenRequestPending({
        isLoading: false,
        requestReady: false,
        requestScope: '1:',
        resultScope: '1:',
        shouldLoad: true,
      }),
    ).toBe(true);
  });

  it('settles a definitive scoped empty result instead of loading forever', () => {
    expect(
      isDefaultStockTokenRequestPending({
        isLoading: false,
        requestReady: true,
        requestScope: '1:stocks',
        resultScope: '1:stocks',
        shouldLoad: true,
      }),
    ).toBe(false);
  });

  it('does not report loading when a live or restored selection skips defaults', () => {
    expect(
      isDefaultStockTokenRequestPending({
        isLoading: false,
        requestReady: false,
        requestScope: '0:stocks',
        resultScope: '',
        shouldLoad: false,
      }),
    ).toBe(false);
  });
});
