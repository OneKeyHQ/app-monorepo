jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

/* eslint-disable import/first */
import type {
  IFetchServerTokenDetailResponse,
  IFetchServerTokenListParams,
  IFetchServerTokenListResponse,
} from '@onekeyhq/shared/types/serverToken';
import type {
  IAccountToken,
  ITokenData,
  ITokenFiat,
} from '@onekeyhq/shared/types/token';

import {
  STARKNET_PRESET_TOKENS,
  STRK_TOKEN_ADDRESS,
} from './sdkStarknet/consts';
import { normalizeTokenAddress } from './utils';
import StarknetVault from './Vault';
/* eslint-enable import/first */

const NETWORK = {
  id: 'starknet--mainnet',
  chainId: '0x534e5f4d41494e',
  decimals: 18,
  symbol: 'STRK',
  shortname: 'STRK',
  logoURI: '',
  feeMeta: { decimals: 18, symbol: 'STRK' },
};
const ACCOUNT_ADDRESS =
  '0x00f1ae5f5976da6f374a5cc06c77bf9c9f7341e02be6913889fccc382bf09673';
const USER_ADDED_TOKEN =
  '0x0124aeb495b947201f5fac96fd1138e326ad86195b98df6dec9009158a533b49';
const ACCOUNT_ID = "hd-1--m/44'/9004'/0'/0/0";

function buildVault() {
  const getNonce = jest.fn(async () => '0x7');
  const getTokenBalance = jest.fn(async () => ['0x0', '0x0']);
  const getTokenMetadata = jest.fn(async () => ({
    name: 'User Token',
    symbol: 'UTK',
    decimals: 18,
  }));
  // a real instance, so the memoized metadata class field exists
  const vault = new StarknetVault({
    networkId: NETWORK.id,
    accountId: ACCOUNT_ID,
    backgroundApi: {
      serviceNetwork: { isCustomNetwork: async () => true },
    } as unknown as StarknetVault['backgroundApi'],
  });
  Object.assign(vault, {
    getClient: async () => ({ getTokenBalance, getTokenMetadata, getNonce }),
    getNetwork: async () => NETWORK,
    getNetworkInfo: async () => ({ nativeTokenAddress: STRK_TOKEN_ADDRESS }),
  });
  return { vault, getTokenBalance, getTokenMetadata, getNonce };
}

async function listTokens(vault: StarknetVault, contractList: string[] = []) {
  const response = await vault.fetchTokenList({
    accountId: ACCOUNT_ID,
    requestApiParams: {
      networkId: NETWORK.id,
      accountAddress: ACCOUNT_ADDRESS,
      contractList,
    },
  });
  return response.data.data.tokens.data;
}

describe('StarknetVault custom-network RPC token list', () => {
  it('queries the nonce only if requested and keeps undeployed accounts at zero', async () => {
    const { vault, getNonce } = buildVault();
    const params = {
      accountId: ACCOUNT_ID,
      networkId: NETWORK.id,
      accountAddress: ACCOUNT_ADDRESS,
    };
    expect(
      (await vault.fetchAccountDetails(params)).data.data.nonce,
    ).toBeUndefined();
    expect(getNonce).not.toHaveBeenCalled();
    expect(
      (await vault.fetchAccountDetails({ ...params, withNonce: true })).data
        .data.nonce,
    ).toBe(7);
    getNonce.mockRejectedValueOnce({ code: 20 });
    expect(
      (await vault.fetchAccountDetails({ ...params, withNonce: true })).data
        .data.nonce,
    ).toBe(0);
    getNonce.mockRejectedValueOnce(new Error('offline'));
    await expect(
      vault.fetchAccountDetails({ ...params, withNonce: true }),
    ).rejects.toThrow('offline');
  });

  it('lists every bundled mainnet token without reading its metadata from the chain', async () => {
    const { vault, getTokenBalance, getTokenMetadata } = buildVault();
    const tokens = await listTokens(vault);

    expect(tokens.map((token) => token.address).toSorted()).toEqual(
      STARKNET_PRESET_TOKENS[NETWORK.id]
        .map((token) => normalizeTokenAddress(token.address))
        .toSorted(),
    );
    expect(getTokenBalance).toHaveBeenCalledTimes(7);
    expect(getTokenMetadata).not.toHaveBeenCalled();
  });

  it('shows bridged USDC as USDC.e, apart from native USDC', async () => {
    const { vault } = buildVault();
    const tokens = await listTokens(vault);
    const bySymbol = (symbol: string) =>
      tokens.filter((token) => token.symbol === symbol);

    expect(bySymbol('USDC')).toHaveLength(1);
    expect(bySymbol('USDC.e')).toHaveLength(1);
    expect(bySymbol('USDC.e')[0].decimals).toBe(6);
  });

  it('keeps STRK as the native entry', async () => {
    const { vault } = buildVault();
    const tokens = await listTokens(vault);

    expect(tokens[0].isNative).toBe(true);
    expect(tokens[0].address).toBe(normalizeTokenAddress(STRK_TOKEN_ADDRESS));
  });

  it('still reads a user-added token from the chain', async () => {
    const { vault, getTokenMetadata } = buildVault();
    const tokens = await listTokens(vault, [USER_ADDED_TOKEN]);

    expect(getTokenMetadata).toHaveBeenCalledTimes(1);
    expect(tokens.map((token) => token.symbol)).toContain('UTK');
  });

  it('keeps custom-network token details on RPC', async () => {
    const { vault, getTokenBalance, getTokenMetadata } = buildVault();

    const response = await vault.fetchTokenDetails({
      accountId: ACCOUNT_ID,
      networkId: NETWORK.id,
      accountAddress: ACCOUNT_ADDRESS,
      contractList: [USER_ADDED_TOKEN],
    });

    expect(getTokenMetadata).toHaveBeenCalledTimes(1);
    expect(getTokenBalance).toHaveBeenCalledTimes(1);
    expect(response.data.data).toHaveLength(1);
    expect(response.data.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          info: expect.objectContaining({
            address: normalizeTokenAddress(USER_ADDED_TOKEN),
            symbol: 'UTK',
          }),
        }),
      ]),
    );
  });

  it('has no preset tokens for a network it does not ship', () => {
    expect(STARKNET_PRESET_TOKENS['starknet--sepolia']).toBeUndefined();
  });
});

