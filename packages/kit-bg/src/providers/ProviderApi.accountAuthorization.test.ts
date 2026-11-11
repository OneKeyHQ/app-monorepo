import { createHash } from 'crypto';

import { Message } from '@solana/web3.js';
import { Psbt, address as bitcoinAddress, networks } from 'bitcoinjs-lib';
import { cloneDeep, set } from 'lodash';
import { utils as tronUtils } from 'tronweb';

import { initBitcoinEcc } from '@onekeyhq/core/src/chains/btc/sdkBtc';

import fixtures from './__fixtures__/signingAccounts.json';
import ProviderApiAlgo from './ProviderApiAlgo';
import ProviderApiAptos from './ProviderApiAptos';
import ProviderApiBfc from './ProviderApiBfc';
import ProviderApiBtc from './ProviderApiBtc';
import ProviderApiEthereum from './ProviderApiEthereum';
import ProviderApiNear from './ProviderApiNear';
import ProviderApiNostr from './ProviderApiNostr';
import ProviderApiScdo from './ProviderApiScdo';
import ProviderApiSolana from './ProviderApiSolana';
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
jest.mock('./backgroundProviders', () => ({ providerApiLoaders: {} }));
jest.mock('../states/jotai/atoms', () => ({ perpsActiveAccountAtom: {} }));
jest.mock('../vaults/factory', () => ({ vaultFactory: {} }));

const providers = {
  algo: ProviderApiAlgo,
  aptos: ProviderApiAptos,
  bfc: ProviderApiBfc,
  btc: ProviderApiBtc,
  evm: ProviderApiEthereum,
  near: ProviderApiNear,
  nostr: ProviderApiNostr,
  scdo: ProviderApiScdo,
  sol: ProviderApiSolana,
  stellar: ProviderApiStellar,
  sui: ProviderApiSui,
  tron: ProviderApiTron,
};
const approval = new Error('confirmation reached');
const evmAddress = '0x52908400098527886E0F7030069857D2E4169EE7';
const message = '0x6869';
const typed =
  '{"types":{"EIP712Domain":[],"Test":[]},"primaryType":"Test","domain":{},"message":{}}';
