import type { IEarnAvailableAsset } from '@onekeyhq/shared/types/earn';
import type {
  IBorrowMarketItem,
  IBorrowReserveItem,
  IEarnPortfolioInvestment,
  IStakeProtocolListItem,
} from '@onekeyhq/shared/types/staking';
import type { IAccountToken, ITokenFiat } from '@onekeyhq/shared/types/token';

import {
  buildHoldRows,
  buildHoldingShares,
  buildLoanOffers,
  buildLoanPairs,
  buildMarketCard,
  buildNetworkView,
  buildOfferRows,
  buildProtocolShares,
  buildTokenOffers,
  buildValueShares,
  collectLendingOffers,
  collectNetworkOffers,
  collectTileRows,
  computeNetWorth,
  deriveLendingSupply,
  estimateBorrowInterest24h,
  findPositionDeposit,
  formatSharePercent,
  getAssetSortApr,
  getHoldRowTarget,
  getLoanAssetType,
  getLoanNetApy,
  parseCompactFiatText,
  pickLoanPreviewPairs,
  pickTileOffers,
  sortLoanPairs,
  sumBorrowedFiat,
  sumHoldRows,
  sumPortfolioDeposits,
  sumWalletHoldings,
} from './earnDesktopHome.utils';

import type {
  IEarnDesktopLendingOffer,
  IEarnDesktopWalletNetworkGroup,
} from './earnDesktopHome.utils';

const investment = (
  code: string,
  totalFiatValue: string,
  networkId = 'evm--1',
) =>
  ({
    totalFiatValue,
    protocol: {
      providerDetail: { code, name: code.toUpperCase(), logoURI: '' },
    },
    network: { networkId, name: '', logoURI: '' },
    assets: [],
    airdropAssets: [],
  }) as unknown as IEarnPortfolioInvestment;

// One provider's positions as the portfolio hands them over: merged into one
// investment that keeps the first position's protocol, each asset carrying
// its own request's total
const mergedInvestment = (
  code: string,
  positions: {
    symbol: string;
    fiatValue: string;
    networkId?: string;
    vault?: string;
  }[],
) =>
  ({
    totalFiatValue: positions
      .reduce((sum, item) => sum + Number(item.fiatValue), 0)
      .toString(),
    protocol: {
      symbol: positions[0]?.symbol,
      providerDetail: { code, name: code, logoURI: '' },
    },
    network: {
      networkId: positions[0]?.networkId ?? 'evm--1',
      name: '',
      logoURI: '',
    },
    assets: positions.map((item) => ({
      token: { info: { symbol: item.symbol, logoURI: '' } },
      rewardAssets: [],
      assetsStatus: [],
      metadata: {
        protocol: {
          vault: item.vault,
          providerDetail: { code, name: code, logoURI: '' },
        },
        network: {
          networkId: item.networkId ?? 'evm--1',
          name: '',
          logoURI: '',
        },
        fiatValue: item.fiatValue,
      },
    })),
    airdropAssets: [],
  }) as unknown as IEarnPortfolioInvestment;

const market = (provider: string, networkId: string, name: string) =>
  ({
    provider,
    networkId,
    name,
    logoURI: '',
    marketAddress: `0x${provider}${networkId.length}`,
  }) as unknown as IBorrowMarketItem;

const token = (symbol: string) => ({
  networkId: 'evm--1',
  address: `0x${symbol}`,
  name: symbol,
  symbol,
  decimals: 18,
  logoURI: `${symbol}.png`,
});

const reserves = ({
  borrow,
  supply = [],
  supplied = [],
  borrowed,
}: {
  borrow: {
    symbol: string;
    apy: string;
    total: string;
    canBeBorrowed?: boolean;
    borrowFactor?: string;
  }[];
  supply?: {
    symbol: string;
    apy?: string;
    canBeCollateral: boolean;
    liquidationLtv?: string;
  }[];
  supplied?: { symbol: string; fiatValue: string; apy?: string }[];
  borrowed?: { symbol: string; fiatValue: string; apy: string }[];
}) =>
  ({
    ...(borrowed
      ? {
          borrowed: {
            assets: borrowed.map((item) => ({
              reserveAddress: `Borrowed-${item.symbol}`,
              token: token(item.symbol),
              apyDetail: { apy: item.apy },
              borrowedAmount: { fiatValue: item.fiatValue },
            })),
          },
        }
      : {}),
    borrow: {
      assets: borrow.map((item) => ({
        reserveAddress: `borrow-${item.symbol}`,
        token: token(item.symbol),
        apyDetail: { apy: item.apy },
        totalBorrowed: { text: item.total },
        canBeBorrowed: item.canBeBorrowed,
        borrowFactor: item.borrowFactor,
      })),
    },
    supply: {
      assets: supply.map((item) => ({
        reserveAddress: `supply-${item.symbol}`,
        token: token(item.symbol),
        apyDetail: { apy: item.apy ?? '0' },
        canBeCollateral: item.canBeCollateral,
        liquidationLtv: item.liquidationLtv,
        reserveSize: { text: '$1.00M' },
      })),
    },
    supplied: {
      assets: supplied.map((item) => ({
        reserveAddress: `Supply-${item.symbol}`,
        token: token(item.symbol),
        apyDetail: { apy: item.apy ?? '0' },
        suppliedAmount: { fiatValue: item.fiatValue },
      })),
    },
  }) as unknown as IBorrowReserveItem;

describe('parseCompactFiatText', () => {
  it.each([
    ['$4.18B', 4.18e9],
    ['$565.76K', 565_760],
    ['$167.60M', 167_600_000],
    ['$1,234.5', 1234.5],
    ['$0', 0],
    [undefined, 0],
  ])('reads %s', (text, expected) => {
    expect(parseCompactFiatText(text)).toBeCloseTo(expected);
  });
});

const walletToken = (
  symbol: string,
  key: string,
  extra: Partial<IAccountToken> = {},
): IAccountToken => ({
  $key: key,
  symbol,
  name: symbol,
  address: key,
  decimals: 6,
  isNative: false,
  ...extra,
});

const walletFiat = (
  balanceParsed: string,
  fiatValue: string,
  extra: Partial<ITokenFiat> = {},
): ITokenFiat => ({
  balance: balanceParsed,
  balanceParsed,
  fiatValue,
  price: 1,
  currency: 'usd',
  ...extra,
});

describe('sumWalletHoldings', () => {
  it('adds a token up across networks', () => {
    // The 10-21 test wallet: USDC on Ethereum and on Arbitrum
    const holdings = sumWalletHoldings([
      {
        tokens: [walletToken('USDC', 'eth_usdc'), walletToken('ETH', 'eth')],
        map: {
          eth_usdc: walletFiat('4.025784', '4.02489832752'),
          eth: walletFiat('0.000723', '1.76'),
        },
      },
      {
        tokens: [walletToken('USDC', 'arb_usdc')],
        map: { arb_usdc: walletFiat('385.739546', '385.655454778972') },
      },
    ]);
    expect(holdings.get('usdc')).toEqual({
      amount: '389.76533',
      fiatValueUsd: '389.680353106492',
    });
    expect(holdings.get('eth')).toEqual({
      amount: '0.000723',
      fiatValueUsd: '1.76',
    });
  });

  it('scales a rebase balance, whose value is already scaled', () => {
    const holdings = sumWalletHoldings([
      {
        tokens: [walletToken('TSLAx', 'sol_x')],
        map: { sol_x: walletFiat('2', '900', { balanceMultiplier: '1.5' }) },
      },
    ]);
    expect(holdings.get('tslax')).toEqual({ amount: '3', fiatValueUsd: '900' });
  });

  it('leaves out DeFi positions, shared-balance twins and empty balances', () => {
    const holdings = sumWalletHoldings([
      {
        tokens: [
          walletToken('USDC', 'a', { defiMarked: true }),
          walletToken('USDC', 'b'),
          walletToken('USDC', 'c'),
          walletToken('DAI', 'd'),
          walletToken('USDT', 'missing'),
        ],
        map: {
          a: walletFiat('10', '10'),
          b: walletFiat('5', '5', { sharedBalanceExcludedFromTotal: true }),
          c: walletFiat('1', '1'),
          d: walletFiat('0', '0'),
        },
      },
    ]);
    expect(holdings.get('usdc')).toEqual({ amount: '1', fiatValueUsd: '1' });
    expect(holdings.has('dai')).toBe(false);
    expect(holdings.has('usdt')).toBe(false);
  });

  it('keeps the amount but not a value in another currency', () => {
    const holdings = sumWalletHoldings([
      {
        tokens: [walletToken('EURC', 'e')],
        map: { e: walletFiat('2', '1.8', { currency: 'eur' }) },
      },
    ]);
    expect(holdings.get('eurc')).toEqual({ amount: '2', fiatValueUsd: '0' });
  });
});

