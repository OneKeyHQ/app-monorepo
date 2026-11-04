import { TransactionBlock } from '@benfen/bfc.js/transactions';
import { wallet } from '@cityofzion/neon-core';

import { conflux } from '@onekeyhq/core/src/chains/cfx/sdkCfx';

import ProviderApiAlph from './ProviderApiAlph';
import ProviderApiAptos from './ProviderApiAptos';
import ProviderApiBfc from './ProviderApiBfc';
import ProviderApiConflux from './ProviderApiConflux';
import ProviderApiCosmos from './ProviderApiCosmos';
import ProviderApiNeoN3 from './ProviderApiNeoN3';
import ProviderApiNostr from './ProviderApiNostr';
import ProviderApiScdo from './ProviderApiScdo';
import ProviderApiStellar from './ProviderApiStellar';
import ProviderApiSui from './ProviderApiSui';
import ProviderApiTron from './ProviderApiTron';

import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  providerApiMethod: () => () => undefined,
  permissionRequired: () => () => undefined,
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: { discovery: { dapp: { dappRequest: jest.fn() } } },
}));
jest.mock('../vaults/factory', () => ({
  vaultFactory: {
    getVault: jest.fn().mockResolvedValue({
      buildTransferTransaction: jest
        .fn()
        .mockResolvedValue({ toJson: () => ({}) }),
    }),
  },
}));
jest.mock('./backgroundProviders', () => ({ providerApiLoaders: {} }));
jest.mock('../vaults/impls/alph/sdkAlph/utils', () => ({
  serializeUnsignedTransaction: jest.fn().mockResolvedValue({}),
  deserializeUnsignedTransaction: jest
    .fn()
    .mockResolvedValue({ unsignedTx: {} }),
}));

const approval = new Error('confirmation reached');
const hexAddress = `0x${'12'.repeat(32)}`;
const otherAddress = `0x${'34'.repeat(32)}`;
const cfxAddress = conflux.address.encodeCfxAddress(
  '0x1122334455667788990011223344556677889900',
  1029,
);
const cfxOther = conflux.address.encodeCfxAddress(
  '0x1344334455667788990011223344556677889900',
  1029,
);

function setup(address = hexAddress, networkId = 'sui--101') {
  const openSignMessageModal = jest.fn().mockRejectedValue(approval);
  const openSignAndSendTransactionModal = jest.fn().mockRejectedValue(approval);
  const openModal = jest.fn().mockRejectedValue(approval);
  const account = {
    id: 'account-a',
    pub: '12'.repeat(32),
    address,
    path: "m/44'/148'/0'",
    addressDetail: { normalizedAddress: address },
  };
  const serviceDApp = {
    dAppGetConnectedAccountsInfo: jest.fn().mockResolvedValue([
      {
        account,
        accountInfo: {
          accountId: account.id,
          networkId,
          walletId: 'hd-a',
          address,
        },
      },
    ]),
    openSignMessageModal,
    openSignAndSendTransactionModal,
    openModal,
  };
  const backgroundApi = {
    serviceDApp,
    servicePassword: {
      getCachedPassword: jest.fn().mockResolvedValue(undefined),
    },
  };
  const request: IJsBridgeMessagePayload = { origin: 'https://signer.example' };
  return {
    account,
    backgroundApi,
    request,
    openSignMessageModal,
    openSignAndSendTransactionModal,
    openModal,
  };
}

type IHarness = ReturnType<typeof setup>;
const suiInput = (address: string) => ({
  account: { address, publicKey: new Uint8Array(), chains: [], features: [] },
  chain: 'sui:mainnet' as const,
  messageSerialize: '6869',
  walletSerialize: '',
  blockSerialize: new TransactionBlock().serialize(),
  transaction: '',
});
const aminoDoc = {
  chain_id: 'cosmoshub-4',
  account_number: '1',
  sequence: '0',
  fee: { amount: [], gas: '200000' },
  msgs: [],
  memo: '',
};

