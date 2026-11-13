import { EAddressEncodings } from '@onekeyhq/core/src/types';
import type { IAddressValidation } from '@onekeyhq/shared/types/address';
import type { IUniversalSearchDappResult } from '@onekeyhq/shared/types/search';
import { EUniversalSearchType } from '@onekeyhq/shared/types/search';

import ServiceUniversalSearch from './ServiceUniversalSearch';

import type { AxiosInstance } from 'axios';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  backgroundMethod:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));

jest.mock('./ServiceBase', () => ({
  __esModule: true,
  default: class {
    backgroundApi: unknown;

    getClient = jest.fn();

    constructor({ backgroundApi }: { backgroundApi: unknown }) {
      this.backgroundApi = backgroundApi;
    }
  },
}));

jest.mock('../vaults/settings', () => ({
  getVaultSettings: jest.fn(async () => ({ watchingAccountEnabled: true })),
}));

const NEAR = { id: 'near--0', impl: 'near', shortname: 'Near' };
const EVM = { id: 'evm--1', impl: 'evm', shortname: 'ETH' };
const NEAR_TESTNET = { ...NEAR, id: 'near--testnet' };

function rpcResponse(response: unknown) {
  return { data: { data: { data: [response] } } };
}

const existingAccount = rpcResponse({ result: { amount: '0' } });
const missingAccount = rpcResponse({
  error: {
    code: -32_000,
    message: 'Server error',
    cause: { name: 'UNKNOWN_ACCOUNT' },
  },
});

function makeService({
  encoding = EAddressEncodings.REGISTER_ACCOUNT,
  networks = [NEAR],
} = {}) {
  const post = jest.fn().mockResolvedValue(missingAccount);
  const serviceAccount = {
    getAllIndexedAccounts: jest.fn().mockResolvedValue({ indexedAccounts: [] }),
    getAllAccounts: jest.fn().mockResolvedValue({ accounts: [] }),
    getAccountNameFromAddress: jest.fn().mockResolvedValue([]),
    getWalletSafe: jest.fn().mockResolvedValue({ id: 'hd-1', name: 'Wallet' }),
    getIndexedAccount: jest.fn().mockResolvedValue({ id: 'hd-1--0' }),
    getAccountsInSameIndexedAccountId: jest.fn().mockResolvedValue({
      accounts: [{ id: 'hd-1--0--near', address: 'alice.near' }],
    }),
    getAccount: jest.fn().mockResolvedValue({ id: 'hd-1--0--near' }),
  };
  const localValidateAddress = jest.fn(
    async ({ address }: { address: string }): Promise<IAddressValidation> => ({
      isValid: true,
      displayAddress: address,
      normalizedAddress: address,
      encoding,
    }),
  );
  const validateAddressBatch = jest.fn().mockResolvedValue({
    isValid: true,
    networkIds: networks.map((network) => network.id),
  });
  const service = new ServiceUniversalSearch({
    backgroundApi: {
      serviceAccount,
      serviceNetwork: {
        getAllNetworks: jest.fn().mockResolvedValue({ networks }),
        getNetworkSafe: jest.fn(async ({ networkId }: { networkId: string }) =>
          networks.find((network) => network.id === networkId),
        ),
      },
      serviceValidator: {
        localValidateAddress,
        localValidateWatchingAddress: localValidateAddress,
        validateAddressBatch,
      },
      serviceAccountProfile: {
        getAllNetworkAccountsValueByAccountId: jest.fn(),
        getAllNetworkAccountsValueByAddress: jest.fn(),
      },
      serviceDeFi: { getAccountsLocalDeFiOverview: jest.fn() },
      simpleDb: { deFi: { getRawData: jest.fn() } },
    },
  });
  jest
    .spyOn(service, 'getClient')
    .mockResolvedValue({ post } as unknown as AxiosInstance);
  return { service, post, serviceAccount, validateAddressBatch };
}

const nextTurn = () => new Promise<void>((resolve) => setImmediate(resolve));