describe('buildProtocolShares', () => {
  it('keeps the top three and sums the rest to 100', () => {
    const shares = buildProtocolShares({
      investments: [
        investment('bitway', '53'),
        investment('morpho', '24'),
        investment('spark', '17'),
        investment('lido', '4'),
        investment('pendle', '2'),
      ],
    });
    expect(shares.top.map((item) => [item.key, item.percent])).toEqual([
      ['bitway', 53],
      ['morpho', 24],
      ['spark', 17],
    ]);
    expect(shares.rest).toMatchObject({ count: 2, percent: 6 });
    // The bar's "2 more" names them
    expect(shares.rest?.items.map((item) => [item.key, item.percent])).toEqual([
      ['lido', 4],
      ['pendle', 2],
    ]);
    expect(shares.total).toBe(100);
  });

  it('adds lending supply to its provider', () => {
    const shares = buildProtocolShares({
      investments: [investment('morpho', '10')],
      lendingSupplies: [
        {
          provider: 'aave',
          name: 'Aave',
          fiatValue: 50,
          netValue: 30,
          tokens: [{ symbol: 'ETH' }],
          debtValue: 20,
        },
        { provider: 'Morpho', name: 'Morpho', fiatValue: 10, netValue: 10 },
      ],
    });
    expect(shares.top.map((item) => [item.key, item.value])).toEqual([
      ['aave', 30],
      ['morpho', 20],
    ]);
    // The hover card reads supplied 50, borrowed 20
    expect(shares.top[0]).toMatchObject({
      debtValue: 20,
      tokens: [{ symbol: 'ETH' }],
    });
    expect(shares.rest).toBeUndefined();
  });

  it('is empty without deposits', () => {
    expect(buildProtocolShares({ investments: [] })).toEqual({
      top: [],
      total: 0,
    });
  });

  it('keeps a rest that rounds to nothing', () => {
    const shares = buildProtocolShares({
      investments: [
        investment('bitway', '600'),
        investment('morpho', '300'),
        investment('spark', '99.6'),
        investment('lido', '0.4'),
      ],
    });
    expect(shares.rest).toMatchObject({ count: 1, percent: 0 });
    expect(formatSharePercent(shares.rest?.percent ?? 0)).toBe('<1%');
    expect(formatSharePercent(shares.top[0].percent)).toBe('60%');
  });
});

describe('buildValueShares', () => {
  it('adds up one protocol across networks, keeping its first name', () => {
    const shares = buildValueShares({
      items: [
        { key: 'morpho', name: 'Morpho', value: 40 },
        { key: 'pendle', name: 'Pendle', value: 30 },
        { key: 'morpho', name: 'Morpho Blue', value: 20 },
        { key: 'spark', name: 'Spark', value: 6 },
        { key: 'lido', name: 'Lido', value: 4 },
        { key: 'aave', name: 'Aave', value: 0 },
      ],
    });
    expect(shares.top.map((item) => [item.name, item.percent])).toEqual([
      ['Morpho', 60],
      ['Pendle', 30],
      ['Spark', 6],
    ]);
    expect(shares.rest).toMatchObject({ count: 1, percent: 4 });
  });

  it('keeps what each protocol holds and what is borrowed there', () => {
    const shares = buildValueShares({
      items: [
        {
          key: 'aave',
          name: 'Aave',
          value: 30,
          tokens: [{ symbol: 'USDC' }, { symbol: 'ETH' }],
          debtValue: 20,
        },
        {
          key: 'morpho',
          name: 'Morpho',
          value: 25,
          tokens: [{ symbol: 'USDC' }],
        },
        {
          key: 'aave',
          name: 'Aave',
          value: 10,
          tokens: [{ symbol: 'eth' }, { symbol: 'WBTC' }],
          debtValue: 5,
        },
      ],
    });
    expect(shares.top[0]).toMatchObject({
      key: 'aave',
      value: 40,
      debtValue: 25,
      tokens: [{ symbol: 'USDC' }, { symbol: 'ETH' }, { symbol: 'WBTC' }],
    });
    expect(shares.top[1].debtValue).toBeUndefined();
  });
});

describe('getAssetSortApr', () => {
  it('sorts a range by its top', () => {
    expect(
      getAssetSortApr({
        aprWithoutFee: '14.78',
        maxAprInfo: { normal: { text: '15.87% APY' } },
      } as IEarnAvailableAsset),
    ).toBe(15.87);
  });

  it('reads the highlighted rate before the plain one', () => {
    expect(
      getAssetSortApr({
        aprWithoutFee: '4.1',
        aprInfo: {
          highlight: { text: '5.42%' },
          normal: { text: '4.10%' },
        },
      } as IEarnAvailableAsset),
    ).toBe(5.42);
  });

  it('falls back to the rate without fee', () => {
    expect(
      getAssetSortApr({ aprWithoutFee: '3.5' } as IEarnAvailableAsset),
    ).toBe(3.5);
  });
});

describe('portfolio deposits', () => {
  // The test account on 20 Oct: Bitway's USDT and U arrive as one investment
  // whose protocol names USDT only
  const bitway = mergedInvestment('bitway', [
    { symbol: 'USDT', fiatValue: '58.71', vault: '0xvault' },
    { symbol: 'U', fiatValue: '7.07' },
  ]);

  it('credits each token its own deposit', () => {
    const { byToken } = sumPortfolioDeposits([bitway]);
    expect(byToken.get('usdt')).toBeCloseTo(58.71);
    expect(byToken.get('u')).toBeCloseTo(7.07);
  });

  it('finds the offer that holds a deposit', () => {
    const deposits = sumPortfolioDeposits([bitway]);
    const usdt = { provider: 'Bitway', networkId: 'evm--1', symbol: 'USDT' };
    expect(
      findPositionDeposit(deposits, { ...usdt, vault: '0xVAULT' }),
    ).toBeCloseTo(58.71);
    // An offer without a vault takes the token's deposit at that provider
    expect(findPositionDeposit(deposits, usdt)).toBeCloseTo(58.71);
    // A position without a vault matches an offer that has one
    expect(
      findPositionDeposit(deposits, {
        ...usdt,
        symbol: 'U',
        vault: '0xother',
      }),
    ).toBeCloseTo(7.07);
    // Two different vaults never match
    expect(
      findPositionDeposit(deposits, { ...usdt, vault: '0xother' }),
    ).toBeUndefined();
    expect(
      findPositionDeposit(deposits, { ...usdt, networkId: 'evm--56' }),
    ).toBeUndefined();
  });
});

