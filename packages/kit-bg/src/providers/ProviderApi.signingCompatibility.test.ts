import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import sdkAlgo from 'algosdk';
import { Psbt, address as bitcoinAddress } from 'bitcoinjs-lib';
import bs58 from 'bs58';
import { PubKey } from 'cosmjs-types/cosmos/crypto/secp256k1/keys';
import { AuthInfo, TxBody, TxRaw } from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import { cloneDeep } from 'lodash';

import {
  getBitcoinECPair,
  getBtcForkNetwork,
} from '@onekeyhq/core/src/chains/btc/sdkBtc';
import type { ISignPsbtOptions } from '@onekeyhq/shared/types/ProviderApis/ProviderApiBtc.type';

import ProviderApiAlgo from './ProviderApiAlgo';
import ProviderApiBtc from './ProviderApiBtc';
import ProviderApiCosmos from './ProviderApiCosmos';
import ProviderApiSolana from './ProviderApiSolana';
import ProviderApiStellar from './ProviderApiStellar';

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

// Snapshots are recorded by executing the unmodified providers at merge-base
// fe08dd0878eceb47f8a5aa4fe2cfb6b5e3db542d, then verified against this branch.
const request: IJsBridgeMessagePayload = {
  origin: 'https://compatibility.example',
};
function setup(
  address: string,
  pub = '',
  id = 'account-a',
  networkId = 'test-network',
) {
  const account = {
    id,
    address,
    pub,
    path: "m/44'/148'/0'",
    addressDetail: { normalizedAddress: address },
  };
  const message = jest.fn().mockResolvedValue('aabb');
  const transaction = jest.fn().mockResolvedValue({
    rawTx: 'AQI=',
    txid: 'transaction-id',
    signature: 'signature',
  });
  const createBatch = jest.fn().mockResolvedValue({ batchId: 'batch-id' });
  const batch = jest.fn().mockResolvedValue(['signed-psbt-0', 'signed-psbt-1']);
  const connection = jest
    .fn()
    .mockResolvedValue([
      { account, accountInfo: { accountId: id, networkId, address } },
    ]);
  const backgroundApi = {
    serviceDApp: {
      dAppGetConnectedAccountsInfo: connection,
      openSignMessageModal: message,
      openSignAndSendTransactionModal: transaction,
      openBatchTxConfirmModal: batch,
      switchConnectedNetwork: jest.fn(),
    },
    serviceAccount: { getAccount: jest.fn().mockResolvedValue(account) },
    serviceNetwork: {
      getNetwork: jest.fn().mockResolvedValue({ code: 'tbtc' }),
    },
    serviceSetting: {
      getEnableBTCFreshAddress: jest.fn().mockResolvedValue(false),
    },
    serviceBatchTxSign: { createBatch, disposeBatch: jest.fn() },
  };
  return {
    account,
    backgroundApi,
    message,
    transaction,
    connection,
    createBatch,
    batch,
  };
}

// Public Babylon devnet fixture already covered by sdkBtc/index.test.ts.
const babylonPsbt =
  '70736274ff01005e0200000001a1a9dd6bf28fd4d756be39c78325e98ee009dbc8d455631f05526989dab7a99c0000000000b001000001b06a14000000000022512053bea6a3e87c00ca8cfff0ebcc53acf2ae4590e208f3f4f6b6719c535c166529000000000001012bf06b140000000000225120025f94c02d52276a8e411d1265166a79426f470403b02a0e19c17fca41bc67d74215c050929b74c1a04954b78b4b6035e97a5e078a5a0f28ec96d547bfee9ace803ac0543f95859a7067673cafd4f4f70ae74468231a81f21afb71ce5da4f5edccf3912720358818f214fcd9d4ccc4296c9079ec25ed440b0df4acc34bedaa76c2c1955a19ad02b001b2c001172050929b74c1a04954b78b4b6035e97a5e078a5a0f28ec96d547bfee9ace803ac00000';
const btcAddress =
  'tb1p2wl2dglg0sqv4r8l7r4uc5av72hyty8zprelfa4kwxw9xhqkv55s3kz7ze';
const btcPub =
  '02358818f214fcd9d4ccc4296c9079ec25ed440b0df4acc34bedaa76c2c1955a19';
const btcNetwork = getBtcForkNetwork('tbtc');

