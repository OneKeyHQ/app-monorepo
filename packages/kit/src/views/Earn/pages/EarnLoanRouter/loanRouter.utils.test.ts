import { EOnChainHistoryTxStatus } from '@onekeyhq/shared/types/history';

import {
  buildLoanRoutes,
  buildLoanRoutesForPicks,
  buildLoanSelectTokens,
  getLoanBorrowOptions,
  getLoanCardMetrics,
  getLoanDoneLine,
  getLoanForLtv,
  getLoanForPositionLtv,
  getLoanHealthTone,
  getLoanLtvBar,
  getLoanPayPath,
  getLoanPlaces,
  getLoanRouteMetrics,
  getLoanRunAfterSupply,
  getLoanSteps,
  isLoanPlanStopped,
  listLoanSelectNetworks,
  parseLoanFigure,
  pickLoanBorrowPick,
  pickLoanPayToken,
  rankLoanRoutes,
  scopeLoanPick,
  snapLoanLtv,
  stepLoanLtv,
  toLoanTxOutcome,
} from './loanRouter.utils';

import type { ILoanRoute, ILoanRouteFacts } from './loanRouter.utils';
import type { IEarnDesktopMarketReserves } from '../../components/desktopHome/earnDesktopHome.utils';
import type { IEarnAssetPick } from '../EarnAssetSelect/earnAssetSelect.utils';

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
  collateralAssets: [],
  debtAssets: [],
  positionNetValue: 0,
  positionAnnualNet: 0,
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

  it('names every network a token is lent on, once each', () => {
    const arbitrum = market(
      'Arbitrum',
      '0xarb',
      [supplyAsset('WBTC')],
      [borrowAsset('USDC')],
    );
    arbitrum.market.networkId = 'evm--42161';
    arbitrum.market.network = {
      ...arbitrum.market.network,
      networkId: 'evm--42161',
      name: 'Arbitrum',
    };
    const options = getLoanBorrowOptions({
      markets: [...MARKETS, arbitrum],
      collateralSymbol: 'WBTC',
      stableSymbols: new Set(['USDC']),
    });
    expect(
      options.map((option) => option.networks.map((network) => network.name)),
    ).toEqual([['Ethereum', 'Arbitrum']]);
  });
});

// The same pair on a second network: Base lends USDC and DAI against WBTC,
// and takes ETH too
const onNetwork = (
  entry: IEarnDesktopMarketReserves,
  networkId: string,
  name: string,
) => {
  entry.market.networkId = networkId;
  entry.market.network = {
    ...entry.market.network,
    networkId,
    name,
    logoURI: `${name}.png`,
  };
  return entry;
};
const BASE_ID = 'evm--8453';
const NETWORK_MARKETS = [
  ...MARKETS,
  onNetwork(
    market(
      'Base',
      '0xbase',
      [supplyAsset('WBTC', { apy: '0.2' }), supplyAsset('ETH')],
      [borrowAsset('USDC', { apy: '5' }), borrowAsset('DAI', { apy: '2.5' })],
    ),
    BASE_ID,
    'Base',
  ),
];
const STABLES = new Set(['USDC', 'DAI']);
const WBTC: IEarnAssetPick = { kind: 'token', symbol: 'WBTC' };
const USDC: IEarnAssetPick = { kind: 'token', symbol: 'USDC' };

