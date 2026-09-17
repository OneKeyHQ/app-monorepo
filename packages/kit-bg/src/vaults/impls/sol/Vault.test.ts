/*
yarn jest packages/kit-bg/src/vaults/impls/sol/Vault.test.ts

Covers the Solana blockhash lifecycle around signing and pending history
(OK-63381): the pre-sign blockhash refresh, its skip rules, the dropped
detection for pending txs that never reached the ledger, and the custom RPC
"Blockhash not found" retry parity.
*/
import {
  Keypair,
  SystemProgram,
  Transaction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import bs58 from 'bs58';

import { parseToNativeTx } from '@onekeyhq/core/src/chains/sol/sdkSol/parse';
import type { IEncodedTxSol } from '@onekeyhq/core/src/chains/sol/types';
import type { ISignedTxPro, IUnsignedTxPro } from '@onekeyhq/core/src/types';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IDBCustomRpc } from '@onekeyhq/shared/types/customRpc';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

// Importing the vault pulls in the localDb singleton, whose constructor opens
// IndexedDB at module load and crashes under jest's node environment.
jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

// eslint-disable-next-line import/first
import { VaultBase } from '../../base/VaultBase';

// eslint-disable-next-line import/first
import { ClientCustomRpcSol } from './sdkSol/ClientCustomRpcSol';
// eslint-disable-next-line import/first
import SolVault from './Vault';

// eslint-disable-next-line import/first
import type { FailedAttemptError } from 'p-retry';

const OLD_BLOCKHASH = bs58.encode(Buffer.alloc(32, 1));
const NEW_BLOCKHASH = bs58.encode(Buffer.alloc(32, 2));
const NEW_LAST_VALID_BLOCK_HEIGHT = 12_345;

const payer = Keypair.generate();
const otherSigner = Keypair.generate();
const recipient = Keypair.generate();
const nonceAccount = Keypair.generate();

const transferIx = SystemProgram.transfer({
  fromPubkey: payer.publicKey,
  toPubkey: recipient.publicKey,
  lamports: 1,
});
const otherSignerTransferIx = SystemProgram.transfer({
  fromPubkey: otherSigner.publicKey,
  toPubkey: recipient.publicKey,
  lamports: 1,
});
const nonceAdvanceIx = SystemProgram.nonceAdvance({
  noncePubkey: nonceAccount.publicKey,
  authorizedPubkey: payer.publicKey,
});

function buildLegacyEncodedTx(
  instructions: Parameters<Transaction['add']>,
): IEncodedTxSol {
  const tx = new Transaction({
    recentBlockhash: OLD_BLOCKHASH,
    feePayer: payer.publicKey,
  }).add(...instructions);
  return bs58.encode(
    tx.serialize({ requireAllSignatures: false, verifySignatures: false }),
  );
}

function buildVersionedEncodedTx(
  instructions: Parameters<Transaction['add']>,
): IEncodedTxSol {
  const message = new TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash: OLD_BLOCKHASH,
    instructions: instructions as ConstructorParameters<
      typeof TransactionMessage
    >[0]['instructions'],
  }).compileToV0Message();
  return bs58.encode(
    Buffer.from(new VersionedTransaction(message).serialize()),
  );
}

function readBlockhash(encodedTx: IEncodedTxSol): string | undefined {
  const nativeTx = parseToNativeTx(encodedTx);
  if (nativeTx instanceof VersionedTransaction) {
    return nativeTx.message.recentBlockhash;
  }
  return nativeTx?.recentBlockhash;
}

// Instantiating the full vault requires a backgroundApi context; the methods
// under test only reach the RPC through the spied helpers below.
function buildVault() {
  const vault = Object.create(SolVault.prototype) as SolVault;
  vault.networkId = 'sol--101';
  const getRecentBlockHash = jest
    .spyOn(vault, '_getRecentBlockHash')
    .mockResolvedValue({
      recentBlockhash: NEW_BLOCKHASH,
      lastValidBlockHeight: NEW_LAST_VALID_BLOCK_HEIGHT,
    });
  return { vault, getRecentBlockHash };
}

function buildUnsignedTx(encodedTx: IEncodedTxSol): IUnsignedTxPro {
  return {
    encodedTx,
    payload: { feePayer: payer.publicKey.toBase58() },
    uuid: 'uuid-1',
  };
}

function buildPendingTx({
  txid,
  createdAt,
}: {
  txid: string;
  createdAt?: number;
}): IAccountHistoryTx {
  return {
    id: `sol--101_${txid}`,
    isLocalCreated: true,
    decodedTx: {
      txid,
      createdAt,
      status: EDecodedTxStatus.Pending,
      networkId: 'sol--101',
      accountId: 'hd-1--0',
    },
  } as unknown as IAccountHistoryTx;
}