const NATIVE_TOKEN: IAccountToken = {
  $key: `${NETWORK.id}_${ACCOUNT_ADDRESS}_${STRK_TOKEN_ADDRESS}`,
  networkId: NETWORK.id,
  address: STRK_TOKEN_ADDRESS,
  name: 'Starknet',
  symbol: 'STRK',
  decimals: 18,
  isNative: true,
  logoURI: 'https://example.com/strk.png',
};
const NATIVE_FIAT: ITokenFiat = {
  balance: '66200107901543245744',
  balanceParsed: '66.200107901543245744',
  price: 0.033_968_07,
  price24h: -1.969_02,
  fiatValue: '2.24868989920717407945939408',
};

function tokenData(token: IAccountToken, fiat: ITokenFiat): ITokenData {
  return {
    data: [token],
    map: { [token.$key]: fiat },
    keys: token.$key,
    fiatValue: fiat.fiatValue,
  };
}

function apiResponse(): IFetchServerTokenListResponse {
  return {
    data: {
      data: {
        tokens: tokenData({ ...NATIVE_TOKEN }, { ...NATIVE_FIAT }),
        riskTokens: tokenData(
          {
            ...NATIVE_TOKEN,
            $key: 'discovered-risk-token',
            address: USER_ADDED_TOKEN,
            symbol: 'RISK',
            isNative: false,
            riskLevel: 1002,
          },
          { ...NATIVE_FIAT, price: 0, fiatValue: '0' },
        ),
        smallBalanceTokens: tokenData(
          { ...NATIVE_TOKEN, $key: 'small-balance-token', isNative: false },
          {
            ...NATIVE_FIAT,
            balance: '1',
            balanceParsed: '0.000000000000000001',
            fiatValue: '0.00000000000000000003396807',
          },
        ),
      },
    },
  };
}

function buildApiVault(
  response:
    | IFetchServerTokenListResponse
    | IFetchServerTokenDetailResponse = apiResponse(),
) {
  const post = jest.fn(
    async (_url: string, _body: unknown, _options: unknown) => response,
  );
  const backgroundApi = {
    serviceNetwork: {
      isCustomNetwork: jest.fn(async () => false),
    },
    serviceToken: { getClient: jest.fn(async () => ({ post })) },
    serviceAccountProfile: {
      _getWalletTypeHeader: jest.fn(async () => ({
        'X-OneKey-Wallet-Type': 'hd',
      })),
    },
  };
  const vault = new StarknetVault({
    networkId: NETWORK.id,
    accountId: ACCOUNT_ID,
    backgroundApi: backgroundApi as unknown as StarknetVault['backgroundApi'],
  });
  const getClient = jest
    .spyOn(vault, 'getClient')
    .mockRejectedValue(new Error('Preset token reads must use the backend'));
  return { vault, post, backgroundApi, getClient, response };
}