describe('the network both picks are on', () => {
  it('puts a pick on one network, or back on every network', () => {
    expect(scopeLoanPick(WBTC, BASE_ID)).toEqual({
      kind: 'token',
      symbol: 'WBTC',
      networkId: BASE_ID,
    });
    expect(
      scopeLoanPick({
        kind: 'class',
        assetClass: 'stable',
        networkId: BASE_ID,
      }),
    ).toEqual({ kind: 'class', assetClass: 'stable' });
  });

  it("lists every network's markets, or the picks' network alone", () => {
    const routesOn = (networkId?: string) =>
      buildLoanRoutesForPicks({
        markets: NETWORK_MARKETS,
        collateral: scopeLoanPick(WBTC, networkId),
        borrow: scopeLoanPick(USDC, networkId),
        stableSymbols: STABLES,
      }).map((route) => route.market.marketAddress);
    expect(routesOn()).toEqual(['0xcore', '0xprime', '0xbase']);
    expect(routesOn(BASE_ID)).toEqual(['0xbase']);
    expect(routesOn('evm--1')).toEqual(['0xcore', '0xprime']);
  });

  it('keeps the loan where the network lends it, else one lent there', () => {
    const dai: IEarnAssetPick = { kind: 'token', symbol: 'DAI' };
    const pick = (networkId?: string) =>
      pickLoanBorrowPick({
        markets: NETWORK_MARKETS,
        collateral: WBTC,
        current: dai,
        stableSymbols: STABLES,
        networkId,
      });
    // Only Base lends DAI against WBTC
    expect(pick()).toEqual(dai);
    expect(pick(BASE_ID)).toEqual(dai);
    expect(pick('evm--1')).toEqual(USDC);
  });
});

describe('buildLoanSelectTokens', () => {
  it('gives each network what the wallet holds there, and the total', () => {
    const holdings = new Map([
      [
        'WBTC',
        new Map([
          ['evm--1', { amount: '0.5', fiatValueUsd: '40000' }],
          [BASE_ID, { amount: '0.25', fiatValueUsd: '20000' }],
        ]),
      ],
      // Held where no market takes it: not counted
      ['ETH', new Map([['evm--1', { amount: '1', fiatValueUsd: '3000' }]])],
    ]);
    const tokens = buildLoanSelectTokens({
      markets: NETWORK_MARKETS,
      side: 'supply',
      stableSymbols: STABLES,
      holdings,
    });
    const wbtc = tokens.find((item) => item.symbol === 'WBTC');
    expect(
      wbtc?.networks.map((network) => [
        network.id,
        network.balance,
        network.fiatValue,
      ]),
    ).toEqual([
      ['evm--1', '0.5', 40_000],
      [BASE_ID, '0.25', 20_000],
    ]);
    expect(wbtc?.balance).toBe('0.75');
    expect(wbtc?.fiatValue).toBe(60_000);
    const eth = tokens.find((item) => item.symbol === 'ETH');
    expect(eth?.networks.map((network) => network.id)).toEqual([BASE_ID]);
    expect(eth?.balance).toBeUndefined();
    expect(eth?.networks[0].balance).toBeUndefined();
  });

  it('gives each network its lowest borrow rate, and the lowest of all', () => {
    const tokens = buildLoanSelectTokens({
      markets: NETWORK_MARKETS,
      side: 'borrow',
      collateral: WBTC,
      stableSymbols: STABLES,
    });
    const usdc = tokens.find((item) => item.symbol === 'USDC');
    // Core 4.5% and Prime 3% on Ethereum, 5% on Base
    expect(usdc?.networks.map((network) => [network.id, network.rate])).toEqual(
      [
        ['evm--1', 3],
        [BASE_ID, 5],
      ],
    );
    expect(usdc?.rate).toBe(3);
    const dai = tokens.find((item) => item.symbol === 'DAI');
    expect(dai?.networks.map((network) => network.id)).toEqual([BASE_ID]);
    expect(dai?.rate).toBe(2.5);
  });

  it("orders both sides' network columns the same, each with its own", () => {
    const borrowTokens = buildLoanSelectTokens({
      markets: NETWORK_MARKETS,
      side: 'borrow',
      collateral: WBTC,
      stableSymbols: STABLES,
    });
    const order = [
      { id: BASE_ID, name: 'Base', logoURI: '' },
      { id: 'evm--1', name: 'Ethereum', logoURI: '' },
    ];
    const idsOf = (
      networks: ReturnType<typeof listLoanSelectNetworks>,
    ): string[] => networks.map((network) => network.id);
    expect(
      idsOf(listLoanSelectNetworks({ order, tokens: borrowTokens })),
    ).toEqual([BASE_ID, 'evm--1']);
    expect(
      idsOf(
        listLoanSelectNetworks({
          order,
          tokens: borrowTokens.filter((item) => item.symbol === 'DAI'),
        }),
      ),
    ).toEqual([BASE_ID]);
    // A network the order lacks comes after it
    expect(
      idsOf(
        listLoanSelectNetworks({ order: [order[1]], tokens: borrowTokens }),
      ),
    ).toEqual(['evm--1', BASE_ID]);
  });
});