describe('SolVault.refreshUnsignedTxBeforeSign', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('re-stamps a single-signer legacy tx with a fresh blockhash', async () => {
    const { vault, getRecentBlockHash } = buildVault();
    const unsignedTx = buildUnsignedTx(buildLegacyEncodedTx([transferIx]));

    const refreshed = await vault.refreshUnsignedTxBeforeSign(unsignedTx);

    expect(getRecentBlockHash).toHaveBeenCalledTimes(1);
    expect(readBlockhash(refreshed.encodedTx as IEncodedTxSol)).toBe(
      NEW_BLOCKHASH,
    );
    expect(refreshed.payload).toEqual(unsignedTx.payload);
    expect(refreshed.uuid).toBe(unsignedTx.uuid);
    // The original object is left untouched for callers that still hold it.
    expect(readBlockhash(unsignedTx.encodedTx as IEncodedTxSol)).toBe(
      OLD_BLOCKHASH,
    );
  });

  it('re-stamps a single-signer versioned tx with a fresh blockhash', async () => {
    const { vault } = buildVault();
    const unsignedTx = buildUnsignedTx(buildVersionedEncodedTx([transferIx]));

    const refreshed = await vault.refreshUnsignedTxBeforeSign(unsignedTx);

    const nativeTx = parseToNativeTx(refreshed.encodedTx as IEncodedTxSol);
    expect(nativeTx).toBeInstanceOf(VersionedTransaction);
    expect(readBlockhash(refreshed.encodedTx as IEncodedTxSol)).toBe(
      NEW_BLOCKHASH,
    );
  });

  it('leaves a multi-signer tx untouched', async () => {
    const { vault, getRecentBlockHash } = buildVault();
    const legacy = buildUnsignedTx(
      buildLegacyEncodedTx([transferIx, otherSignerTransferIx]),
    );
    const versioned = buildUnsignedTx(
      buildVersionedEncodedTx([transferIx, otherSignerTransferIx]),
    );

    expect(await vault.refreshUnsignedTxBeforeSign(legacy)).toBe(legacy);
    expect(await vault.refreshUnsignedTxBeforeSign(versioned)).toBe(versioned);
    expect(getRecentBlockHash).not.toHaveBeenCalled();
  });

  it('leaves a durable-nonce tx untouched', async () => {
    const { vault, getRecentBlockHash } = buildVault();
    const legacy = buildUnsignedTx(
      buildLegacyEncodedTx([nonceAdvanceIx, transferIx]),
    );
    const versioned = buildUnsignedTx(
      buildVersionedEncodedTx([nonceAdvanceIx, transferIx]),
    );

    expect(await vault.refreshUnsignedTxBeforeSign(legacy)).toBe(legacy);
    expect(await vault.refreshUnsignedTxBeforeSign(versioned)).toBe(versioned);
    expect(getRecentBlockHash).not.toHaveBeenCalled();
  });

  it('falls back to the original tx when the blockhash fetch fails', async () => {
    const { vault, getRecentBlockHash } = buildVault();
    getRecentBlockHash.mockRejectedValue(new Error('rpc down'));
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const unsignedTx = buildUnsignedTx(buildLegacyEncodedTx([transferIx]));

    expect(await vault.refreshUnsignedTxBeforeSign(unsignedTx)).toBe(
      unsignedTx,
    );
  });
});

describe('SolVault.getDroppedPendingTxs', () => {
  const now = 1_700_000_000_000;
  const oldEnough = now - timerUtils.getTimeDurationMs({ minute: 3 });
  const tooRecent = now - timerUtils.getTimeDurationMs({ minute: 1 });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('drops only aged pending txs the chain has never seen', async () => {
    const { vault } = buildVault();
    jest.spyOn(Date, 'now').mockReturnValue(now);
    const getSignatureStatuses = jest
      .spyOn(vault, 'getSignatureStatuses')
      .mockResolvedValue([null, { confirmationStatus: 'confirmed' }]);
    const unseen = buildPendingTx({ txid: 'sig-unseen', createdAt: oldEnough });
    const landed = buildPendingTx({ txid: 'sig-landed', createdAt: oldEnough });
    const fresh = buildPendingTx({ txid: 'sig-fresh', createdAt: tooRecent });
    const unstamped = buildPendingTx({ txid: 'sig-unstamped' });

    const dropped = await vault.getDroppedPendingTxs({
      pendingTxs: [fresh, unseen, unstamped, landed],
    });

    expect(getSignatureStatuses).toHaveBeenCalledWith([
      'sig-unseen',
      'sig-landed',
    ]);
    expect(dropped).toEqual([unseen]);
  });

  it('skips the RPC when no pending tx is old enough', async () => {
    const { vault } = buildVault();
    jest.spyOn(Date, 'now').mockReturnValue(now);
    const getSignatureStatuses = jest.spyOn(vault, 'getSignatureStatuses');

    const dropped = await vault.getDroppedPendingTxs({
      pendingTxs: [buildPendingTx({ txid: 'sig-fresh', createdAt: tooRecent })],
    });

    expect(dropped).toEqual([]);
    expect(getSignatureStatuses).not.toHaveBeenCalled();
  });

  it('keeps every pending tx when the status lookup fails or is malformed', async () => {
    const { vault } = buildVault();
    jest.spyOn(Date, 'now').mockReturnValue(now);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const pendingTxs = [
      buildPendingTx({ txid: 'sig-a', createdAt: oldEnough }),
      buildPendingTx({ txid: 'sig-b', createdAt: oldEnough }),
    ];
    const getSignatureStatuses = jest
      .spyOn(vault, 'getSignatureStatuses')
      .mockRejectedValueOnce(new Error('rpc down'))
      .mockResolvedValueOnce([null]);

    expect(await vault.getDroppedPendingTxs({ pendingTxs })).toEqual([]);
    expect(await vault.getDroppedPendingTxs({ pendingTxs })).toEqual([]);
    expect(getSignatureStatuses).toHaveBeenCalledTimes(2);
  });
});