function apiParams(): IFetchServerTokenListParams {
  return {
    accountId: ACCOUNT_ID,
    requestApiParams: {
      networkId: NETWORK.id,
      accountAddress: ACCOUNT_ADDRESS,
      contractList: [USER_ADDED_TOKEN],
      hiddenTokens: [STRK_TOKEN_ADDRESS],
      hideRiskTokens: true,
      hideSmallBalanceTokens: true,
      isForceRefresh: true,
      isAllNetwork: false,
    },
    flag: 'token-list',
    requestCurrency: 'usd',
    signal: new AbortController().signal,
  };
}

describe('StarknetVault preset-network backend tokens', () => {
  it('uses the shared token/list API with filters, wallet headers, currency and cancellation', async () => {
    const { vault, post, backgroundApi, getClient } = buildApiVault();
    const params = apiParams();

    await vault.fetchTokenList(params);

    expect(backgroundApi.serviceNetwork.isCustomNetwork).toHaveBeenCalledWith({
      networkId: NETWORK.id,
    });
    expect(post).toHaveBeenCalledWith(
      '/wallet/v1/account/token/list?flag=token-list',
      params.requestApiParams,
      {
        signal: params.signal,
        headers: {
          'X-OneKey-Wallet-Type': 'hd',
          'x-onekey-request-currency': 'usd',
        },
      },
    );
    expect(getClient).not.toHaveBeenCalled();
  });

  it('preserves backend prices, balances, icons and risk/small-balance groups', async () => {
    const { vault, response } = buildApiVault();

    const result = await vault.fetchTokenList(apiParams());

    expect(result).toBe(response);
    expect(result.data.data.tokens.map[NATIVE_TOKEN.$key]).toMatchObject(
      NATIVE_FIAT,
    );
    expect(result.data.data.tokens.data[0].logoURI).toBe(NATIVE_TOKEN.logoURI);
    expect(result.data.data.riskTokens.data[0]).toMatchObject({
      address: USER_ADDED_TOKEN,
      riskLevel: 1002,
    });
    expect(result.data.data.smallBalanceTokens.data).toHaveLength(1);
  });

  it('surfaces backend failures instead of replacing the result with zero-priced RPC tokens', async () => {
    const { vault, post, getClient } = buildApiVault();
    const error = new Error('Backend unavailable');
    post.mockRejectedValueOnce(error);

    await expect(vault.fetchTokenList(apiParams())).rejects.toBe(error);
    expect(getClient).not.toHaveBeenCalled();
  });

  it('preserves cancellation errors without reading RPC balances', async () => {
    const { vault, post, getClient } = buildApiVault();
    const error = new Error('canceled');
    error.name = 'CanceledError';
    post.mockRejectedValueOnce(error);

    await expect(vault.fetchTokenList(apiParams())).rejects.toBe(error);
    expect(getClient).not.toHaveBeenCalled();
  });

  it('uses token/search for detail prices and balances, including send-page refreshes', async () => {
    const detailResponse: IFetchServerTokenDetailResponse = {
      data: {
        data: [{ info: { ...NATIVE_TOKEN }, ...NATIVE_FIAT }],
      },
    };
    const { vault, post, getClient } = buildApiVault(detailResponse);
    const signal = new AbortController().signal;
    const body = {
      networkId: NETWORK.id,
      accountAddress: ACCOUNT_ADDRESS,
      contractList: [STRK_TOKEN_ADDRESS],
    };

    const response = await vault.fetchTokenDetails({
      ...body,
      accountId: ACCOUNT_ID,
      signal,
      requestCurrency: 'usd',
    });

    expect(post).toHaveBeenCalledWith('/wallet/v1/account/token/search', body, {
      signal,
      headers: {
        'X-OneKey-Wallet-Type': 'hd',
        'x-onekey-request-currency': 'usd',
      },
    });
    expect(response).toBe(detailResponse);
    expect(response.data.data[0]).toMatchObject(NATIVE_FIAT);
    expect(getClient).not.toHaveBeenCalled();
  });

  it('surfaces token/search failures instead of returning zero-priced details', async () => {
    const { vault, post, getClient } = buildApiVault();
    const error = new Error('Token search unavailable');
    post.mockRejectedValueOnce(error);

    await expect(
      vault.fetchTokenDetails({
        accountId: ACCOUNT_ID,
        networkId: NETWORK.id,
        accountAddress: ACCOUNT_ADDRESS,
        contractList: [STRK_TOKEN_ADDRESS],
      }),
    ).rejects.toBe(error);
    expect(getClient).not.toHaveBeenCalled();
  });
});
