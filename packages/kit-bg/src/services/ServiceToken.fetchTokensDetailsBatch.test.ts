/*
yarn jest packages/kit-bg/src/services/ServiceToken.fetchTokensDetailsBatch.test.ts

Bulk send (many-to-one / many-to-many) reads sender balances through the
search-batch endpoint. Chains that hide part of the native balance behind a
reserve (OK-64709: ALPH keeps 0.001 ALPH for the change output) must apply the
same split here that the single-account `fetchTokensDetails` path applies,
otherwise bulk send treats the reserve as spendable.
*/
import type { IFetchTokenDetailBatchResp } from '@onekeyhq/shared/types/token';

import ServiceToken from './ServiceToken';

const mockFillTokensDetailsBatch = jest.fn<
  Promise<IFetchTokenDetailBatchResp>,
  [{ tokensDetailsBatch: IFetchTokenDetailBatchResp }]
>();
const mockGetChainOnlyVault = jest.fn<
  Promise<{ fillTokensDetailsBatch: typeof mockFillTokensDetailsBatch }>,
  [{ networkId: string }]
>();

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

jest.mock('../vaults/factory', () => ({
  vaultFactory: {
    getChainOnlyVault: (...args: [{ networkId: string }]) =>
      mockGetChainOnlyVault(...args),
  },
}));

const NETWORK_ID = 'alph--0';
const SENDER = '192bWu4Ce7TxSrEMjmRfaDZUvXPGxrvc6ApDk6RVgXzXk';

function createService({
  serverResponse,
}: {
  serverResponse: IFetchTokenDetailBatchResp;
}) {
  const service = new ServiceToken({
    backgroundApi: {
      serviceAccountProfile: {
        _getWalletTypeHeader: jest.fn().mockResolvedValue({}),
      },
    },
  });
  const post = jest.fn().mockResolvedValue({
    data: { data: serverResponse },
  });
  Object.assign(service, {
    getClient: jest.fn().mockResolvedValue({ post }),
  });
  return { service, post };
}

describe('ServiceToken.fetchTokensDetailsBatch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetChainOnlyVault.mockResolvedValue({
      fillTokensDetailsBatch: mockFillTokensDetailsBatch,
    });
    mockFillTokensDetailsBatch.mockImplementation(
      async ({ tokensDetailsBatch }) =>
        tokensDetailsBatch.map((item) => ({
          ...item,
          tokens: item.tokens.map((token) => ({
            ...token,
            balanceParsed: `filled:${token.balanceParsed}`,
          })),
        })),
    );
  });

  it('runs the batch response through the vault fill hook before returning it', async () => {
    const { service } = createService({
      serverResponse: [
        {
          accountAddress: SENDER,
          tokens: [
            {
              info: { address: '', isNative: true, decimals: 18 },
              balance: '101000000000000000',
              balanceParsed: '0.101',
            },
          ],
        },
      ] as IFetchTokenDetailBatchResp,
    });

    const result = await service.fetchTokensDetailsBatch({
      accountId: 'hd-1--m/44h/1234h/0h',
      networkId: NETWORK_ID,
      contractList: [''],
      queries: [{ accountAddress: SENDER }],
    });

    expect(mockGetChainOnlyVault).toHaveBeenCalledWith({
      networkId: NETWORK_ID,
    });
    // The hook sees the normalized items, i.e. with networkId stamped on info.
    expect(mockFillTokensDetailsBatch).toHaveBeenCalledWith({
      tokensDetailsBatch: [
        {
          accountAddress: SENDER,
          tokens: [
            expect.objectContaining({
              balanceParsed: '0.101',
              info: expect.objectContaining({ networkId: NETWORK_ID }),
            }),
          ],
        },
      ],
    });
    expect(result).toEqual([
      {
        accountAddress: SENDER,
        tokens: [expect.objectContaining({ balanceParsed: 'filled:0.101' })],
      },
    ]);
  });

  it('does not touch the network or the vault when there is nothing to query', async () => {
    const { service, post } = createService({ serverResponse: [] });

    await expect(
      service.fetchTokensDetailsBatch({
        accountId: 'hd-1--m/44h/1234h/0h',
        networkId: NETWORK_ID,
        contractList: [''],
        queries: [],
      }),
    ).resolves.toEqual([]);

    expect(post).not.toHaveBeenCalled();
    expect(mockGetChainOnlyVault).not.toHaveBeenCalled();
  });
});
