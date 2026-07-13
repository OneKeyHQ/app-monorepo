import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import {
  ComputeBudgetInstruction,
  PublicKey,
  SystemInstruction,
  VersionedTransaction,
} from '@solana/web3.js';
import bs58 from 'bs58';

import * as rpcClient from '../core/sol/rpc-client';
import { buildSolTransferTx } from '../core/sol/tx-builder';

// jest.mock is hoisted above all imports by babel-jest. We can't reference
// outer consts directly (they would TDZ at factory-invocation time, since
// tx-builder pulls in rpc-client during its top-level import). Instead the
// factory creates fresh jest.fn() instances; the suite captures them after
// the import via the namespace-import alias so each test can prime mocks.
jest.mock('../core/sol/rpc-client', () => ({
  __esModule: true,
  getSolLatestBlockhash: jest.fn(),
  getSolRecentMaxPrioritizationFee: jest.fn(),
  getSolAccountInfo: jest.fn(),
  getSolTokenAccountsByOwner: jest.fn(),
}));

const getSolLatestBlockhash =
  rpcClient.getSolLatestBlockhash as jest.MockedFunction<
    typeof rpcClient.getSolLatestBlockhash
  >;
const getSolRecentMaxPrioritizationFee =
  rpcClient.getSolRecentMaxPrioritizationFee as jest.MockedFunction<
    typeof rpcClient.getSolRecentMaxPrioritizationFee
  >;
const getSolAccountInfo = rpcClient.getSolAccountInfo as jest.MockedFunction<
  typeof rpcClient.getSolAccountInfo
>;
const getSolTokenAccountsByOwner =
  rpcClient.getSolTokenAccountsByOwner as jest.MockedFunction<
    typeof rpcClient.getSolTokenAccountsByOwner
  >;

// Real SOL system program ID — used as a recognizable on-curve test address.
const FROM = '11111111111111111111111111111111';
const TO = 'So11111111111111111111111111111111111111112'; // wrapped-SOL mint, on-curve
const RECENT_BLOCKHASH = '8WTbMvAJxpMC1eX5XmuztkZQGfYaWwXJTtWrm6tVgRgi';

function decodeMessage(encodedTx: string) {
  const tx = VersionedTransaction.deserialize(bs58.decode(encodedTx));
  expect(tx.message.version).toBe(0);
  return tx.message;
}

describe('buildSolTransferTx — native SOL', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getSolLatestBlockhash.mockResolvedValue({
      recentBlockhash: RECENT_BLOCKHASH,
      lastValidBlockHeight: 0,
    });
    getSolRecentMaxPrioritizationFee.mockResolvedValue(7777);
  });

  it('builds a v0 VersionedTransaction with priority fee + System.Transfer', async () => {
    const result = await buildSolTransferTx({
      networkId: 'sol--101',
      fromAddress: FROM,
      toAddress: TO,
      amount: '1.5',
      decimals: 9,
    });

    expect(result.ataDetails).toBeUndefined();
    const message = decodeMessage(result.encodedTx as unknown as string);
    expect(message.recentBlockhash).toBe(RECENT_BLOCKHASH);

    // Two compiled instructions: ComputeBudget setComputeUnitPrice + Transfer.
    expect(message.compiledInstructions).toHaveLength(2);

    const accountKeys = message.staticAccountKeys.map((k) => k.toBase58());
    const programIdsByInstruction = message.compiledInstructions.map(
      (ix) => accountKeys[ix.programIdIndex],
    );
    expect(programIdsByInstruction).toEqual([
      'ComputeBudget111111111111111111111111111111',
      '11111111111111111111111111111111',
    ]);

    // Decode priority fee — confirms the unit-price (microLamports) wires through.
    const cbIx = message.compiledInstructions[0];
    const cbType = ComputeBudgetInstruction.decodeInstructionType({
      programId: new PublicKey(programIdsByInstruction[0]),
      keys: [],
      data: Buffer.from(cbIx.data),
    });
    expect(cbType).toBe('SetComputeUnitPrice');

    // Decode lamports — confirms human-amount → BigInt(decimals) conversion.
    const transferIx = message.compiledInstructions[1];
    const decoded = SystemInstruction.decodeTransfer({
      programId: new PublicKey(programIdsByInstruction[1]),
      keys: transferIx.accountKeyIndexes.map((i) => ({
        pubkey: message.staticAccountKeys[i],
        isSigner: false,
        isWritable: true,
      })),
      data: Buffer.from(transferIx.data),
    });
    expect(decoded.lamports.toString()).toBe('1500000000');

    expect(getSolRecentMaxPrioritizationFee).toHaveBeenCalledWith('sol--101', [
      FROM,
    ]);
    expect(getSolAccountInfo).not.toHaveBeenCalled();
    expect(getSolTokenAccountsByOwner).not.toHaveBeenCalled();
  });

  it('rejects amounts whose decimal count exceeds the chain decimals', async () => {
    await expect(
      buildSolTransferTx({
        networkId: 'sol--101',
        fromAddress: FROM,
        toAddress: TO,
        amount: '0.0000000001', // 10 decimals > 9
        decimals: 9,
      }),
    ).rejects.toThrow(/more decimals/);
  });

  it('rejects non-positive amounts', async () => {
    await expect(
      buildSolTransferTx({
        networkId: 'sol--101',
        fromAddress: FROM,
        toAddress: TO,
        amount: '0',
        decimals: 9,
      }),
    ).rejects.toThrow(/Invalid SOL transfer amount/);
  });
});