const legacy = [{ name: 'text', type: 'string', value: 'hi' }];
function setup(chain: keyof typeof providers, address = fixtures.hex) {
  const account = {
    id: 'qr-test',
    address,
    pub: '12'.repeat(32),
    path: "m/44'/148'/0'",
    addressDetail: { normalizedAddress: address },
  };
  const connection = {
    account,
    accountInfo: {
      accountId: account.id,
      networkId: 'test-network',
      address,
      walletId: 'hd-test',
    },
  };
  const approve = jest.fn(async (_params: unknown): Promise<unknown> => {
    throw approval;
  });
  const connections = jest.fn().mockResolvedValue([connection]);
  const backgroundApi = {
    serviceDApp: {
      dAppGetConnectedAccountsInfo: connections,
      openSignMessageModal: approve,
      openSignAndSendTransactionModal: approve,
      openModal: approve,
      switchConnectedNetwork: jest.fn(),
    },
    serviceAccount: { getAccount: async () => account },
    serviceSetting: { getEnableBTCFreshAddress: async () => false },
    serviceNetwork: { getNetwork: async () => ({ code: 'tbtc' }) },
    servicePassword: { getCachedPassword: async () => undefined },
    serviceValidator: {
      validateAddress: async ({ address: value }: { address: unknown }) =>
        typeof value === 'string' && /^(0x)?[0-9a-f]{40}$/i.test(value)
          ? 'valid'
          : 'invalid',
    },
  };
  const Provider = providers[chain];
  const provider = new Provider({ backgroundApi });
  const request: IJsBridgeMessagePayload = { origin: 'https://signer.example' };
  // Invoke the DApp's dynamic method/parameter surface, including malformed inputs.
  const methods = provider as unknown as Record<
    string,
    (request: IJsBridgeMessagePayload, ...params: unknown[]) => Promise<unknown>
  >;
  const run = (method: string, ...params: unknown[]) =>
    methods[method].call(provider, request, ...params);
  const rejects = async (method: string, ...params: unknown[]) => {
    await expect(run(method, ...params)).rejects.toMatchObject({ code: 4100 });
    expect(approve).not.toHaveBeenCalled();
  };
  const accepts = async (method: string, ...params: unknown[]) => {
    await expect(run(method, ...params)).rejects.toBe(approval);
  };
  return {
    rejects,
    accepts,
    account,
    connection,
    approve,
    connections,
    request,
    run,
  };
}
const evmCases = [
  ['eth_sign', [evmAddress, message], 0],
  ['personal_sign', [message, evmAddress], 1],
  ['eth_signTypedData', [evmAddress, typed], 0],
  ['eth_signTypedData_v1', [legacy, evmAddress], 1],
  ['eth_signTypedData_v3', [evmAddress, typed], 0],
  ['eth_signTypedData_v4', [evmAddress, typed], 0],
  ['eth_sendTransaction', [{ from: evmAddress, value: '0x0' }], '0.from'],
] as const;
it.each(evmCases)(
  'EVM %s authorizes its signer',
  async (method, params, position) => {
    const h = setup('evm', evmAddress);
    for (const signer of [fixtures.other, undefined, null, 123, {}]) {
      const args: unknown[] = cloneDeep([...params]);
      set(args, String(position), signer);
      await h.rejects(method, ...args);
    }
    const before = cloneDeep(params);
    await h.accepts(method, ...params);
    expect(params).toStrictEqual(before);
  },
);
it.each([false, true])(
  'EVM payload and legacy order, WalletConnect=%s',
  async (wc) => {
    const h = setup('evm', evmAddress);
    h.request.isWalletConnectRequest = wc;
    h.approve.mockResolvedValue('signature');
    for (const args of [
      [message, evmAddress],
      [message, evmAddress.toLowerCase()],
      [message, evmAddress.slice(2)],
      [evmAddress, message],
    ]) {
      const address = args[0] === message ? args[1] : args[0];
      await expect(h.run('personal_sign', ...args)).resolves.toBe('signature');
      expect(h.approve).toHaveBeenLastCalledWith({
        request: h.request,
        accountId: h.account.id,
        networkId: h.connection.accountInfo.networkId,
        unsignedMessage: {
          type: 'PERSONAL_SIGN',
          message,
          payload: [message, address],
        },
      });
    }
    h.approve.mockClear();
    for (const address of [
      fixtures.other.slice(0, 42),
      fixtures.other.slice(2, 42),
      fixtures.other.slice(0, 42).replace('0x', '0X'),
    ]) {
      await h.rejects('personal_sign', evmAddress, address);
    }
    h.connections.mockResolvedValue([]);
    await h.rejects('eth_sign', evmAddress, message);
  },
);
it.each(['sui', 'bfc', 'stellar', 'scdo'] as const)(
  'rejects stale %s connection metadata',
  async (chain) => {
    const h = setup(chain);
    h.connection.accountInfo.address = fixtures.other;
    const method = {
      sui: 'signTransactionBlock',
      bfc: 'signTransactionBlock',
      stellar: 'stellar_signMessage',
      scdo: 'scdo_signTransaction',
    }[chain];
    h.request.data = { params: [{ From: fixtures.other }] };
    await h.rejects(method, {
      message: 'hi',
      account: { address: fixtures.hex },
    });
  },
);
it('checks optional Nostr keys and Stellar paths before approval', async () => {
  const h = setup('nostr');
  h.request.data = { params: { event: { pubkey: '34'.repeat(32) } } };
  await h.rejects('signEvent');
  h.request.data = { params: { event: { pubkey: h.account.pub } } };
  await h.accepts('signEvent');
  const stellar = setup('stellar');
  await stellar.rejects('stellar_signMessage', {
    message: 'hi',
    path: "m/44'/148'/1'",
  });
});

