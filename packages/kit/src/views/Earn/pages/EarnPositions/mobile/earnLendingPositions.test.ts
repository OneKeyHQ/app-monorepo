import type { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IEarnPortfolioPositionsResponse } from '@onekeyhq/shared/types/earn/portfolioPositions';
import type {
  IBorrowEModeStatus,
  IBorrowHealthFactor,
  IBorrowMarketItem,
  IBorrowReserveItem,
  IEarnRepayActionData,
  IEarnWithdrawActionData,
} from '@onekeyhq/shared/types/staking';

import {
  lendingSupplyPositionOf,
  withLendingMarketPositions,
} from './earnLendingPositions';
import {
  buildEarnPortfolioView,
  buildHoldingView,
  sumEarnDefiAssets,
} from './earnPositionModel';
import { position, token } from './earnPositionModel.fixtures';
import {
  findLendingMarketCardKey,
  findLoanMarketOf,
  holdingRowActionOf,
  lendingCollateralOf,
  lendingEModeLabelOf,
  lendingMarketOf,
} from './myPortfolio.utils';

import type {
  IEarnPositionSectionKind,
  IEarnPositionView,
} from './earnPositionModel';
import type { IEarnDesktopAccountMarket } from '../../../components/desktopHome/useEarnDesktopHomeData';

const AAVE_CORE: IBorrowMarketItem = {
  provider: 'aave',
  networkId: 'evm--1',
  name: 'Aave Core Market',
  logoURI: 'https://logo/aave.png',
  marketAddress: '0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2',
  network: {
    networkId: 'evm--1',
    name: 'Ethereum',
    logoURI: 'https://logo/eth-network.png',
  } as IBorrowMarketItem['network'],
};

const borrowToken = (symbol: string) => ({
  networkId: 'evm--1',
  address: `0x${symbol.toLowerCase()}`,
  name: symbol,
  symbol,
  decimals: 18,
  logoURI: `https://logo/${symbol}.png`,
});

const balance = (number: string, fiatValue: string) => ({
  number,
  fiatValue,
  title: { text: '' },
  description: { text: '' },
});

function reserves({
  supplied,
  borrowed = [],
}: {
  supplied: Array<[string, string, string]>;
  borrowed?: Array<[string, string, string]>;
}) {
  return {
    supplied: {
      assets: supplied.map(([symbol, number, fiat]) => ({
        reserveAddress: `0x${symbol.toLowerCase()}`,
        token: borrowToken(symbol),
        suppliedAmount: balance(number, fiat),
      })),
    },
    borrowed: {
      assets: borrowed.map(([symbol, number, fiat]) => ({
        reserveAddress: `0x${symbol.toLowerCase()}`,
        token: borrowToken(symbol),
        borrowedAmount: balance(number, fiat),
      })),
    },
  } as unknown as IBorrowReserveItem;
}

const HEALTH = {
  healthFactor: {
    text: { text: '1.59', color: '$textSuccess' },
    button: {
      type: 'healthFactorRiskDetail',
      disabled: false,
      text: { text: '' },
      data: {
        healthFactorDetail: {
          value: '1.59',
          valueColor: '$textSuccess',
          status: { tag: 'Healthy', badge: 'success' },
        },
      },
    },
  },
} as unknown as IBorrowHealthFactor;

const EMPTY: IEarnPortfolioPositionsResponse = {
  positions: {},
  protocolSummaries: [],
  errors: [],
};

const translate = (id: ETranslations) => id as string;