describe('SolVault.checkShouldRetryBroadcastTx', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  function buildError(
    fields: { code?: number; message?: string },
    attemptNumber = 1,
  ): FailedAttemptError {
    const error = new Error(fields.message ?? 'boom');
    return Object.assign(error, {
      code: fields.code,
      attemptNumber,
      retriesLeft: 1,
    }) as unknown as FailedAttemptError;
  }

  it('retries the proxy blockhash-not-found code', async () => {
    const { vault } = buildVault();
    const wait = jest.spyOn(timerUtils, 'wait').mockResolvedValue(undefined);

    expect(
      await vault.checkShouldRetryBroadcastTx(buildError({ code: 40_028 }, 2)),
    ).toBe(true);
    expect(wait).toHaveBeenCalledWith(2000);
  });

  it('retries the custom RPC blockhash-not-found message', async () => {
    const { vault } = buildVault();
    jest.spyOn(timerUtils, 'wait').mockResolvedValue(undefined);

    expect(
      await vault.checkShouldRetryBroadcastTx(
        buildError({
          message:
            'Error JSON RPC response: Transaction simulation failed: Blockhash not found',
        }),
      ),
    ).toBe(true);
  });

  it('does not retry other broadcast failures', async () => {
    const { vault } = buildVault();
    const wait = jest.spyOn(timerUtils, 'wait').mockResolvedValue(undefined);

    expect(
      await vault.checkShouldRetryBroadcastTx(
        buildError({
          message:
            'Error JSON RPC response: Transaction simulation failed: insufficient funds',
        }),
      ),
    ).toBe(false);
    expect(wait).not.toHaveBeenCalled();
  });
});

describe('SolVault broadcast error copy', () => {
  const signedTx: ISignedTxPro = {
    txid: '',
    rawTx: 'cmF3',
    encodedTx: 'encoded',
  };
  const broadcastParams = {
    accountId: 'hd-1--0',
    networkId: 'sol--101',
    signedTx,
    accountAddress: payer.publicKey.toBase58(),
  };
  const nodeError = new Error(
    'Error JSON RPC response: Transaction simulation failed: Blockhash not found',
  );

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('replaces the custom RPC blockhash rejection with the expired copy', async () => {
    const { vault } = buildVault();
    jest
      .spyOn(ClientCustomRpcSol.prototype, 'broadcastTransaction')
      .mockRejectedValue(nodeError);

    const promise = vault.broadcastTransactionFromCustomRpc({
      ...broadcastParams,
      customRpcInfo: { rpc: 'https://rpc.example' } as IDBCustomRpc,
    });

    await expect(promise).rejects.toMatchObject({
      message: 'Transaction expired, please try again.',
      code: 40_028,
    });
  });

  it('replaces the proxy blockhash rejection with the expired copy', async () => {
    const { vault } = buildVault();
    jest
      .spyOn(VaultBase.prototype, 'broadcastTransaction')
      .mockRejectedValue(
        Object.assign(new Error('server text'), { code: 40_028 }),
      );

    await expect(
      vault.broadcastTransaction(broadcastParams),
    ).rejects.toMatchObject({
      message: 'Transaction expired, please try again.',
      code: 40_028,
    });
  });

  it('passes other broadcast failures through untouched', async () => {
    const { vault } = buildVault();
    const insufficient = new Error('insufficient funds');
    jest
      .spyOn(VaultBase.prototype, 'broadcastTransaction')
      .mockRejectedValue(insufficient);

    await expect(vault.broadcastTransaction(broadcastParams)).rejects.toBe(
      insufficient,
    );
  });
});
