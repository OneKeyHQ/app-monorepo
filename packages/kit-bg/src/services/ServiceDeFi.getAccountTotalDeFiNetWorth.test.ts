/*
yarn test packages/kit-bg/src/services/ServiceDeFi.getAccountTotalDeFiNetWorth.test.ts
*/

import type { IDeFiProtocol } from '@onekeyhq/shared/types/defi';

// --- mocks MUST be defined before the import of ServiceDeFi below ---

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => () => undefined,
  backgroundMethod: () => (_t: unknown, _k: unknown, d: PropertyDescriptor) =>
    d,
  toastIfError: () => (_t: unknown, _k: unknown, d: PropertyDescriptor) => d,
}));

jest.mock('../states/jotai/atoms/currency', () => ({
  currencyPersistAtom: {
    get: async () => ({
      currencyMap: {
        usd: { id: 'usd', value: 1 },
        cny: { id: 'cny', value: 7.2 },
        eur: { id: 'eur', value: 0.9 },
      },
    }),
  },
}));

jest.mock('./ServiceBase', () => ({
  __esModule: true,
  default: class ServiceBase {
    backgroundApi: any;

    constructor({ backgroundApi }: { backgroundApi: any }) {
      this.backgroundApi = backgroundApi;
    }
  },
}));

jest.mock('@onekeyhq/shared/src/utils/accountUtils', () => ({
  __esModule: true,
  default: {
    isOthersAccount: ({ accountId }: { accountId: string }) =>
      accountId.startsWith('other--'),
    isAllNetwork: ({ networkId }: { networkId: string }) =>
      networkId === 'onekeyall--0',
    buildAccountLocalAssetsKey: ({
      accountAddress,
      xpub,
    }: {
      accountAddress?: string;
      xpub?: string;
    }) => `${accountAddress ?? ''}|${xpub ?? ''}`,
  },
}));

jest.mock('@onekeyhq/shared/src/utils/networkUtils', () => ({
  __esModule: true,
  default: {
    isAllNetwork: ({ networkId }: { networkId: string }) =>
      networkId === 'onekeyall--0',
  },
}));

// eslint-disable-next-line import/first
import ServiceDeFi, { buildVisibleDeFiOverview } from './ServiceDeFi';

describe('buildVisibleDeFiOverview', () => {
  test('excludes totals from protocols hidden by the low-value filter', () => {
    const overview = {
      totalValue: 0.01,
      totalDebt: 0,
      totalReward: 0.01,
      netWorth: 0.02,
      chains: ['polygon'],
      protocolCount: 1,
      positionCount: 1,
    };

    expect(
      buildVisibleDeFiOverview({
        overview,
        protocolMap: {},
        protocols: [],
      }),
    ).toEqual({
      totalValue: 0,
      totalDebt: 0,
      totalReward: 0,
      netWorth: 0,
      chains: [],
      protocolCount: 0,
      positionCount: 0,
    });
  });

  test('sums only retained protocol summaries', () => {
    const retainedProtocol = {
      protocol: 'aave-v3',
      networkId: 'evm--137',
    } as IDeFiProtocol;
    expect(
      buildVisibleDeFiOverview({
        overview: {
          totalValue: 11.01,
          totalDebt: 2,
          totalReward: 1.01,
          netWorth: 10.02,
          chains: ['polygon'],
          protocolCount: 2,
          positionCount: 2,
        },
        protocols: [retainedProtocol],
        protocolMap: {
          'evm--137-aave-v3': {
            protocol: 'aave-v3',
            protocolName: 'Aave V3',
            totalValue: 11,
            totalDebt: 2,
            totalReward: 1,
            netWorth: 10,
            networkIds: ['evm--137'],
            positionCount: 1,
            positionIndices: [],
            protocolLogo: '',
            protocolUrl: '',
          },
        },
      }),
    ).toEqual({
      totalValue: 11,
      totalDebt: 2,
      totalReward: 1,
      netWorth: 10,
      chains: ['polygon'],
      protocolCount: 1,
      positionCount: 1,
    });
  });
});

function makeService(overrides: {
  getRawData?: jest.Mock;
  getAccountsDeFiOverview?: jest.Mock;
  getAllNetworkAccounts?: jest.Mock;
}) {
  const backgroundApi = {
    simpleDb: {
      deFi: {
        getAccountsDeFiOverview: overrides.getAccountsDeFiOverview ?? jest.fn(),
        getRawData:
          overrides.getRawData ?? jest.fn().mockResolvedValue(undefined),
      },
    },
    serviceAllNetwork: {
      getAllNetworkAccounts:
        overrides.getAllNetworkAccounts ??
        jest.fn().mockResolvedValue({ accountsInfo: [] }),
    },
  };
  // The real ServiceDeFi constructor expects a fully typed IBackgroundApi;
  // we're intentionally only partially mocking it, so go through `unknown` to
  // keep the returned instance strongly typed for callers.
  const Ctor = ServiceDeFi as unknown as new (args: {
    backgroundApi: unknown;
  }) => ServiceDeFi;
  return new Ctor({ backgroundApi });
}