describe('withLendingMarketPositions', () => {
  const loan: IEarnDesktopAccountMarket = {
    market: AAVE_CORE,
    reserves: reserves({
      supplied: [
        ['ETH', '0.001214', '2.84'],
        ['DAI', '0.7527', '0.75'],
      ],
      borrowed: [['cbBTC', '0.00001847', '1.49']],
    }),
    healthFactor: HEALTH,
  };

  it("adds a market's supply and loan as one lending position", () => {
    const merged = withLendingMarketPositions({
      response: EMPTY,
      entries: [loan],
    });
    const [added] = merged.positions['evm--1'];
    expect(added.category).toBe('lending');
    expect(added.name).toBe('Aave Core');
    expect(added.protocolName).toBe('Aave');
    expect(added.assets.map((asset) => [asset.symbol, asset.value])).toEqual([
      ['ETH', 2.84],
      ['DAI', 0.75],
    ]);
    expect(added.debts.map((debt) => [debt.symbol, debt.value])).toEqual([
      ['cbBTC', 1.49],
    ]);
    expect(added.metrics.healthFactor).toBe(1.59);
    expect(added.earn.healthFactorDetail?.status.tag).toBe('Healthy');
    expect(added.earn.vault).toBe(AAVE_CORE.marketAddress);
  });

  it('totals as the home does: the API, plus the supply, less the loan', () => {
    const api: IEarnPortfolioPositionsResponse = {
      ...EMPTY,
      positions: {
        'evm--1': [
          position({
            networkId: 'evm--1',
            chain: 'evm',
            protocol: 'lido',
            protocolName: 'Lido',
            category: 'staked',
            groupId: 'lido:evm--1:steth',
            name: 'Lido staked ETH',
            assets: [token({ symbol: 'ETH', amount: '0.01', price: 1000 })],
          }),
        ],
      },
    };
    const { protocols } = buildEarnPortfolioView({
      response: withLendingMarketPositions({ response: api, entries: [loan] }),
      translate,
    });
    expect(sumEarnDefiAssets(protocols)).toBeCloseTo(10 + 2.84 + 0.75 - 1.49);
  });

  it('leaves out what the API reports already', () => {
    const api: IEarnPortfolioPositionsResponse = {
      ...EMPTY,
      positions: {
        'evm--1': [
          position({
            networkId: 'evm--1',
            chain: 'evm',
            protocol: 'aave',
            protocolName: 'Aave',
            category: 'lending',
            groupId: 'aave:evm--1:eth',
            name: 'Aave ETH',
            assets: [token({ symbol: 'ETH', amount: '0.001214', price: 2340 })],
            debts: [
              token({ symbol: 'cbBTC', amount: '0.00001847', price: 80_000 }),
            ],
          }),
        ],
      },
    };
    const merged = withLendingMarketPositions({
      response: api,
      entries: [loan],
    });
    const added = merged.positions['evm--1'][1];
    expect(added.assets.map((asset) => asset.symbol)).toEqual(['DAI']);
    expect(added.debts).toEqual([]);
    expect(added.earn.healthFactorDetail).toBeUndefined();
  });

  it('adds nothing for markets the account holds nothing in', () => {
    const merged = withLendingMarketPositions({
      response: EMPTY,
      entries: [
        { market: AAVE_CORE, reserves: reserves({ supplied: [] }) },
        { market: AAVE_CORE },
      ],
    });
    expect(merged).toBe(EMPTY);
  });

  it("opens the market's Borrow page, a supply alone included", () => {
    const supplyOnly: IEarnDesktopAccountMarket = {
      market: AAVE_CORE,
      reserves: reserves({ supplied: [['USDC', '5', '5']] }),
    };
    const { protocols } = buildEarnPortfolioView({
      response: withLendingMarketPositions({
        response: EMPTY,
        entries: [supplyOnly],
      }),
      translate,
    });
    const [card] = protocols.flatMap((protocol) => protocol.positions);
    expect(card.action).toBeDefined();
    expect(
      card.action ? findLoanMarketOf(protocols, card.action.target) : undefined,
    ).toEqual({
      provider: 'aave',
      networkId: 'evm--1',
      marketAddress: AAVE_CORE.marketAddress,
    });
  });
});