it.each(['legacy', 'v0'] as const)(
  'Solana %s required signers',
  async (format) => {
    const h = setup('sol', fixtures.sol.address);
    const alias =
      format === 'legacy'
        ? jest
            .spyOn(Message.prototype, 'staticAccountKeys', 'get')
            .mockReturnValue([])
        : undefined;
    try {
      for (const method of [
        'signTransaction',
        'signAllTransactions',
        'signAndSendTransaction',
      ]) {
        for (const [role, tx] of fixtures.sol[format].entries()) {
          h.approve.mockClear();
          const params = {
            message: method === 'signAllTransactions' ? [tx, tx] : tx,
          };
          const result = h.run(method, params);
          if (role === 2) {
            await expect(result).rejects.toMatchObject({ code: 4100 });
            expect(h.approve).not.toHaveBeenCalled();
          } else {
            await expect(result).rejects.toBe(approval);
            expect(h.approve).toHaveBeenCalledWith(
              expect.objectContaining({ encodedTx: tx }),
            );
          }
        }
      }
      h.approve.mockClear();
      await h.rejects('signAllTransactions', {
        message: [fixtures.sol[format][0], fixtures.sol[format][2]],
      });
    } finally {
      alias?.mockRestore();
    }
  },
);
it.each([
  'martianSignTransaction',
  'martianSignAndSubmitTransaction',
  'signAndSubmitTransactionStandardV1',
])('Aptos %s sender', async (method) => {
  const h = setup('aptos');
  await h.rejects(method, fixtures.aptos[1]);
  await h.accepts(method, fixtures.aptos[0]);
});
it('checks all NEAR signers/keys before the first batch confirmation', async () => {
  const h = setup('near', fixtures.near.address);
  h.account.pub = fixtures.near.pub;
  for (const invalid of fixtures.near.transactions.slice(1)) {
    await h.rejects('near_sendTransactions', {
      transactions: [fixtures.near.transactions[0], invalid],
    });
  }
  h.approve.mockResolvedValue({ txid: 'txid' });
  await expect(
    h.run('near_requestSignTransactions', {
      transactions: [fixtures.near.transactions[0]],
    }),
  ).resolves.toEqual({ transactionHashes: ['txid'] });
  expect(h.approve).toHaveBeenCalledWith(
    expect.objectContaining({ encodedTx: fixtures.near.transactions[0] }),
  );
});
it('preserves Algorand rekey/skip selection and rejects a foreign sender', async () => {
  const h = setup('algo', fixtures.algo.address);
  const [own, foreign] = fixtures.algo.transactions;
  await h.rejects('algo_signTxn', [{ txn: own }, { txn: foreign }]);

  h.approve.mockResolvedValue({ rawTx: 'signed' });
  await expect(
    h.run('algo_signTxn', [
      { txn: own, signers: [] },
      { txn: own, signers: [h.account.address] },
      { txn: foreign, authAddr: h.account.address },
    ]),
  ).resolves.toEqual([null, null, 'signed']);
  expect(h.approve).toHaveBeenCalledWith(
    expect.objectContaining({ encodedTx: [foreign] }),
  );
});

it('Tron preserves explicit permissions and rejects foreign owners', async () => {
  for (const [index, raw] of fixtures.tron.transactions.entries()) {
    const h = setup('tron', fixtures.tron.address);
    const rawData = tronUtils.deserializeTx.deserializeTransaction(
      'TransferContract',
      raw,
    ) as { contract: { Permission_id?: number | string }[] };
    if (index === 1) rawData.contract[0].Permission_id = '0';
    const tx = {
      raw_data: rawData,
      raw_data_hex: raw,
      txID: createHash('sha256').update(raw, 'hex').digest('hex'),
    };
    if (index < 2) {
      for (const permission of index === 0 ? [undefined, 0] : ['0']) {
        rawData.contract[0].Permission_id = permission;
        await h.rejects('tron_signTransaction', tx);
      }
      await h.rejects(
        'personal_sign',
        message,
        'TCf5cqRffPccWpnN6LMTaD2cTCDEuqbnkD',
      );
      await h.accepts('signMessageV2', message, h.account.address);
    } else {
      await h.accepts('tron_signTransaction', tx);
    }
  }
});