const cases: {
  name: string;
  address?: string;
  other?: string;
  networkId?: string;
  optional?: boolean;
  call: (h: IHarness, signer: string) => Promise<unknown>;
}[] = [
  ...(
    [
      'signMessage',
      'signPersonalMessage',
      'signTransactionBlock',
      'signAndExecuteTransactionBlock',
      'signTransaction',
      'signAndExecuteTransaction',
    ] as const
  ).map((method) => ({
    name: `sui.${method}`,
    call: (h: IHarness, signer: string) =>
      new ProviderApiSui({ backgroundApi: h.backgroundApi })[method](
        h.request,
        suiInput(signer),
      ),
  })),
  ...(
    [
      'signMessage',
      'signPersonalMessage',
      'signTransactionBlock',
      'signAndExecuteTransactionBlock',
    ] as const
  ).map((method) => ({
    name: `bfc.${method}`,
    call: (h: IHarness, signer: string) =>
      new ProviderApiBfc({ backgroundApi: h.backgroundApi })[method](
        h.request,
        suiInput(signer),
      ),
  })),
  ...(
    [
      'signAndSubmitTransferTx',
      'signAndSubmitDeployContractTx',
      'signAndSubmitExecuteScriptTx',
      'signAndSubmitUnsignedTx',
      'signUnsignedTx',
      'signMessage',
    ] as const
  ).map((method) => ({
    name: `alephium.${method}`,
    call: (h: IHarness, signer: string) =>
      new ProviderApiAlph({ backgroundApi: h.backgroundApi })[method](
        h.request,
        JSON.stringify({
          signerAddress: signer,
          unsignedTx: '',
          message: 'hi',
          destinations: [],
          bytecode: '',
        }),
      ),
  })),
  ...(['stellar_signMessage', 'stellar_signTransaction'] as const).map(
    (method) => ({
      name: `stellar.${method}`,
      optional: true,
      call: (h: IHarness, signer: string) =>
        new ProviderApiStellar({ backgroundApi: h.backgroundApi })[method](
          h.request,
          {
            address: signer,
            message: 'hi',
            xdr: 'opaque-xdr',
            networkPassphrase: 'test',
          },
        ),
    }),
  ),
  {
    name: 'aptos.signIn',
    optional: true,
    call: (h, signer) =>
      new ProviderApiAptos({ backgroundApi: h.backgroundApi }).signIn(
        h.request,
        {
          address: signer,
          nonce: '0123456789abcdef',
          domain: 'signer.example',
          uri: 'https://signer.example',
          chainId: 'aptos:mainnet',
        },
      ),
  },
  {
    name: 'neo.send',
    address: wallet.getAddressFromScriptHash('12'.repeat(20)),
    other: wallet.getAddressFromScriptHash('34'.repeat(20)),
    call: (h, signer) =>
      new ProviderApiNeoN3({ backgroundApi: h.backgroundApi }).send(h.request, {
        fromAddress: signer,
        toAddress: otherAddress,
        asset: 'GAS',
        amount: '1',
      }),
    // NEO validates the transfer encoding after checking its explicit sender.
  },
  ...(['signAmino', 'cosmos_signAmino'] as const).map((method) => ({
    name: `cosmos.${method}`,
    networkId: 'cosmos--cosmoshub-4',
    call: (h: IHarness, signer: string) =>
      new ProviderApiCosmos({ backgroundApi: h.backgroundApi })[method](
        h.request,
        { signer, signerAddress: signer, signDoc: aminoDoc },
      ),
  })),
  ...(['signDirect', 'cosmos_signDirect'] as const).map((method) => ({
    name: `cosmos.${method}`,
    networkId: 'cosmos--cosmoshub-4',
    call: (h: IHarness, signer: string) =>
      new ProviderApiCosmos({ backgroundApi: h.backgroundApi })[method](
        h.request,
        {
          signer,
          signerAddress: signer,
          signDoc: {
            chainId: 'cosmoshub-4',
            accountNumber: '1',
            bodyBytes: '',
            authInfoBytes: '',
          },
        },
      ),
  })),
  ...(['signArbitrary'] as const).map((method) => ({
    name: `cosmos.${method}`,
    networkId: 'cosmos--cosmoshub-4',
    call: (h: IHarness, signer: string) =>
      new ProviderApiCosmos({ backgroundApi: h.backgroundApi })[method](
        h.request,
        {
          chainId: 'cosmoshub-4',
          signer,
          data: 'hi',
        },
      ),
  })),
  ...(['cfx_sign', 'cfx_signTypedData_v4', 'personal_sign'] as const).map(
    (method) => ({
      name: `conflux.${method}`,
      address: cfxAddress,
      other: cfxOther,
      call: (h: IHarness, signer: string) =>
        new ProviderApiConflux({ backgroundApi: h.backgroundApi })[method](
          h.request,
          ...(method === 'personal_sign'
            ? ['0x6869', signer]
            : [signer, '0x6869']),
        ),
    }),
  ),
  ...(['cfx_sendTransaction', 'wallet_sendTransaction'] as const).map(
    (method) => ({
      name: `conflux.${method}`,
      address: cfxAddress,
      other: cfxOther,
      call: (h: IHarness, signer: string) =>
        new ProviderApiConflux({ backgroundApi: h.backgroundApi })[method](
          h.request,
          { from: signer, to: cfxOther, value: '0x0', data: '0x' },
        ),
    }),
  ),
];

