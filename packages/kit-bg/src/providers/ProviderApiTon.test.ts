import { Address, beginCell } from '@ton/core';
import TonWeb from 'tonweb';

import type { IEncodedTxTon } from '@onekeyhq/core/src/chains/ton/types';

import ProviderApiTon from './ProviderApiTon';

import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  providerApiMethod: () => () => undefined,
  permissionRequired: () => () => undefined,
}));
jest.mock('../vaults/factory', () => ({ vaultFactory: {} }));
jest.mock('../vaults/impls/ton/sdkTon/utils', () => ({}));
jest.mock('./ProviderApiBase', () => ({
  __esModule: true,
  default: class {
    backgroundApi: unknown;

    constructor({ backgroundApi }: { backgroundApi: unknown }) {
      this.backgroundApi = backgroundApi;
    }
  },
}));

function setup(accounts: unknown = null) {
  const serviceDApp = {
    dAppGetConnectedAccountsInfo: jest.fn().mockResolvedValue(accounts),
    openConnectionModal: jest.fn(),
  };
  const provider = new ProviderApiTon({ backgroundApi: { serviceDApp } });
  const response = { address: 'authorized-address' };
  const getResponse = jest.fn().mockResolvedValue(response);
  Object.defineProperty(provider, '_getAccountResponse', {
    value: getResponse,
  });
  const request = (params: unknown): IJsBridgeMessagePayload =>
    ({
      origin: 'https://dapp.example',
      scope: 'ton',
      data: { method: 'connect', params },
    }) as IJsBridgeMessagePayload;
  return { provider, serviceDApp, request, response, getResponse };
}

describe('TON connection restoration', () => {
  it('returns only an existing TON authorization without opening a modal', async () => {
    const account = { id: 'account' };
    const { provider, serviceDApp, request, response, getResponse } = setup([
      { account, accountInfo: { networkId: 'ton-network' } },
    ]);
    await expect(provider.restoreConnection(request([]))).resolves.toEqual(
      response,
    );
    expect(serviceDApp.dAppGetConnectedAccountsInfo).toHaveBeenCalledWith(
      expect.objectContaining({ origin: 'https://dapp.example', scope: 'ton' }),
    );
    expect(getResponse).toHaveBeenCalledWith(account, 'ton-network');
    expect(serviceDApp.openConnectionModal).not.toHaveBeenCalled();
  });

  it('returns null for an unapproved origin without requesting authorization', async () => {
    const { provider, serviceDApp, request, getResponse } = setup();
    await expect(provider.restoreConnection(request([]))).resolves.toBeNull();
    expect(getResponse).not.toHaveBeenCalled();
    expect(serviceDApp.openConnectionModal).not.toHaveBeenCalled();
  });

  it('still validates the manifest origin for an explicit connect request', async () => {
    const { provider, request, serviceDApp } = setup();
    const originalFetch = globalThis.fetch;
    const fetchMock = jest.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ name: 'Example', url: 'https://different.example' }),
    } as Response);
    globalThis.fetch = fetchMock;
    try {
      await expect(
        provider.connect(
          request([2, { manifestUrl: 'https://dapp.example/manifest.json' }]),
          [],
        ),
      ).rejects.toMatchObject({ code: 3 });
      expect(fetchMock).toHaveBeenCalledWith(
        'https://dapp.example/manifest.json',
      );
      expect(serviceDApp.openConnectionModal).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it.each([
    undefined,
    {},
    [],
    [2],
    [2, null],
    [2, {}],
    [2, { manifestUrl: 123 }],
  ])(
    'rejects malformed connect parameters without a TypeError: %j',
    async (params) => {
      const { provider, request, serviceDApp } = setup();
      await expect(provider.connect(request(params), [])).rejects.toMatchObject(
        { code: 2 },
      );
      expect(serviceDApp.openConnectionModal).not.toHaveBeenCalled();
    },
  );
});

describe('TON transaction request boundary', () => {
  it.each([1, 128, 160])(
    'rejects nonstandard send mode %s before confirmation',
    async (sendMode) => {
      const { provider, request } = setup();
      const getTonVault = jest.fn();
      Object.defineProperty(provider, 'getTonVault', { value: getTonVault });
      await expect(
        provider.sendTransaction(request([]), {
          from: '',
          valid_until: Math.floor(Date.now() / 1000) + 60,
          messages: [
            {
              address: Address.parse(`0:${'44'.repeat(32)}`).toString(),
              amount: '1',
              sendMode,
            },
          ],
        }),
      ).rejects.toMatchObject({ code: 1 });
      expect(getTonVault).not.toHaveBeenCalled();
    },
  );

  it.each([false, true])(
    'preserves message fields and Jetton metadata for the shared parser: %s',
    async (withMetadata) => {
      const from = `0:${'11'.repeat(32)}`;
      const address = new TonWeb.Address(`0:${'44'.repeat(32)}`).toString(
        true,
        true,
        true,
      );
      const payload = beginCell()
        .storeUint(0x0f_8a_7e_a5, 32)
        .storeUint(0, 64)
        .storeCoins(1_500_000)
        .storeAddress(Address.parse(`0:${'22'.repeat(32)}`))
        .storeAddress(Address.parse(from))
        .storeBit(false)
        .storeCoins(0)
        .storeBit(false)
        .endCell()
        .toBoc()
        .toString('base64');
      const stateInit = beginCell().endCell().toBoc().toString('base64');
      const message = {
        address,
        amount: '50000000',
        payload,
        stateInit,
        ...(withMetadata
          ? {
              jetton: {
                amount: '999999999',
                toAddress: `0:${'33'.repeat(32)}`,
                jettonMasterAddress: `0:${'66'.repeat(32)}`,
                jettonWalletAddress: address,
                fwdFee: '0',
              },
              tokenAddress: `0:${'66'.repeat(32)}`,
              sendMode: 3,
            }
          : {}),
      };
      const encodedTx: IEncodedTxTon & { valid_until: number } = {
        from: '',
        valid_until: Math.floor(Date.now() / 1000) + 60,
        messages: [message],
      };
      const precheckUnsignedTx = jest.fn().mockResolvedValue(undefined);
      const openSignAndSendTransactionModal = jest
        .fn()
        .mockResolvedValue({ rawTx: 'signed-transaction' });
      const provider = new ProviderApiTon({
        backgroundApi: { serviceDApp: { openSignAndSendTransactionModal } },
      });
      Object.defineProperty(provider, 'getTonVault', {
        value: jest.fn().mockResolvedValue({ precheckUnsignedTx }),
      });
      Object.defineProperty(provider, 'getAccountsInfo', {
        value: jest.fn().mockResolvedValue([
          {
            account: { id: 'account', addressDetail: { baseAddress: from } },
            accountInfo: { networkId: 'ton--mainnet' },
          },
        ]),
      });
      const request = {
        origin: 'https://dapp.example',
        scope: 'ton',
        data: { method: 'sendTransaction' },
      } as IJsBridgeMessagePayload;
      await expect(provider.sendTransaction(request, encodedTx)).resolves.toBe(
        'signed-transaction',
      );
      const expectedMessages = [message];
      expect(precheckUnsignedTx).toHaveBeenCalledWith(
        expect.objectContaining({
          unsignedTx: {
            encodedTx: expect.objectContaining({ messages: expectedMessages }),
          },
        }),
      );
      expect(openSignAndSendTransactionModal).toHaveBeenCalledWith(
        expect.objectContaining({
          encodedTx: expect.objectContaining({
            from,
            messages: expectedMessages,
          }),
        }),
      );
    },
  );
});