describe('pickTileOffers', () => {
  it('gives each empty tile its own offer', () => {
    expect(
      pickTileOffers({
        rewardsEmpty: true,
        withdrawalsEmpty: true,
        loansEmpty: false,
        walletEmpty: true,
        poolsAvailable: false,
      }),
    ).toEqual({
      rewards: 'trending',
      withdrawals: 'fixedIncome',
      loans: undefined,
      wallet: 'borrow',
    });
  });

  it('shows Pools on the wallet tile once Pools ships', () => {
    expect(
      pickTileOffers({
        rewardsEmpty: false,
        withdrawalsEmpty: false,
        loansEmpty: false,
        walletEmpty: true,
        poolsAvailable: true,
      }).wallet,
    ).toBe('pools');
  });

  it('leaves the wallet tile without an offer when every offer is in use', () => {
    expect(
      pickTileOffers({
        rewardsEmpty: true,
        withdrawalsEmpty: true,
        loansEmpty: true,
        walletEmpty: true,
        poolsAvailable: false,
      }).wallet,
    ).toBeUndefined();
  });
});

describe('buildMarketCard', () => {
  it('ranks by amount borrowed and lists collateral once', () => {
    const card = buildMarketCard({
      market: market('aave', 'evm--42161', 'Aave Arbitrum Market'),
      reserves: reserves({
        borrow: [
          { symbol: 'WBTC', apy: '0.73', total: '$11.68M' },
          { symbol: 'ETH', apy: '1.97', total: '$133.36M' },
          { symbol: 'USDC', apy: '3.42', total: '$167.60M' },
          { symbol: 'USDT', apy: '4.19', total: '$39.11M' },
          {
            symbol: 'GHO',
            apy: '3.54',
            total: '$565.76K',
            canBeBorrowed: false,
          },
        ],
        supply: [
          { symbol: 'WBTC', canBeCollateral: true, liquidationLtv: '78' },
          { symbol: 'ETH', canBeCollateral: true, liquidationLtv: '84' },
          { symbol: 'ETH', canBeCollateral: true, liquidationLtv: '84' },
          { symbol: 'GHO', canBeCollateral: false },
          { symbol: 'USDe', canBeCollateral: true, liquidationLtv: '0' },
        ],
      }),
    });
    expect(card.label).toBe('Aave Arbitrum');
    expect(card.topBorrow.map((row) => row.symbol)).toEqual([
      'USDC',
      'ETH',
      'USDT',
    ]);
    expect(card.moreCount).toBe(1);
    expect(card.collateral.map((item) => item.symbol)).toEqual(['WBTC', 'ETH']);
  });

  it('is empty before the reserves load', () => {
    const card = buildMarketCard({
      market: market('kamino', 'sol--101', 'Kamino Main Market'),
    });
    expect(card.topBorrow).toEqual([]);
    expect(card.moreCount).toBe(0);
    expect(card.collateral).toEqual([]);
  });
});

describe('buildLoanOffers', () => {
  it('ranks the most borrowed assets, each where supplying pays most', () => {
    const offers = buildLoanOffers([
      {
        market: market('aave', 'evm--1', 'Aave Core Instance'),
        reserves: reserves({
          borrow: [
            { symbol: 'ETH', apy: '1.96', total: '$4.18B' },
            { symbol: 'USDC', apy: '4.59', total: '$2.24B' },
          ],
          supply: [
            { symbol: 'ETH', apy: '1.3', canBeCollateral: true },
            { symbol: 'USDC', apy: '3.87', canBeCollateral: true },
          ],
        }),
      },
      {
        market: market('aave', 'evm--42161', 'Aave Arbitrum Market'),
        reserves: reserves({
          borrow: [{ symbol: 'USDC', apy: '3.42', total: '$167.60M' }],
          supply: [{ symbol: 'USDC', apy: '2.49', canBeCollateral: true }],
        }),
      },
      {
        market: market('kamino', 'sol--101', 'Main Market'),
        reserves: reserves({
          borrow: [{ symbol: 'USDC', apy: '5.89', total: '$123.14M' }],
          supply: [{ symbol: 'USDC', apy: '4.33', canBeCollateral: true }],
        }),
      },
    ]);
    // The supply rate, not the borrow rate, and Kamino pays most for USDC
    expect(
      offers.map((offer) => [offer.symbol, offer.market.networkId, offer.apy]),
    ).toEqual([
      ['ETH', 'evm--1', '1.3'],
      ['USDC', 'sol--101', '4.33'],
    ]);
  });

  it('leaves out an asset no market pays to supply', () => {
    expect(
      buildLoanOffers([
        {
          market: market('aave', 'evm--1', 'Aave Core Instance'),
          reserves: reserves({
            borrow: [
              { symbol: 'GHO', apy: '5.2', total: '$300.00M' },
              { symbol: 'USDT', apy: '4.34', total: '$2.49B' },
            ],
            supply: [
              { symbol: 'GHO', apy: '0', canBeCollateral: false },
              { symbol: 'USDT', apy: '3.38', canBeCollateral: true },
            ],
          }),
        },
      ]).map((offer) => offer.symbol),
    ).toEqual(['USDT']);
  });
});

describe('collectLendingOffers', () => {
  it('groups supply by symbol with the deposited amount', () => {
    const core = market('aave', 'evm--1', 'Aave Core Instance');
    const offers = collectLendingOffers({
      markets: [
        {
          market: core,
          reserves: reserves({
            borrow: [],
            supply: [{ symbol: 'USDC', apy: '3.86', canBeCollateral: true }],
          }),
        },
      ],
      supplied: new Map([
        [`aave:evm--1:${core.marketAddress}:supply-usdc`, 2.9],
      ]),
    });
    const usdc = offers.get('usdc');
    expect(usdc?.map((offer) => [offer.marketLabel, offer.apy])).toEqual([
      ['Aave Core', '3.86'],
    ]);
    expect(usdc?.[0].tvlText).toBe('$1.00M');
    expect(usdc?.[0].depositedFiatValue).toBe(2.9);
  });
});

describe('loan totals', () => {
  const entries = [
    {
      market: market('aave', 'evm--1', 'Aave Core Instance'),
      reserves: reserves({
        borrow: [],
        borrowed: [
          { symbol: 'USDC', fiatValue: '365', apy: '10%' },
          { symbol: 'ETH', fiatValue: '730', apy: '2.5' },
        ],
      }),
    },
    { market: market('kamino', 'sol--101', 'Kamino Main Market') },
  ];

  it('sums what every loan owes', () => {
    expect(sumBorrowedFiat(entries).toNumber()).toBe(1095);
  });

  it('estimates a day of interest at the borrow APYs', () => {
    expect(estimateBorrowInterest24h(entries)).toBeCloseTo(0.15, 10);
  });

  it('is zero without loans', () => {
    expect(sumBorrowedFiat([]).toNumber()).toBe(0);
    expect(estimateBorrowInterest24h([])).toBe(0);
  });

  it('nets the loans out of net worth', () => {
    expect(
      computeNetWorth({
        depositsFiatValue: '135.6',
        lendingTotal: 10.9,
        borrowedTotal: sumBorrowedFiat(entries),
      }),
    ).toBe('-948.5');
    expect(
      computeNetWorth({
        depositsFiatValue: undefined,
        lendingTotal: 0,
        borrowedTotal: sumBorrowedFiat([]),
      }),
    ).toBe('0');
  });
});