describe.each(cases)(
  '$name account authorization',
  ({ address, other, networkId, optional, call }) => {
    it('accepts the selected account', async () => {
      const h = setup(address, networkId);
      await expect(call(h, h.account.address)).rejects.toBe(approval);
    });

    it('keeps original signing payload', async () => {
      const h = setup(address, networkId);
      await expect(call(h, h.account.address)).rejects.toBe(approval);
      expect({
        message: h.openSignMessageModal.mock.calls,
        transaction: h.openSignAndSendTransactionModal.mock.calls,
        modal: h.openModal.mock.calls,
      }).toMatchSnapshot('baseline-fe08');
    });

    it.each([
      other ?? otherAddress,
      ...(optional ? [] : [undefined]),
      null,
      123,
      {},
    ])('rejects requested signer %j before confirmation', async (signer) => {
      const h = setup(address, networkId);
      // These requests intentionally violate the external API's static type.
      await expect(call(h, signer as string)).rejects.toMatchObject({
        code: 4100,
      });
      expect(h.openSignMessageModal).not.toHaveBeenCalled();
      expect(h.openSignAndSendTransactionModal).not.toHaveBeenCalled();
      expect(h.openModal).not.toHaveBeenCalled();
    });
  },
);

describe('optional signer constraints', () => {
  it.each(['sui', 'bfc', 'stellar'] as const)(
    'rejects a stale %s execution address without repairing the payload',
    async (chain) => {
      const h = setup();
      h.backgroundApi.serviceDApp.dAppGetConnectedAccountsInfo.mockResolvedValue(
        [
          {
            account: h.account,
            accountInfo: {
              accountId: h.account.id,
              networkId: 'test-network',
              address: otherAddress,
            },
          },
        ],
      );
      let result: Promise<unknown>;
      if (chain === 'sui') {
        result = new ProviderApiSui({
          backgroundApi: h.backgroundApi,
        }).signTransactionBlock(h.request, suiInput(hexAddress));
      } else if (chain === 'bfc') {
        result = new ProviderApiBfc({
          backgroundApi: h.backgroundApi,
        }).signTransactionBlock(h.request, suiInput(hexAddress));
      } else {
        result = new ProviderApiStellar({
          backgroundApi: h.backgroundApi,
        }).stellar_signMessage(h.request, { message: 'hi' });
      }
      await expect(result).rejects.toMatchObject({ code: 4100 });
      expect(h.openSignMessageModal).not.toHaveBeenCalled();
      expect(h.openSignAndSendTransactionModal).not.toHaveBeenCalled();
    },
  );
  it.each(['stellar_signMessage', 'stellar_signTransaction'] as const)(
    'allows omitted Stellar address in %s',
    async (method) => {
      const h = setup();
      await expect(
        new ProviderApiStellar({ backgroundApi: h.backgroundApi })[method](
          h.request,
          { message: 'hi', xdr: 'opaque-xdr', networkPassphrase: 'test' },
        ),
      ).rejects.toBe(approval);
    },
  );
  it('rejects a Stellar derivation path selecting another key', async () => {
    const h = setup();
    await expect(
      new ProviderApiStellar({
        backgroundApi: h.backgroundApi,
      }).stellar_signMessage(h.request, {
        message: 'hi',
        path: "m/44'/148'/1'",
      }),
    ).rejects.toMatchObject({ code: 4100 });
    expect(h.openSignMessageModal).not.toHaveBeenCalled();
  });
  it.each([undefined, '12'.repeat(32)])(
    'allows an absent or matching Nostr event public key',
    async (pubkey) => {
      const h = setup();
      await expect(
        new ProviderApiNostr({ backgroundApi: h.backgroundApi }).signEvent({
          ...h.request,
          data: { params: { event: { pubkey } } },
        }),
      ).rejects.toBe(approval);
    },
  );
  it('rejects a Nostr public key mismatch before the automatic signing path', async () => {
    const h = setup();
    await expect(
      new ProviderApiNostr({ backgroundApi: h.backgroundApi }).signEvent({
        ...h.request,
        data: { params: { event: { pubkey: '34'.repeat(32) } } },
      }),
    ).rejects.toMatchObject({ code: 4100 });
    expect(
      h.backgroundApi.servicePassword.getCachedPassword,
    ).not.toHaveBeenCalled();
    expect(h.openModal).not.toHaveBeenCalled();
  });
  it('rejects a SCDO sender matching only the stale connection address', async () => {
    const h = setup();
    await expect(
      new ProviderApiScdo({
        backgroundApi: h.backgroundApi,
      }).scdo_signTransaction({
        ...h.request,
        data: { params: [{ From: 'stale-address' }] },
      }),
    ).rejects.toMatchObject({ code: 4100 });
    expect(h.openSignAndSendTransactionModal).not.toHaveBeenCalled();
  });
  it('rejects an explicitly mismatched Tron personal_sign account', async () => {
    const h = setup('T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb');
    await expect(
      new ProviderApiTron({ backgroundApi: h.backgroundApi }).personal_sign(
        h.request,
        'hi',
        'TCf5cqRffPccWpnN6LMTaD2cTCDEuqbnkD',
      ),
    ).rejects.toMatchObject({ code: 4100 });
    expect(h.openSignMessageModal).not.toHaveBeenCalled();
  });
});