describe('lendingSupplyPositionOf', () => {
  // The account's Aave Core rows as the market reads them: ETH backs the
  // cbBTC loan, DAI is supplied with its collateral switch off
  const entry = (): IEarnDesktopAccountMarket => {
    const read = reserves({
      supplied: [
        ['ETH', '0.001214', '2.80'],
        ['DAI', '0.7527', '0.75'],
        ['ARB', '0.0000075', '0'],
      ],
      borrowed: [['cbBTC', '0.00001847', '1.47']],
    });
    read.supplied.assets[0].apyDetail = { apy: '1.32' };
    read.supplied.assets[0].usageAsCollateral = true;
    read.supplied.assets[1].usageAsCollateral = false;
    return { market: AAVE_CORE, reserves: read, healthFactor: HEALTH };
  };

  it("gives a supply that backs the market's loan the market's health factor", () => {
    const supply = lendingSupplyPositionOf({
      entry: entry(),
      reserveAddress: '0xETH',
    });
    expect(supply?.assets.map((asset) => [asset.symbol, asset.value])).toEqual([
      ['ETH', 2.8],
    ]);
    expect(supply?.debts).toEqual([]);
    expect(supply?.metrics.healthFactor).toBe(1.59);
    expect(supply?.groupId).toBe(
      'aave:evm--1:0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2:0xeth',
    );
    // A day at 1.32%: 2.80 * 0.0132 / 365
    expect(
      Number(supply?.earn.investment.earnings24hFiatValue).toFixed(6),
    ).toBe('0.000101');
  });

  it("leaves the health factor off a supply the market doesn't count as collateral", () => {
    const supply = lendingSupplyPositionOf({
      entry: entry(),
      reserveAddress: '0xdai',
    });
    expect(supply?.assets[0].symbol).toBe('DAI');
    expect(supply?.metrics.healthFactor).toBeNull();
  });

  it('keeps dust worth less than a cent, and has nothing where nothing is supplied', () => {
    expect(
      lendingSupplyPositionOf({ entry: entry(), reserveAddress: '0xarb' })
        ?.assets[0].symbol,
    ).toBe('ARB');
    expect(
      lendingSupplyPositionOf({ entry: entry(), reserveAddress: '0xusdc' }),
    ).toBeUndefined();
  });

  it('draws as a Supplied row with its way out where the page gives one', () => {
    const supply = lendingSupplyPositionOf({
      entry: entry(),
      reserveAddress: '0xeth',
    });
    const view = buildHoldingView({
      sources: supply ? [supply] : [],
      provider: 'aave',
      translate,
    });
    expect(view?.sections.map((section) => section.kind)).toEqual(['supplied']);
    expect(view?.meta?.healthFactor).toBe(1.59);
    const [row] = view?.sections[0].assets ?? [];
    expect(
      holdingRowActionOf({ kind: 'supplied', asset: row, redeemable: true }),
    ).toEqual({ kind: 'redeem' });
    expect(
      holdingRowActionOf({ kind: 'supplied', asset: row, redeemable: false }),
    ).toBeUndefined();
  });
});