describe('getAccountTotalDeFiNetWorth', () => {
  test('empty cache (All-Networks) → { netWorth: "0", hasCache: false }', async () => {
    const svc = makeService({
      getAllNetworkAccounts: jest.fn().mockResolvedValue({
        accountsInfo: [
          { apiAddress: '0xabc', accountXpub: undefined, networkId: 'evm--1' },
        ],
      }),
      getRawData: jest.fn().mockResolvedValue({ overview: {} }),
    });

    const result = await svc.getAccountTotalDeFiNetWorth({
      accountId: 'hd-1--0',
      networkId: 'onekeyall--0',
      targetCurrency: 'usd',
    });

    expect(result).toEqual({
      hasCache: false,
      netWorth: '0',
      networkIds: [],
    });
  });

  test('single-network entry, same currency → returns raw netWorth', async () => {
    const svc = makeService({
      getAccountsDeFiOverview: jest.fn().mockResolvedValue([
        {
          accountAddress: '0xabc',
          overview: {
            'evm--1': {
              totalValue: 1000,
              totalDebt: 0,
              totalReward: 0,
              netWorth: 1000,
              currency: 'usd',
            },
          },
        },
      ]),
    });

    const result = await svc.getAccountTotalDeFiNetWorth({
      accountId: 'hd-1--0',
      networkId: 'evm--1',
      targetCurrency: 'usd',
    });

    expect(result).toEqual({
      hasCache: true,
      netWorth: '1000',
      networkIds: ['evm--1'],
    });
  });

  test('single-network entry, different currency (usd→cny) → converts', async () => {
    const svc = makeService({
      getAccountsDeFiOverview: jest.fn().mockResolvedValue([
        {
          accountAddress: '0xabc',
          overview: {
            'evm--1': {
              netWorth: 1000,
              currency: 'usd',
            },
          },
        },
      ]),
    });

    const result = await svc.getAccountTotalDeFiNetWorth({
      accountId: 'hd-1--0',
      networkId: 'evm--1',
      targetCurrency: 'cny',
    });

    expect(result).toEqual({
      hasCache: true,
      netWorth: '7200',
      networkIds: ['evm--1'],
    });
  });

  test('All-Networks: sums across multiple child addresses and networks', async () => {
    const svc = makeService({
      getAllNetworkAccounts: jest.fn().mockResolvedValue({
        accountsInfo: [
          { apiAddress: '0xabc', accountXpub: undefined, networkId: 'evm--1' },
          { apiAddress: '0xabc', accountXpub: undefined, networkId: 'evm--56' },
          { apiAddress: '0xdef', accountXpub: undefined, networkId: 'btc--0' },
        ],
      }),
      getRawData: jest.fn().mockResolvedValue({
        overview: {
          '0xabc|': {
            'evm--1': { netWorth: 500, currency: 'usd' },
            'evm--56': { netWorth: 200, currency: 'usd' },
          },
          '0xdef|': {
            'btc--0': { netWorth: 300, currency: 'usd' },
          },
        },
      }),
    });

    const result = await svc.getAccountTotalDeFiNetWorth({
      accountId: 'hd-1--0',
      networkId: 'onekeyall--0',
      targetCurrency: 'usd',
    });

    expect(result).toEqual({
      hasCache: true,
      netWorth: '1000',
      networkIds: ['btc--0', 'evm--1', 'evm--56'],
    });
  });

  test('All-Networks: filters DeFi net worth to enabled networks when provided', async () => {
    const svc = makeService({
      getAllNetworkAccounts: jest.fn().mockResolvedValue({
        accountsInfo: [
          { apiAddress: '0xabc', accountXpub: undefined, networkId: 'evm--1' },
          { apiAddress: '0xabc', accountXpub: undefined, networkId: 'evm--56' },
          { apiAddress: '0xdef', accountXpub: undefined, networkId: 'btc--0' },
        ],
      }),
      getRawData: jest.fn().mockResolvedValue({
        overview: {
          '0xabc|': {
            'evm--1': { netWorth: 500, currency: 'usd' },
            'evm--56': { netWorth: 200, currency: 'usd' },
          },
          '0xdef|': {
            'btc--0': { netWorth: 300, currency: 'usd' },
          },
        },
      }),
    });

    const result = await svc.getAccountTotalDeFiNetWorth({
      accountId: 'hd-1--0',
      networkId: 'onekeyall--0',
      targetCurrency: 'usd',
      enabledNetworkIds: ['evm--1', 'btc--0'],
    });

    expect(result).toEqual({
      hasCache: true,
      netWorth: '800',
      networkIds: ['btc--0', 'evm--1'],
    });
  });

  test('missing target currency → falls back to USD', async () => {
    const svc = makeService({
      getAccountsDeFiOverview: jest.fn().mockResolvedValue([
        {
          accountAddress: '0xabc',
          overview: {
            'evm--1': { netWorth: 1000, currency: 'usd' },
          },
        },
      ]),
    });

    const result = await svc.getAccountTotalDeFiNetWorth({
      accountId: 'hd-1--0',
      networkId: 'evm--1',
      targetCurrency: 'xxx-not-a-real-code',
    });

    expect(result).toEqual({
      hasCache: true,
      netWorth: '1000',
      networkIds: ['evm--1'],
    });
  });
});
