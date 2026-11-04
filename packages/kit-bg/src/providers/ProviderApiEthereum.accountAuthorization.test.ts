import ProviderApiEthereum from './ProviderApiEthereum';

import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  providerApiMethod: () => () => undefined,
  permissionRequired: () => () => undefined,
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: { discovery: { dapp: { dappRequest: jest.fn() } } },
}));
jest.mock('../states/jotai/atoms', () => ({ perpsActiveAccountAtom: {} }));

const address = '0x52908400098527886E0F7030069857D2E4169EE7';
const other = '0x1111111111111111111111111111111111111111';
const approval = new Error('confirmation reached');
const typedData = JSON.stringify({
  types: { EIP712Domain: [], Test: [{ name: 'text', type: 'string' }] },
  primaryType: 'Test',
  domain: {},
  message: { text: 'account authorization regression' },
});
const legacyData = [{ name: 'text', type: 'string', value: 'hello' }];
const request: IJsBridgeMessagePayload = {
  origin: 'https://signer.example',
  scope: 'ethereum',
};

function setup(isWalletConnectRequest = false) {
  const openSignMessageModal = jest.fn().mockRejectedValue(approval);
  const openSignAndSendTransactionModal = jest.fn().mockRejectedValue(approval);
  const dAppGetConnectedAccountsInfo = jest.fn().mockResolvedValue([
    {
      account: {
        id: 'account-a',
        address,
        addressDetail: { normalizedAddress: address },
      },
      accountInfo: {
        accountId: 'account-a',
        networkId: 'evm--1',
        address: other,
      },
    },
  ]);
  const provider = new ProviderApiEthereum({
    backgroundApi: {
      serviceDApp: {
        dAppGetConnectedAccountsInfo,
        openSignMessageModal,
        openSignAndSendTransactionModal,
      },
    },
  });
  return {
    provider,
    request: {
      ...request,
      isWalletConnectRequest,
      data: { method: 'test', walletConnectTopic: 'session-a' },
    },
    openSignMessageModal,
    openSignAndSendTransactionModal,
    dAppGetConnectedAccountsInfo,
  };
}

const cases = [
  { method: 'eth_sign', args: (signer: unknown) => [signer, '0x6869'] },
  { method: 'personal_sign', args: (signer: unknown) => ['0x6869', signer] },
  {
    method: 'eth_signTypedData',
    args: (signer: unknown) => [legacyData, signer],
  },
  {
    method: 'eth_signTypedData_v1',
    args: (signer: unknown) => [legacyData, signer],
  },
  {
    method: 'eth_signTypedData',
    args: (signer: unknown) => [signer, typedData],
  },
  {
    method: 'eth_signTypedData_v3',
    args: (signer: unknown) => [signer, typedData],
  },
  {
    method: 'eth_signTypedData_v4',
    args: (signer: unknown) => [signer, typedData],
  },
] as const;

describe.each([false, true])(
  'EVM signing authorization, WalletConnect=%s',
  (wc) => {
    describe.each(cases)('$method', ({ method, args }) => {
      it.each([address, address.toLowerCase(), address.slice(2)])(
        'accepts the resolved account %s',
        async (signer) => {
          const h = setup(wc);
          await expect(
            h.provider[method](h.request, ...args(signer)),
          ).rejects.toBe(approval);
          expect(h.openSignMessageModal).toHaveBeenCalledTimes(1);
        },
      );

      it.each([other, undefined, null, 123, {}])(
        'rejects %j before confirmation',
        async (signer) => {
          const h = setup(wc);
          await expect(
            h.provider[method](h.request, ...args(signer)),
          ).rejects.toMatchObject({ code: 4100 });
          expect(h.openSignMessageModal).not.toHaveBeenCalled();
        },
      );
    });

    it.each([other, undefined, null])(
      'rejects transaction from=%j',
      async (from) => {
        const h = setup(wc);
        await expect(
          h.provider.eth_sendTransaction(h.request, { from } as Parameters<
            ProviderApiEthereum['eth_sendTransaction']
          >[1]),
        ).rejects.toMatchObject({ code: 4100 });
        expect(h.openSignAndSendTransactionModal).not.toHaveBeenCalled();
      },
    );

    it('accepts a transaction from A to B', async () => {
      const h = setup(wc);
      await expect(
        h.provider.eth_sendTransaction(h.request, {
          from: address.toLowerCase(),
          to: other,
          value: '0x0',
        }),
      ).rejects.toBe(approval);
      expect(h.openSignAndSendTransactionModal).toHaveBeenCalledWith(
        expect.objectContaining({ accountId: 'account-a' }),
      );
    });

    it('rejects an empty authorization list', async () => {
      const h = setup(wc);
      h.dAppGetConnectedAccountsInfo.mockResolvedValue([]);
      await expect(
        h.provider.eth_sign(h.request, address, '0x6869'),
      ).rejects.toMatchObject({ code: 4100 });
      expect(h.openSignMessageModal).not.toHaveBeenCalled();
    });
  },
);

describe('network change request isolation', () => {
  it.each(['wallet_switchEthereumChain', 'wallet_addEthereumChain'] as const)(
    'does not suppress another origin calling %s with identical params',
    async (method) => {
      const h = setup();
      const switchConnectedNetwork = jest.fn(
        async (_params: { origin: string }) => undefined,
      );
      Object.assign(h.provider.backgroundApi, {
        serviceNetwork: {
          containsNetwork: jest.fn().mockResolvedValue(true),
          getNetworkSafe: jest.fn().mockResolvedValue({
            id: 'evm--10',
            chainId: '10',
            name: 'Optimism',
          }),
        },
      });
      Object.assign(h.provider.backgroundApi.serviceDApp, {
        switchConnectedNetwork,
        notifyChainSwitchUIToDappSite: jest.fn(),
        notifyDAppChainChanged: jest.fn(),
      });
      const params = { chainId: '0xa' };
      const data = { method, params: [params] };
      await expect(
        Promise.all([
          h.provider[method]({ ...request, data }, params),
          h.provider[method](
            { ...request, origin: 'https://other.example', data },
            params,
          ),
        ]),
      ).resolves.toEqual([null, null]);
      expect(switchConnectedNetwork.mock.calls.map(([p]) => p.origin)).toEqual(
        expect.arrayContaining([request.origin, 'https://other.example']),
      );
    },
  );
});