describe('Pay with across networks', () => {
  const collateral = { networkId: 'evm--1', symbol: 'WETH' };
  const payWith = (symbol: string, networkId: string) => ({
    symbol,
    networkId,
  });

  it('pays with the collateral there as it is, its wrapped twin too', () => {
    expect(
      getLoanPayPath({ payToken: payWith('WETH', 'evm--1'), collateral }),
    ).toBe('direct');
    expect(
      getLoanPayPath({ payToken: payWith('ETH', 'evm--1'), collateral }),
    ).toBe('direct');
    // Nothing held: the collateral itself, its balance 0
    expect(getLoanPayPath({ collateral })).toBe('direct');
  });

  it('swaps another token there, and bridges from any other network', () => {
    expect(
      getLoanPayPath({ payToken: payWith('USDC', 'evm--1'), collateral }),
    ).toBe('swap');
    expect(
      getLoanPayPath({ payToken: payWith('WETH', BASE_ID), collateral }),
    ).toBe('bridge');
    expect(
      getLoanPayPath({ payToken: payWith('USDC', BASE_ID), collateral }),
    ).toBe('bridge');
  });

  const held = (
    symbol: string,
    networkId: string,
    amount: string,
    fiatValueUsd: string,
  ) => ({
    key: `${networkId}|${symbol}`,
    networkId,
    token: { symbol },
    amount,
    fiatValueUsd,
  });
  const wallet = [
    held('WETH', 'evm--1', '0.001', '3'),
    held('USDC', 'evm--1', '500', '500'),
    held('ETH', BASE_ID, '0.01', '30'),
  ];

  it('starts on the largest holding of the collateral, on any network', () => {
    expect(pickLoanPayToken(wallet, 'WETH')?.key).toBe(`${BASE_ID}|ETH`);
  });

  it('else starts on the largest holding of anything', () => {
    expect(pickLoanPayToken(wallet, 'WBTC')?.key).toBe('evm--1|USDC');
    expect(pickLoanPayToken(wallet, '')?.key).toBe('evm--1|USDC');
    expect(pickLoanPayToken([], 'WBTC')).toBeUndefined();
  });

  it('compares one asset by amount where no value is known', () => {
    const unpriced = [
      held('ETH', 'evm--1', '0.001', '0'),
      held('ETH', 'evm--42161', '0.5', '0'),
      held('ETH', BASE_ID, '0.5', '0'),
    ];
    // Equal amounts keep the list's order
    expect(pickLoanPayToken(unpriced, 'ETH')?.key).toBe('evm--42161|ETH');
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
    // With what the LTV would be: 60,000 / 80,000
    expect(over.block).toEqual({ kind: 'maxLtv', maxLtv: 0.73, ltv: 0.75 });

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
      ltv: metrics.ltv,
    });
    expect(metrics.ltv).toBeGreaterThan(metrics.maxLtv ?? 1);
  });

  it('shows a loan alone by what it costs a year, with no rate', () => {
    const metrics = getLoanRouteMetrics({
      route: core,
      facts: facts({
        weightedCollateral: 100_000,
        debt: 0,
        collateralValue: 125_000,
        borrowableNow: 50_000,
      }),
      collateralAmount: '',
      borrowAmount: '1000',
      ltvStage: undefined,
    });
    expect(metrics.netApy).toBeUndefined();
    // 1,000 x 4.5%
    expect(metrics.annualNet).toBeCloseTo(-45);
    expect(metrics.block).toBeUndefined();
  });

  it('gives no rate to a plan that takes out more than it puts in', () => {
    const metrics = getLoanRouteMetrics({
      route: core,
      facts: facts({
        collateralPrice: 1,
        weightedCollateral: 100_000,
        collateralValue: 125_000,
        borrowableNow: 50_000,
      }),
      collateralAmount: '1000',
      borrowAmount: '2000',
    });
    // 1,000 x 0% - 2,000 x 4.5%
    expect(metrics.annualNet).toBeCloseTo(-90);
    expect(metrics.netApy).toBeUndefined();
  });

  it("gives the plan's own rate where the market holds no position", () => {
    const position = facts({
      collateralPrice: 1,
      weightedCollateral: 100_000,
      collateralValue: 125_000,
      borrowableNow: 50_000,
    });
    const within = getLoanRouteMetrics({
      route: core,
      facts: position,
      collateralAmount: '1000',
      borrowAmount: '700',
    });
    // (0 - 700 x 4.5%) / 300
    expect(within.netApy).toBeCloseTo(-10.5);
    expect(within.netApyBefore).toBeUndefined();
    // Past the pair's 73% it is still a rate
    const past = getLoanRouteMetrics({
      route: core,
      facts: position,
      collateralAmount: '1000',
      borrowAmount: '800',
    });
    // (0 - 800 x 4.5%) / 200
    expect(past.netApy).toBeCloseTo(-18);
    expect(past.annualNet).toBeCloseTo(-36);
    expect(past.block).toBeUndefined();
  });

  it("gives the whole position's rate, before and after, where it has one", () => {
    const position = facts({
      collateralPrice: 1,
      weightedCollateral: 100_000,
      collateralValue: 125_000,
      borrowableNow: 50_000,
      positionNetValue: 10_000,
      positionAnnualNet: 300,
    });
    const untyped = getLoanRouteMetrics({
      route: core,
      facts: position,
      collateralAmount: '',
      borrowAmount: '',
    });
    expect(untyped.netApyBefore).toBeCloseTo(3);
    expect(untyped.netApy).toBeCloseTo(3);
    const typed = getLoanRouteMetrics({
      route: core,
      facts: position,
      collateralAmount: '1000',
      borrowAmount: '700',
    });
    // (300 - 700 x 4.5%) / (10,000 + 300)
    expect(typed.netApy).toBeCloseTo((300 - 31.5) / 103);
    expect(typed.netApyBefore).toBeCloseTo(3);
  });

  it('holds only a fresh pair to its limit before amounts are typed', () => {
    const fresh = getLoanRouteMetrics({
      route: core,
      facts: facts(),
      collateralAmount: '',
      borrowAmount: '',
      ltvStage: 0.75,
    });
    expect(fresh.block).toEqual({ kind: 'maxLtv', maxLtv: 0.73, ltv: 0.75 });
    expect(fresh.maxLtv).toBeCloseTo(0.73);

    const withPosition = getLoanRouteMetrics({
      route: core,
      facts: facts({
        weightedCollateral: 10_000,
        debt: 5000,
        collateralValue: 12_500,
        debtValue: 5000,
        borrowableNow: 4000,
      }),
      collateralAmount: '',
      borrowAmount: '',
      ltvStage: 0.75,
    });
    expect(withPosition.block).toBeUndefined();
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
    expect(metrics.block).toEqual({ kind: 'maxLtv', maxLtv: 0.6, ltv: 0.61 });
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

describe('getLoanForPositionLtv', () => {
  it('lends what brings the whole position to the LTV', () => {
    // 0.5 x (7.02 + 1) - 2 = 2.01, at 2,000 a token
    expect(
      getLoanForPositionLtv({
        ltv: 0.5,
        collateralValue: 7.02,
        debtValue: 2,
        newCollateralValue: 1,
        borrowPrice: 2000,
        decimals: 18,
      }),
    ).toBe('0.001005');
  });

  it('rounds the loan as far as the LTV it gives still reads the same', () => {
    // 0.7 x (2.78 + 4.58) - 1.45 = 3.702 USDT at 1.0001: four places on
    // $7.36 of collateral
    expect(
      getLoanForPositionLtv({
        ltv: 0.7,
        collateralValue: 2.78,
        debtValue: 1.45,
        newCollateralValue: 4.58,
        borrowPrice: 1.0001,
        decimals: 6,
      }),
    ).toBe('3.7016');
    // One place on $10,000, whole tokens on $1,000,000
    expect(
      getLoanForPositionLtv({
        ltv: 0.5,
        collateralValue: 0,
        debtValue: 0,
        newCollateralValue: 10_000,
        borrowPrice: 1.0001,
        decimals: 6,
      }),
    ).toBe('4999.5');
    expect(
      getLoanForPositionLtv({
        ltv: 0.5,
        collateralValue: 0,
        debtValue: 0,
        newCollateralValue: 1_000_000,
        borrowPrice: 1.0001,
        decimals: 6,
      }),
    ).toBe('499950');
  });

  it('lends nothing at or below the debt already there', () => {
    expect(
      getLoanForPositionLtv({
        ltv: 0.2,
        collateralValue: 7.02,
        debtValue: 2,
        newCollateralValue: 1,
        borrowPrice: 2000,
        decimals: 18,
      }),
    ).toBe('');
  });
});

describe('getLoanPlaces', () => {
  it('keeps a small ETH loan to eight places and caps at the token', () => {
    expect(
      getLoanPlaces({ collateralValue: 4.58, borrowPrice: 2300, decimals: 18 }),
    ).toBe(8);
    expect(
      getLoanPlaces({ collateralValue: 4.58, borrowPrice: 1, decimals: 6 }),
    ).toBe(4);
    expect(
      getLoanPlaces({ collateralValue: 0, borrowPrice: 1, decimals: 6 }),
    ).toBe(6);
  });
});

describe('snapLoanLtv and stepLoanLtv', () => {
  const bounds = { lower: 0.1967, upper: 0.808 };

  it('lands a drag on whole percents, the floor and Max as stops', () => {
    expect(snapLoanLtv(0.7006, bounds)).toBeCloseTo(0.7, 10);
    expect(snapLoanLtv(0.806, bounds)).toBe(0.808);
    expect(snapLoanLtv(0.194, bounds)).toBe(0.1967);
    expect(snapLoanLtv(0.199, bounds)).toBeCloseTo(0.2, 10);
  });

  it('steps a key press to the next whole percent, or ten', () => {
    const step = (value: number, size: number, direction: 1 | -1) =>
      stepLoanLtv(value, { step: size, direction, ...bounds });
    expect(step(0.519, 0.01, 1)).toBeCloseTo(0.52, 10);
    expect(step(0.519, 0.01, -1)).toBeCloseTo(0.51, 10);
    expect(step(0.52, 0.01, 1)).toBeCloseTo(0.53, 10);
    expect(step(0.52, 0.01, -1)).toBeCloseTo(0.51, 10);
    expect(step(0.519, 0.1, 1)).toBeCloseTo(0.6, 10);
    expect(step(0.2, 0.01, -1)).toBe(0.1967);
    expect(step(0.8, 0.01, 1)).toBe(0.808);
  });
});

describe('getLoanLtvBar', () => {
  const [core] = buildLoanRoutes({
    markets: MARKETS,
    collateralSymbol: 'WBTC',
    borrowSymbol: 'USDC',
  });

  it('starts the bar at the debt already in the market', () => {
    const bar = getLoanLtvBar({
      route: core,
      facts: facts({
        weightedCollateral: 5.68,
        debt: 2,
        collateralValue: 7.02,
        debtValue: 2,
      }),
      maxLtv: 0.7643,
      newCollateralValue: 1,
      loanValue: 0.5,
      previewLtv: 0.5,
    });
    // 2 / 8.02, then 2.5 / 8.02
    expect(bar.used).toBeCloseTo(0.2494, 3);
    expect(bar.value).toBeCloseTo(0.3117, 3);
    // (5.68 + 1 x 0.78) / 8.02
    expect(bar.liquidation).toBeCloseTo(0.8055, 3);
    expect(bar.cap).toBe(0.7643);
    expect(bar.isPreview).toBe(false);
  });

  it("shows a fresh pair's plan before anything backs it", () => {
    const bar = getLoanLtvBar({
      route: core,
      facts: facts(),
      maxLtv: 0.73,
      newCollateralValue: 0,
      loanValue: 0,
      previewLtv: 0.5,
    });
    expect(bar).toEqual({
      used: 0,
      value: 0.5,
      cap: 0.73,
      liquidation: 0.78,
      isPreview: true,
    });
  });
});

describe('a plan without a loan', () => {
  const [core, prime] = buildLoanRoutes({
    markets: MARKETS,
    collateralSymbol: 'WBTC',
    borrowSymbol: 'USDC',
  });

  it('meets no loan limit and earns the supply rate', () => {
    const metrics = getLoanRouteMetrics({
      route: prime,
      facts: facts({ liquidity: 10, maxLtv: 0.1 }),
      collateralAmount: '1',
      borrowAmount: '',
    });
    expect(metrics.block).toBeUndefined();
    expect(metrics.netApy).toBeCloseTo(0.1);
    // 80,000 x 0.1%
    expect(metrics.annualNet).toBeCloseTo(80);
    expect(metrics.healthFactor).toBeUndefined();
    expect(metrics.liquidationPrice).toBeUndefined();
  });

  it('is stopped only where the account can not use the network', () => {
    const blocks = [
      { kind: 'borrowable' },
      { kind: 'liquidity', liquidity: 10 },
      { kind: 'maxLtv', maxLtv: 0.4, ltv: 0.5 },
    ] as const;
    blocks.forEach((block) => {
      expect(isLoanPlanStopped(block, true)).toBe(false);
      expect(isLoanPlanStopped(block, false)).toBe(true);
    });
    expect(isLoanPlanStopped({ kind: 'account' }, true)).toBe(true);
    expect(isLoanPlanStopped({ kind: 'account' }, false)).toBe(true);
    expect(isLoanPlanStopped(undefined, false)).toBe(false);
  });

  it("keeps the card's reason where the reference loan doesn't fit", () => {
    const metrics = getLoanCardMetrics({
      route: core,
      facts: facts({ liquidity: 10 }),
      collateralAmount: '1',
      borrowAmount: '',
      ltvStage: 0,
      isReference: true,
    });
    // 40,000 at 50% LTV, past the 10 left
    expect(metrics.block).toEqual({ kind: 'liquidity', liquidity: 10 });
    expect(isLoanPlanStopped(metrics.block, true)).toBe(false);
  });
});

describe('getLoanCardMetrics', () => {
  const [highSupply, lowBorrow] = buildLoanRoutes({
    markets: [
      market(
        'Steep',
        '0xsteep',
        [supplyAsset('WBTC', { apy: '2' })],
        [borrowAsset('USDC', { apy: '10' })],
      ),
      market(
        'Cheap',
        '0xcheap',
        [supplyAsset('WBTC', { apy: '1' })],
        [borrowAsset('USDC', { apy: '2' })],
      ),
    ],
    collateralSymbol: 'WBTC',
    borrowSymbol: 'USDC',
  });

  const rank = (isReference: boolean, collateralAmount = '1') =>
    rankLoanRoutes(
      [highSupply, lowBorrow].map((route) => ({
        route,
        metrics: getLoanCardMetrics({
          route,
          facts: facts(),
          collateralAmount,
          borrowAmount: '',
          ltvStage: 0,
          isReference,
        }),
      })),
    ).map((item) => item.route.marketLabel);

  it('compares the markets at half the collateral until a loan is typed', () => {
    const steep = getLoanCardMetrics({
      route: highSupply,
      facts: facts(),
      collateralAmount: '1',
      borrowAmount: '',
      ltvStage: 0,
      isReference: true,
    });
    expect(steep.ltv).toBeCloseTo(0.5);
    // (2 - 10 x 0.5) / 0.5
    expect(steep.netApy).toBeCloseTo(-6);
    // The pair at 50% LTV: the cheaper loan wins, as on the Loans list
    expect(rank(true)).toEqual([lowBorrow.marketLabel, highSupply.marketLabel]);
    expect(rank(true, '')).toEqual([
      lowBorrow.marketLabel,
      highSupply.marketLabel,
    ]);
    // A supply alone would put the higher supply rate first
    expect(rank(false)).toEqual([
      highSupply.marketLabel,
      lowBorrow.marketLabel,
    ]);
  });

  it("gives the pair's own rate with nothing typed, a position or not", () => {
    const position = facts({
      collateralPrice: 1,
      weightedCollateral: 100_000,
      collateralValue: 125_000,
      borrowableNow: 50_000,
      positionNetValue: 10_000,
      positionAnnualNet: 300,
    });
    const reference = getLoanCardMetrics({
      route: lowBorrow,
      facts: position,
      collateralAmount: '',
      borrowAmount: '',
      ltvStage: 0,
      isReference: true,
    });
    // (1 - 2 x 0.5) / 0.5
    expect(reference.netApy).toBeCloseTo(0);
    expect(reference.netApyBefore).toBeCloseTo(3);
    const asTyped = getLoanCardMetrics({
      route: lowBorrow,
      facts: position,
      collateralAmount: '',
      borrowAmount: '',
      ltvStage: 0,
      isReference: false,
    });
    expect(asTyped.netApy).toBeCloseTo(3);
  });

  it('follows the loan once one is typed', () => {
    const metrics = getLoanCardMetrics({
      route: lowBorrow,
      facts: facts(),
      collateralAmount: '1',
      borrowAmount: '20000',
      isReference: false,
    });
    expect(metrics.ltv).toBeCloseTo(0.25);
  });
});

describe('getLoanSteps', () => {
  const steps = (
    hasCollateral: boolean,
    hasLoan: boolean,
    conversion?: 'swap' | 'bridge',
    hasApproval = false,
  ) => getLoanSteps({ hasCollateral, hasLoan, conversion, hasApproval });

  it("names the window's own steps before anything is typed", () => {
    expect(steps(false, false)).toEqual(['supply', 'borrow']);
    expect(steps(false, false, 'swap')).toEqual(['swap', 'supply', 'borrow']);
    expect(steps(false, false, 'bridge')).toEqual([
      'bridge',
      'supply',
      'borrow',
    ]);
  });

  it('runs a supply alone in one step, after a swap or an approval', () => {
    expect(steps(true, false)).toEqual(['supply']);
    expect(steps(true, false, 'swap')).toEqual(['swap', 'supply']);
    expect(steps(true, false, undefined, true)).toEqual(['approve', 'supply']);
  });

  it('runs the loan after the supply, or alone', () => {
    expect(steps(true, true)).toEqual(['supply', 'borrow']);
    expect(steps(true, true, undefined, true)).toEqual([
      'approve',
      'supply',
      'borrow',
    ]);
    // The allowance is read once the swap is in
    expect(steps(true, true, 'swap', true)).toEqual([
      'swap',
      'supply',
      'borrow',
    ]);
    expect(steps(false, true, 'swap')).toEqual(['borrow']);
  });

  it('bridges first where the collateral comes from another network', () => {
    expect(steps(true, false, 'bridge')).toEqual(['bridge', 'supply']);
    // The allowance is read once the bridge is in, on the market's network
    expect(steps(true, true, 'bridge', true)).toEqual([
      'bridge',
      'supply',
      'borrow',
    ]);
    // A loan alone borrows against what the market holds: nothing to bridge
    expect(steps(false, true, 'bridge')).toEqual(['borrow']);
  });
});

describe('getLoanDoneLine', () => {
  const [core] = buildLoanRoutes({
    markets: MARKETS,
    collateralSymbol: 'WBTC',
    borrowSymbol: 'USDC',
  });
  const formatAmount = (amount: string, symbol: string) =>
    `${amount} ${symbol}`;
  const line = (
    collateralAmount: string,
    borrowAmount: string,
    supplied: boolean,
  ) =>
    getLoanDoneLine({
      plan: { route: core, collateralAmount, borrowAmount },
      supplied,
      formatAmount,
    });

  it('says a supply alone went in, without a loan', () => {
    expect(line('0.001', '', true)).toBe(
      `0.001 WBTC supplied to ${core.marketLabel}`,
    );
    expect(line('0.001', '0', true)).toBe(
      `0.001 WBTC supplied to ${core.marketLabel}`,
    );
  });

  it('says what was supplied and borrowed, or borrowed alone', () => {
    expect(line('0.001', '40', true)).toBe(
      `0.001 WBTC supplied and 40 USDC borrowed on ${core.marketLabel}`,
    );
    expect(line('0', '40', false)).toBe(
      `40 USDC borrowed on ${core.marketLabel}`,
    );
  });
});

describe('after the supply', () => {
  it('reads the final status as what came of the supply', () => {
    expect(toLoanTxOutcome(EOnChainHistoryTxStatus.Success)).toBe('landed');
    expect(toLoanTxOutcome(EOnChainHistoryTxStatus.Failed)).toBe('failed');
    // The wait ran out
    expect(toLoanTxOutcome(EOnChainHistoryTxStatus.Pending)).toBe('pending');
    expect(toLoanTxOutcome(undefined)).toBe('pending');
  });

  it('never ends a failed supply as supplied, with a loan or without', () => {
    [false, true].forEach((hasLoan) => {
      expect(getLoanRunAfterSupply({ outcome: 'failed', hasLoan })).toBe(
        'failed',
      );
      expect(getLoanRunAfterSupply({ outcome: 'rejected', hasLoan })).toBe(
        'idle',
      );
    });
  });

  it('ends a supply alone once sent; a loan follows a landed supply', () => {
    expect(getLoanRunAfterSupply({ outcome: 'landed', hasLoan: false })).toBe(
      'done',
    );
    expect(getLoanRunAfterSupply({ outcome: 'pending', hasLoan: false })).toBe(
      'done',
    );
    expect(getLoanRunAfterSupply({ outcome: 'landed', hasLoan: true })).toBe(
      'borrow',
    );
    expect(getLoanRunAfterSupply({ outcome: 'pending', hasLoan: true })).toBe(
      'borrowReady',
    );
  });
});

describe('parseLoanFigure', () => {
  it('reads the server figures', () => {
    expect(parseLoanFigure('79,594.7677')).toBeCloseTo(79_594.7677);
    expect(parseLoanFigure('73.00%')).toBe(73);
    expect(parseLoanFigure(undefined)).toBeUndefined();
  });
});

describe('getLoanHealthTone', () => {
  // Where the server's quotes put 1.50, 1.49, 1.10 and 1.09 (10-28)
  it('reads the bands the server colors: 1.5 and up, 1.1 to 1.5, under 1.1', () => {
    expect(getLoanHealthTone(undefined)).toBe('success');
    expect(getLoanHealthTone(Infinity)).toBe('success');
    expect(getLoanHealthTone(1.5)).toBe('success');
    expect(getLoanHealthTone(1.49)).toBe('caution');
    expect(getLoanHealthTone(1.1)).toBe('caution');
    expect(getLoanHealthTone(1.09)).toBe('critical');
    expect(getLoanHealthTone(0.9)).toBe('critical');
  });
});