describe('buildSolTransferTx — SPL token', () => {
  // USDC mint — deterministic, on-curve, well-known mainnet shape.
  const MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

  beforeEach(() => {
    jest.clearAllMocks();
    getSolLatestBlockhash.mockResolvedValue({
      recentBlockhash: RECENT_BLOCKHASH,
      lastValidBlockHeight: 0,
    });
    getSolRecentMaxPrioritizationFee.mockResolvedValue(0);
    // Default: source has no token accounts → fall back to TOKEN_PROGRAM_ID.
    getSolTokenAccountsByOwner.mockResolvedValue([]);
  });

  it('returns ataDetails AND prepends create-ATA when destination ATA is missing', async () => {
    getSolAccountInfo.mockResolvedValue(null);

    const result = await buildSolTransferTx({
      networkId: 'sol--101',
      fromAddress: FROM,
      toAddress: TO,
      amount: '1',
      decimals: 6,
      tokenAddress: MINT,
    });

    const expectedDestAta = getAssociatedTokenAddressSync(
      new PublicKey(MINT),
      new PublicKey(TO),
      true,
      TOKEN_PROGRAM_ID,
    ).toBase58();

    expect(result.ataDetails).toEqual([
      {
        owner: TO,
        programId: TOKEN_PROGRAM_ID.toBase58(),
        mintAddress: MINT,
        associatedTokenAddress: expectedDestAta,
      },
    ]);

    const message = decodeMessage(result.encodedTx as unknown as string);
    // 3 instructions: priority fee + create-ATA + transfer-checked.
    expect(message.compiledInstructions).toHaveLength(3);

    const accountKeys = message.staticAccountKeys.map((k) => k.toBase58());
    const programIds = message.compiledInstructions.map(
      (ix) => accountKeys[ix.programIdIndex],
    );
    expect(programIds[0]).toBe('ComputeBudget111111111111111111111111111111');
    expect(programIds[1]).toBe(ASSOCIATED_TOKEN_PROGRAM_ID.toBase58());
    expect(programIds[2]).toBe(TOKEN_PROGRAM_ID.toBase58());

    expect(getSolAccountInfo).toHaveBeenCalledWith('sol--101', expectedDestAta);
  });

  it('skips create-ATA when destination ATA already exists', async () => {
    // The tx-builder only checks for non-null on the destination-ATA lookup,
    // so a minimally-shaped mock is enough — types are loosened to bypass
    // the @solana AccountInfo generic without dragging in a Buffer/PublicKey
    // dance for a value the production code never reads.
    getSolAccountInfo.mockResolvedValue({
      data: ['', 'base64'],
      executable: false,
      lamports: 2_039_280,
      owner: TOKEN_PROGRAM_ID,
      rentEpoch: 0,
    } as unknown as Awaited<ReturnType<typeof rpcClient.getSolAccountInfo>>);

    const result = await buildSolTransferTx({
      networkId: 'sol--101',
      fromAddress: FROM,
      toAddress: TO,
      amount: '1',
      decimals: 6,
      tokenAddress: MINT,
    });

    expect(result.ataDetails).toBeUndefined();
    const message = decodeMessage(result.encodedTx as unknown as string);
    expect(message.compiledInstructions).toHaveLength(2); // priority fee + transfer-checked
  });
});
