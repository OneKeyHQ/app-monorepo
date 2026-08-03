import {
  ETokenDappType,
  type IAccountToken,
  type IFetchAccountTokensResp,
  type ITokenData,
} from '@onekeyhq/shared/types/token';

import ServiceToken from './ServiceToken';

type IMockVault = {
  fetchTokenList: (
    params: unknown,
  ) => Promise<{ data: { data: IFetchAccountTokensResp } }>;
};

const mockGetVault = jest.fn<Promise<IMockVault>, [unknown]>();

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  backgroundMethod:
    () => (_target: unknown, _key: string, descriptor: unknown) =>
      descriptor,
  backgroundMethodForDev:
    () => (_target: unknown, _key: string, descriptor: unknown) =>
      descriptor,
  checkDevOnlyPassword: jest.fn(),
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
  currencyPersistAtom: {
    get: jest.fn(async () => ({ currencyMap: {} })),
  },
  settingsPersistAtom: {
    get: jest.fn(async () => ({ currencyInfo: { id: 'usd' } })),
  },
}));

jest.mock('../vaults/factory', () => ({
  vaultFactory: {
    getVault: (params: unknown) => mockGetVault(params),
  },
}));

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
    mockGetVault.mockResolvedValue({ fetchTokenList });

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
