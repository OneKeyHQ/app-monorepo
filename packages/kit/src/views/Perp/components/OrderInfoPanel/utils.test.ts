import type { IPerpsFrontendOrder } from '@onekeyhq/shared/types/hyperliquid/sdk';

import {
  calculateSpotHoldingPnl,
  canChasePerpsOrder,
  filterSpotHoldingBalances,
  formatSpotHoldingPnlText,
  getOrderAssetDisplayName,
  getOrderSizeDisplayName,
  getTwapHistoryEventTimeMs,
  getVisibleSpotHoldingsCount,
  isSpotHoldingStableCoin,
  normalizeEpochMs,
} from './utils';

type ISpotHoldingFilterTestItem = {
  rawCoin: string;
  total: string;
  usdcValueNum: number;
  hasPriceSource: boolean;
};

function makeOpenOrder(
  overrides: Partial<IPerpsFrontendOrder> = {},
): IPerpsFrontendOrder {
  return {
    coin: 'BTC',
    oid: 1,
    orderType: 'Limit',
    tif: 'Gtc',
    isTrigger: false,
    isPositionTpsl: false,
    sz: '0.25',
    origSz: '1',
    ...overrides,
  } as IPerpsFrontendOrder;
}

describe('canChasePerpsOrder', () => {
  it('allows a partially filled ordinary perp Gtc order', () => {
    expect(canChasePerpsOrder(makeOpenOrder())).toBe(true);
  });

  it.each([
    ['spot', { coin: '@107' }],
    ['Alo', { tif: 'Alo' }],
    ['null TIF', { tif: null }],
    ['trigger', { isTrigger: true }],
    ['position TP/SL', { isPositionTpsl: true }],
    ['non-limit type', { orderType: 'Market' }],
    ['empty remaining size', { sz: '0' }],
  ] satisfies [string, Partial<IPerpsFrontendOrder>][])(
    'rejects %s',
    (_, value) => {
      expect(canChasePerpsOrder(makeOpenOrder(value))).toBe(false);
    },
  );
});

describe('calculateSpotHoldingPnl', () => {
  it('preserves sub-cent pnl precision for small spot holdings', () => {
    const result = calculateSpotHoldingPnl({
      total: '514.452756',
      entryNtl: '0.05144527',
      midPrice: '0.0000903',
      isStable: false,
    });

    expect(result.pnl).toBe('-0.0049901861332');
    expect(result.pnlPercent).toBeCloseTo(-9.699_990_170_524_91, 12);
  });

  it('formats sub-cent non-zero pnl like Hyperliquid', () => {
    expect(formatSpotHoldingPnlText('-0.002796', -0.632)).toBe(
      '-$0.00 (-0.6%)',
    );
    expect(formatSpotHoldingPnlText('-0.008434', -2.31)).toBe('-$0.01 (-2.3%)');
  });

  it('treats USDH as stable and suppresses its spot holdings pnl', () => {
    expect(isSpotHoldingStableCoin('USDH')).toBe(true);
    expect(isSpotHoldingStableCoin('USDT0')).toBe(true);
    expect(isSpotHoldingStableCoin('usdt0')).toBe(true);
    expect(
      calculateSpotHoldingPnl({
        total: '0.00405586',
        entryNtl: '0.0040556572',
        midPrice: '1',
        isStable: isSpotHoldingStableCoin('USDH'),
      }),
    ).toEqual({});
  });
});

