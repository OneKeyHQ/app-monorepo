import {
  AccountAddress,
  ChainId,
  EntryFunction,
  RawTransaction,
  SimpleTransaction,
  TransactionPayloadEntryFunction,
} from '@aptos-labs/ts-sdk';
import {
  Keypair,
  Message,
  SystemProgram,
  Transaction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import sdkAlgo from 'algosdk';
import bs58 from 'bs58';
import { utils as nearUtils, transactions } from 'near-api-js';
import { TronWeb, utils as tronUtils } from 'tronweb';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import ProviderApiAlgo from './ProviderApiAlgo';
import ProviderApiAptos from './ProviderApiAptos';
import ProviderApiNear from './ProviderApiNear';
import ProviderApiSolana from './ProviderApiSolana';
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
jest.mock('../vaults/factory', () => ({ vaultFactory: {} }));
jest.mock('./backgroundProviders', () => ({ providerApiLoaders: {} }));

const approval = new Error('confirmation reached');
function setup(address: string, pub = '') {
  const account = {
    id: 'account-a',
    address,
    pub,
    addressDetail: { normalizedAddress: address },
  };
  const openSignAndSendTransactionModal = jest.fn(
    async (_params: { accountId: string }): Promise<{ rawTx: string }> => {
      throw approval;
    },
  );
  const dAppGetConnectedAccountsInfo = jest.fn().mockResolvedValue([
    {
      account,
      accountInfo: {
        accountId: account.id,
        networkId: 'test-network',
        address: 'stale-address',
      },
    },
  ]);
  const request: IJsBridgeMessagePayload = {
    origin: 'https://transactions.example',
  };
  const backgroundApi = {
    serviceDApp: {
      dAppGetConnectedAccountsInfo,
      openSignAndSendTransactionModal,
    },
  };
  return {
    account,
    backgroundApi,
    request,
    openSignAndSendTransactionModal,
    dAppGetConnectedAccountsInfo,
  };
}

describe('Solana transaction signers', () => {
  const a = Keypair.generate().publicKey;
  const b = Keypair.generate().publicKey;
  const blockhash = Keypair.generate().publicKey.toBase58();
  function encoded(
    signer = a,
    versioned = false,
    cosigner = false,
    recipient = b,
  ) {
    const instructions = [
      SystemProgram.transfer({
        fromPubkey: signer,
        toPubkey: recipient,
        lamports: 1,
      }),
    ];
    if (cosigner)
      instructions.push(
        SystemProgram.transfer({ fromPubkey: a, toPubkey: b, lamports: 1 }),
      );
    if (versioned) {
      return bs58.encode(
        new VersionedTransaction(
          new TransactionMessage({
            payerKey: signer,
            recentBlockhash: blockhash,
            instructions,
          }).compileToV0Message(),
        ).serialize(),
      );
    }
    const tx = new Transaction({
      feePayer: signer,
      recentBlockhash: blockhash,
    }).add(...instructions);
    return bs58.encode(
      tx.serialize({ requireAllSignatures: false, verifySignatures: false }),
    );
  }
  it.each([false, true])(
    'accepts A as a required signer, versioned=%s',
    async (versioned) => {
      const h = setup(a.toBase58());
      await expect(
        new ProviderApiSolana({
          backgroundApi: h.backgroundApi,
        }).signTransaction(h.request, { message: encoded(a, versioned) }),
      ).rejects.toBe(approval);
    },
  );
  it.each([false, true])(
    'accepts A as a cosigner while B pays fees, versioned=%s',
    async (versioned) => {
      const h = setup(a.toBase58());
      await expect(
        new ProviderApiSolana({
          backgroundApi: h.backgroundApi,
        }).signTransaction(h.request, { message: encoded(b, versioned, true) }),
      ).rejects.toBe(approval);
    },
  );
  it.each(['signTransaction', 'signAndSendTransaction'] as const)(
    'rejects B-only transactions in %s',
    async (method) => {
      const h = setup(a.toBase58());
      await expect(
        new ProviderApiSolana({ backgroundApi: h.backgroundApi })[method](
          h.request,
          { message: encoded(b) },
        ),
      ).rejects.toMatchObject({ code: 4100 });
      expect(h.openSignAndSendTransactionModal).not.toHaveBeenCalled();
    },
  );
  it('validates the entire batch before approving its first transaction', async () => {
    const h = setup(a.toBase58());
    await expect(
      new ProviderApiSolana({
        backgroundApi: h.backgroundApi,
      }).signAllTransactions(h.request, { message: [encoded(), encoded(b)] }),
    ).rejects.toMatchObject({ code: 4100 });
    expect(h.openSignAndSendTransactionModal).not.toHaveBeenCalled();
  });
  it('rejects a connection change instead of replacing the original signing account', async () => {
    const h = setup(a.toBase58());
    const connected = (id: string) => [
      {
        account: { ...h.account, id },
        accountInfo: { accountId: id, networkId: 'sol--101' },
      },
    ];
    h.dAppGetConnectedAccountsInfo.mockResolvedValueOnce(
      connected('account-a'),
    );
    h.dAppGetConnectedAccountsInfo.mockResolvedValue(connected('account-b'));
    await expect(
      new ProviderApiSolana({
        backgroundApi: h.backgroundApi,
      }).signAllTransactions(h.request, { message: [encoded(), encoded()] }),
    ).rejects.toMatchObject({ code: 4100 });
    expect(h.openSignAndSendTransactionModal).not.toHaveBeenCalled();
  });

  describe.each(['legacy', 'v0'] as const)(
    '%s native message fields',
    (format) => {
      const cases = (
        [
          'signTransaction',
          'signAllTransactions',
          'signAndSendTransaction',
        ] as const
      ).flatMap((method) =>
        (['signer', 'cosigner', 'recipient'] as const).map((role) => ({
          method,
          role,
        })),
      );
      it.each(cases)('$method with A as $role', async ({ method, role }) => {
        const h = setup(a.toBase58());
        const tx = encoded(
          role === 'signer' ? a : b,
          format === 'v0',
          role === 'cosigner',
          role === 'recipient' ? a : b,
        );
        // Exercise the native legacy interface without its versioned-message compatibility alias.
        const alias =
          format === 'legacy'
            ? jest
                .spyOn(Message.prototype, 'staticAccountKeys', 'get')
                .mockImplementation(() => {
                  throw new OneKeyLocalError(
                    'Legacy compatibility alias accessed',
                  );
                })
            : undefined;
        try {
          const provider = new ProviderApiSolana({
            backgroundApi: h.backgroundApi,
          });
          const result =
            method === 'signAllTransactions'
              ? provider.signAllTransactions(h.request, { message: [tx, tx] })
              : provider[method](h.request, { message: tx });
          if (role === 'recipient') {
            await expect(result).rejects.toMatchObject({ code: 4100 });
            expect(h.openSignAndSendTransactionModal).not.toHaveBeenCalled();
          } else {
            await expect(result).rejects.toBe(approval);
            expect(h.openSignAndSendTransactionModal).toHaveBeenCalledTimes(1);
          }
        } finally {
          alias?.mockRestore();
        }
      });
    },
  );
});

describe('NEAR signer and access key', () => {
  const pub = `ed25519:${bs58.encode(new Uint8Array(32).fill(1))}`;
  const otherPub = `ed25519:${bs58.encode(new Uint8Array(32).fill(2))}`;
  function encoded(signer = 'a.near', key = pub) {
    return Buffer.from(
      transactions
        .createTransaction(
          signer,
          nearUtils.PublicKey.fromString(key),
          'b.near',
          1,
          [],
          new Uint8Array(32),
        )
        .encode(),
    ).toString('base64');
  }
  it('accepts the connected named account and access key', async () => {
    const h = setup('a.near', pub);
    await expect(
      new ProviderApiNear({
        backgroundApi: h.backgroundApi,
      }).near_requestSignTransactions(h.request, {
        transactions: [encoded()],
        meta: {},
        send: true,
      }),
    ).rejects.toBe(approval);
  });
  it.each([encoded('b.near'), encoded('a.near', otherPub)])(
    'rejects a different signer or access key before any batch approval',
    async (invalid) => {
      const h = setup('a.near', pub);
      await expect(
        new ProviderApiNear({
          backgroundApi: h.backgroundApi,
        }).near_sendTransactions(h.request, {
          transactions: [encoded(), invalid],
          meta: {},
          send: true,
        }),
      ).rejects.toMatchObject({ code: 4100 });
      expect(h.openSignAndSendTransactionModal).not.toHaveBeenCalled();
    },
  );
});

describe('Algorand requested signers', () => {
  const a = sdkAlgo.generateAccount().addr;
  const b = sdkAlgo.generateAccount().addr;
  function encoded(from = a) {
    return Buffer.from(
      sdkAlgo
        .makePaymentTxnWithSuggestedParamsFromObject({
          from,
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
  }
  it('accepts the connected sender without changing the original selection', async () => {
    const h = setup(a);
    await expect(
      new ProviderApiAlgo({ backgroundApi: h.backgroundApi }).algo_signTxn(
        h.request,
        [{ txn: encoded() }],
      ),
    ).rejects.toBe(approval);
  });
  it('rejects another sender before any confirmation', async () => {
    const h = setup(a);
    await expect(
      new ProviderApiAlgo({ backgroundApi: h.backgroundApi }).algo_signTxn(
        h.request,
        [{ txn: encoded() }, { txn: encoded(b) }],
      ),
    ).rejects.toMatchObject({ code: 4100 });
    expect(h.openSignAndSendTransactionModal).not.toHaveBeenCalled();
  });
  it('preserves the original skip rule for both empty and non-empty signers arrays', async () => {
    const h = setup(a);
    h.openSignAndSendTransactionModal.mockResolvedValue({ rawTx: 'signed-a' });
    await expect(
      new ProviderApiAlgo({ backgroundApi: h.backgroundApi }).algo_signTxn(
        h.request,
        [
          { txn: encoded(b), signers: [] },
          { txn: encoded(b), signers: [b] },
          { txn: encoded() },
        ],
      ),
    ).resolves.toEqual([null, null, 'signed-a']);
    expect(h.openSignAndSendTransactionModal).toHaveBeenCalledWith(
      expect.objectContaining({ encodedTx: [encoded()] }),
    );
  });
  it('preserves explicit authorized-address signing without rewriting the transaction', async () => {
    const h = setup(a);
    const txn = encoded(b);
    await expect(
      new ProviderApiAlgo({ backgroundApi: h.backgroundApi }).algo_signTxn(
        h.request,
        [{ txn, authAddr: a }],
      ),
    ).rejects.toBe(approval);
    expect(h.openSignAndSendTransactionModal).toHaveBeenCalledWith(
      expect.objectContaining({ encodedTx: [txn] }),
    );
  });
});

describe('Aptos BCS transaction senders', () => {
  const a = `0x${'12'.repeat(32)}`;
  const b = `0x${'34'.repeat(32)}`;
  function encoded(sender: string) {
    const payload = new TransactionPayloadEntryFunction(
      EntryFunction.build('0x1::aptos_account', 'transfer', [], []),
    );
    return new SimpleTransaction(
      new RawTransaction(
        AccountAddress.fromString(sender),
        0n,
        payload,
        1000n,
        100n,
        2_000_000_000n,
        new ChainId(1),
      ),
    )
      .bcsToHex()
      .toStringWithoutPrefix();
  }
  it.each([
    'martianSignTransaction',
    'martianSignAndSubmitTransaction',
    'signAndSubmitTransactionStandardV1',
  ] as const)('%s accepts A and rejects B', async (method) => {
    const h = setup(a);
    const provider = new ProviderApiAptos({ backgroundApi: h.backgroundApi });
    await expect(provider[method](h.request, encoded(b))).rejects.toMatchObject(
      { code: 4100 },
    );
    expect(h.openSignAndSendTransactionModal).not.toHaveBeenCalled();
    await expect(provider[method](h.request, encoded(a))).rejects.toBe(
      approval,
    );
  });
});

describe('Tron owner and permission signers', () => {
  const a = 'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb';
  const b = TronWeb.address.fromHex(`41${'12'.repeat(20)}`);
  function encoded(owner: string, permission?: number | string) {
    const transaction = {
      txID: '',
      raw_data_hex: '',
      raw_data: {
        contract: [
          {
            type: 'TransferContract',
            Permission_id: permission,
            parameter: {
              type_url: 'type.googleapis.com/protocol.TransferContract',
              value: {
                owner_address: TronWeb.address.toHex(owner),
                to_address: TronWeb.address.toHex(a),
                amount: 1,
              },
            },
          },
        ],
        ref_block_bytes: '0a95',
        ref_block_hash: '81a16498bf36d557',
        expiration: 1_697_179_737_000,
        timestamp: 1_697_179_677_393,
      },
    };
    const pb: unknown = tronUtils.transaction.txJsonToPb(transaction);
    transaction.raw_data_hex = tronUtils.transaction.txPbToRawDataHex(pb);
    transaction.txID = tronUtils.transaction.txPbToTxID(pb).replace(/^0x/, '');
    return transaction;
  }
  it.each([undefined, 0, '0'])(
    'rejects a mismatched owner for default permission=%j',
    async (permission) => {
      const h = setup(a);
      await expect(
        new ProviderApiTron({
          backgroundApi: h.backgroundApi,
        }).tron_signTransaction(h.request, encoded(b, permission)),
      ).rejects.toMatchObject({ code: 4100 });
      expect(h.openSignAndSendTransactionModal).not.toHaveBeenCalled();
    },
  );
  it.each([encoded(a), encoded(b, 2)])(
    'preserves matching owner and explicit permission signing',
    async (tx) => {
      const h = setup(a);
      await expect(
        new ProviderApiTron({
          backgroundApi: h.backgroundApi,
        }).tron_signTransaction(h.request, tx),
      ).rejects.toBe(approval);
    },
  );
});