describe('deriveLendingSupply', () => {
  const core = market('aave', 'evm--1', 'Aave Core Instance');
  const kamino = market('kamino', 'sol--101', 'Kamino Main Market');
  const entries = [
    {
      market: core,
      reserves: reserves({
        borrow: [],
        supplied: [
          { symbol: 'cbBTC', fiatValue: '3.00' },
          { symbol: 'USDC', fiatValue: '2.90', apy: '3.65' },
        ],
      }),
    },
    {
      market: kamino,
      reserves: reserves({
        borrow: [],
        supplied: [
          { symbol: 'USDC', fiatValue: '5' },
          { symbol: 'SOL', fiatValue: '4', apy: '7.3' },
        ],
      }),
    },
  ];

  it('sums supply per market and keys it by reserve', () => {
    const result = deriveLendingSupply({ entries, investments: [] });
    expect(result.lendingTotal).toBeCloseTo(14.9);
    expect(result.lendingSupplies.map((item) => item.name)).toEqual([
      'Aave',
      'Kamino',
    ]);
    expect(
      result.supplied.get(`aave:evm--1:${core.marketAddress}:supply-usdc`),
    ).toBe(2.9);
  });

  it("splits a market's supply net of what it borrows there", () => {
    const withLoan = [
      {
        market: core,
        reserves: {
          ...reserves({
            borrow: [],
            supplied: [{ symbol: 'ETH', fiatValue: '2.84' }],
          }),
          borrowed: {
            assets: [{ borrowedAmount: { fiatValue: '1.49' } }],
          },
        } as unknown as IBorrowReserveItem,
      },
    ];
    const [aave] = deriveLendingSupply({
      entries: withLoan,
      investments: [],
    }).lendingSupplies;
    // Net Worth subtracts the loan apart; the split shows what is left
    expect(aave.fiatValue).toBeCloseTo(2.84);
    expect(aave.netValue).toBeCloseTo(1.35);
  });

  it('estimates a day of what the supply earns', () => {
    const result = deriveLendingSupply({ entries, investments: [] });
    // 2.90 at 3.65% and 4 at 7.3%, for a day
    expect(result.interest24h).toBeCloseTo(
      (2.9 * 0.0365 + 4 * 0.073) / 365,
      10,
    );
  });

  it('skips only the token the Earn portfolio already reports', () => {
    // Kamino USDC has a staking config, so the portfolio holds it; the SOL
    // supplied in the same market still counts, as its loans would
    const result = deriveLendingSupply({
      entries,
      investments: [
        mergedInvestment('kamino', [
          { symbol: 'USDC', fiatValue: '5', networkId: 'sol--101' },
        ]),
      ],
    });
    expect(
      result.lendingSupplies.map((item) => [item.name, item.fiatValue]),
    ).toEqual([
      ['Aave', 5.9],
      ['Kamino', 4],
    ]);
    expect(result.lendingTotal).toBeCloseTo(9.9);
    expect(
      result.supplied.has(
        `kamino:sol--101:${kamino.marketAddress}:supply-usdc`,
      ),
    ).toBe(false);
  });
});

describe('collectTileRows', () => {
  // Shaped like the test account's live rows (20 Oct): principal ready to
  // claim under rewardAssets, pending rewards under assetsStatus, classified
  // airdrop rows, and Lista's unclassified Check row
  const claim = (type = 'claim') => ({
    type,
    disabled: false,
    text: { text: 'Claim' },
  });
  const meta = (code: string, networkId = 'evm--56') => ({
    protocol: { providerDetail: { code, name: code, logoURI: '' } },
    network: { networkId, name: '', logoURI: '' },
  });
  const portfolioAsset = (
    code: string,
    symbol: string,
    rewardAssets: object[],
    assetsStatus: object[],
  ) => ({
    token: { info: { symbol, logoURI: `${symbol}.png` } },
    rewardAssets,
    assetsStatus,
    metadata: meta(code),
  });
  const airdrop = (code: string, symbol: string, rows: object[]) => ({
    token: { info: { symbol, logoURI: `${symbol}.png` } },
    airdropAssets: rows,
    metadata: meta(code),
  });
  const investments = [
    {
      assets: [
        portfolioAsset(
          'bitway',
          'USDT',
          [
            {
              kind: 'claimablePrincipal',
              amount: '2',
              fiatValue: '2.00',
              title: { text: '2 USDT' },
              button: claim('claimOrder'),
            },
          ],
          [
            {
              kind: 'active',
              amount: '56.61',
              fiatValue: '56.57',
              title: { text: '' },
            },
            {
              kind: 'pendingReward',
              amount: '0.0954',
              fiatValue: '0.0953',
              title: { text: '' },
            },
          ],
        ),
        portfolioAsset(
          'bitway',
          'U',
          [
            {
              kind: 'claimablePrincipal',
              amount: '3.0079',
              fiatValue: '3.01',
              title: { text: '' },
              button: claim('claimOrder'),
            },
          ],
          [
            {
              kind: 'unstaking',
              amount: '1',
              fiatValue: '1.00',
              title: { text: '' },
            },
            {
              kind: 'pendingReward',
              amount: '0.002116',
              fiatValue: '0.0021',
              title: { text: '' },
            },
          ],
        ),
      ],
      airdropAssets: [],
    },
    {
      assets: [],
      airdropAssets: [
        airdrop('morpho', 'KAT', [
          {
            kind: 'reward',
            amount: '17.07',
            fiatValue: '0.069',
            title: { text: '' },
            button: claim('claimAirdrop'),
          },
          {
            kind: 'pendingReward',
            amount: '0.0779',
            fiatValue: '0.0003',
            title: { text: '' },
          },
        ]),
        airdrop('pendle', 'USDe', [
          {
            kind: 'claimablePrincipal',
            amount: '0.2502',
            fiatValue: '0.25',
            title: { text: '' },
            button: claim(),
          },
        ]),
        airdrop('lista', 'LISTA', [
          {
            key: 'listaTokenReward',
            title: { text: '0 LISTA' },
            button: {
              type: 'listaCheck',
              disabled: false,
              text: { text: 'Check' },
            },
          },
          {
            key: 'listaTokenReward',
            kind: 'pendingReward',
            amount: '0',
            fiatValue: '0',
            title: { text: '0 LISTA' },
          },
        ]),
      ],
    },
  ] as unknown as IEarnPortfolioInvestment[];

  it('files every row by its kind', () => {
    const { rewards, withdrawals } = collectTileRows(investments);
    expect(
      rewards.rows.map((row) => [row.symbol, row.amount, row.isPending]),
    ).toEqual([
      ['KAT', '17.07', false],
      ['USDT', '0.0954', true],
      ['U', '0.002116', true],
      ['KAT', '0.0779', true],
    ]);
    expect(rewards.totalFiatValue).toBeCloseTo(0.1667);
    expect(withdrawals.rows.map((row) => [row.symbol, row.kind])).toEqual([
      ['U', 'claimablePrincipal'],
      ['USDT', 'claimablePrincipal'],
      ['USDe', 'claimablePrincipal'],
      ['U', 'unstaking'],
    ]);
    expect(withdrawals.totalFiatValue).toBeCloseTo(6.26);
  });

  it('keeps the claim on claimable rows only', () => {
    const { rewards, withdrawals } = collectTileRows(investments);
    expect(rewards.rows[0].action?.source).toBe('airdrop');
    expect(rewards.rows[1].action).toBeUndefined();
    expect(withdrawals.rows[0].action?.source).toBe('asset');
    expect(withdrawals.rows[3].action).toBeUndefined();
  });
});

const protocol = (
  provider: string,
  networkId: string,
  apr: string,
  extra: Partial<IStakeProtocolListItem> = {},
) =>
  ({
    provider: {
      name: provider,
      vault: `${provider}-vault`,
      aprWithoutFee: apr,
    },
    network: { networkId, name: networkId, logoURI: '' },
    isEarning: false,
    ...extra,
  }) as unknown as IStakeProtocolListItem;
const lending = (provider: string, networkId: string, apy: string) =>
  ({
    key: `${provider}:${networkId}:usdc`,
    market: market(provider, networkId, provider),
    marketLabel: provider,
    reserveAddress: 'usdc',
    symbol: 'USDC',
    logoURI: '',
    apy,
  }) as IEarnDesktopLendingOffer;

