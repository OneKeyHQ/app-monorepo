import {
  buildLoanRoutes,
  getLoanBorrowOptions,
  getLoanForLtv,
  getLoanRouteMetrics,
  parseLoanFigure,
  rankLoanRoutes,
} from './loanRouter.utils';

import type { ILoanRoute, ILoanRouteFacts } from './loanRouter.utils';
import type { IEarnDesktopMarketReserves } from '../../components/desktopHome/earnDesktopHome.utils';

const token = (symbol: string, address = `0x${symbol.toLowerCase()}`) => ({
  address,
  name: symbol,
  symbol,
  decimals: 18,
  logoURI: `${symbol}.png`,
  networkId: 'evm--1',
});

const supplyAsset = (
  symbol: string,
  { apy = '1', ltv = '78', canBeCollateral = true } = {},
) => ({
  reserveAddress: `0x${symbol.toLowerCase()}`,
  token: token(symbol),
  apyDetail: { apy },
  categories: [],
  canBeCollateral,
  liquidationLtv: ltv,
  walletBalance: { title: { text: '0' }, description: { text: '0' } },
  supplyButton: {},
});

const borrowAsset = (
  symbol: string,
  { apy = '4', borrowFactor = '1' } = {},
) => ({
  reserveAddress: `0x${symbol.toLowerCase()}`,
  token: token(symbol),
  apyDetail: { apy },
  categories: [],
  canBeBorrowed: true,
  available: { title: { text: '0' }, description: { text: '0' } },
  borrowButton: {},
  borrowFactor,
});

const market = (
  name: string,
  marketAddress: string,
  supply: ReturnType<typeof supplyAsset>[],
  borrow: ReturnType<typeof borrowAsset>[],
) =>
  ({
    market: {
      provider: 'aave',
      networkId: 'evm--1',
      name,
      logoURI: '',
      marketAddress,
      network: { networkId: 'evm--1', name: 'Ethereum', logoURI: '' },
    },
    reserves: {
      supplied: { assets: [] },
      borrowed: { assets: [] },
      supply: { assets: supply },
      borrow: { assets: borrow },
    },
  }) as unknown as IEarnDesktopMarketReserves;

const MARKETS = [
  market(
    'Core',
    '0xcore',
    [supplyAsset('WBTC', { apy: '0', ltv: '78' }), supplyAsset('USDC')],
    [borrowAsset('USDC', { apy: '4.5' }), borrowAsset('WBTC')],
  ),
  market(
    'Prime',
    '0xprime',
    [supplyAsset('WBTC', { apy: '0.1', ltv: '75' })],
    [borrowAsset('USDC', { apy: '3' })],
  ),
];

const facts = (overrides: Partial<ILoanRouteFacts> = {}): ILoanRouteFacts => ({
  hasAccount: true,
  networkAccountId: 'account',
  collateralPrice: 80_000,
  borrowPrice: 1,
  maxLtv: 0.73,
  liquidity: 10_000_000,
  weightedCollateral: 0,
  debt: 0,
  collateralValue: 0,
  debtValue: 0,
  collateralSupplied: 0,
  collateralWeighted: 0,
  borrowableNow: 0,
  canBorrowHere: true,
  ...overrides,
});

describe('buildLoanRoutes', () => {
  it('finds every market that takes the collateral and lends the loan', () => {
    const routes = buildLoanRoutes({
      markets: MARKETS,
      collateralSymbol: 'wbtc',
      borrowSymbol: 'USDC',
    });
    expect(routes.map((route) => route.market.marketAddress)).toEqual([
      '0xcore',
      '0xprime',
    ]);
    expect(routes[0].key).toBe('aave:evm--1:0xcore|0xwbtc|0xusdc');
    expect(routes[0].collateral.liquidationLtv).toBeCloseTo(0.78);
    expect(routes[1].borrow.borrowApy).toBe(3);
  });

  it('never pairs an asset with itself', () => {
    expect(
      buildLoanRoutes({
        markets: MARKETS,
        collateralSymbol: 'WBTC',
        borrowSymbol: 'WBTC',
      }),
    ).toEqual([]);
  });
});

describe('getLoanBorrowOptions', () => {
  it('lists what any market lends against the collateral, once each', () => {
    const options = getLoanBorrowOptions({
      markets: MARKETS,
      collateralSymbol: 'WBTC',
      stableSymbols: new Set(['USDC']),
    });
    expect(options.map((option) => option.symbol)).toEqual(['USDC']);
  });
});