describe('NEAR named accounts in address search', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  test.each(['google.com', 'vana.com', 'www.google.com', 'onekey.org'])(
    'omits the nonexistent named account %s in both search entrypoints',
    async (input) => {
      const { service } = makeService();
      await expect(
        service.universalSearchOfAddress({ input }),
      ).resolves.toEqual({ items: [] });
      await expect(service.searchUrlAccount({ input })).resolves.toEqual({
        items: [],
      });
    },
  );

  test.each(['alice.near', 'app.alice.near', 'registered.com'])(
    'keeps an existing named account %s, including zero-balance accounts',
    async (input) => {
      const { service, post } = makeService();
      post.mockResolvedValue(existingAccount);
      const result = await service.searchUrlAccount({ input: ` ${input} ` });
      expect(result.items).toMatchObject([
        { payload: { network: NEAR, addressInfo: { displayAddress: input } } },
      ]);
      expect(post).toHaveBeenCalledWith(
        '/wallet/v1/proxy/wallet',
        {
          networkId: NEAR.id,
          body: [
            {
              route: 'rpc',
              params: {
                method: 'query',
                params: {
                  request_type: 'view_account',
                  account_id: input,
                  finality: 'final',
                },
              },
            },
          ],
        },
        { timeout: 3000 },
      );
    },
  );

  test.each([
    [EAddressEncodings.IMPLICIT_ACCOUNT, 'a'.repeat(64), [NEAR]],
    [EAddressEncodings.ENCODED_PUBKEY, 'ed25519:public-key', [NEAR]],
    [EAddressEncodings.REGISTER_ACCOUNT, 'example.eth', [EVM]],
  ])(
    'does not query existence for %s on %j (%j)',
    async (encoding, input, networks) => {
      const { service, post } = makeService({ encoding, networks });
      const result = await service.searchUrlAccount({ input });
      expect(result.items).toHaveLength(1);
      expect(post).not.toHaveBeenCalled();
    },
  );

  test('preserves local account-name results when the external NEAR account is absent', async () => {
    const { service, serviceAccount } = makeService();
    serviceAccount.getAllIndexedAccounts.mockResolvedValue({
      indexedAccounts: [
        { id: 'hd-1--0', walletId: 'hd-1', name: 'google.com' },
      ],
    });
    const result = await service.universalSearchOfAddress({
      input: 'google.com',
    });
    expect(result.items).toMatchObject([
      {
        payload: {
          isSearchedByAccountName: true,
          accountInfo: { accountName: 'google.com' },
        },
      },
    ]);
  });

  test('preserves an address belonging to a local wallet without a remote existence lookup', async () => {
    const { service, post, serviceAccount } = makeService();
    serviceAccount.getAccountNameFromAddress.mockResolvedValue([
      { accountId: 'hd-1--0', walletName: 'Wallet', accountName: 'Account 1' },
    ]);
    const result = await service.universalSearchOfAddress({
      input: 'alice.near',
    });
    expect(result.items).toMatchObject([
      { payload: { accountInfo: { accountId: 'hd-1--0' } } },
    ]);
    expect(post).not.toHaveBeenCalled();
  });

  test.each(['transport', 'rpc', 'malformed'])(
    'keeps other network and DApp results on a %s failure and retries the NEAR lookup',
    async (failure) => {
      const { service, post } = makeService({ networks: [NEAR, EVM] });
      if (failure === 'transport')
        post.mockRejectedValueOnce(new Error('timeout'));
      else if (failure === 'rpc')
        post.mockResolvedValueOnce(
          rpcResponse({
            error: {
              code: -32_000,
              message: 'Unavailable',
              cause: { name: 'UNAVAILABLE_SHARD' },
            },
          }),
        );
      else post.mockResolvedValueOnce(rpcResponse(undefined));
      post.mockResolvedValue(existingAccount);
      const dappResult: IUniversalSearchDappResult = {
        items: [
          {
            type: EUniversalSearchType.Dapp,
            payload: {
              dappId: 'example',
              name: 'Example',
              url: 'https://example.com',
              logo: '',
              description: '',
              networkIds: [],
              tags: [],
            },
          },
        ],
      };
      jest
        .spyOn(service, 'universalSearchOfDapp')
        .mockResolvedValue(dappResult);
      const result = await service.universalSearch({
        input: 'google.com',
        searchTypes: [EUniversalSearchType.Address, EUniversalSearchType.Dapp],
      });
      expect(result[EUniversalSearchType.Address]?.items).toMatchObject([
        { payload: { network: EVM } },
      ]);
      expect(result[EUniversalSearchType.Dapp]).toEqual(dappResult);
      await nextTurn();
      const retry = await service.searchUrlAccount({ input: 'google.com' });
      expect(retry.items).toHaveLength(2);
      expect(post).toHaveBeenCalledTimes(2);
    },
  );

  test('shares concurrent requests and cached results across search entrypoints', async () => {
    const { service, post } = makeService();
    let finish: ((value: typeof existingAccount) => void) | undefined;
    post.mockReturnValue(
      new Promise<typeof existingAccount>((resolve) => {
        finish = resolve;
      }),
    );
    const first = service.universalSearchOfAddress({ input: 'alice.near' });
    const second = service.searchUrlAccount({ input: 'alice.near' });
    await nextTurn();
    expect(post).toHaveBeenCalledTimes(1);
    finish?.(existingAccount);
    const results = await Promise.all([first, second]);
    expect(results.map((result) => result.items.length)).toEqual([1, 1]);
    await nextTurn();
    await service.searchUrlAccount({ input: 'alice.near' });
    expect(post).toHaveBeenCalledTimes(1);
  });

  test('expires definitive negative results instead of hiding newly created accounts indefinitely', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    const { service, post } = makeService();
    await service.searchUrlAccount({ input: 'alice.near' });
    await nextTurn();
    await service.searchUrlAccount({ input: 'alice.near' });
    expect(post).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(61_000);
    post.mockResolvedValue(existingAccount);
    const result = await service.searchUrlAccount({ input: 'alice.near' });
    expect(result.items).toHaveLength(1);
    expect(post).toHaveBeenCalledTimes(2);
  });

  test('isolates account existence by network and account ID', async () => {
    const { service, post } = makeService({ networks: [NEAR, NEAR_TESTNET] });
    post
      .mockResolvedValueOnce(missingAccount)
      .mockResolvedValue(existingAccount);
    const result = await service.searchUrlAccount({ input: 'alice.near' });
    expect(result.items).toMatchObject([
      { payload: { network: NEAR_TESTNET } },
    ]);
    await service.searchUrlAccount({ input: 'bob.near' });
    expect(post).toHaveBeenCalledTimes(4);
  });
});