describe('buildOfferRows', () => {
  const asset = (symbol: string, networkIds: string[]) =>
    ({
      symbol,
      name: symbol,
      logoURI: '',
      protocols: networkIds.map((networkId) => ({
        networkId,
        provider: 'x',
      })),
    }) as unknown as IEarnAvailableAsset;
  const withTvl = (
    item: IStakeProtocolListItem,
    tvl: string,
    extra: Record<string, unknown> = {},
  ) =>
    ({
      ...item,
      provider: { ...item.provider, tvl, ...extra },
    }) as unknown as IStakeProtocolListItem;

  it('makes a row per network with the TVL of the offers there', () => {
    const rows = buildOfferRows({
      assets: [asset('USDT', ['evm--1', 'evm--56'])],
      protocolsBySymbol: new Map([
        [
          'usdt',
          [
            withTvl(protocol('spark', 'evm--1', '6.07'), '$664.54M'),
            withTvl(protocol('morpho', 'evm--1', '2.12'), '$5.46M'),
            withTvl(protocol('bitway', 'evm--56', '7.5'), '$1.50M'),
          ],
        ],
      ]),
      lendingOffers: new Map(),
      isFixedRate: false,
    });
    expect(
      rows.map((row) => [row.networkId, row.offers[0].apr, row.tvl]),
    ).toEqual([
      ['evm--1', 6.07, 670_000_000],
      ['evm--56', 7.5, 1_500_000],
    ]);
  });

  it('counts withdraw-only protocols for neither rate nor TVL', () => {
    const [row] = buildOfferRows({
      assets: [asset('ETH', ['evm--1'])],
      protocolsBySymbol: new Map([
        [
          'eth',
          [
            withTvl(protocol('lido', 'evm--1', '2.9'), '$24.09B', {
              group: 'withdrawOnly',
            }),
            withTvl(protocol('everstake', 'evm--1', '2.57'), '$1.26B'),
          ],
        ],
      ]),
      lendingOffers: new Map(),
      isFixedRate: false,
    });
    expect([row.offers[0].apr, row.tvl]).toEqual([2.57, 1_260_000_000]);
  });

  it('keeps fixed-rate offers for Fixed Income alone', () => {
    const protocols = new Map([
      [
        'usde',
        [
          withTvl(protocol('ethena', 'evm--1', '4.28'), '$1.52M'),
          withTvl(protocol('pendle', 'evm--1', '9.1'), '$40.00M'),
        ],
      ],
    ]);
    const rate = (isFixedRate: boolean) =>
      buildOfferRows({
        assets: [asset('USDe', ['evm--1'])],
        protocolsBySymbol: protocols,
        lendingOffers: new Map(),
        isFixedRate,
      }).map((row) => row.offers.map((offer) => offer.apr));
    expect(rate(false)).toEqual([[4.28]]);
    expect(rate(true)).toEqual([[9.1]]);
  });

  it('adds lending rates but not their reserves to the TVL', () => {
    const [row] = buildOfferRows({
      assets: [asset('USDC', ['evm--1'])],
      protocolsBySymbol: new Map([
        ['usdc', [withTvl(protocol('spark', 'evm--1', '3.1'), '$300.00M')]],
      ]),
      lendingOffers: new Map([
        ['usdc', [{ ...lending('aave', 'evm--1', '3.87'), tvlText: '$3.00B' }]],
      ]),
      isFixedRate: false,
    });
    expect([row.offers[0].kind, row.offers[0].apr, row.tvl]).toEqual([
      'lending',
      3.87,
      300_000_000,
    ]);
  });
});

describe('collectNetworkOffers', () => {
  const redeemOnly = { aprInfo: { button: { type: 'redeem' } } };

  it('lists the offers on the given network, the best rate first', () => {
    // USDC on Ethereum, as the 10-21 test wallet holds it
    const offers = collectNetworkOffers({
      networkId: 'evm--1',
      protocols: [
        protocol('morpho', 'evm--1', '3.82'),
        protocol('morpho', 'evm--8453', '6.3'),
        protocol('spark', 'evm--1', '5.42'),
      ],
      lendingOffers: [
        lending('aave', 'evm--42161', '2.37'),
        lending('aave', 'evm--1', '3.85'),
      ],
    });
    expect(offers.map((offer) => [offer.kind, offer.key, offer.apr])).toEqual([
      ['protocol', 'evm--1-spark-spark-vault', 5.42],
      ['lending', 'aave:evm--1:usdc', 3.85],
      ['protocol', 'evm--1-morpho-morpho-vault', 3.82],
    ]);
  });

  it('leaves out redeem-only offers and rates of 0 or below', () => {
    const offers = collectNetworkOffers({
      networkId: 'evm--1',
      protocols: [
        protocol('spark', 'evm--1', '5.42'),
        protocol('morpho', 'evm--1', '6.1', redeemOnly),
        protocol('bitway', 'evm--1', '0'),
        protocol('falcon', 'evm--1', '-0.4'),
      ],
      lendingOffers: [lending('aave', 'evm--1', '0.00')],
    });
    expect(offers.map((offer) => offer.key)).toEqual([
      'evm--1-spark-spark-vault',
    ]);
  });

  it('lists a lending market the protocol list carries only once', () => {
    // Kamino USDC has a staking config, so the list carries the market
    expect(
      collectNetworkOffers({
        networkId: 'sol--101',
        protocols: [protocol('Kamino', 'sol--101', '4.58')],
        lendingOffers: [lending('kamino', 'sol--101', '6.10')],
      }).map((offer) => [offer.kind, offer.apr]),
    ).toEqual([['protocol', 4.58]]);
    // normalizeToEarnProvider reads the list's "staked" as Lista
    expect(
      collectNetworkOffers({
        networkId: 'evm--56',
        protocols: [protocol('staked', 'evm--56', '2.1')],
        lendingOffers: [lending('lista', 'evm--56', '3.4')],
      }).map((offer) => offer.kind),
    ).toEqual(['protocol']);
  });

  it('keeps a lending market whose protocol entry is left out', () => {
    const kamino = lending('kamino', 'sol--101', '6.10');
    expect(
      collectNetworkOffers({
        networkId: 'sol--101',
        protocols: [protocol('kamino', 'sol--101', '0')],
        lendingOffers: [kamino],
      }).map((offer) => [offer.kind, offer.apr]),
    ).toEqual([['lending', 6.1]]);
    expect(
      collectNetworkOffers({
        networkId: 'sol--101',
        protocols: [protocol('kamino', 'sol--101', '4.58', redeemOnly)],
        lendingOffers: [kamino],
      }).map((offer) => [offer.kind, offer.apr]),
    ).toEqual([['lending', 6.1]]);
    // The same provider on another network doesn't hide it either
    expect(
      collectNetworkOffers({
        networkId: 'evm--1',
        protocols: [protocol('aave', 'evm--42161', '2.9')],
        lendingOffers: [lending('aave', 'evm--1', '3.85')],
      }).map((offer) => [offer.kind, offer.apr]),
    ).toEqual([['lending', 3.85]]);
  });

  it.each([
    ['Pendle', undefined, true],
    ['Pendle', null, true],
    ['pendle', 'simpleEarn', false],
    ['Pendle', 'staking', true],
    ['Falcon', ' fixedRate ', true],
    ['Ethena', undefined, false],
  ] as const)(
    'reads %s with category %p as fixed rate: %p',
    (provider, category, isFixedRate) => {
      const item = protocol(provider, 'evm--1', '7.85');
      const [offer] = collectNetworkOffers({
        networkId: 'evm--1',
        protocols: [{ ...item, provider: { ...item.provider, category } }],
        lendingOffers: [],
      });
      expect(offer.isFixedRate).toBe(isFixedRate);
    },
  );

  it('keys each offer by where it deposits', () => {
    // USDe on Ethereum: a Pendle market, an offer without a vault, and Aave
    const core = market('aave', 'evm--1', 'Aave Core Instance');
    const ethena = protocol('ethena', 'evm--1', '4.8');
    const offers = collectNetworkOffers({
      networkId: 'evm--1',
      protocols: [
        protocol('pendle', 'evm--1', '7.85'),
        { ...ethena, provider: { ...ethena.provider, vault: undefined } },
      ],
      lendingOffers:
        collectLendingOffers({
          markets: [
            {
              market: core,
              reserves: reserves({
                borrow: [],
                supply: [{ symbol: 'USDe', apy: '2.9', canBeCollateral: true }],
              }),
            },
          ],
        }).get('usde') ?? [],
    });
    expect(offers.map((offer) => [offer.key, offer.isFixedRate])).toEqual([
      ['evm--1-pendle-pendle-vault', true],
      ['evm--1-ethena-', false],
      [`aave:evm--1:${core.marketAddress}:supply-USDe`, false],
    ]);
  });
});

