import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  ComputeBudgetProgram,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import bs58 from 'bs58';

import { registerSwapExecuteCommand } from '../commands/swap/swap-execute';
import { _resetPendingDir, _setPendingDirForTest, savePending } from '../core';
import * as solRpcClient from '../core/sol/rpc-client';
import { apiClient } from '../infra';
import { getSignerByImpl } from '../signer';

import { createTestProgram, extractJson, runCommand } from './test-helpers';

import type { IPendingOrder } from '../core';

jest.mock('@onekeyhq/shared/src/request/customUA', () => ({
  withCustomUAHeaders: jest.fn(
    async (_url: string, headers: Record<string, string>) => headers,
  ),
}));

jest.mock('../infra', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    setEnv: jest.fn(),
  },
}));

jest.mock('../commands/command-guards', () => {
  const actual = jest.requireActual<
    typeof import('../commands/command-guards')
  >('../commands/command-guards');
  return {
    ...actual,
    requireAuthenticatedCommand: jest.fn(async () => undefined),
  };
});

jest.mock('../signer', () => ({
  getSignerByImpl: jest.fn(),
}));

jest.mock('../core/sol/rpc-client', () => ({
  __esModule: true,
  getSolLatestBlockhash: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/unbound-method
const mockPost = apiClient.post as jest.MockedFunction<typeof apiClient.post>;
const mockGetSignerByImpl = getSignerByImpl as jest.MockedFunction<
  typeof getSignerByImpl
>;
const mockGetSolLatestBlockhash =
  solRpcClient.getSolLatestBlockhash as jest.MockedFunction<
    typeof solRpcClient.getSolLatestBlockhash
  >;

const FROM_ADDRESS = 'So11111111111111111111111111111111111111112'; // wrapped-SOL mint, on-curve
const TO_ADDRESS = '11111111111111111111111111111111'; // System Program
const STALE_BLOCKHASH = '11111111111111111111111111111111';
const FRESH_BLOCKHASH = 'GfYaWwXJTtWrm6tVgRgi8WTbMvAJxpMC1eX5XmuztkZQ';

function buildBs58SolTx() {
  const message = new TransactionMessage({
    payerKey: new PublicKey(FROM_ADDRESS),
    recentBlockhash: STALE_BLOCKHASH,
    instructions: [
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      SystemProgram.transfer({
        fromPubkey: new PublicKey(FROM_ADDRESS),
        toPubkey: new PublicKey(TO_ADDRESS),
        lamports: BigInt(1),
      }),
    ],
  }).compileToV0Message([]);
  const tx = new VersionedTransaction(message);
  return bs58.encode(Buffer.from(tx.serialize()));
}

function registerSwapCommands() {
  const program = createTestProgram();
  const swap = program.command('swap');
  registerSwapExecuteCommand(swap);
  return program;
}

function makeSigner() {
  return {
    getAddress: jest.fn().mockResolvedValue({
      address: FROM_ADDRESS,
      path: "m/44'/501'/0'/0'",
      publicKey: FROM_ADDRESS,
    }),
    signTransaction: jest.fn().mockResolvedValue({
      rawTx: 'signed-sol-base64-rawtx',
      txid: 'placeholderTxid',
    }),
    signMessage: jest.fn(),
  };
}

function makePendingOrder(
  overrides: Partial<IPendingOrder> = {},
): IPendingOrder {
  const now = Date.now();
  return {
    orderId: 'sol_order',
    status: 'pending',
    chain: 'sol',
    networkId: 'sol--101',
    createdAt: now,
    updatedAt: now,
    fromToken: { contractAddress: '', symbol: 'SOL', decimals: 9 },
    toToken: { contractAddress: '', symbol: 'USDC', decimals: 6 },
    amount: '0.1',
    txData: {
      solSwapTx: { encodedTx: buildBs58SolTx() },
    },
    provider: 'okx-aggregator',
    toNetworkId: 'sol--101',
    protocolType: 'Swap',
    ...overrides,
  };
}

async function runExecute(args: string[] = []) {
  return runCommand(registerSwapCommands(), [
    '--yes',
    'swap',
    'execute',
    '--chain',
    'sol',
    '--order',
    'sol_order',
    ...args,
  ]);
}

describe('swap execute SOL OKX path', () => {
  let tempDir: string;

  beforeEach(() => {
    jest.clearAllMocks();
    process.exitCode = 0;
    tempDir = mkdtempSync(join(tmpdir(), 'swap-execute-sol-'));
    _setPendingDirForTest(tempDir);
    mockGetSignerByImpl.mockResolvedValue(makeSigner());
    mockGetSolLatestBlockhash.mockResolvedValue({
      recentBlockhash: FRESH_BLOCKHASH,
      lastValidBlockHeight: 12_345,
    });
    // Valid SOL signature shape (base58, 64 bytes → ~88 chars). Random
    // base58 chars; only the regex matters for the broadcast assertion.
    mockPost.mockResolvedValue({
      result:
        '5VERv8NMvTdAdRKf3xkAhEy3yBzBaRH6JxyznjRdGw9V8GhRoBLEhRgcGdwYatGrG7XmVD6tUL3yTmKiL5wPyQpW',
    });
  });

  afterEach(() => {
    _resetPendingDir();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('refreshes blockhash, signs via SOL signer, broadcasts via send-transaction', async () => {
    savePending('sol_order', makePendingOrder());

    const result = await runExecute();

    expect(result.exitCode).toBe(0);
    expect(mockGetSolLatestBlockhash).toHaveBeenCalledWith('sol--101');
    expect(mockGetSignerByImpl).toHaveBeenCalledWith('sol');

    const signer = await mockGetSignerByImpl.mock.results[0].value;
    expect(signer.signTransaction).toHaveBeenCalledTimes(1);
    const signCall = signer.signTransaction.mock.calls[0][0];

    // Decode the encodedTx handed to the signer and confirm the blockhash
    // was swapped from the stale value to the fresh one — this is the App
    // parity guard for OKX-routed SOL swaps (Vault.ts:1431).
    const refreshedTx = VersionedTransaction.deserialize(
      bs58.decode(signCall.unsignedTx.encodedTx as unknown as string),
    );
    expect(refreshedTx.message.recentBlockhash).toBe(FRESH_BLOCKHASH);
    expect(refreshedTx.message.recentBlockhash).not.toBe(STALE_BLOCKHASH);

    expect(signCall.account.path).toBe("m/44'/501'/0'/0'");
    expect(signCall.networkId).toBe('sol--101');

    expect(mockPost).toHaveBeenCalledWith(
      'wallet',
      '/wallet/v1/account/send-transaction',
      {
        networkId: 'sol--101',
        accountAddress: FROM_ADDRESS,
        tx: 'signed-sol-base64-rawtx',
      },
    );

    const parsed = JSON.parse(extractJson(result.stdout));
    expect(parsed.ok).toBe(true);
    expect(parsed.data.status).toBe('executed');
    expect(parsed.data.txHash).toMatch(/^[1-9A-HJ-NP-Za-km-z]{43,128}$/);
  });

  it('rejects when the persisted order is missing solSwapTx', async () => {
    savePending(
      'sol_order',
      makePendingOrder({
        txData: {} as Record<string, unknown>,
      }),
    );

    const result = await runExecute();

    expect(result.exitCode).not.toBe(0);
    expect(mockGetSignerByImpl).not.toHaveBeenCalled();
    const parsed = JSON.parse(extractJson(result.stdout));
    expect(parsed.error.code).toBe('BIZ_SWAP_FAILED');
    expect(parsed.error.message).toMatch(/solSwapTx/);
  });

  it('rejects --sign-only on SOL orders (BTC-only flag, must fail closed before broadcasting)', async () => {
    savePending('sol_order', makePendingOrder());

    const result = await runExecute(['--sign-only']);

    expect(result.exitCode).not.toBe(0);
    // Must reject BEFORE refreshing blockhash / signing / broadcasting.
    // Otherwise the user who passed --sign-only expecting "no broadcast"
    // would have their swap silently sent.
    expect(mockGetSolLatestBlockhash).not.toHaveBeenCalled();
    expect(mockGetSignerByImpl).not.toHaveBeenCalled();
    const parsed = JSON.parse(extractJson(result.stdout));
    expect(parsed.error.code).toBe('PARAM_INVALID_CONFIG');
    expect(parsed.error.message).toMatch(/sign-only.*BTC/i);
  });

  it('rejects when broadcast returns an invalid SOL txid', async () => {
    savePending('sol_order', makePendingOrder());
    mockPost.mockResolvedValueOnce({ result: 'not-a-valid-sol-sig!' });

    const result = await runExecute();

    expect(result.exitCode).not.toBe(0);
    const parsed = JSON.parse(extractJson(result.stdout));
    expect(parsed.error.code).toBe('BIZ_TRANSACTION_FAILED');
    expect(parsed.error.message).toMatch(/invalid txid/i);
  });

  it('handles legacy Transaction format too (refreshes blockhash before signing)', async () => {
    // Build a legacy (non-versioned) Transaction to exercise the
    // `nativeTx instanceof Transaction` branch — App accepts both shapes.
    // lastValidBlockHeight is set by the production code path but not
    // round-tripped through serialize/deserialize, so we only assert on
    // the recentBlockhash (the field the chain actually uses to expire txs).
    const legacy = new Transaction({
      recentBlockhash: STALE_BLOCKHASH,
      feePayer: new PublicKey(FROM_ADDRESS),
    }).add(
      SystemProgram.transfer({
        fromPubkey: new PublicKey(FROM_ADDRESS),
        toPubkey: new PublicKey(TO_ADDRESS),
        lamports: 1,
      }),
    );
    const legacyEncoded = bs58.encode(
      legacy.serialize({ requireAllSignatures: false }),
    );

    savePending(
      'sol_order',
      makePendingOrder({
        txData: { solSwapTx: { encodedTx: legacyEncoded } },
      }),
    );

    const result = await runExecute();

    expect(result.exitCode).toBe(0);
    const signer = await mockGetSignerByImpl.mock.results[0].value;
    const signCall = signer.signTransaction.mock.calls[0][0];
    const refreshed = Transaction.from(
      bs58.decode(signCall.unsignedTx.encodedTx as unknown as string),
    );
    expect(refreshed.recentBlockhash).toBe(FRESH_BLOCKHASH);
  });
});
