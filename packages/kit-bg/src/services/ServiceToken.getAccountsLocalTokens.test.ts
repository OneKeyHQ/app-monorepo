import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import ServiceToken from './ServiceToken';

import type { ISimpleDBLocalTokens } from '../dbs/simple/entity/SimpleDbEntityLocalTokens';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  backgroundMethod: () => (_t: unknown, _k: unknown, d: PropertyDescriptor) =>
    d,
  backgroundMethodForDev:
    () => (_t: unknown, _k: unknown, d: PropertyDescriptor) =>
      d,
  toastIfError: () => (_t: unknown, _k: unknown, d: PropertyDescriptor) => d,
  checkDevOnlyPassword: jest.fn(),
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

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {
    MemoryPressureWarning: 'MemoryPressureWarning',
  },
  appEventBus: {
    on: jest.fn(),
  },
}));

jest.mock('../states/jotai/atoms', () => ({
  settingsPersistAtom: {
    get: jest.fn(async () => ({ currencyInfo: { id: 'usd' } })),
  },
  currencyPersistAtom: {
    get: jest.fn(async () => ({ currencyMap: {} })),
  },
}));

jest.mock('../vaults/factory', () => ({
  vaultFactory: {
    getVault: jest.fn(),
  },
}));

jest.mock('../vaults/settings', () => ({
  getVaultSettings: jest.fn(),
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    token: {
      request: {
        fetchAccountTokenAccountAddressAndXpubBothEmpty: jest.fn(),
        fetchAccountTokensBlockedAllNetworkRequest: jest.fn(),
      },
    },
  },
}));

const emptySnapshot: ISimpleDBLocalTokens = {
  data: {},
  tokenList: {},
  smallBalanceTokenList: {},
  riskyTokenList: {},
  tokenListMap: {},
  tokenListValue: {},
};
const accounts = Array.from({ length: 22 }, (_, index) => ({
  accountId: `test-account-${index}`,
  networkId: `evm--${index}`,
  accountAddress: `test-address-${index}`,
  xpub: index === 1 ? 'test-xpub' : undefined,
}));

function setup(rawData: ISimpleDBLocalTokens | undefined = emptySnapshot) {
  const getRawData = jest.fn().mockResolvedValue(rawData);
  const service = new ServiceToken({
    backgroundApi: { simpleDb: { localTokens: { getRawData } } },
  });
  const local = jest
    .spyOn(service, 'getAccountLocalTokens')
    .mockImplementation(async (params) => ({
      tokenList: [],
      smallBalanceTokenList: [],
      riskyTokenList: [],
      tokenListMap: {},
      tokenListValue: '0',
      hasCache: false,
      currency: 'usd',
      accountId: params.accountId,
      networkId: params.networkId,
    }));
  return { service, local, getRawData };
}

describe('ServiceToken.getAccountsLocalTokens', () => {
  afterEach(() => jest.restoreAllMocks());

  it('reads one snapshot for 22 networks and preserves result order and xpub inputs', async () => {
    const { service, local, getRawData } = setup();
    const result = await service.getAccountsLocalTokens({ accounts });
    expect(getRawData).toHaveBeenCalledTimes(1);
    expect(local).toHaveBeenCalledTimes(22);
    expect(result.map((item) => item?.accountId)).toEqual(
      accounts.map((item) => item.accountId),
    );
    local.mock.calls.forEach(([params], index) => {
      expect(params).toEqual({
        ...accounts[index],
        simpleDbLocalTokensRawData: emptySnapshot,
      });
      expect(params.simpleDbLocalTokensRawData).toBe(emptySnapshot);
    });
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });

  it('uses a single empty snapshot when storage is missing', async () => {
    const { service, local, getRawData } = setup();
    getRawData.mockResolvedValue(undefined);
    await service.getAccountsLocalTokens({ accounts });
    const snapshot = local.mock.calls[0][0].simpleDbLocalTokensRawData;
    expect(snapshot).toEqual(emptySnapshot);
    expect(getRawData).toHaveBeenCalledTimes(1);
    local.mock.calls.forEach(([params]) =>
      expect(params.simpleDbLocalTokensRawData).toBe(snapshot),
    );
  });

  it('keeps successful networks when one cache read fails', async () => {
    const { service, local } = setup();
    local.mockRejectedValueOnce(new OneKeyLocalError('cache unavailable'));
    const result = await service.getAccountsLocalTokens({ accounts });
    expect(result[0]).toBeNull();
    expect(result.slice(1).map((item) => item?.accountId)).toEqual(
      accounts.slice(1).map((item) => item.accountId),
    );
  });

  it('does not read storage for an empty batch', async () => {
    const { service, local, getRawData } = setup();
    await expect(
      service.getAccountsLocalTokens({ accounts: [] }),
    ).resolves.toEqual([]);
    expect(getRawData).not.toHaveBeenCalled();
    expect(local).not.toHaveBeenCalled();
  });
});