describe('buildHoldRows', () => {
  const earnAsset = (symbol: string) =>
    ({
      symbol,
      name: symbol,
      logoURI: '',
      protocols: [],
    }) as unknown as IEarnAvailableAsset;

  // The 10-21 test wallet: USDC on Arbitrum, Ethereum and Avalanche
  const usdcGroups: IEarnDesktopWalletNetworkGroup[] = [
    {
      accountId: 'a',
      networkId: 'evm--1',
      tokens: [walletToken('USDC', 'eth_usdc', { logoURI: 'eth.png' })],
      map: { eth_usdc: walletFiat('4.025784', '4.02') },
    },
    {
      accountId: 'b',
      networkId: 'evm--42161',
      tokens: [walletToken('USDC', 'arb_usdc', { logoURI: 'arb.png' })],
      map: { arb_usdc: walletFiat('355.739591', '355.53') },
    },
    {
      accountId: 'c',
      networkId: 'evm--43114',
      tokens: [walletToken('USDC', 'avax_usdc')],
      map: { avax_usdc: walletFiat('105.4', '105.34') },
    },
  ];
  const usdcProtocols = new Map([
    [
      'usdc',
      [
        protocol('spark', 'evm--1', '5.42'),
        protocol('morpho', 'evm--1', '3.82'),
        protocol('kamino', 'sol--101', '6.1'),
      ],
    ],
  ]);
  const usdcLending = new Map([
    [
      'usdc',
      [
        lending('aave', 'evm--42161', '2.37'),
        lending('aave', 'evm--1', '3.85'),
      ],
    ],
  ]);

  it('lists a token once, added up over the networks it sits on', () => {
    const rows = buildHoldRows({
      groups: usdcGroups,
      assets: [earnAsset('USDC')],
      protocolsBySymbol: usdcProtocols,
      lendingOffers: usdcLending,
    });
    expect(rows).toHaveLength(1);
    const [usdc] = rows;
    expect(usdc.key).toBe('usdc');
    // Avalanche pays nothing but its USDC counts: Earn bridges it
    expect(usdc.amount).toBe('465.165375');
    expect(usdc.fiatValueUsd).toBe('464.89');
    // The networks it sits on, the most valuable first
    expect(usdc.networkIds).toEqual(['evm--42161', 'evm--43114', 'evm--1']);
    // The token as listed where the wallet holds the most of it
    expect(usdc.token.logoURI).toBe('arb.png');
    // Every network's offers, the best rate first
    expect(usdc.offers.map((offer) => offer.apr)).toEqual([
      6.1, 5.42, 3.85, 3.82, 2.37,
    ]);
    expect(getHoldRowTarget(usdc)).toEqual({
      networkId: 'sol--101',
      provider: 'kamino',
      offerKey: 'sol--101-kamino-kamino-vault',
    });
  });

  it('counts only the offers on networks the wallet has an account on', () => {
    // An EVM address has no Solana account to deposit Kamino's USDC from
    const [usdc] = buildHoldRows({
      groups: usdcGroups,
      assets: [earnAsset('USDC')],
      protocolsBySymbol: usdcProtocols,
      lendingOffers: usdcLending,
      accountNetworkIds: ['evm--1', 'evm--42161', 'evm--43114'],
    });
    expect(usdc.offers.map((offer) => offer.apr)).toEqual([
      5.42, 3.85, 3.82, 2.37,
    ]);
    expect(getHoldRowTarget(usdc)).toEqual({
      networkId: 'evm--1',
      provider: 'spark',
      offerKey: 'evm--1-spark-spark-vault',
    });
    // A lending market's protocol is the market's own
    const [onArbitrum] = buildHoldRows({
      groups: usdcGroups,
      assets: [earnAsset('USDC')],
      protocolsBySymbol: usdcProtocols,
      lendingOffers: usdcLending,
      accountNetworkIds: ['evm--42161'],
    });
    expect(getHoldRowTarget(onArbitrum)).toEqual({
      networkId: 'evm--42161',
      provider: 'aave',
      offerKey: 'aave:evm--42161:usdc',
    });
  });

  it('leaves out a token Earn offers nowhere the wallet can take it', () => {
    const rows = buildHoldRows({
      groups: [
        {
          accountId: 'a',
          networkId: 'evm--1',
          tokens: [
            walletToken('USDC', 'eth_usdc'),
            walletToken('PEPE', 'eth_pepe'),
            walletToken('USDT', 'eth_usdt'),
          ],
          map: {
            eth_usdc: walletFiat('10', '10'),
            eth_pepe: walletFiat('1000', '50'),
            eth_usdt: walletFiat('20', '20'),
          },
        },
      ],
      // PEPE isn't listed; USDT is, but pays only on Solana
      assets: [earnAsset('USDC'), earnAsset('USDT')],
      protocolsBySymbol: new Map([
        ['usdc', [protocol('spark', 'evm--8453', '4')]],
        ['usdt', [protocol('kamino', 'sol--101', '5')]],
      ]),
      lendingOffers: new Map(),
      accountNetworkIds: ['evm--1', 'evm--8453'],
    });
    // USDC pays on Base only, where the wallet holds none: it still counts
    expect(rows.map((row) => [row.token.symbol, row.networkIds])).toEqual([
      ['USDC', ['evm--1']],
    ]);
  });

  it('leads with the offer that needs no bridge when two pay the same', () => {
    const [usdc] = buildHoldRows({
      groups: usdcGroups,
      assets: [earnAsset('USDC')],
      protocolsBySymbol: new Map([
        [
          'usdc',
          [
            protocol('spark', 'evm--8453', '4'),
            protocol('spark', 'evm--1', '4'),
          ],
        ],
      ]),
      lendingOffers: new Map(),
    });
    expect(getHoldRowTarget(usdc).networkId).toBe('evm--1');
  });

  it('leaves out redeem-only and zero-rate offers, and a market listed twice', () => {
    const rows = buildHoldRows({
      groups: [
        {
          accountId: 'a',
          networkId: 'sol--101',
          tokens: [
            walletToken('USDC', 'sol_usdc'),
            walletToken('USDC', 'sol_position', { defiMarked: true }),
          ],
          map: {
            sol_usdc: walletFiat('10', '10'),
            sol_position: walletFiat('50', '50'),
          },
        },
      ],
      assets: [earnAsset('USDC')],
      protocolsBySymbol: new Map([
        [
          'usdc',
          [
            protocol('kamino', 'sol--101', '4.58'),
            protocol('jupiter', 'sol--101', '6.1', {
              aprInfo: { button: { type: 'redeem' } },
            }),
            protocol('drift', 'sol--101', '0'),
          ],
        ],
      ]),
      lendingOffers: new Map([
        ['usdc', [lending('kamino', 'sol--101', '6.10')]],
      ]),
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].fiatValueUsd).toBe('10');
    expect(rows[0].offers.map((offer) => [offer.kind, offer.apr])).toEqual([
      ['protocol', 4.58],
    ]);
  });
});