describe('filterSpotHoldingBalances', () => {
  const balances: ISpotHoldingFilterTestItem[] = [
    {
      rawCoin: 'USDC',
      total: '0.5',
      usdcValueNum: 0.5,
      hasPriceSource: true,
    },
    {
      rawCoin: 'BELOW',
      total: '2',
      usdcValueNum: 4.99,
      hasPriceSource: true,
    },
    {
      rawCoin: 'EXACT',
      total: '1',
      usdcValueNum: 5,
      hasPriceSource: true,
    },
    {
      rawCoin: 'ABOVE',
      total: '1',
      usdcValueNum: 5.01,
      hasPriceSource: true,
    },
    {
      rawCoin: 'UNKNOWN',
      total: '1',
      usdcValueNum: 0,
      hasPriceSource: false,
    },
    {
      rawCoin: 'ZERO',
      total: '0',
      usdcValueNum: 10,
      hasPriceSource: true,
    },
  ];

  it('keeps every non-zero holding when the filter is disabled', () => {
    expect(
      filterSpotHoldingBalances({
        balances,
        hideBelowThreshold: false,
      }).map((item) => item.rawCoin),
    ).toEqual(['USDC', 'BELOW', 'EXACT', 'ABOVE', 'UNKNOWN']);
  });

  it('hides only priced non-USDC holdings strictly below five dollars', () => {
    expect(
      filterSpotHoldingBalances({
        balances,
        hideBelowThreshold: true,
      }).map((item) => item.rawCoin),
    ).toEqual(['USDC', 'EXACT', 'ABOVE', 'UNKNOWN']);
  });
});

describe('getVisibleSpotHoldingsCount', () => {
  it('uses the same threshold and price-source rules as the holdings list', () => {
    expect(
      getVisibleSpotHoldingsCount({
        balances: [
          { coin: 'USDC', total: '0', entryNtl: '0' },
          { coin: 'BELOW', total: '2', entryNtl: '1' },
          { coin: 'EXACT', total: '1', entryNtl: '1' },
          { coin: 'UNKNOWN', total: '1', entryNtl: '0' },
        ],
        tokenPriceLookup: {
          BELOW: '2.495',
          EXACT: '5',
        },
        hideBelowThreshold: true,
        hasPerpsUsdc: true,
      }),
    ).toBe(3);
  });
});

describe('order display name helpers', () => {
  it('keeps perp symbols normalized through parseDexCoin', () => {
    expect(getOrderAssetDisplayName('kPEPE', {})).toBe('kPEPE');
  });

  it('resolves spot asset ids and pair names through the display map', () => {
    const coin = 'BTC';
    const spotPair = `U${coin}/USDC`;
    const spotDisplayMap = {
      '@107': 'HYPE',
      [spotPair]: coin,
      [spotPair.split('/')[0]]: coin,
    };
    const spotPairDisplayNameMap = {
      '@107': 'HYPE/USDC',
    };

    expect(
      getOrderAssetDisplayName('@107', spotDisplayMap, spotPairDisplayNameMap),
    ).toBe('HYPE/USDC');
    expect(getOrderAssetDisplayName(spotPair, spotDisplayMap)).toBe('BTC/USDC');
  });

  it('falls back to the shared spot token map for canonical pair names', () => {
    expect(getOrderAssetDisplayName('UETH/USDC', {})).toBe('ETH/USDC');
  });

  it('keeps spot order quantity units base-only', () => {
    const spotDisplayMap = {
      '@107': 'HYPE',
    };

    expect(getOrderSizeDisplayName('@107', spotDisplayMap)).toBe('HYPE');
    expect(getOrderSizeDisplayName('UETH/USDC', spotDisplayMap)).toBe('ETH');
    expect(getOrderSizeDisplayName('BTC', spotDisplayMap)).toBe('BTC');
  });
});

describe('TWAP history time helpers', () => {
  it('normalizes seconds and milliseconds timestamps', () => {
    expect(normalizeEpochMs(1_718_000_000)).toBe(1_718_000_000_000);
    expect(normalizeEpochMs(1_718_000_000_123)).toBe(1_718_000_000_123);
  });

  it('uses Hyperliquid history record time ahead of TWAP start time', () => {
    expect(
      getTwapHistoryEventTimeMs({
        time: 1_718_000_000,
        state: { timestamp: 1_717_999_000_000 },
      }),
    ).toBe(1_718_000_000_000);
  });

  it('falls back to TWAP start time when the history record time is missing', () => {
    expect(
      getTwapHistoryEventTimeMs({
        state: { timestamp: 1_717_999_000_000 },
      }),
    ).toBe(1_717_999_000_000);
  });
});
