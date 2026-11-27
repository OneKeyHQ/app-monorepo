import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type {
  IFetchServerTokenListParams,
  IFetchServerTokenListResponse,
} from '@onekeyhq/shared/types/serverToken';
import { EStrk20OptInStatus } from '@onekeyhq/shared/types/starknetPrivacy';

import { VaultBase } from '../../base/VaultBase';

import { STRK_TOKEN_ADDRESS } from './sdkStarknet/consts';
import StarknetVault from './Vault';

import type { IBackgroundApi } from '../../../apis/IBackgroundApi';

jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

const NETWORK_ID = 'starknet--mainnet';
const ACCOUNT_ID = "hd-1--m/44'/9004'/0'/0/0";
const ACCOUNT_ADDRESS =
  '0x0157d9497dee8bbdc5e6a968a96a2408d10c6bf6cfe2b4509602952429d094ec';
const USDC_ADDRESS =
  '0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8';

function createBackendResponse(): IFetchServerTokenListResponse {
  return {
    data: {
      data: {
        tokens: {
          data: [
            {
              $key: `${NETWORK_ID}_${ACCOUNT_ADDRESS}_${STRK_TOKEN_ADDRESS}`,
              decimals: 18,
              name: 'Starknet Token',
              symbol: 'STRK',
              address: STRK_TOKEN_ADDRESS,
              isNative: true,
            },
          ],
          map: {
            [`${NETWORK_ID}_${ACCOUNT_ADDRESS}_${STRK_TOKEN_ADDRESS}`]: {
              balance: '1000000000000000000',
              balanceParsed: '1',
              fiatValue: '0.5',
              price: 0.5,
              price24h: 1,
              currency: 'usd',
            },
          },
          keys: 'backend-tokens',
          fiatValue: '0.5',
        },
        smallBalanceTokens: { data: [], map: {}, keys: 'backend-small' },
        riskTokens: { data: [], map: {}, keys: 'backend-risk' },
      },
    },
  };
}

function createParams(
  overrides?: Partial<IFetchServerTokenListParams['requestApiParams']>,
): IFetchServerTokenListParams {
  return {
    accountId: ACCOUNT_ID,
    requestApiParams: {
      networkId: NETWORK_ID,
      accountAddress: ACCOUNT_ADDRESS,
      ...overrides,
    },
  };
}

function createVault({
  optInStatus,
  getHomePrivateBalances,
}: {
  optInStatus?: EStrk20OptInStatus;
  getHomePrivateBalances?: jest.Mock;
}) {
  const getRecord = jest.fn(async () =>
    optInStatus ? { optInStatus } : undefined,
  );
  const serviceStarknetPrivacyGetter = jest.fn(() => ({
    getHomePrivateBalances: getHomePrivateBalances ?? jest.fn(),
  }));
  const backgroundApi = {
    simpleDb: {
      starknetPrivacy: { getRecord },
    },
  } as Record<string, unknown>;
  Object.defineProperty(backgroundApi, 'serviceStarknetPrivacy', {
    get: serviceStarknetPrivacyGetter,
    enumerable: true,
  });

  const vault = new StarknetVault({
    networkId: NETWORK_ID,
    accountId: ACCOUNT_ID,
    backgroundApi: backgroundApi as unknown as IBackgroundApi,
  });

  return { vault, getRecord, serviceStarknetPrivacyGetter };
}

