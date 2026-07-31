/*
yarn test packages/kit-bg/src/services/ServiceToken.fetchAccountTokens.test.ts

Regression guard for the /wallet/v1/account/token/list?flag=token-selector
40003 flood: a first-frame race in TokenSelector could call fetchAccountTokens
with the all-network mock networkId (`onekeyall--0`), which resolved
`AllNetworkMockAddress` as accountAddress and POSTed a request the wallet API
always rejects. All-network flows must fan out per real network BEFORE this
method; a direct all-network request must short-circuit to empty data without
reaching the vault/network layer.
*/

// --- jest.mock calls are hoisted above these imports by babel-jest ---

import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';

import { vaultFactory } from '../vaults/factory';

import ServiceToken from './ServiceToken';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => () => undefined,
  backgroundMethod: () => (_t: unknown, _k: unknown, d: PropertyDescriptor) =>
    d,
  toastIfError: () => (_t: unknown, _k: unknown, d: PropertyDescriptor) => d,
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

jest.mock('../states/jotai/atoms', () => ({
  settingsPersistAtom: {
    get: jest.fn().mockResolvedValue({ currencyInfo: { id: 'usd' } }),
  },
  currencyPersistAtom: {
    get: jest.fn().mockResolvedValue({}),
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

const getVaultMock = vaultFactory.getVault as unknown as jest.Mock;

function buildBackgroundApiStub() {
  return {
    serviceAccount: {
      getAccountXpub: jest.fn().mockResolvedValue(undefined),
      getAccountAddressForApi: jest.fn().mockResolvedValue('0xabc'),
      buildAccountXpubOrAddress: jest.fn().mockResolvedValue('0xabc'),
    },
    serviceCustomToken: {
      getCustomTokens: jest.fn().mockResolvedValue([]),
      getHiddenTokens: jest.fn().mockResolvedValue([]),
    },
    serviceToken: {
      getUnblockedTokens: jest.fn().mockResolvedValue([]),
      getBlockedTokens: jest.fn().mockResolvedValue([]),
      getAllAggregateTokenInfo: jest
        .fn()
        .mockResolvedValue({ allAggregateTokenMap: {} }),
    },
    serviceNetwork: {
      getVaultSettings: jest.fn().mockResolvedValue({}),
      getNetworkSafe: jest.fn().mockResolvedValue(undefined),
    },
  };
}

describe('ServiceToken.fetchAccountTokens all-network guard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('short-circuits an all-network networkId to empty data without touching the vault', async () => {
    const service = new ServiceToken({
      backgroundApi: buildBackgroundApiStub(),
    });
    // If the guard is missing the request would reach the vault layer.
    getVaultMock.mockRejectedValue(new Error('must not reach vault'));

    const resp = await service.fetchAccountTokens({
      accountId: 'hd-1--mock-all-network-account',
      networkId: getNetworkIdsMap().onekeyall,
      flag: 'token-selector',
    });

    expect(getVaultMock).not.toHaveBeenCalled();
    expect(resp.networkId).toBe(getNetworkIdsMap().onekeyall);
    expect(resp.tokens.data).toEqual([]);
    expect(resp.smallBalanceTokens.data).toEqual([]);
    expect(resp.riskTokens.data).toEqual([]);
  });

  it('lets real network ids pass through to the vault layer', async () => {
    const service = new ServiceToken({
      backgroundApi: buildBackgroundApiStub(),
    });
    const sentinel = new Error('vault reached');
    getVaultMock.mockRejectedValue(sentinel);

    await expect(
      service.fetchAccountTokens({
        accountId: 'hd-1--evm-account',
        networkId: 'evm--1',
        flag: 'token-selector',
      }),
    ).rejects.toBe(sentinel);
    expect(getVaultMock).toHaveBeenCalledTimes(1);
  });
});
