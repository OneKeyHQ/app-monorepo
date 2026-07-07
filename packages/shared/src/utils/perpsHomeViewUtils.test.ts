import { mapSnapshotToPerpsHomeView } from './perpsHomeViewUtils';

const snap: any = {
  address: '0xabc',
  isEmpty: false,
  accountValue: '146.65',
  withdrawable: '110',
  totalMarginUsed: '10',
  totalUnrealizedPnl: '10.12',
  perpPositions: [
    {
      coin: 'ETH',
      szi: '1.2',
      entryPx: '1600.12',
      positionValue: '1920.14',
      unrealizedPnl: '10.12',
      returnOnEquity: '0.1',
      liquidationPx: '1500.00',
      marginUsed: '100.12',
      leverageType: 'isolated',
      leverageValue: 1,
      cumFundingSinceOpen: '0.01',
    },
    {
      coin: 'BTC',
      szi: '-0.1',
      entryPx: '60000',
      positionValue: '6000',
      unrealizedPnl: '-50',
      returnOnEquity: '-0.1',
      liquidationPx: null,
      marginUsed: '600',
      leverageType: 'cross',
      leverageValue: 10,
      cumFundingSinceOpen: '-0.5',
    },
  ],
  spotBalances: [
    {
      coin: 'USDC',
      token: 0,
      total: '82.45',
      hold: '0',
      entryNtl: '82.45',
      priceUsd: '1',
      valueUsd: '82.45',
    },
    {
      coin: 'HYPE',
      spotUniverseName: 'HYPE/USDC',
      token: 2,
      total: '1.24',
      hold: '0',
      entryNtl: '27.0',
      priceUsd: '22.71',
      valueUsd: '28.16',
    },
    {
      coin: 'UETH',
      spotUniverseName: 'UETH/USDC',
      token: 10,
      total: '0.00019',
      hold: '0',
      entryNtl: '0.44',
      priceUsd: '1631.57',
      valueUsd: '0.31',
    },
    {
      coin: 'WEIRD',
      token: 9,
      total: '5',
      hold: '0',
      entryNtl: '5',
      priceUsd: undefined,
      valueUsd: undefined,
    },
  ],
  spotTotalUsd: '110.61',
  netWorthUsd: '257.26',
  source: 'rest',
  isDegraded: true,
  summaryUpdatedAt: 1,
  spotUpdatedAt: 1,
  priceCachedAt: 1,
  fetchedAt: 1,
};

describe('mapSnapshotToPerpsHomeView', () => {
  it('maps account value + positions with derived markPx + side + abs size', () => {
    const v = mapSnapshotToPerpsHomeView(snap);
    expect(v.isEmpty).toBe(false);
    expect(v.accountValueUsd).toBeCloseTo(257.26);
    expect(v.positions.map((p) => p.coin)).toEqual(['BTC', 'ETH']);
    const eth = v.positions.find((p) => p.coin === 'ETH');
    expect(eth?.side).toBe('long');
    expect(eth?.sizeCoin).toBe('1.2');
    expect(Number(eth?.markPx)).toBeCloseTo(1600.117); // 1920.14 / 1.2
    expect(eth?.pnlUsd).toBeCloseTo(10.12);
    expect(eth?.roi).toBeCloseTo(0.1);
    const btc = v.positions.find((p) => p.coin === 'BTC');
    expect(btc?.side).toBe('short');
    expect(btc?.sizeCoin).toBe('0.1');
    expect(btc?.liqPx).toBeNull();
  });
  it('maps holdings with perps spot pnl rules and suppresses stablecoin pnl', () => {
    const v = mapSnapshotToPerpsHomeView(snap);
    expect(v.holdings.map((h) => h.symbol)).toEqual([
      'USDC',
      'HYPE',
      'UETH',
      'WEIRD',
    ]);
    const hype = v.holdings.find((h) => h.symbol === 'HYPE');
    expect(hype?.displaySymbol).toBe('HYPE');
    expect(hype?.spotUniverseName).toBe('HYPE/USDC');
    expect(hype?.valueUsd).toBeCloseTo(28.16);
    expect(hype?.pnlUsd).toBeCloseTo(1.1604); // 1.24 * 22.71 - 27.0
    const ueth = v.holdings.find((h) => h.symbol === 'UETH');
    expect(ueth?.displaySymbol).toBe('ETH');
    expect(ueth?.spotUniverseName).toBe('UETH/USDC');
    expect(ueth?.pnlUsd).toBeCloseTo(-0.130_001_7);
    const usdc = v.holdings.find((h) => h.symbol === 'USDC');
    expect(usdc?.displaySymbol).toBe('USDC');
    expect(usdc?.pnlUsd).toBeUndefined();
    const weird = v.holdings.find((h) => h.symbol === 'WEIRD');
    expect(weird?.valueUsd).toBeUndefined();
    expect(weird?.pnlUsd).toBeUndefined();
  });
  it('keeps zero-cost spot holdings pnl visible on home', () => {
    const v = mapSnapshotToPerpsHomeView({
      ...snap,
      spotBalances: [
        {
          coin: 'POINTS',
          token: 99,
          total: '10',
          hold: '0',
          entryNtl: '0',
          priceUsd: '2',
          valueUsd: '20',
        },
      ],
    });

    expect(v.holdings[0]?.pnlUsd).toBe(20);
  });
  it('suppresses pnl for stablecoin aliases', () => {
    const v = mapSnapshotToPerpsHomeView({
      ...snap,
      spotBalances: [
        {
          coin: 'USDT0',
          token: 99,
          total: '10',
          hold: '0',
          entryNtl: '9.9',
          priceUsd: '1',
          valueUsd: '10',
        },
      ],
    });

    expect(v.holdings[0]?.displaySymbol).toBe('USDT');
    expect(v.holdings[0]?.pnlUsd).toBeUndefined();
  });
  it('empty snapshot → empty view', () => {
    const v = mapSnapshotToPerpsHomeView({
      ...snap,
      isEmpty: true,
      perpPositions: [],
      spotBalances: [],
    });
    expect(v.isEmpty).toBe(true);
    expect(v.positions).toHaveLength(0);
    expect(v.holdings).toHaveLength(0);
  });
});