describe('ready to earn', () => {
  const earnAsset = (symbol: string) =>
    ({
      symbol,
      name: symbol,
      logoURI: '',
      protocols: [],
    }) as unknown as IEarnAvailableAsset;
  const rows = buildHoldRows({
    groups: [
      {
        accountId: 'a',
        networkId: 'evm--42161',
        tokens: [walletToken('USDC', 'arb_usdc')],
        map: { arb_usdc: walletFiat('300', '300') },
      },
      {
        accountId: 'a',
        networkId: 'evm--1',
        tokens: [
          walletToken('USDC', 'eth_usdc'),
          walletToken('USDT', 'eth_usdt'),
        ],
        map: {
          eth_usdc: walletFiat('100', '100'),
          eth_usdt: walletFiat('50', '50'),
        },
      },
      {
        accountId: 'a',
        networkId: 'evm--56',
        tokens: [walletToken('U', 'bsc_u')],
        map: { bsc_u: walletFiat('30', '30') },
      },
    ],
    assets: [earnAsset('USDC'), earnAsset('USDT'), earnAsset('U')],
    protocolsBySymbol: new Map([
      ['usdc', [protocol('spark', 'evm--1', '5')]],
      ['usdt', [protocol('spark', 'evm--1', '4')]],
      ['u', [protocol('lista', 'evm--56', '10')]],
    ]),
    lendingOffers: new Map([['usdc', [lending('aave', 'evm--42161', '2')]]]),
  });

  it('sums what the rows are worth and earn in a year at their rates', () => {
    // USDC on Arbitrum and Ethereum is one row, at the best rate anywhere
    expect(rows).toHaveLength(3);
    // 400 at 5%, 50 at 4% and 30 at 10%
    expect(sumHoldRows(rows)).toEqual({ valueUsd: 480, yearlyUsd: 25 });
    expect(sumHoldRows([])).toEqual({ valueUsd: 0, yearlyUsd: 0 });
  });

  it('splits by token across networks, the rest together', () => {
    const shares = buildHoldingShares({ rows, topCount: 2 });
    // USDC on Arbitrum and Ethereum is one share
    expect(shares.top.map((share) => [share.name, share.percent])).toEqual([
      ['USDC', 83],
      ['USDT', 10],
    ]);
    expect(shares.rest).toMatchObject({ count: 1, percent: 7 });
    expect(shares.total).toBe(480);
  });
});

describe('loan pairs', () => {
  const stable = new Set(['USDC', 'USDT', 'PYUSD']);

  it('groups tokens by the asset they stand for', () => {
    expect(
      ['WBTC', 'cbBTC', 'BTC.b', 'ETH', 'wstETH', 'JitoSOL', 'SOL', 'USDC'].map(
        (symbol) => getLoanAssetType(symbol, stable),
      ),
    ).toEqual(['btc', 'btc', 'btc', 'eth', 'eth', 'sol', 'sol', 'stable']);
    // Any USD token and the stable tokens the list may miss
    expect(getLoanAssetType('sUSDe', stable)).toBe('stable');
    expect(getLoanAssetType('GHO', stable)).toBe('stable');
    expect(getLoanAssetType('LINK', stable)).toBe('other');
  });

  it('works out Net APY over what the position is worth after the loan', () => {
    // Half the collateral borrowed: 2 x supply less borrow
    expect(getLoanNetApy({ supplyApy: 1.3, borrowApy: 4.59 })).toBeCloseTo(
      -1.99,
    );
    expect(getLoanNetApy({ supplyApy: 0, borrowApy: 3.21 })).toBeCloseTo(-3.21);
    // Aave's own figure for 100 supplied at 10% and 60 borrowed at 8%
    expect(
      getLoanNetApy({ supplyApy: 10, borrowApy: 8, ltv: 0.6 }),
    ).toBeCloseTo(13);
  });

  const aaveCore = {
    market: market('aave', 'evm--1', 'Aave Core Instance'),
    reserves: reserves({
      borrow: [
        { symbol: 'ETH', apy: '1.95', total: '$4.18B' },
        { symbol: 'USDC', apy: '4.59', total: '$2.24B' },
        { symbol: 'GHO', apy: '4.6', total: '$300M', canBeBorrowed: false },
      ],
      supply: [
        {
          symbol: 'ETH',
          apy: '1.3',
          canBeCollateral: true,
          liquidationLtv: '83',
        },
        {
          symbol: 'WETH',
          apy: '1.3',
          canBeCollateral: true,
          liquidationLtv: '83',
        },
        {
          symbol: 'WBTC',
          apy: '0',
          canBeCollateral: true,
          liquidationLtv: '78',
        },
        {
          symbol: 'cbBTC',
          apy: '0',
          canBeCollateral: true,
          liquidationLtv: '73',
        },
        {
          symbol: 'USDC',
          apy: '3.87',
          canBeCollateral: true,
          liquidationLtv: '78',
        },
        {
          symbol: 'syrupUSDT',
          apy: '4',
          canBeCollateral: true,
          liquidationLtv: '10',
        },
        {
          symbol: 'sUSDe',
          apy: '0',
          canBeCollateral: false,
          liquidationLtv: '75',
        },
      ],
    }),
  };

  it('pairs each collateral with each asset the market lends', () => {
    const pairs = buildLoanPairs({
      markets: [aaveCore],
      stableSymbols: stable,
    });
    expect(
      pairs.map((pair) => [
        pair.collateral.symbol,
        pair.moreCollateral.map((item) => item.symbol),
        pair.borrow.symbol,
        Number(pair.netApy.toFixed(2)),
      ]),
    ).toEqual([
      // WETH is ETH's twin, GHO can't be borrowed, sUSDe isn't collateral,
      // syrupUSDT can't back half its value, and ETH never borrows ETH
      ['WBTC', ['cbBTC'], 'ETH', -1.95],
      ['USDC', [], 'ETH', 5.79],
      ['ETH', [], 'USDC', -1.99],
      ['WBTC', ['cbBTC'], 'USDC', -4.59],
    ]);
    expect(pairs[0].marketLabel).toBe('Aave Core');
    expect(pairs[0].collateral.type).toBe('btc');
    expect(pairs[0].borrow.type).toBe('eth');
  });

  it('counts a loan at its borrow factor against the limit', () => {
    const kamino = {
      market: market('kamino', 'sol--101', 'Kamino Main Market'),
      reserves: reserves({
        borrow: [
          { symbol: 'SOL', apy: '5.42', total: '$90M', borrowFactor: '1.25' },
          { symbol: 'USDC', apy: '5.89', total: '$120M', borrowFactor: '1' },
        ],
        supply: [
          {
            symbol: 'JitoSOL',
            apy: '0',
            canBeCollateral: true,
            liquidationLtv: '0.65',
          },
        ],
      }),
    };
    // 50% x 1.25 is too close to a 65% limit; 50% of USDC is not
    expect(
      buildLoanPairs({ markets: [kamino], stableSymbols: stable }).map(
        (pair) => pair.borrow.symbol,
      ),
    ).toEqual(['USDC']);
  });

  it('skips a market whose reserves never arrived', () => {
    expect(
      buildLoanPairs({
        markets: [{ market: market('kamino', 'sol--101', 'Kamino') }],
        stableSymbols: stable,
      }),
    ).toEqual([]);
  });

  it('sorts each rate with its better end first', () => {
    const pairs = buildLoanPairs({
      markets: [aaveCore],
      stableSymbols: stable,
    });
    const order = (sort: 'net' | 'supply' | 'borrow', dir?: 'asc' | 'desc') =>
      sortLoanPairs(pairs, sort, dir).map(
        (pair) => `${pair.collateral.symbol}>${pair.borrow.symbol}`,
      );
    expect(order('net')).toEqual([
      'USDC>ETH',
      'WBTC>ETH',
      'ETH>USDC',
      'WBTC>USDC',
    ]);
    // The cheapest loan first, ties by Net APY
    expect(order('borrow')).toEqual([
      'USDC>ETH',
      'WBTC>ETH',
      'ETH>USDC',
      'WBTC>USDC',
    ]);
    expect(order('supply')).toEqual([
      'USDC>ETH',
      'ETH>USDC',
      'WBTC>ETH',
      'WBTC>USDC',
    ]);
    expect(order('net', 'asc')).toEqual([
      'WBTC>USDC',
      'ETH>USDC',
      'WBTC>ETH',
      'USDC>ETH',
    ]);
  });

  it('previews the pairs the Loans list starts on', () => {
    const pairs = buildLoanPairs({
      markets: [aaveCore],
      stableSymbols: stable,
    });
    const names = (list: typeof pairs) =>
      list.map((pair) => `${pair.collateral.symbol}>${pair.borrow.symbol}`);
    // A stable token to borrow, the best net APY first
    expect(names(pickLoanPreviewPairs(pairs, 3))).toEqual([
      'ETH>USDC',
      'WBTC>USDC',
    ]);
    expect(names(pickLoanPreviewPairs(pairs, 1))).toEqual(['ETH>USDC']);
  });
});

