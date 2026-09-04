import { fetchMarketAssetKLineData } from '@onekeyhq/kit/src/components/TradingView/utils/fetchMarketAssetKLineData';

import { createTradingViewNativeAssetDataProvider } from './assetDataProvider';

jest.mock(
  '@onekeyhq/kit/src/components/TradingView/utils/fetchMarketAssetKLineData',
  () => ({ fetchMarketAssetKLineData: jest.fn() }),
);

describe('createTradingViewNativeAssetDataProvider', () => {
  it('uses the Asset K-line API as its only history source', async () => {
    const response = { pointType: 'single' as const, points: [], total: 0 };
    jest.mocked(fetchMarketAssetKLineData).mockResolvedValue(response);
    const provider = createTradingViewNativeAssetDataProvider({
      kind: 'asset',
      assetId: 'doge',
    });

    const result = await provider.fetchHistory({
      interval: {
        hyperliquidValue: '1h',
        label: '1H',
        marketWsValue: '1h',
        seconds: 60 * 60,
        value: '60',
      },
      signal: new AbortController().signal,
      timeFrom: 100,
      timeTo: 200,
    });

    expect(provider.key).toBe('asset:doge');
    expect(provider.supportsRealtime).toBe(false);
    expect(fetchMarketAssetKLineData).toHaveBeenCalledWith({
      assetId: 'doge',
      interval: '1H',
      timeFrom: 100,
      timeTo: 200,
    });
    expect(result).toEqual(response);
  });
});