describe("a market's rows read from the market (demo 11-03)", () => {
  const ACCOUNT_ID = "hd-1--m/44'/60'/0'/0/0";
  const INDEXED_ACCOUNT_ID = 'hd-1--0';
  const offButton = { disabled: true, text: { text: '' } };
  // The account's Aave Core rows: ETH backs the cbBTC loan, DAI is supplied
  // with its switch off, GHO the market never takes as collateral
  const entry = (): IEarnDesktopAccountMarket => {
    const read = reserves({
      supplied: [
        ['ETH', '0.001214', '2.84'],
        ['DAI', '0.7527', '0.75'],
        ['GHO', '1', '1'],
      ],
      borrowed: [['cbBTC', '0.00001847', '1.49']],
    });
    const [eth, dai, gho] = read.supplied.assets;
    eth.usageAsCollateral = true;
    eth.canBeCollateral = true;
    dai.usageAsCollateral = false;
    dai.canBeCollateral = true;
    gho.usageAsCollateral = false;
    gho.canBeCollateral = false;
    return {
      market: AAVE_CORE,
      accountId: ACCOUNT_ID,
      reserves: read,
      healthFactor: HEALTH,
    };
  };
  const viewOf = (
    entries: IEarnDesktopAccountMarket[],
    indexedAccountId?: string,
  ) =>
    buildEarnPortfolioView({
      response: withLendingMarketPositions({
        response: EMPTY,
        entries,
        indexedAccountId,
      }),
      translate,
    });
  const cardOf = (
    entries: IEarnDesktopAccountMarket[],
    indexedAccountId?: string,
  ): IEarnPositionView => {
    const [card] = viewOf(entries, indexedAccountId).protocols.flatMap(
      (protocol) => protocol.positions,
    );
    return card;
  };
  const rowsOf = (card: IEarnPositionView, kind: IEarnPositionSectionKind) =>
    card.sections.find((section) => section.kind === kind)?.assets ?? [];
  const actionOf = (
    card: IEarnPositionView,
    kind: IEarnPositionSectionKind,
    symbol: string,
  ) => {
    const asset = rowsOf(card, kind).find((row) => row.symbol === symbol);
    return asset
      ? holdingRowActionOf({ kind, asset, redeemable: false })
      : undefined;
  };

  it("carries each row's reserve and the account the market was read for", () => {
    const card = cardOf([entry()], INDEXED_ACCOUNT_ID);
    const read = (kind: IEarnPositionSectionKind) =>
      rowsOf(card, kind).map((row) => [
        row.symbol,
        row.lending?.side,
        row.lending?.reserve.reserveAddress,
      ]);
    expect(read('supplied')).toEqual([
      ['ETH', 'supplied', '0xeth'],
      ['DAI', 'supplied', '0xdai'],
      ['GHO', 'supplied', '0xgho'],
    ]);
    expect(read('borrowed')).toEqual([['cbBTC', 'borrowed', '0xcbbtc']]);
    expect(lendingMarketOf(card)).toEqual({
      market: AAVE_CORE,
      accountId: ACCOUNT_ID,
      indexedAccountId: INDEXED_ACCOUNT_ID,
    });
  });

  it('gives no market controls where the market was read without an account', () => {
    const { accountId: _accountId, ...withoutAccount } = entry();
    const card = cardOf([withoutAccount]);
    expect(
      card.sections.flatMap((section) =>
        section.assets.map((asset) => asset.lending),
      ),
    ).toEqual([undefined, undefined, undefined, undefined]);
    expect(lendingMarketOf(card)).toBeUndefined();
    expect(actionOf(card, 'supplied', 'ETH')).toBeUndefined();
    expect(actionOf(card, 'borrowed', 'cbBTC')).toBeUndefined();
  });

  it('withdraws a supply and repays a loan through the market', () => {
    const card = cardOf([entry()]);
    expect(actionOf(card, 'supplied', 'ETH')).toMatchObject({
      kind: 'lending',
      disabled: false,
      lending: { side: 'supplied', reserve: { reserveAddress: '0xeth' } },
    });
    expect(actionOf(card, 'borrowed', 'cbBTC')).toMatchObject({
      kind: 'lending',
      disabled: false,
      lending: { side: 'borrowed', reserve: { reserveAddress: '0xcbbtc' } },
    });
  });

  it('turns Withdraw and Repay off where the market page has them off', () => {
    const read = entry();
    const reserve = read.reserves as IBorrowReserveItem;
    reserve.supplied.assets[0].withdrawButton =
      offButton as unknown as IEarnWithdrawActionData;
    reserve.borrowed.assets[0].repayButton =
      offButton as unknown as IEarnRepayActionData;
    const card = cardOf([read]);
    expect(actionOf(card, 'supplied', 'ETH')).toMatchObject({
      kind: 'lending',
      disabled: true,
    });
    expect(actionOf(card, 'supplied', 'DAI')).toMatchObject({
      kind: 'lending',
      disabled: false,
    });
    expect(actionOf(card, 'borrowed', 'cbBTC')).toMatchObject({
      kind: 'lending',
      disabled: true,
    });
  });

  it("turns them off on Aave's own coin where its market has no gateway for it", () => {
    const onNetwork = (networkId: string) => {
      const read = entry();
      const market = { ...AAVE_CORE, networkId };
      const reserve = read.reserves as IBorrowReserveItem;
      // Aave lists a network's own coin without an address
      reserve.supplied.assets[0].reserveAddress = '';
      reserve.borrowed.assets[0].reserveAddress = '';
      return cardOf([{ ...read, market }]);
    };
    // Polygon has no gateway; Ethereum has one
    expect(actionOf(onNetwork('evm--137'), 'supplied', 'ETH')).toMatchObject({
      disabled: true,
    });
    expect(actionOf(onNetwork('evm--137'), 'borrowed', 'cbBTC')).toMatchObject({
      disabled: true,
    });
    expect(actionOf(onNetwork('evm--1'), 'supplied', 'ETH')).toMatchObject({
      disabled: false,
    });
  });

  it('hangs the collateral switch under a supply the market says counts or not, and the mark where it never can', () => {
    const card = cardOf([entry()]);
    const collateral = rowsOf(card, 'supplied').map((row) => [
      row.symbol,
      lendingCollateralOf(row)?.state,
    ]);
    expect(collateral).toEqual([
      ['ETH', 'switch'],
      ['DAI', 'switch'],
      ['GHO', 'unavailable'],
    ]);
    // A loan's row has none, and a market that doesn't say (Kamino) none
    expect(lendingCollateralOf(rowsOf(card, 'borrowed')[0])).toBeUndefined();
    const kamino = entry();
    (kamino.reserves as IBorrowReserveItem).supplied.assets.forEach((asset) => {
      delete asset.usageAsCollateral;
    });
    expect(
      rowsOf(cardOf([kamino]), 'supplied').map((row) =>
        lendingCollateralOf(row),
      ),
    ).toEqual([undefined, undefined, undefined]);
  });

  it("finds the card a Your loans card opens, by the market's key", () => {
    const { protocols } = viewOf([entry()]);
    expect(
      findLendingMarketCardKey(
        protocols,
        `aave:evm--1:${AAVE_CORE.marketAddress}`,
      ),
    ).toBe(protocols[0].key);
    expect(
      findLendingMarketCardKey(protocols, 'aave:evm--42161:0xother'),
    ).toBeUndefined();
  });
});

describe('lendingEModeLabelOf', () => {
  const status = (eModeId: number): IBorrowEModeStatus =>
    ({
      eModeId,
      originalLtv: '80',
      categories: [
        { eModeId: 1, label: 'ETH_correlated', ltv: '93', disabled: false },
        { eModeId: 2, label: 'Stablecoins', ltv: '90', disabled: false },
      ],
    }) as unknown as IBorrowEModeStatus;

  it('names the category on, or Off, as the market page does', () => {
    expect(lendingEModeLabelOf(status(0), 'Off')).toBe('Off');
    expect(lendingEModeLabelOf(status(1), 'Off')).toBe('ETH correlated');
    // A category the market no longer lists reads Off
    expect(lendingEModeLabelOf(status(9), 'Off')).toBe('Off');
  });

  it('has nothing where the market has no categories or nothing is read', () => {
    expect(
      lendingEModeLabelOf({ ...status(0), categories: [] }, 'Off'),
    ).toBeUndefined();
    expect(lendingEModeLabelOf(null, 'Off')).toBeUndefined();
    expect(lendingEModeLabelOf(undefined, 'Off')).toBeUndefined();
  });
});
