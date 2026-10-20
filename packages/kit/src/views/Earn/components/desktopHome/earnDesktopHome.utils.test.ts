import type {
  IBorrowMarketItem,
  IBorrowReserveItem,
  IEarnPortfolioInvestment,
} from '@onekeyhq/shared/types/staking';

import {
  buildBorrowOffers,
  buildMarketCard,
  buildProtocolShares,
  collectLendingOffers,
  collectTileRows,
  deriveLendingSupply,
  estimateBorrowInterest24h,
  parseCompactFiatText,
  pickTileOffers,
  sumBorrowedFiat,
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
  }[];
  supply?: {
    symbol: string;
    apy?: string;
    canBeCollateral: boolean;
    liquidationLtv?: string;
  }[];
  supplied?: { symbol: string; fiatValue: string }[];
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
    expect(shares.rest).toEqual({ count: 2, percent: 6 });
    expect(shares.total).toBe(100);
  });

  it('adds lending supply to its provider', () => {
    const shares = buildProtocolShares({
      investments: [investment('morpho', '10')],
      lendingSupplies: [
        { provider: 'aave', name: 'Aave', fiatValue: 30 },
        { provider: 'Morpho', name: 'Morpho', fiatValue: 10 },
      ],
    });
    expect(shares.top.map((item) => [item.key, item.value])).toEqual([
      ['aave', 30],
      ['morpho', 20],
    ]);
    expect(shares.rest).toBeUndefined();
  });

  it('is empty without deposits', () => {
    expect(buildProtocolShares({ investments: [] })).toEqual({
      top: [],
      total: 0,
    });
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

describe('buildBorrowOffers', () => {
  it('ranks assets across markets and picks the cheapest market', () => {
    const offers = buildBorrowOffers([
      {
        market: market('aave', 'evm--1', 'Aave Core Instance'),
        reserves: reserves({
          borrow: [
            { symbol: 'ETH', apy: '1.96', total: '$4.18B' },
            { symbol: 'USDC', apy: '4.59', total: '$2.24B' },
          ],
        }),
      },
      {
        market: market('aave', 'evm--42161', 'Aave Arbitrum Market'),
        reserves: reserves({
          borrow: [{ symbol: 'USDC', apy: '3.42', total: '$167.60M' }],
        }),
      },
    ]);
    expect(
      offers.map((offer) => [offer.symbol, offer.marketLabel, offer.apy]),
    ).toEqual([
      ['ETH', 'Aave Core', '1.96'],
      ['USDC', 'Aave Arbitrum', '3.42'],
    ]);
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
          { symbol: 'USDC', fiatValue: '2.90' },
        ],
      }),
    },
    {
      market: kamino,
      reserves: reserves({
        borrow: [],
        supplied: [{ symbol: 'USDC', fiatValue: '5' }],
      }),
    },
  ];

  it('sums supply per market and keys it by reserve', () => {
    const result = deriveLendingSupply({ entries, investments: [] });
    expect(result.lendingTotal).toBeCloseTo(10.9);
    expect(result.lendingSupplies.map((item) => item.name)).toEqual([
      'Aave',
      'Kamino',
    ]);
    expect(
      result.supplied.get(`aave:evm--1:${core.marketAddress}:supply-usdc`),
    ).toBe(2.9);
  });

  it('skips a market the Earn portfolio already reports', () => {
    const result = deriveLendingSupply({
      entries,
      investments: [investment('kamino', '5', 'sol--101')],
    });
    expect(result.lendingSupplies.map((item) => item.name)).toEqual(['Aave']);
    expect(result.lendingTotal).toBeCloseTo(5.9);
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
