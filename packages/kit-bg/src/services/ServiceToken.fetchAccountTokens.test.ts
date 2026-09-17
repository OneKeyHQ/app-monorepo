/*
yarn test packages/kit-bg/src/services/ServiceToken.fetchAccountTokens.test.ts

Covers two fetchAccountTokens regressions:

1. All-network guard — regression guard for the
/wallet/v1/account/token/list?flag=token-selector 40003 flood: a first-frame
race in TokenSelector could call fetchAccountTokens with the all-network mock
networkId (`onekeyall--0`), which resolved `AllNetworkMockAddress` as
accountAddress and POSTed a request the wallet API always rejects. All-network
flows must fan out per real network BEFORE this method; a direct all-network
request must short-circuit to empty data without reaching the vault/network
layer.

2. dApp-token filtering — when the request excludes wallet tokens
(`withoutWalletToken`), explicit custom contracts returned by the server must
be stripped from every dApp-only token group before cache and account-worth
consumers see them.
*/

// --- jest.mock calls are hoisted above these imports by babel-jest ---

import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import {
  ETokenDappType,
  type IAccountToken,
  type IFetchAccountTokensResp,
  type ITokenData,
} from '@onekeyhq/shared/types/token';

import { vaultFactory } from '../vaults/factory';

import ServiceToken from './ServiceToken';

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

const networkId = 'evm--1';

const walletToken: IAccountToken = {
  $key: 'wallet-token',
  address: '0xwallet',
  decimals: 18,
  isNative: false,
  name: 'Wallet token',
  symbol: 'WALLET',
  dappType: ETokenDappType.WalletToken,
  networkId,
};

const dappToken: IAccountToken = {
  $key: 'dapp-token',
  address: '0xdapp',
  decimals: 18,
  isNative: false,
  name: 'DeFi token',
  symbol: 'DEFI',
  dappName: 'DeFi protocol',
  networkId,
};

function buildTokenData(): ITokenData {
  return {
    data: [walletToken, dappToken],
    keys: `${walletToken.$key},${dappToken.$key}`,
    map: {
      [walletToken.$key]: {
        balance: '3',
        balanceParsed: '3',
        fiatValue: '3',
        price: 1,
      },
      [dappToken.$key]: {
        balance: '10',
        balanceParsed: '10',
        fiatValue: '10',
        price: 1,
      },
    },
    fiatValue: '13',
    currency: 'usd',
  };
}

describe('ServiceToken.fetchAccountTokens', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('removes an explicit custom wallet token from every dApp-only token group', async () => {
    const response: IFetchAccountTokensResp = {
      tokens: buildTokenData(),
      riskTokens: buildTokenData(),
      smallBalanceTokens: buildTokenData(),
      allTokens: buildTokenData(),
    };
    const fetchTokenList = jest.fn(async () => ({
      data: { data: response },
    }));
    getVaultMock.mockResolvedValue({ fetchTokenList });

    const service = new ServiceToken({
      backgroundApi: {
        serviceAccount: {
          getAccountXpub: jest.fn(async () => ''),
          getAccountAddressForApi: jest.fn(async () => '0xaccount'),
          buildAccountXpubOrAddress: jest.fn(
            async ({
              getAccountAddressFn,
            }: {
              getAccountAddressFn: () => Promise<string>;
            }) => getAccountAddressFn(),
          ),
        },
        serviceCustomToken: {
          getCustomTokens: jest.fn(
            async ({ networkId: requestedNetworkId }: { networkId: string }) =>
              requestedNetworkId === networkId ? [walletToken] : [],
          ),
          getHiddenTokens: jest.fn(async () => []),
        },
        serviceNetwork: {
          getVaultSettings: jest.fn(async () => ({
            mergeDeriveAssetsEnabled: false,
          })),
          getNetworkSafe: jest.fn(async () => ({ name: 'Ethereum' })),
        },
        serviceToken: {
          getUnblockedTokens: jest.fn(async () => []),
          getBlockedTokens: jest.fn(async () => []),
          getAllAggregateTokenInfo: jest.fn(async () => ({
            allAggregateTokenMap: {},
            allAggregateTokens: [],
          })),
        },
      },
    });

    const result = await service.fetchAccountTokens({
      accountId: "hd-1--m/44'/60'/0'/0/0",
      networkId,
      withoutDappToken: false,
      withoutWalletToken: true,
      saveToLocal: false,
    });

    expect(fetchTokenList).toHaveBeenCalledWith(
      expect.objectContaining({
        requestApiParams: expect.objectContaining({
          contractList: [walletToken.address],
          withoutDappToken: false,
          withoutWalletToken: true,
        }),
      }),
    );

    for (const groupName of [
      'tokens',
      'riskTokens',
      'smallBalanceTokens',
      'allTokens',
    ] as const) {
      expect(result[groupName]).toEqual(
        expect.objectContaining({
          data: [expect.objectContaining({ $key: dappToken.$key })],
          keys: dappToken.$key,
          map: {
            [dappToken.$key]: expect.objectContaining({ fiatValue: '10' }),
          },
          fiatValue: '10',
        }),
      );
    }
  });
});
