import { removePerpsColdStartSimpleDbData } from './SimpleDbEntityPerp';

describe('removePerpsColdStartSimpleDbData', () => {
  it('clears first-screen cache fields while preserving Perps preferences and authorization state', () => {
    const result = removePerpsColdStartSimpleDbData({
      hyperliquidCurrentToken: 'ETH',
      hyperliquidTermsAccepted: true,
      hyperliquidCustomSettings: { skipOrderConfirm: true },
      hyperliquidOrderBookTickOptions: {
        ETH: { value: '0.01', nSigFigs: 5, mantissa: 2 },
      },
      abstractionModeUsers: { '0xabc': 'unifiedAccount' },
      tradingUniverse: [
        {
          name: 'ETH',
          szDecimals: 4,
          maxLeverage: 50,
          marginTableId: 1,
          assetId: 1,
        },
      ],
      tradingUniverses: [],
      tradingUniversesUpdatedAt: 1,
      tokenSearchAliases: { ETH: { aliases: ['ethereum'] } },
      activeAssetCtxSnapshotCache: {},
      l2BookSnapshotCache: {},
      allDexsAssetCtxsSnapshotCache: {
        data: { ctxs: [] },
        updatedAt: 1,
      },
      perpsAccountDisplayCacheByAddress: {},
      hyperliquidPortfolioSnapshotByAddress: {},
    });

    expect(result).toEqual({
      hyperliquidCurrentToken: 'ETH',
      hyperliquidTermsAccepted: true,
      hyperliquidCustomSettings: { skipOrderConfirm: true },
      hyperliquidOrderBookTickOptions: {
        ETH: { value: '0.01', nSigFigs: 5, mantissa: 2 },
      },
      abstractionModeUsers: { '0xabc': 'unifiedAccount' },
    });
  });
});