describe('getLoanRouteMetrics', () => {
  const [core] = buildLoanRoutes({
    markets: MARKETS,
    collateralSymbol: 'WBTC',
    borrowSymbol: 'USDC',
  });

  it('works out the plan at the chosen LTV before amounts are typed', () => {
    const metrics = getLoanRouteMetrics({
      route: core,
      facts: facts(),
      collateralAmount: '',
      borrowAmount: '',
      ltvStage: 0.5,
    });
    // (0 - 4.5 x 0.5) / 0.5
    expect(metrics.netApy).toBeCloseTo(-4.5);
    expect(metrics.ltv).toBe(0.5);
    expect(metrics.block).toBeUndefined();
  });

  it('works out the health factor and liquidation price for the amounts', () => {
    const metrics = getLoanRouteMetrics({
      route: core,
      facts: facts(),
      collateralAmount: '1',
      borrowAmount: '40000',
    });
    // 80,000 x 0.78 / 40,000
    expect(metrics.healthFactor).toBeCloseTo(1.56);
    // 40,000 / (1 x 0.78)
    expect(metrics.liquidationPrice).toBeCloseTo(51_282.05, 1);
    expect(metrics.ltv).toBeCloseTo(0.5);
    // 80,000 x 0.73
    expect(metrics.maxBorrow).toBeCloseTo(58_400);
    expect(metrics.annualNet).toBeCloseTo(-1800);
  });

  it('says why a market can not take the loan', () => {
    const over = getLoanRouteMetrics({
      route: core,
      facts: facts(),
      collateralAmount: '1',
      borrowAmount: '60000',
    });
    expect(over.block).toEqual({ kind: 'maxLtv', maxLtv: 0.73 });

    const dry = getLoanRouteMetrics({
      route: core,
      facts: facts({ liquidity: 1000 }),
      collateralAmount: '1',
      borrowAmount: '40000',
    });
    expect(dry.block).toEqual({ kind: 'liquidity', liquidity: 1000 });

    const eMode = getLoanRouteMetrics({
      route: core,
      facts: facts({ canBorrowHere: false, eModeLabel: 'ETH correlated' }),
      collateralAmount: '1',
      borrowAmount: '1',
    });
    expect(eMode.block).toEqual({
      kind: 'borrowable',
      eModeLabel: 'ETH correlated',
    });

    const noAccount = getLoanRouteMetrics({
      route: core,
      facts: facts({ hasAccount: false, networkAccountId: undefined }),
      collateralAmount: '',
      borrowAmount: '',
    });
    expect(noAccount.block).toEqual({ kind: 'account' });
  });

  it('counts the position already in the market', () => {
    const metrics = getLoanRouteMetrics({
      route: core,
      facts: facts({
        weightedCollateral: 10_000,
        debt: 5000,
        collateralValue: 12_500,
        debtValue: 5000,
        borrowableNow: 4000,
      }),
      collateralAmount: '1',
      borrowAmount: '10000',
    });
    expect(metrics.healthFactorBefore).toBeCloseTo(2);
    // (10,000 + 62,400) / 15,000
    expect(metrics.healthFactor).toBeCloseTo(4.8267, 3);
    // The whole position's: 5,000 / 12,500, then 15,000 / 92,500
    expect(metrics.ltvBefore).toBeCloseTo(0.4);
    expect(metrics.ltv).toBeCloseTo(0.1622, 3);
    // (5,000 + 4,000 + 58,400) / 92,500
    expect(metrics.maxLtv).toBeCloseTo(0.7286, 3);
  });

  it('blocks a loan past the position limit, at the limit the row shows', () => {
    const position = facts({
      weightedCollateral: 10_000,
      debt: 5000,
      collateralValue: 12_500,
      debtValue: 5000,
      borrowableNow: 4000,
    });
    // 4,000 + 58,400 more at most
    const metrics = getLoanRouteMetrics({
      route: core,
      facts: position,
      collateralAmount: '1',
      borrowAmount: '62500',
    });
    expect(metrics.block).toEqual({
      kind: 'maxLtv',
      maxLtv: metrics.maxLtv,
    });
    expect(metrics.ltv).toBeGreaterThan(metrics.maxLtv ?? 1);
  });

  it("lowers the limit by the loan token's borrow factor", () => {
    const [prime] = buildLoanRoutes({
      markets: [
        market(
          'Volatile',
          '0xvolatile',
          [supplyAsset('USDC', { ltv: '80' })],
          [borrowAsset('SOL', { borrowFactor: '1.25' })],
        ),
      ],
      collateralSymbol: 'USDC',
      borrowSymbol: 'SOL',
    });
    const metrics = getLoanRouteMetrics({
      route: prime,
      facts: facts({ collateralPrice: 1, borrowPrice: 1, maxLtv: 0.75 }),
      collateralAmount: '100',
      borrowAmount: '61',
    });
    expect(metrics.maxLtv).toBeCloseTo(0.6);
    expect(metrics.block).toEqual({ kind: 'maxLtv', maxLtv: 0.6 });
  });
});

describe('rankLoanRoutes', () => {
  it('puts the markets that can take the loan first, best plan first', () => {
    const route = (key: string) => ({ key, marketLabel: key }) as ILoanRoute;
    const ranked = rankLoanRoutes([
      { route: route('a'), metrics: { netApy: 5, block: { kind: 'account' } } },
      { route: route('b'), metrics: { netApy: 1 } },
      { route: route('c'), metrics: { netApy: 3 } },
    ]);
    expect(ranked.map((item) => item.route.key)).toEqual(['c', 'b', 'a']);
  });
});

describe('getLoanForLtv', () => {
  it('lends a share of the collateral value in the loan token', () => {
    expect(
      getLoanForLtv({
        collateralAmount: '2',
        ltv: 0.5,
        collateralPrice: 0.9998,
        borrowPrice: 2306.77,
        decimals: 18,
      }),
    ).toBe('0.00043341');
    expect(
      getLoanForLtv({
        collateralAmount: '',
        ltv: 0.5,
        collateralPrice: 1,
        borrowPrice: 1,
        decimals: 6,
      }),
    ).toBe('');
  });
});

describe('parseLoanFigure', () => {
  it('reads the server figures', () => {
    expect(parseLoanFigure('79,594.7677')).toBeCloseTo(79_594.7677);
    expect(parseLoanFigure('73.00%')).toBe(73);
    expect(parseLoanFigure(undefined)).toBeUndefined();
  });
});