describe('an open token in the Earn table', () => {
  const withProvider = (
    item: IStakeProtocolListItem,
    fields: Record<string, unknown>,
  ) =>
    ({
      ...item,
      provider: { ...item.provider, ...fields },
    }) as unknown as IStakeProtocolListItem;
  // USDC as the 10-28 data lists it: two Morpho vaults on Base among them
  const usdcProtocols = [
    protocol('spark', 'evm--1', '5.19'),
    withProvider(protocol('morpho', 'evm--8453', '4.6327'), { vault: 'a' }),
    withProvider(protocol('morpho', 'evm--8453', '4.6297'), { vault: 'b' }),
    protocol('morpho', 'evm--1', '3.82'),
  ];
  const usdcLending = [
    lending('aave', 'evm--1', '3.85'),
    lending('aave', 'evm--42161', '2.37'),
  ];
  const usdcNetworks = ['evm--1', 'evm--8453', 'evm--42161'];

  it('lists the protocols of its kind and the markets the list lacks', () => {
    const offers = buildTokenOffers({
      protocols: [
        ...usdcProtocols,
        protocol('pendle', 'evm--1', '9.1'),
        protocol('Kamino', 'sol--101', '4.58'),
      ],
      lendingOffers: [...usdcLending, lending('kamino', 'sol--101', '6.10')],
      isFixedRate: false,
    });
    expect(offers.map((offer) => [offer.kind, offer.key, offer.apr])).toEqual([
      ['protocol', 'evm--1-spark-spark-vault', 5.19],
      ['protocol', 'evm--8453-morpho-a', 4.6327],
      ['protocol', 'evm--8453-morpho-b', 4.6297],
      ['protocol', 'evm--1-morpho-morpho-vault', 3.82],
      ['protocol', 'sol--101-Kamino-Kamino-vault', 4.58],
      ['lending', 'aave:evm--1:usdc', 3.85],
      ['lending', 'aave:evm--42161:usdc', 2.37],
    ]);
  });

  it('keeps to the picked networks', () => {
    const keys = (networkIds: string[]) =>
      buildTokenOffers({
        protocols: usdcProtocols,
        lendingOffers: usdcLending,
        isFixedRate: false,
        networkIds,
      }).map((offer) => offer.key);
    expect(keys(['evm--8453'])).toEqual([
      'evm--8453-morpho-a',
      'evm--8453-morpho-b',
    ]);
    expect(keys(['evm--42161'])).toEqual(['aave:evm--42161:usdc']);
    expect(keys([])).toHaveLength(6);
  });

  it('lists no lending markets for a fixed-rate token', () => {
    expect(
      buildTokenOffers({
        protocols: [protocol('pendle', 'evm--1', '9.1')],
        lendingOffers: usdcLending,
        isFixedRate: true,
      }).map((offer) => offer.kind),
    ).toEqual(['protocol']);
  });

  it('shows a filtered row the rates and networks of its offers there', () => {
    const view = (pickedNetworkIds: string[]) =>
      buildNetworkView({
        protocols: usdcProtocols,
        lendingOffers: usdcLending,
        isFixedRate: false,
        rowNetworkIds: usdcNetworks,
        pickedNetworkIds,
      });
    expect(view(['evm--8453'])).toEqual({
      networkIds: ['evm--8453'],
      aprRange: { min: 4.6297, max: 4.6327 },
    });
    // In the row's order, whatever order the networks were picked in
    expect(view(['evm--42161', 'evm--8453'])).toEqual({
      networkIds: ['evm--8453', 'evm--42161'],
      aprRange: { min: 2.37, max: 4.6327 },
    });
  });

  it('keeps a badge to the networks of the offers carrying it', () => {
    const bonus = { tag: 'Bonus', badgeType: 'success' };
    const own = { tag: 'New', badgeType: 'info' };
    const tags = (pickedNetworkIds: string[]) =>
      buildNetworkView({
        protocols: [
          withProvider(usdcProtocols[0], { badges: [bonus] }),
          ...usdcProtocols.slice(1),
        ],
        lendingOffers: usdcLending,
        isFixedRate: false,
        rowNetworkIds: usdcNetworks,
        pickedNetworkIds,
        badges: [bonus, own],
      }).badges?.map((badge) => badge.tag);
    // Spark's Bonus is on Ethereum; a badge no offer carries stays
    expect(tags(['evm--1'])).toEqual(['Bonus', 'New']);
    expect(tags(['evm--8453'])).toEqual(['New']);
    expect(tags(['evm--8453', 'evm--1'])).toEqual(['Bonus', 'New']);
  });

  it('colors a filtered rate as the offers there color theirs', () => {
    const green = '#1E8055';
    const color = (pickedNetworkIds: string[]) =>
      buildNetworkView({
        protocols: [
          protocol('spark', 'evm--1', '5.19', {
            aprInfo: { normal: { text: '5.19%', color: green } },
          } as unknown as Partial<IStakeProtocolListItem>),
          ...usdcProtocols.slice(1),
        ],
        lendingOffers: usdcLending,
        isFixedRate: false,
        rowNetworkIds: usdcNetworks,
        pickedNetworkIds,
      }).aprColor;
    // Spark's green is on Ethereum; Base's Morpho rates have no color
    expect(color(['evm--1'])).toBe(green);
    expect(color(['evm--8453'])).toBeUndefined();
    expect(color(['evm--8453', 'evm--1'])).toBe(green);
  });

  it('counts no withdraw-only, redeem-only or zero-rate offer', () => {
    const view = buildNetworkView({
      protocols: [
        withProvider(protocol('lido', 'evm--1', '2.32'), {
          group: 'withdrawOnly',
        }),
        protocol('stakefish', 'evm--1', '2.52', {
          aprInfo: { button: { type: 'redeem' } },
        } as Partial<IStakeProtocolListItem>),
        protocol('everstake', 'evm--1', '0'),
      ],
      lendingOffers: [],
      isFixedRate: false,
      rowNetworkIds: ['evm--1'],
      pickedNetworkIds: ['evm--1'],
    });
    // Nothing there pays: the picked network still shows, without a rate
    expect(view).toEqual({ networkIds: ['evm--1'] });
  });

  it('keeps a fixed-rate row to its fixed-rate offers', () => {
    expect(
      buildNetworkView({
        protocols: [
          protocol('ethena', 'evm--1', '4.28'),
          protocol('pendle', 'evm--1', '9.1'),
        ],
        lendingOffers: [lending('aave', 'evm--1', '3.85')],
        isFixedRate: true,
        rowNetworkIds: ['evm--1'],
        pickedNetworkIds: ['evm--1'],
      }).aprRange,
    ).toEqual({ min: 9.1, max: 9.1 });
  });
});