it('preserves Babylon PSBT bytes and signer options', async () => {
  initBitcoinEcc();
  const { address, pub, psbt, uncompressed } = fixtures.babylon;
  const fixture = Psbt.fromHex(psbt).data.inputs[0];
  expect(fixture.witnessUtxo?.script).not.toEqual(
    bitcoinAddress.toOutputScript(address, networks.testnet),
  );
  expect(
    fixture.tapLeafScript?.some((leaf) =>
      Buffer.from(leaf.script).includes(Buffer.from(pub.slice(2), 'hex')),
    ),
  ).toBe(true);
  for (const publicKey of [undefined, pub, pub.slice(2), uncompressed]) {
    const h = setup('btc', address);
    h.account.pub = pub;
    h.approve.mockResolvedValue({ psbtHex: psbt });
    const input = {
      index: 0,
      publicKey,
      sighashTypes: [1],
      useTweakedSigner: false,
      disableTweakSigner: true,
    };
    const options = {
      autoFinalized: false,
      isBtcWalletProvider: true,
      toSignInputs: publicKey ? [input] : undefined,
    };
    const params = { psbtHex: psbt, options };
    const before = cloneDeep(params);
    await expect(h.run('signPsbt', params)).resolves.toBe(psbt);
    expect(params).toStrictEqual(before);
    const selected = publicKey
      ? { ...input, publicKey, address }
      : { index: 0, publicKey: pub, address };
    expect(h.approve.mock.calls[0][0]).toMatchObject({
      encodedTx: { psbtHex: psbt, inputsToSign: [selected] },
    });
  }
});
it('validates owned BTC derivations and preflights legacy batch identities', async () => {
  const { main, custom, claimed, xpub } = fixtures.btc;
  const h = setup('btc', main.address);
  Object.assign(h.account, {
    pub: main.publicKey,
    xpub,
    addresses: { '0/0': main.address },
    customAddresses: { '1/0': custom.address },
    findAddresses: { '0/100': claimed.address },
  });
  for (const input of [main, custom, claimed]) {
    await h.accepts('signPsbt', {
      psbtHex: fixtures.babylon.psbt,
      options: { toSignInputs: [{ index: 0, ...input }] },
    });
  }
  h.approve.mockClear();
  for (const input of [
    { address: fixtures.babylon.address },
    { publicKey: fixtures.babylon.pub },
    { address: claimed.address, publicKey: main.publicKey },
  ]) {
    await h.rejects('signPsbts', {
      psbtHexs: [fixtures.babylon.psbt, fixtures.babylon.psbt],
      options: [
        { toSignInputs: [{ index: 0, address: main.address }] },
        { toSignInputs: [{ index: 0, ...input }] },
      ],
    });
  }
});
it.each(['btc', 'sol'] as const)(
  '%s rejects a changed signing account',
  async (chain) => {
    const h = setup(
      chain,
      chain === 'sol' ? fixtures.sol.address : fixtures.babylon.address,
    );
    const changed = {
      account: { ...h.account, id: 'other-account' },
      accountInfo: { ...h.connection.accountInfo, accountId: 'other-account' },
    };
    h.connections
      .mockResolvedValueOnce([h.connection])
      .mockResolvedValue([changed]);
    const params =
      chain === 'sol'
        ? { message: [fixtures.sol.legacy[0]] }
        : {
            psbtHexs: [fixtures.babylon.psbt],
            options: { autoFinalized: false },
          };
    await h.rejects(
      chain === 'sol' ? 'signAllTransactions' : 'signPsbts',
      params,
    );
  },
);
