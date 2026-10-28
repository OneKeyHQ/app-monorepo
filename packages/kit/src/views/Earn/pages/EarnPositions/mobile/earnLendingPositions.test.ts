import type { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IEarnPortfolioPositionsResponse } from '@onekeyhq/shared/types/earn/portfolioPositions';
import type {
  IBorrowHealthFactor,
  IBorrowMarketItem,
  IBorrowReserveItem,
} from '@onekeyhq/shared/types/staking';

import { withLendingMarketPositions } from './earnLendingPositions';
import { buildEarnPortfolioView, sumEarnDefiAssets } from './earnPositionModel';
import { position, token } from './earnPositionModel.fixtures';
import { findLoanMarketOf } from './myPortfolio.utils';

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