describe('original successful signing behavior', () => {
  const btcCases: { name: string; options: ISignPsbtOptions }[] = [
    {
      name: 'Babylon automatic script-path input selection',
      options: { autoFinalized: false, isBtcWalletProvider: true },
    },
    ...[
      { index: 0 },
      { index: 0, address: btcAddress },
      { index: 0, publicKey: btcPub },
      { index: 0, publicKey: btcPub.slice(2) },
      {
        index: 0,
        publicKey: getBitcoinECPair()
          .fromPublicKey(Buffer.from(btcPub, 'hex'), { compressed: false })
          .publicKey.toString('hex'),
      },
      {
        index: 0,
        address: btcAddress,
        publicKey: btcPub,
        sighashTypes: [1],
        useTweakedSigner: false,
        disableTweakSigner: true,
      },
    ].map((input, index) => ({
      name: `Babylon explicit signing metadata ${index}`,
      options: { autoFinalized: false, toSignInputs: [input] },
    })),
  ];
  it.each(btcCases)(
    'keeps original signing payload and result: $name',
    async ({ options }) => {
      const h = setup(btcAddress, btcPub, 'qr-fixture', 'tbtc--0');
      const fixture = Psbt.fromHex(babylonPsbt, { network: btcNetwork });
      const input = fixture.data.inputs[0];
      expect(Buffer.from(input.witnessUtxo!.script)).not.toEqual(
        Buffer.from(bitcoinAddress.toOutputScript(btcAddress, btcNetwork)),
      );
      expect(
        input.tapLeafScript?.some((leaf) =>
          Buffer.from(leaf.script).includes(
            Buffer.from(btcPub.slice(2), 'hex'),
          ),
        ),
      ).toBe(true);
      h.transaction.mockResolvedValue({ psbtHex: babylonPsbt });
      const params = { psbtHex: babylonPsbt, options };
      const before = cloneDeep(params);
      const result = await new ProviderApiBtc({
        backgroundApi: h.backgroundApi,
      }).signPsbt(request, params);
      expect(params).toStrictEqual(before);
      expect(result).toBe(babylonPsbt);
      expect({ calls: h.transaction.mock.calls, result }).toMatchSnapshot(
        'baseline-fe08',
      );
    },
  );
  it.each(['qr-fixture', 'hd-fixture'])(
    'keeps original signing payload and result: Babylon legacy batch %s',
    async (id) => {
      const h = setup(btcAddress, btcPub, id, 'tbtc--0');
      h.transaction.mockResolvedValue({ psbtHex: babylonPsbt });
      const options = [
        {
          autoFinalized: false,
          toSignInputs: [
            { index: 0, publicKey: btcPub, useTweakedSigner: false },
          ],
        },
        { autoFinalized: false, isBtcWalletProvider: true },
      ];
      const result = await new ProviderApiBtc({
        backgroundApi: h.backgroundApi,
      }).signPsbts(request, { psbtHexs: [babylonPsbt, babylonPsbt], options });
      expect(result).toStrictEqual([babylonPsbt, babylonPsbt]);
      expect({ calls: h.transaction.mock.calls, result }).toMatchSnapshot(
        'baseline-fe08',
      );
    },
  );
  it('keeps original signing payload and result: BTC batch confirmation', async () => {
    const h = setup(btcAddress, btcPub, 'hd-fixture', 'tbtc--0');
    const make = (hash: number) =>
      new Psbt({ network: btcNetwork })
        .addInput({
          hash: Buffer.alloc(32, hash),
          index: 0,
          witnessUtxo: {
            script: Buffer.from(`5120${'11'.repeat(32)}`, 'hex'),
            value: 10_000n,
          },
        })
        .addOutput({ address: btcAddress, value: 9000n })
        .toHex();
    const result = await new ProviderApiBtc({
      backgroundApi: h.backgroundApi,
    }).signPsbts(request, {
      psbtHexs: [make(1), make(2)],
      options: {
        autoFinalized: false,
        toSignInputs: [{ index: 0, publicKey: btcPub }],
      },
    });
    expect({
      create: h.createBatch.mock.calls,
      confirm: h.batch.mock.calls,
      result,
    }).toMatchSnapshot('baseline-fe08');
  });
  const solA = new PublicKey(new Uint8Array(32).fill(1));
  const solB = new PublicKey(new Uint8Array(32).fill(2));
  const solTx = bs58.encode(
    new Transaction({ feePayer: solA, recentBlockhash: solB.toBase58() })
      .add(
        SystemProgram.transfer({
          fromPubkey: solA,
          toPubkey: solB,
          lamports: 1,
        }),
      )
      .serialize({ requireAllSignatures: false, verifySignatures: false }),
  );
  it.each([
    'signTransaction',
    'signAndSendTransaction',
    'signAllTransactions',
  ] as const)(
    'keeps original signing payload and result: Solana %s',
    async (method) => {
      const h = setup(solA.toBase58(), '', 'account-a', 'sol--101');
      const provider = new ProviderApiSolana({
        backgroundApi: h.backgroundApi,
      });
      const result =
        method === 'signAllTransactions'
          ? await provider.signAllTransactions(request, {
              message: [solTx, solTx],
            })
          : await provider[method](request, { message: solTx });
      expect({ calls: h.transaction.mock.calls, result }).toMatchSnapshot(
        'baseline-fe08',
      );
    },
  );
  it.each(['stellar_signMessage', 'stellar_signTransaction'] as const)(
    'keeps original signing payload and result: %s',
    async (method) => {
      const h = setup(
        'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
      );
      const params = {
        message: 'unchanged message',
        xdr: 'unchanged-xdr',
        networkPassphrase: 'test-passphrase',
      };
      const result = await new ProviderApiStellar({
        backgroundApi: h.backgroundApi,
      })[method](request, params);
      expect({
        message: h.message.mock.calls,
        transaction: h.transaction.mock.calls,
        result,
      }).toMatchSnapshot('baseline-fe08');
    },
  );
  it.each([false, true])(
    'keeps original signing payload and result: Algorand skipped inputs=%s',
    async (allSkipped) => {
      const a = sdkAlgo.encodeAddress(new Uint8Array(32).fill(1));
      const b = sdkAlgo.encodeAddress(new Uint8Array(32).fill(2));
      const txn = Buffer.from(
        sdkAlgo
          .makePaymentTxnWithSuggestedParamsFromObject({
            from: a,
            to: b,
            amount: 1,
            suggestedParams: {
              fee: 1000,
              flatFee: true,
              firstRound: 1,
              lastRound: 10,
              genesisID: 'test',
              genesisHash: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
            },
          })
          .toByte(),
      ).toString('base64');
      const h = setup(a);
      h.transaction.mockResolvedValue({ rawTx: 'signed-0,signed-1' });
      const transactions = [
        { txn, signers: [] },
        { txn, signers: [a] },
        ...(allSkipped ? [] : [{ txn }]),
      ];
      const result = await new ProviderApiAlgo({
        backgroundApi: h.backgroundApi,
      }).algo_signTxn(request, transactions);
      expect({ calls: h.transaction.mock.calls, result }).toMatchSnapshot(
        'baseline-fe08',
      );
    },
  );
  it.each(['signArbitrary', 'verifyArbitrary'] as const)(
    'keeps original signing payload and result: Cosmos %s',
    async (method) => {
      const h = setup(
        'cosmos1fixture',
        btcPub,
        'account-a',
        'cosmos--cosmoshub-4',
      );
      const signature = Buffer.alloc(64, 1);
      const pub = PubKey.encode({ key: Buffer.from(btcPub, 'hex') }).finish();
      const signed = TxRaw.encode({
        bodyBytes: TxBody.encode(TxBody.fromPartial({})).finish(),
        authInfoBytes: AuthInfo.encode(
          AuthInfo.fromPartial({
            signerInfos: [
              {
                publicKey: {
                  typeUrl: '/cosmos.crypto.secp256k1.PubKey',
                  value: pub,
                },
              },
            ],
          }),
        ).finish(),
        signatures: [signature],
      }).finish();
      h.message.mockResolvedValue(Buffer.from(signed).toString('base64'));
      const params = {
        chainId: 'cosmoshub-4',
        signer: h.account.address,
        data: 'unchanged ADR-36 message',
        signature: {
          signature: signature.toString('base64'),
          pub_key: {
            type: 'tendermint/PubKeySecp256k1',
            value: Buffer.from(btcPub, 'hex').toString('base64'),
          },
        },
      };
      const result = await new ProviderApiCosmos({
        backgroundApi: h.backgroundApi,
      })[method](request, params);
      expect({ calls: h.message.mock.calls, result }).toMatchSnapshot(
        'baseline-fe08',
      );
    },
  );
});