describe('StarknetVault.overlaySessionTokenListResponse private balance overlay', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('keeps fetchTokenList strictly public-only so persistent localTokens cache never stores private balances', async () => {
    const backendResponse = createBackendResponse();
    jest
      .spyOn(VaultBase.prototype, 'fetchTokenList')
      .mockResolvedValue(backendResponse);

    const getHomePrivateBalances = jest.fn(async () => ({
      byToken: {
        [STRK_TOKEN_ADDRESS]: '3000000000000000000',
      },
      noteCount: 1,
      blockNumber: 1000,
      lastSyncedAt: Date.now(),
    }));
    const { vault } = createVault({
      optInStatus: EStrk20OptInStatus.Registered,
      getHomePrivateBalances,
    });

    const result = await vault.fetchTokenList(createParams());

    expect(getHomePrivateBalances).not.toHaveBeenCalled();
    expect(
      result.data.data.tokens.map[
        `${NETWORK_ID}_${ACCOUNT_ADDRESS}_${STRK_TOKEN_ADDRESS}`
      ].balanceParsed,
    ).toBe('1');
  });

  it('skips loading serviceStarknetPrivacy when the account is not registered', async () => {
    const backendResponse = createBackendResponse();
    const { vault, serviceStarknetPrivacyGetter } = createVault({
      optInStatus: EStrk20OptInStatus.None,
    });

    await vault.overlaySessionTokenListResponse(
      backendResponse,
      createParams(),
    );

    expect(serviceStarknetPrivacyGetter).not.toHaveBeenCalled();
    expect(
      backendResponse.data.data.tokens.map[
        `${NETWORK_ID}_${ACCOUNT_ADDRESS}_${STRK_TOKEN_ADDRESS}`
      ].balanceParsed,
    ).toBe('1');
    expect(backendResponse.data.data.tokens.keys).toBe('backend-tokens');
  });

  it('overlays cached private balances onto public rows and synthesizes private-only preset tokens', async () => {
    const backendResponse = createBackendResponse();
    const getHomePrivateBalances = jest.fn(async () => ({
      byToken: {
        [STRK_TOKEN_ADDRESS]: '3000000000000000000',
        [USDC_ADDRESS]: '2500000',
      },
      noteCount: 2,
      blockNumber: 1000,
      lastSyncedAt: Date.now(),
    }));
    const { vault } = createVault({
      optInStatus: EStrk20OptInStatus.Registered,
      getHomePrivateBalances,
    });

    await vault.overlaySessionTokenListResponse(
      backendResponse,
      createParams(),
    );

    expect(getHomePrivateBalances).toHaveBeenCalledWith({
      networkId: NETWORK_ID,
      accountId: ACCOUNT_ID,
    });
    expect(
      backendResponse.data.data.tokens.map[
        `${NETWORK_ID}_${ACCOUNT_ADDRESS}_${STRK_TOKEN_ADDRESS}`
      ],
    ).toMatchObject({
      balance: '4000000000000000000',
      balanceParsed: '4',
      totalBalance: '4000000000000000000',
      totalBalanceParsed: '4',
      fiatValue: '2',
      totalBalanceFiatValue: '2',
      price: 0.5,
    });
    expect(backendResponse.data.data.tokens.fiatValue).toBe('2');

    const usdcKey = `${NETWORK_ID}_${ACCOUNT_ADDRESS}_${USDC_ADDRESS}`;
    expect(backendResponse.data.data.tokens.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          $key: usdcKey,
          symbol: 'USDC.e',
          address: USDC_ADDRESS,
          decimals: 6,
          isNative: false,
        }),
      ]),
    );
    expect(backendResponse.data.data.tokens.map[usdcKey]).toMatchObject({
      balance: '2500000',
      balanceParsed: '2.5',
      fiatValue: '',
      price: null,
    });
    expect(backendResponse.data.data.tokens.keys).not.toBe('backend-tokens');
  });

  it('respects hiddenTokens when synthesizing private-only preset tokens', async () => {
    const backendResponse = createBackendResponse();
    const getHomePrivateBalances = jest.fn(async () => ({
      byToken: {
        [USDC_ADDRESS]: '2500000',
      },
      noteCount: 1,
      blockNumber: 1000,
      lastSyncedAt: Date.now(),
    }));
    const { vault } = createVault({
      optInStatus: EStrk20OptInStatus.Registered,
      getHomePrivateBalances,
    });

    await vault.overlaySessionTokenListResponse(
      backendResponse,
      createParams({ hiddenTokens: [USDC_ADDRESS] }),
    );

    expect(backendResponse.data.data.tokens.data).toHaveLength(1);
  });

  it('returns the public list untouched when getHomePrivateBalances fails or returns undefined', async () => {
    const backendResponse = createBackendResponse();
    const getHomePrivateBalances = jest.fn(async () => {
      throw new OneKeyLocalError('discovery offline');
    });
    const { vault } = createVault({
      optInStatus: EStrk20OptInStatus.Registered,
      getHomePrivateBalances,
    });

    await vault.overlaySessionTokenListResponse(
      backendResponse,
      createParams(),
    );

    expect(
      backendResponse.data.data.tokens.map[
        `${NETWORK_ID}_${ACCOUNT_ADDRESS}_${STRK_TOKEN_ADDRESS}`
      ].balanceParsed,
    ).toBe('1');
    expect(backendResponse.data.data.tokens.keys).toBe('backend-tokens');
  });
});
