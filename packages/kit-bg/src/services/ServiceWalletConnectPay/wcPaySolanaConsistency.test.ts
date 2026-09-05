import {
  AddressLookupTableAccount,
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  SYSVAR_RENT_PUBKEY,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import bs58 from 'bs58';

import { EWcPayErrorCode } from '@onekeyhq/shared/src/walletConnect/payErrors';
import type { IWcPayOption } from '@onekeyhq/shared/src/walletConnect/payTypes';

import {
  WC_PAY_SOLANA_MAX_PRIORITY_FEE_LAMPORTS,
  assertWcPaySolanaEncodedTxParses,
  checkWcPaySolanaTxMatchesOrder,
  isWcPaySolanaMessageUnchanged,
} from './wcPaySolanaConsistency';

// yarn jest packages/kit-bg/src/services/ServiceWalletConnectPay/wcPaySolanaConsistency.test.ts

const payer = Keypair.generate();
const recipient = Keypair.generate();
const mint = Keypair.generate().publicKey;
const TOKEN_PROGRAM_ID = new PublicKey(
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
);
const TOKEN_2022_PROGRAM_ID = new PublicKey(
  'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb',
);
const MEMO_PROGRAM_ID = new PublicKey(
  'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr',
);
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
);
const BLOCKHASH = '11111111111111111111111111111111';
const CHAIN = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';

// `assetSymbol` defaults to 'SOL' for native-leg tests; spl-leg tests must
// pass a non-'SOL' symbol (e.g. 'USDC') so they don't trip the validator's
// own asset-kind consistency check.
function buildOption(
  value: string,
  decimals = 9,
  assetSymbol = 'SOL',
): IWcPayOption {
  return {
    id: 'opt-sol',
    account: `${CHAIN}:${payer.publicKey.toBase58()}`,
    amount: {
      unit: assetSymbol,
      value,
      display: { assetSymbol, assetName: 'Solana', decimals },
    },
    etaS: 5,
    actions: [],
  };
}

function toBase64(instructions: TransactionInstruction[]): string {
  const message = new TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash: BLOCKHASH,
    instructions,
  }).compileToLegacyMessage();
  return Buffer.from(new VersionedTransaction(message).serialize()).toString(
    'base64',
  );
}

// The option account's associated token account for `mint` under the given
// token program — the only source the validator accepts for an spl leg.
function deriveAta(owner: PublicKey, programId: PublicKey = TOKEN_PROGRAM_ID) {
  return PublicKey.findProgramAddressSync(
    [owner.toBuffer(), programId.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  )[0];
}

function splTransferChecked(
  amount: bigint,
  authority: PublicKey,
  decimals = 6,
  programId: PublicKey = TOKEN_PROGRAM_ID,
  destination: PublicKey = Keypair.generate().publicKey,
  source: PublicKey = deriveAta(authority, programId),
) {
  const data = Buffer.alloc(10);
  data.writeUInt8(12, 0); // TransferChecked
  data.writeBigUInt64LE(amount, 1);
  data.writeUInt8(decimals, 9);
  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: source, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: destination, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: false },
    ],
    data,
  });
}

function splTransfer(
  amount: bigint,
  authority: PublicKey,
  programId: PublicKey = TOKEN_PROGRAM_ID,
) {
  const data = Buffer.alloc(9);
  data.writeUInt8(3, 0); // Transfer
  data.writeBigUInt64LE(amount, 1);
  return new TransactionInstruction({
    programId,
    keys: [
      {
        pubkey: Keypair.generate().publicKey,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: Keypair.generate().publicKey,
        isSigner: false,
        isWritable: true,
      },
      { pubkey: authority, isSigner: true, isWritable: false },
    ],
    data,
  });
}

function memoInstruction(text: string): TransactionInstruction {
  return new TransactionInstruction({
    programId: MEMO_PROGRAM_ID,
    keys: [],
    data: Buffer.from(text, 'utf8'),
  });
}

// [funder, ata, owner, mint, systemProgram, tokenProgram] — the Associated
// Token Account program's `Create`/`CreateIdempotent` key layout.
function ataInstruction({
  funder,
  ata,
  owner,
  mintKey,
  tokenProgramId = TOKEN_PROGRAM_ID,
  idempotent = false,
}: {
  funder: PublicKey;
  ata: PublicKey;
  owner: PublicKey;
  mintKey: PublicKey;
  tokenProgramId?: PublicKey;
  idempotent?: boolean;
}): TransactionInstruction {
  return new TransactionInstruction({
    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    keys: [
      { pubkey: funder, isSigner: true, isWritable: true },
      { pubkey: ata, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: mintKey, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: tokenProgramId, isSigner: false, isWritable: false },
    ],
    data: idempotent ? Buffer.from([1]) : Buffer.alloc(0),
  });
}

const COMPUTE_BUDGET_PROGRAM_ID = ComputeBudgetProgram.programId;

// Hand-built ComputeBudget instruction with arbitrary raw `data`, for
// testing data-length rules the SDK's own factory methods cannot produce.
function rawComputeBudgetInstruction(data: Buffer): TransactionInstruction {
  return new TransactionInstruction({
    programId: COMPUTE_BUDGET_PROGRAM_ID,
    keys: [],
    data,
  });
}

function setLoadedAccountsDataSizeLimitInstruction(
  bytes: number,
): TransactionInstruction {
  const data = Buffer.alloc(5);
  data.writeUInt8(4, 0);
  data.writeUInt32LE(bytes, 1);
  return rawComputeBudgetInstruction(data);
}

// Hand-built ATA instruction with arbitrary raw `keys`/`data`, for testing
// key-count and data-shape rules the `ataInstruction` helper's fixed 6-key
// layout cannot produce.
function rawAtaInstruction(
  keys: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[],
  data: Buffer = Buffer.alloc(0),
): TransactionInstruction {
  return new TransactionInstruction({
    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    keys,
    data,
  });
}

describe('checkWcPaySolanaTxMatchesOrder', () => {
  it('accepts a single native transfer of the order amount from the option account', () => {
    const tx = toBase64([
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: recipient.publicKey,
        lamports: 1500,
      }),
    ]);
    expect(
      checkWcPaySolanaTxMatchesOrder({
        txBase64: tx,
        caip2ChainId: CHAIN,
        option: buildOption('1500'),
      }),
    ).toEqual({
      ok: true,
      summary: {
        amountRaw: '1500',
        kind: 'native',
        priorityFeeLamports: '0',
        sponsoredFee: false,
        fundsRecipientAta: false,
      },
    });
  });

  it('accepts a single SPL transferChecked of the order amount signed by the option account', () => {
    const tx = toBase64([splTransferChecked(100_000n, payer.publicKey, 6)]);
    expect(
      checkWcPaySolanaTxMatchesOrder({
        txBase64: tx,
        caip2ChainId: CHAIN,
        option: buildOption('100000', 6, 'USDC'),
      }),
    ).toEqual({
      ok: true,
      summary: {
        amountRaw: '100000',
        kind: 'spl',
        mint: mint.toBase58(),
        decimals: 6,
        priorityFeeLamports: '0',
        sponsoredFee: false,
        fundsRecipientAta: false,
      },
    });
  });

  it('accepts a Token-2022 transferChecked of the order amount signed by the option account', () => {
    const tx = toBase64([
      splTransferChecked(100_000n, payer.publicKey, 6, TOKEN_2022_PROGRAM_ID),
    ]);
    expect(
      checkWcPaySolanaTxMatchesOrder({
        txBase64: tx,
        caip2ChainId: CHAIN,
        option: buildOption('100000', 6, 'USDC'),
      }),
    ).toEqual({
      ok: true,
      summary: {
        amountRaw: '100000',
        kind: 'spl',
        mint: mint.toBase58(),
        decimals: 6,
        priorityFeeLamports: '0',
        sponsoredFee: false,
        fundsRecipientAta: false,
      },
    });
  });

  it('refuses a transferChecked whose source is not the option account ATA (delegated transfer)', () => {
    // the option account is the AUTHORITY (a delegate of someone else's
    // token account): the token program would accept it, moving the other
    // owner's balance to the merchant
    const tx = toBase64([
      splTransferChecked(
        100_000n,
        payer.publicKey,
        6,
        TOKEN_PROGRAM_ID,
        undefined,
        Keypair.generate().publicKey,
      ),
    ]);
    expect(
      checkWcPaySolanaTxMatchesOrder({
        txBase64: tx,
        caip2ChainId: CHAIN,
        option: buildOption('100000', 6, 'USDC'),
      }),
    ).toEqual({ ok: false, reason: 'source account mismatch' });
  });

  it('refuses a transferChecked whose source is the ATA under the other token program', () => {
    // right owner and mint, but the account is the Token-2022 ATA while the
    // instruction targets the classic program (and vice versa)
    for (const [programId, otherProgramId] of [
      [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID],
      [TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID],
    ]) {
      const tx = toBase64([
        splTransferChecked(
          100_000n,
          payer.publicKey,
          6,
          programId,
          undefined,
          deriveAta(payer.publicKey, otherProgramId),
        ),
      ]);
      expect(
        checkWcPaySolanaTxMatchesOrder({
          txBase64: tx,
          caip2ChainId: CHAIN,
          option: buildOption('100000', 6, 'USDC'),
        }),
      ).toEqual({ ok: false, reason: 'source account mismatch' });
    }
  });

  it('refuses a plain SPL transfer as an unverifiable mint', () => {
    const tx = toBase64([splTransfer(50_000n, payer.publicKey)]);
    expect(
      checkWcPaySolanaTxMatchesOrder({
        txBase64: tx,
        caip2ChainId: CHAIN,
        option: buildOption('50000', 6, 'USDC'),
      }),
    ).toEqual({ ok: false, reason: 'unverifiable mint' });
  });

  it('refuses a transferChecked whose decimals disagree with the order', () => {
    const tx = toBase64([splTransferChecked(100_000n, payer.publicKey, 9)]);
    expect(
      checkWcPaySolanaTxMatchesOrder({
        txBase64: tx,
        caip2ChainId: CHAIN,
        option: buildOption('100000', 6, 'USDC'),
      }),
    ).toEqual({ ok: false, reason: 'decimals mismatch' });
  });

  it('refuses a native transfer whose order asset is not SOL', () => {
    const tx = toBase64([
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: recipient.publicKey,
        lamports: 1500,
      }),
    ]);
    expect(
      checkWcPaySolanaTxMatchesOrder({
        txBase64: tx,
        caip2ChainId: CHAIN,
        option: buildOption('1500', 9, 'USDC'),
      }),
    ).toEqual({ ok: false, reason: 'asset mismatch' });
  });

  it('refuses an spl transfer whose order asset is SOL', () => {
    const tx = toBase64([splTransferChecked(100_000n, payer.publicKey, 6)]);
    expect(
      checkWcPaySolanaTxMatchesOrder({
        txBase64: tx,
        caip2ChainId: CHAIN,
        option: buildOption('100000', 6, 'SOL'),
      }),
    ).toEqual({ ok: false, reason: 'asset mismatch' });
  });

  it('refuses a zero order amount', () => {
    const tx = toBase64([
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: recipient.publicKey,
        lamports: 1500,
      }),
    ]);
    expect(
      checkWcPaySolanaTxMatchesOrder({
        txBase64: tx,
        caip2ChainId: CHAIN,
        option: buildOption('0'),
      }),
    ).toEqual({ ok: false, reason: 'invalid order amount format' });
  });

  it('accepts a transfer alongside allowed ComputeBudget and Memo instructions', () => {
    const tx = toBase64([
      ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
      memoInstruction('order-123'),
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: recipient.publicKey,
        lamports: 1500,
      }),
    ]);
    expect(
      checkWcPaySolanaTxMatchesOrder({
        txBase64: tx,
        caip2ChainId: CHAIN,
        option: buildOption('1500'),
      }),
    ).toEqual({
      ok: true,
      summary: {
        amountRaw: '1500',
        kind: 'native',
        priorityFeeLamports: '0',
        sponsoredFee: false,
        fundsRecipientAta: false,
      },
    });
  });

  it('accepts a bounded ComputeBudget price+limit and reports the exact ceiling fee', () => {
    const tx = toBase64([
      ComputeBudgetProgram.setComputeUnitLimit({ units: 100_003 }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000 }),
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: recipient.publicKey,
        lamports: 1500,
      }),
    ]);
    // ceil(1_000 * 100_003 / 1_000_000) = ceil(100.003) = 101
    expect(
      checkWcPaySolanaTxMatchesOrder({
        txBase64: tx,
        caip2ChainId: CHAIN,
        option: buildOption('1500'),
      }),
    ).toEqual({
      ok: true,
      summary: {
        amountRaw: '1500',
        kind: 'native',
        priorityFeeLamports: '101',
        sponsoredFee: false,
        fundsRecipientAta: false,
      },
    });
  });

  it('bounds the priority fee at the 1,400,000 CU ceiling when the unset-limit default reaches it', () => {
    // 7 non-ComputeBudget instructions (6 memos + 1 transfer) -> default
    // budget = min(200_000*7, 1_400_000) = 1_400_000, the ceiling itself.
    const memos = [
      memoInstruction('m1'),
      memoInstruction('m2'),
      memoInstruction('m3'),
      memoInstruction('m4'),
      memoInstruction('m5'),
      memoInstruction('m6'),
    ];
    const underCapTx = toBase64([
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 7_000_000 }),
      ...memos,
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: recipient.publicKey,
        lamports: 1500,
      }),
    ]);
    // ceil(7_000_000 * 1_400_000 / 1_000_000) = 9_800_000, under the cap.
    expect(
      checkWcPaySolanaTxMatchesOrder({
        txBase64: underCapTx,
        caip2ChainId: CHAIN,
        option: buildOption('1500'),
      }),
    ).toEqual({
      ok: true,
      summary: {
        amountRaw: '1500',
        kind: 'native',
        priorityFeeLamports: '9800000',
        sponsoredFee: false,
        fundsRecipientAta: false,
      },
    });

    const overCapTx = toBase64([
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 7_200_000 }),
      ...memos,
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: recipient.publicKey,
        lamports: 1500,
      }),
    ]);
    // ceil(7_200_000 * 1_400_000 / 1_000_000) = 10_080_000, over the cap.
    expect(
      checkWcPaySolanaTxMatchesOrder({
        txBase64: overCapTx,
        caip2ChainId: CHAIN,
        option: buildOption('1500'),
      }),
    ).toEqual({ ok: false, reason: 'priority fee too high' });
  });

  // The cap is a ceiling the transaction may sit exactly on: the check is
  // `isGreaterThan`, so the boundary lamport passes and the next one does
  // not. Asserted against the exported constant rather than a literal, so
  // moving the cap moves this test with it.
  it('admits a priority fee exactly at the cap and refuses one lamport more', () => {
    // a 1,000,000 CU limit makes the fee equal the price in lamports:
    // ceil(price * 1_000_000 / 1_000_000)
    const buildTx = (microLamports: number) =>
      toBase64([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 }),
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports }),
        SystemProgram.transfer({
          fromPubkey: payer.publicKey,
          toPubkey: recipient.publicKey,
          lamports: 1500,
        }),
      ]);

    expect(
      checkWcPaySolanaTxMatchesOrder({
        txBase64: buildTx(WC_PAY_SOLANA_MAX_PRIORITY_FEE_LAMPORTS),
        caip2ChainId: CHAIN,
        option: buildOption('1500'),
      }),
    ).toEqual({
      ok: true,
      summary: {
        amountRaw: '1500',
        kind: 'native',
        priorityFeeLamports: String(WC_PAY_SOLANA_MAX_PRIORITY_FEE_LAMPORTS),
        sponsoredFee: false,
        fundsRecipientAta: false,
      },
    });
    expect(
      checkWcPaySolanaTxMatchesOrder({
        txBase64: buildTx(WC_PAY_SOLANA_MAX_PRIORITY_FEE_LAMPORTS + 1),
        caip2ChainId: CHAIN,
        option: buildOption('1500'),
      }),
    ).toEqual({ ok: false, reason: 'priority fee too high' });
  });

  it('refuses the reviewer priority-fee probe (1.4M CU limit at 700M microLamports)', () => {
    const tx = toBase64([
      ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 700_000_000 }),
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: recipient.publicKey,
        lamports: 1500,
      }),
    ]);
    expect(
      checkWcPaySolanaTxMatchesOrder({
        txBase64: tx,
        caip2ChainId: CHAIN,
        option: buildOption('1500'),
      }),
    ).toEqual({ ok: false, reason: 'priority fee too high' });
  });

  it('refuses the deprecated RequestUnits ComputeBudget instruction', () => {
    const tx = toBase64([
      ComputeBudgetProgram.requestUnits({ units: 1_000_000, additionalFee: 0 }),
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: recipient.publicKey,
        lamports: 1500,
      }),
    ]);
    expect(
      checkWcPaySolanaTxMatchesOrder({
        txBase64: tx,
        caip2ChainId: CHAIN,
        option: buildOption('1500'),
      }),
    ).toEqual({ ok: false, reason: 'unsupported instruction' });
  });

  it('refuses a duplicate SetComputeUnitPrice instruction', () => {
    const tx = toBase64([
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000 }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 2000 }),
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: recipient.publicKey,
        lamports: 1500,
      }),
    ]);
    expect(
      checkWcPaySolanaTxMatchesOrder({
        txBase64: tx,
        caip2ChainId: CHAIN,
        option: buildOption('1500'),
      }),
    ).toEqual({ ok: false, reason: 'unsupported instruction' });
  });

  it('refuses a duplicate SetComputeUnitLimit instruction', () => {
    const tx = toBase64([
      ComputeBudgetProgram.setComputeUnitLimit({ units: 100_000 }),
      ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: recipient.publicKey,
        lamports: 1500,
      }),
    ]);
    expect(
      checkWcPaySolanaTxMatchesOrder({
        txBase64: tx,
        caip2ChainId: CHAIN,
        option: buildOption('1500'),
      }),
    ).toEqual({ ok: false, reason: 'unsupported instruction' });
  });

  it('clamps an explicit limit above the runtime ceiling before computing the priority fee', () => {
    const tx = toBase64([
      ComputeBudgetProgram.setComputeUnitLimit({ units: 10_000_000 }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 7_000_000 }),
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: recipient.publicKey,
        lamports: 1500,
      }),
    ]);
    // effectiveLimit = min(10_000_000, 1_400_000) = 1_400_000
    // ceil(7_000_000 * 1_400_000 / 1_000_000) = 9_800_000
    expect(
      checkWcPaySolanaTxMatchesOrder({
        txBase64: tx,
        caip2ChainId: CHAIN,
        option: buildOption('1500'),
      }),
    ).toEqual({
      ok: true,
      summary: {
        amountRaw: '1500',
        kind: 'native',
        priorityFeeLamports: '9800000',
        sponsoredFee: false,
        fundsRecipientAta: false,
      },
    });
  });

  it('computes the priority fee from the runtime default (200,000 CU per non-ComputeBudget instruction) when no limit ix is present', () => {
    const oneIxTx = toBase64([
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 }),
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: recipient.publicKey,
        lamports: 1500,
      }),
    ]);
    // 1 non-ComputeBudget instruction -> default budget = min(200_000*1, 1_400_000) = 200_000
    // ceil(50_000 * 200_000 / 1_000_000) = 10_000
    expect(
      checkWcPaySolanaTxMatchesOrder({
        txBase64: oneIxTx,
        caip2ChainId: CHAIN,
        option: buildOption('1500'),
      }),
    ).toEqual({
      ok: true,
      summary: {
        amountRaw: '1500',
        kind: 'native',
        priorityFeeLamports: '10000',
        sponsoredFee: false,
        fundsRecipientAta: false,
      },
    });

    const sevenIxTx = toBase64([
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 }),
      memoInstruction('m1'),
      memoInstruction('m2'),
      memoInstruction('m3'),
      memoInstruction('m4'),
      memoInstruction('m5'),
      memoInstruction('m6'),
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: recipient.publicKey,
        lamports: 1500,
      }),
    ]);
    // 7 non-ComputeBudget instructions (6 memos + 1 transfer) -> default
    // budget = min(200_000*7, 1_400_000) = 1_400_000
    // ceil(50_000 * 1_400_000 / 1_000_000) = 70_000
    expect(
      checkWcPaySolanaTxMatchesOrder({
        txBase64: sevenIxTx,
        caip2ChainId: CHAIN,
        option: buildOption('1500'),
      }),
    ).toEqual({
      ok: true,
      summary: {
        amountRaw: '1500',
        kind: 'native',
        priorityFeeLamports: '70000',
        sponsoredFee: false,
        fundsRecipientAta: false,
      },
    });
  });

  it('refuses a SystemProgram transfer instruction with the wrong data length', () => {
    const base = SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: recipient.publicKey,
      lamports: 1500,
    });
    // 13 bytes instead of the exact 12 (u32 LE index + u64 LE lamports).
    const withExtraByte = new TransactionInstruction({
      programId: base.programId,
      keys: base.keys,
      data: Buffer.concat([base.data, Buffer.from([0])]),
    });
    const tx = toBase64([withExtraByte]);
    expect(
      checkWcPaySolanaTxMatchesOrder({
        txBase64: tx,
        caip2ChainId: CHAIN,
        option: buildOption('1500'),
      }),
    ).toEqual({ ok: false, reason: 'unsupported instruction' });
  });

  it('refuses a transferChecked instruction with the wrong data length', () => {
    // 14 bytes instead of the exact 10 (discriminator + u64 amount + decimals).
    const data = Buffer.alloc(14);
    data.writeUInt8(12, 0);
    data.writeBigUInt64LE(100_000n, 1);
    data.writeUInt8(6, 9);
    const ix = new TransactionInstruction({
      programId: TOKEN_PROGRAM_ID,
      keys: [
        {
          pubkey: Keypair.generate().publicKey,
          isSigner: false,
          isWritable: true,
        },
        { pubkey: mint, isSigner: false, isWritable: false },
        {
          pubkey: Keypair.generate().publicKey,
          isSigner: false,
          isWritable: true,
        },
        { pubkey: payer.publicKey, isSigner: true, isWritable: false },
      ],
      data,
    });
    const tx = toBase64([ix]);
    expect(
      checkWcPaySolanaTxMatchesOrder({
        txBase64: tx,
        caip2ChainId: CHAIN,
        option: buildOption('100000', 6, 'USDC'),
      }),
    ).toEqual({ ok: false, reason: 'unsupported instruction' });
  });

  it('refuses a SetComputeUnitPrice instruction with an over-long data length', () => {
    // 20 bytes instead of the exact 9 (discriminator + u64 LE microLamports).
    const data = Buffer.alloc(20);
    data.writeUInt8(3, 0);
    const tx = toBase64([
      rawComputeBudgetInstruction(data),
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: recipient.publicKey,
        lamports: 1500,
      }),
    ]);
    expect(
      checkWcPaySolanaTxMatchesOrder({
        txBase64: tx,
        caip2ChainId: CHAIN,
        option: buildOption('1500'),
      }),
    ).toEqual({ ok: false, reason: 'unsupported instruction' });
  });

  it('accepts one RequestHeapFrame instruction and refuses a duplicate', () => {
    const okTx = toBase64([
      ComputeBudgetProgram.requestHeapFrame({ bytes: 65_536 }),
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: recipient.publicKey,
        lamports: 1500,
      }),
    ]);
    expect(
      checkWcPaySolanaTxMatchesOrder({
        txBase64: okTx,
        caip2ChainId: CHAIN,
        option: buildOption('1500'),
      }),
    ).toEqual({
      ok: true,
      summary: {
        amountRaw: '1500',
        kind: 'native',
        priorityFeeLamports: '0',
        sponsoredFee: false,
        fundsRecipientAta: false,
      },
    });

    const dupTx = toBase64([
      ComputeBudgetProgram.requestHeapFrame({ bytes: 65_536 }),
      ComputeBudgetProgram.requestHeapFrame({ bytes: 32_768 }),
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: recipient.publicKey,
        lamports: 1500,
      }),
    ]);
    expect(
      checkWcPaySolanaTxMatchesOrder({
        txBase64: dupTx,
        caip2ChainId: CHAIN,
        option: buildOption('1500'),
      }),
    ).toEqual({ ok: false, reason: 'unsupported instruction' });
  });

  it('accepts one SetLoadedAccountsDataSizeLimit instruction, refuses a duplicate and a malformed one', () => {
    const okTx = toBase64([
      setLoadedAccountsDataSizeLimitInstruction(64 * 1024),
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: recipient.publicKey,
        lamports: 1500,
      }),
    ]);
    expect(
      checkWcPaySolanaTxMatchesOrder({
        txBase64: okTx,
        caip2ChainId: CHAIN,
        option: buildOption('1500'),
      }),
    ).toEqual({
      ok: true,
      summary: {
        amountRaw: '1500',
        kind: 'native',
        priorityFeeLamports: '0',
        sponsoredFee: false,
        fundsRecipientAta: false,
      },
    });

    const dupTx = toBase64([
      setLoadedAccountsDataSizeLimitInstruction(64 * 1024),
      setLoadedAccountsDataSizeLimitInstruction(32 * 1024),
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: recipient.publicKey,
        lamports: 1500,
      }),
    ]);
    expect(
      checkWcPaySolanaTxMatchesOrder({
        txBase64: dupTx,
        caip2ChainId: CHAIN,
        option: buildOption('1500'),
      }),
    ).toEqual({ ok: false, reason: 'unsupported instruction' });

    // 3 bytes total instead of the exact 5 (u8 discriminator + u32 LE).
    const malformedTx = toBase64([
      rawComputeBudgetInstruction(Buffer.from([4, 1, 2])),
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: recipient.publicKey,
        lamports: 1500,
      }),
    ]);
    expect(
      checkWcPaySolanaTxMatchesOrder({
        txBase64: malformedTx,
        caip2ChainId: CHAIN,
        option: buildOption('1500'),
      }),
    ).toEqual({ ok: false, reason: 'unsupported instruction' });
  });

  it('refuses a SetComputeUnitLimit instruction with the wrong data length', () => {
    // 6 bytes total instead of the exact 5 (u8 discriminator + u32 LE).
    const tx = toBase64([
      rawComputeBudgetInstruction(Buffer.from([2, 1, 2, 3, 4, 5])),
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: recipient.publicKey,
        lamports: 1500,
      }),
    ]);
    expect(
      checkWcPaySolanaTxMatchesOrder({
        txBase64: tx,
        caip2ChainId: CHAIN,
        option: buildOption('1500'),
      }),
    ).toEqual({ ok: false, reason: 'unsupported instruction' });
  });

  it('refuses a native leg accompanied by an ATA create instruction', () => {
    const attacker = Keypair.generate().publicKey;
    const tx = toBase64([
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: recipient.publicKey,
        lamports: 1500,
      }),
      ataInstruction({
        funder: payer.publicKey,
        ata: Keypair.generate().publicKey,
        owner: attacker,
        mintKey: mint,
      }),
    ]);
    expect(
      checkWcPaySolanaTxMatchesOrder({
        txBase64: tx,
        caip2ChainId: CHAIN,
        option: buildOption('1500'),
      }),
    ).toEqual({
      ok: false,
      reason: 'unexpected associated token account instruction',
    });
  });

  it('accepts an spl leg accompanied by a matching ATA create-idempotent instruction', () => {
    const destination = Keypair.generate().publicKey;
    const tx = toBase64([
      splTransferChecked(
        100_000n,
        payer.publicKey,
        6,
        TOKEN_PROGRAM_ID,
        destination,
      ),
      ataInstruction({
        funder: payer.publicKey,
        ata: destination,
        owner: Keypair.generate().publicKey,
        mintKey: mint,
        tokenProgramId: TOKEN_PROGRAM_ID,
        idempotent: true,
      }),
    ]);
    expect(
      checkWcPaySolanaTxMatchesOrder({
        txBase64: tx,
        caip2ChainId: CHAIN,
        option: buildOption('100000', 6, 'USDC'),
      }),
    ).toEqual({
      ok: true,
      summary: {
        amountRaw: '100000',
        kind: 'spl',
        mint: mint.toBase58(),
        decimals: 6,
        priorityFeeLamports: '0',
        sponsoredFee: false,
        fundsRecipientAta: true,
      },
    });
  });

  it('refuses an spl leg accompanied by an ATA for a different mint', () => {
    const destination = Keypair.generate().publicKey;
    const otherMint = Keypair.generate().publicKey;
    const tx = toBase64([
      splTransferChecked(
        100_000n,
        payer.publicKey,
        6,
        TOKEN_PROGRAM_ID,
        destination,
      ),
      ataInstruction({
        funder: payer.publicKey,
        ata: destination,
        owner: Keypair.generate().publicKey,
        mintKey: otherMint,
      }),
    ]);
    expect(
      checkWcPaySolanaTxMatchesOrder({
        txBase64: tx,
        caip2ChainId: CHAIN,
        option: buildOption('100000', 6, 'USDC'),
      }),
    ).toEqual({
      ok: false,
      reason: 'unexpected associated token account instruction',
    });
  });

  it('refuses an spl leg accompanied by two ATA instructions', () => {
    const destination = Keypair.generate().publicKey;
    const tx = toBase64([
      splTransferChecked(
        100_000n,
        payer.publicKey,
        6,
        TOKEN_PROGRAM_ID,
        destination,
      ),
      ataInstruction({
        funder: payer.publicKey,
        ata: destination,
        owner: Keypair.generate().publicKey,
        mintKey: mint,
      }),
      ataInstruction({
        funder: payer.publicKey,
        ata: destination,
        owner: Keypair.generate().publicKey,
        mintKey: mint,
      }),
    ]);
    expect(
      checkWcPaySolanaTxMatchesOrder({
        txBase64: tx,
        caip2ChainId: CHAIN,
        option: buildOption('100000', 6, 'USDC'),
      }),
    ).toEqual({
      ok: false,
      reason: 'unexpected associated token account instruction',
    });
  });

  it('refuses an ATA instruction whose created account differs from the leg destination', () => {
    const destination = Keypair.generate().publicKey;
    const wrongAta = Keypair.generate().publicKey;
    const tx = toBase64([
      splTransferChecked(
        100_000n,
        payer.publicKey,
        6,
        TOKEN_PROGRAM_ID,
        destination,
      ),
      ataInstruction({
        funder: payer.publicKey,
        ata: wrongAta,
        owner: Keypair.generate().publicKey,
        mintKey: mint,
      }),
    ]);
    expect(
      checkWcPaySolanaTxMatchesOrder({
        txBase64: tx,
        caip2ChainId: CHAIN,
        option: buildOption('100000', 6, 'USDC'),
      }),
    ).toEqual({
      ok: false,
      reason: 'unexpected associated token account instruction',
    });
  });

  it('refuses an ATA instruction whose token program differs from the leg program', () => {
    const destination = Keypair.generate().publicKey;
    const tx = toBase64([
      splTransferChecked(
        100_000n,
        payer.publicKey,
        6,
        TOKEN_PROGRAM_ID,
        destination,
      ),
      ataInstruction({
        funder: payer.publicKey,
        ata: destination,
        owner: Keypair.generate().publicKey,
        mintKey: mint,
        tokenProgramId: TOKEN_2022_PROGRAM_ID,
      }),
    ]);
    expect(
      checkWcPaySolanaTxMatchesOrder({
        txBase64: tx,
        caip2ChainId: CHAIN,
        option: buildOption('100000', 6, 'USDC'),
      }),
    ).toEqual({
      ok: false,
      reason: 'unexpected associated token account instruction',
    });
  });

  it('refuses an ATA instruction with 5 keys', () => {
    const destination = Keypair.generate().publicKey;
    const tx = toBase64([
      splTransferChecked(
        100_000n,
        payer.publicKey,
        6,
        TOKEN_PROGRAM_ID,
        destination,
      ),
      rawAtaInstruction([
        { pubkey: payer.publicKey, isSigner: true, isWritable: true },
        { pubkey: destination, isSigner: false, isWritable: true },
        {
          pubkey: Keypair.generate().publicKey,
          isSigner: false,
          isWritable: false,
        },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ]),
    ]);
    expect(
      checkWcPaySolanaTxMatchesOrder({
        txBase64: tx,
        caip2ChainId: CHAIN,
        option: buildOption('100000', 6, 'USDC'),
      }),
    ).toEqual({
      ok: false,
      reason: 'unexpected associated token account instruction',
    });
  });

  it('accepts an ATA instruction with a legacy trailing Rent sysvar key', () => {
    const destination = Keypair.generate().publicKey;
    const tx = toBase64([
      splTransferChecked(
        100_000n,
        payer.publicKey,
        6,
        TOKEN_PROGRAM_ID,
        destination,
      ),
      rawAtaInstruction([
        { pubkey: payer.publicKey, isSigner: true, isWritable: true },
        { pubkey: destination, isSigner: false, isWritable: true },
        {
          pubkey: Keypair.generate().publicKey,
          isSigner: false,
          isWritable: false,
        },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      ]),
    ]);
    expect(
      checkWcPaySolanaTxMatchesOrder({
        txBase64: tx,
        caip2ChainId: CHAIN,
        option: buildOption('100000', 6, 'USDC'),
      }),
    ).toEqual({
      ok: true,
      summary: {
        amountRaw: '100000',
        kind: 'spl',
        mint: mint.toBase58(),
        decimals: 6,
        priorityFeeLamports: '0',
        sponsoredFee: false,
        fundsRecipientAta: true,
      },
    });
  });

  it('refuses an ATA instruction with 7 keys whose trailing key is not the Rent sysvar', () => {
    const destination = Keypair.generate().publicKey;
    const tx = toBase64([
      splTransferChecked(
        100_000n,
        payer.publicKey,
        6,
        TOKEN_PROGRAM_ID,
        destination,
      ),
      rawAtaInstruction([
        { pubkey: payer.publicKey, isSigner: true, isWritable: true },
        { pubkey: destination, isSigner: false, isWritable: true },
        {
          pubkey: Keypair.generate().publicKey,
          isSigner: false,
          isWritable: false,
        },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        {
          pubkey: Keypair.generate().publicKey,
          isSigner: false,
          isWritable: false,
        },
      ]),
    ]);
    expect(
      checkWcPaySolanaTxMatchesOrder({
        txBase64: tx,
        caip2ChainId: CHAIN,
        option: buildOption('100000', 6, 'USDC'),
      }),
    ).toEqual({
      ok: false,
      reason: 'unexpected associated token account instruction',
    });
  });

  it('refuses an ATA instruction with 9 keys', () => {
    const destination = Keypair.generate().publicKey;
    const tx = toBase64([
      splTransferChecked(
        100_000n,
        payer.publicKey,
        6,
        TOKEN_PROGRAM_ID,
        destination,
      ),
      rawAtaInstruction([
        { pubkey: payer.publicKey, isSigner: true, isWritable: true },
        { pubkey: destination, isSigner: false, isWritable: true },
        {
          pubkey: Keypair.generate().publicKey,
          isSigner: false,
          isWritable: false,
        },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
        {
          pubkey: Keypair.generate().publicKey,
          isSigner: false,
          isWritable: false,
        },
        {
          pubkey: Keypair.generate().publicKey,
          isSigner: false,
          isWritable: false,
        },
      ]),
    ]);
    expect(
      checkWcPaySolanaTxMatchesOrder({
        txBase64: tx,
        caip2ChainId: CHAIN,
        option: buildOption('100000', 6, 'USDC'),
      }),
    ).toEqual({
      ok: false,
      reason: 'unexpected associated token account instruction',
    });
  });

  it('refuses an ATA RecoverNested instruction', () => {
    const destination = Keypair.generate().publicKey;
    const tx = toBase64([
      splTransferChecked(
        100_000n,
        payer.publicKey,
        6,
        TOKEN_PROGRAM_ID,
        destination,
      ),
      rawAtaInstruction(
        [
          { pubkey: payer.publicKey, isSigner: true, isWritable: true },
          { pubkey: destination, isSigner: false, isWritable: true },
          {
            pubkey: Keypair.generate().publicKey,
            isSigner: false,
            isWritable: false,
          },
          { pubkey: mint, isSigner: false, isWritable: false },
          {
            pubkey: SystemProgram.programId,
            isSigner: false,
            isWritable: false,
          },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        ],
        Buffer.from([2]), // RecoverNested
      ),
    ]);
    expect(
      checkWcPaySolanaTxMatchesOrder({
        txBase64: tx,
        caip2ChainId: CHAIN,
        option: buildOption('100000', 6, 'USDC'),
      }),
    ).toEqual({
      ok: false,
      reason: 'unexpected associated token account instruction',
    });
  });

  it('refuses a transferChecked instruction with extra (multisig/transfer-hook) keys', () => {
    const data = Buffer.alloc(10);
    data.writeUInt8(12, 0);
    data.writeBigUInt64LE(100_000n, 1);
    data.writeUInt8(6, 9);
    const ix = new TransactionInstruction({
      programId: TOKEN_PROGRAM_ID,
      keys: [
        {
          pubkey: Keypair.generate().publicKey,
          isSigner: false,
          isWritable: true,
        },
        { pubkey: mint, isSigner: false, isWritable: false },
        {
          pubkey: Keypair.generate().publicKey,
          isSigner: false,
          isWritable: true,
        },
        { pubkey: payer.publicKey, isSigner: true, isWritable: false },
        {
          pubkey: Keypair.generate().publicKey,
          isSigner: true,
          isWritable: false,
        },
      ],
      data,
    });
    const tx = toBase64([ix]);
    expect(
      checkWcPaySolanaTxMatchesOrder({
        txBase64: tx,
        caip2ChainId: CHAIN,
        option: buildOption('100000', 6, 'USDC'),
      }),
    ).toEqual({ ok: false, reason: 'unsupported instruction' });
  });

  it('refuses a system transfer instruction with extra keys', () => {
    const base = SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: recipient.publicKey,
      lamports: 1500,
    });
    const withExtraKey = new TransactionInstruction({
      programId: base.programId,
      keys: [
        ...base.keys,
        {
          pubkey: Keypair.generate().publicKey,
          isSigner: false,
          isWritable: false,
        },
      ],
      data: base.data,
    });
    const tx = toBase64([withExtraKey]);
    expect(
      checkWcPaySolanaTxMatchesOrder({
        txBase64: tx,
        caip2ChainId: CHAIN,
        option: buildOption('1500'),
      }),
    ).toEqual({ ok: false, reason: 'unsupported instruction' });
  });

  it('refuses a transferChecked instruction missing the decimals byte', () => {
    const data = Buffer.alloc(9);
    data.writeUInt8(12, 0);
    data.writeBigUInt64LE(100_000n, 1);
    const ix = new TransactionInstruction({
      programId: TOKEN_PROGRAM_ID,
      keys: [
        {
          pubkey: Keypair.generate().publicKey,
          isSigner: false,
          isWritable: true,
        },
        { pubkey: mint, isSigner: false, isWritable: false },
        {
          pubkey: Keypair.generate().publicKey,
          isSigner: false,
          isWritable: true,
        },
        { pubkey: payer.publicKey, isSigner: true, isWritable: false },
      ],
      data,
    });
    const tx = toBase64([ix]);
    expect(
      checkWcPaySolanaTxMatchesOrder({
        txBase64: tx,
        caip2ChainId: CHAIN,
        option: buildOption('100000', 6, 'USDC'),
      }),
    ).toEqual({ ok: false, reason: 'unsupported instruction' });
  });

  it('refuses a plain SPL transfer on Token-2022 as an unverifiable mint', () => {
    const tx = toBase64([
      splTransfer(50_000n, payer.publicKey, TOKEN_2022_PROGRAM_ID),
    ]);
    expect(
      checkWcPaySolanaTxMatchesOrder({
        txBase64: tx,
        caip2ChainId: CHAIN,
        option: buildOption('50000', 6, 'USDC'),
      }),
    ).toEqual({ ok: false, reason: 'unverifiable mint' });
  });

  it('accepts a v0 message with no address lookup tables', () => {
    const message = new TransactionMessage({
      payerKey: payer.publicKey,
      recentBlockhash: BLOCKHASH,
      instructions: [
        SystemProgram.transfer({
          fromPubkey: payer.publicKey,
          toPubkey: recipient.publicKey,
          lamports: 1500,
        }),
      ],
    }).compileToV0Message();
    const tx = Buffer.from(
      new VersionedTransaction(message).serialize(),
    ).toString('base64');
    expect(
      checkWcPaySolanaTxMatchesOrder({
        txBase64: tx,
        caip2ChainId: CHAIN,
        option: buildOption('1500'),
      }),
    ).toEqual({
      ok: true,
      summary: {
        amountRaw: '1500',
        kind: 'native',
        priorityFeeLamports: '0',
        sponsoredFee: false,
        fundsRecipientAta: false,
      },
    });
  });

  it('refuses a transaction with no payment instruction', () => {
    const tx = toBase64([
      memoInstruction('order-123'),
      ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
    ]);
    expect(
      checkWcPaySolanaTxMatchesOrder({
        txBase64: tx,
        caip2ChainId: CHAIN,
        option: buildOption('1500'),
      }),
    ).toEqual({ ok: false, reason: 'no payment instruction' });
  });

  it.each([
    [
      'amount mismatch',
      toBase64([
        SystemProgram.transfer({
          fromPubkey: payer.publicKey,
          toPubkey: recipient.publicKey,
          lamports: 1501,
        }),
      ]),
      'amount mismatch',
    ],
    [
      'two transfers',
      toBase64([
        SystemProgram.transfer({
          fromPubkey: payer.publicKey,
          toPubkey: recipient.publicKey,
          lamports: 1500,
        }),
        SystemProgram.transfer({
          fromPubkey: payer.publicKey,
          toPubkey: recipient.publicKey,
          lamports: 1,
        }),
      ]),
      'unexpected instruction count',
    ],
    [
      'transfer from another account',
      toBase64([
        SystemProgram.transfer({
          fromPubkey: recipient.publicKey,
          toPubkey: payer.publicKey,
          lamports: 1500,
        }),
      ]),
      'sender mismatch',
    ],
    [
      'unknown program',
      toBase64([
        new TransactionInstruction({
          programId: Keypair.generate().publicKey,
          keys: [],
          data: Buffer.from([1, 2, 3]),
        }),
      ]),
      'unsupported instruction',
    ],
    ['garbage', 'not-base64!!', 'undecodable transaction'],
  ])('refuses %s', (_label, txBase64, reason) => {
    expect(
      checkWcPaySolanaTxMatchesOrder({
        txBase64,
        caip2ChainId: CHAIN,
        option: buildOption('1500'),
      }),
    ).toEqual({ ok: false, reason });
  });

  // Theft-shaped instructions: each of these is refused today by the
  // classifier's opcode allowlist, and these cases pin that behavior so any
  // future relaxation of classifyTokenInstruction / classifySystemInstruction
  // hits a failing test before it hits user assets.
  it.each([
    [
      'a sneaked SPL Approve (delegate) instruction',
      () =>
        new TransactionInstruction({
          programId: TOKEN_PROGRAM_ID,
          keys: [
            {
              pubkey: Keypair.generate().publicKey,
              isSigner: false,
              isWritable: true,
            },
            {
              pubkey: Keypair.generate().publicKey,
              isSigner: false,
              isWritable: false,
            },
            { pubkey: payer.publicKey, isSigner: true, isWritable: false },
          ],
          data: (() => {
            const data = Buffer.alloc(9);
            data.writeUInt8(4, 0); // Approve
            data.writeBigUInt64LE(1500n, 1);
            return data;
          })(),
        }),
    ],
    [
      'a sneaked SPL SetAuthority instruction',
      () =>
        new TransactionInstruction({
          programId: TOKEN_PROGRAM_ID,
          keys: [
            {
              pubkey: Keypair.generate().publicKey,
              isSigner: false,
              isWritable: true,
            },
            { pubkey: payer.publicKey, isSigner: true, isWritable: false },
          ],
          data: Buffer.from([6, 2, 0]), // SetAuthority(AccountOwner, none)
        }),
    ],
    [
      'a sneaked SPL Burn instruction',
      () =>
        new TransactionInstruction({
          programId: TOKEN_PROGRAM_ID,
          keys: [
            {
              pubkey: Keypair.generate().publicKey,
              isSigner: false,
              isWritable: true,
            },
            { pubkey: mint, isSigner: false, isWritable: true },
            { pubkey: payer.publicKey, isSigner: true, isWritable: false },
          ],
          data: (() => {
            const data = Buffer.alloc(9);
            data.writeUInt8(8, 0); // Burn
            data.writeBigUInt64LE(1500n, 1);
            return data;
          })(),
        }),
    ],
    [
      'a sneaked SPL CloseAccount instruction',
      () =>
        new TransactionInstruction({
          programId: TOKEN_PROGRAM_ID,
          keys: [
            {
              pubkey: Keypair.generate().publicKey,
              isSigner: false,
              isWritable: true,
            },
            {
              pubkey: Keypair.generate().publicKey,
              isSigner: false,
              isWritable: true,
            },
            { pubkey: payer.publicKey, isSigner: true, isWritable: false },
          ],
          data: Buffer.from([9]), // CloseAccount
        }),
    ],
    [
      'a SystemProgram Assign instruction',
      () =>
        SystemProgram.assign({
          accountPubkey: payer.publicKey,
          programId: TOKEN_PROGRAM_ID,
        }),
    ],
    [
      'a SystemProgram AdvanceNonceAccount (durable nonce) instruction',
      () =>
        SystemProgram.nonceAdvance({
          noncePubkey: Keypair.generate().publicKey,
          authorizedPubkey: payer.publicKey,
        }),
    ],
  ])('refuses %s', (_label, buildIx) => {
    expect(
      checkWcPaySolanaTxMatchesOrder({
        txBase64: toBase64([buildIx()]),
        caip2ChainId: CHAIN,
        option: buildOption('1500'),
      }),
    ).toEqual({ ok: false, reason: 'unsupported instruction' });
  });

  it('refuses a second SystemProgram transfer sneaked beside an SPL payment leg', () => {
    // an extra native transfer to a third party alongside the SPL leg must
    // never ride along on the no-confirmation signature
    expect(
      checkWcPaySolanaTxMatchesOrder({
        txBase64: toBase64([
          splTransferChecked(1500n, payer.publicKey),
          SystemProgram.transfer({
            fromPubkey: payer.publicKey,
            toPubkey: recipient.publicKey,
            lamports: 1,
          }),
        ]),
        caip2ChainId: CHAIN,
        option: buildOption('1500', 6, 'USDC'),
      }),
    ).toEqual({ ok: false, reason: 'unexpected instruction count' });
  });

  // The Pay server customarily sponsors the network fee: fee payer = its
  // own co-signing account, the user's account signs only as the payment
  // authority (observed live 2026-08-31). Acceptance requires the account
  // to still be a REQUIRED SIGNER; cost attribution moves to the sponsor.
  it('accepts a sponsored fee payer when the account still signs', () => {
    const sponsor = Keypair.generate();
    const message = new TransactionMessage({
      payerKey: sponsor.publicKey,
      recentBlockhash: BLOCKHASH,
      instructions: [
        SystemProgram.transfer({
          fromPubkey: payer.publicKey,
          toPubkey: recipient.publicKey,
          lamports: 1500,
        }),
      ],
    }).compileToLegacyMessage();
    const tx = Buffer.from(
      new VersionedTransaction(message).serialize(),
    ).toString('base64');
    expect(
      checkWcPaySolanaTxMatchesOrder({
        txBase64: tx,
        caip2ChainId: CHAIN,
        option: buildOption('1500'),
      }),
    ).toEqual({
      ok: true,
      summary: {
        amountRaw: '1500',
        kind: 'native',
        priorityFeeLamports: '0',
        sponsoredFee: true,
        fundsRecipientAta: false,
      },
    });
  });

  it('refuses a message the option account need not sign', () => {
    const sponsor = Keypair.generate();
    const message = new TransactionMessage({
      payerKey: sponsor.publicKey,
      recentBlockhash: BLOCKHASH,
      instructions: [
        // the sponsor pays AND is the transfer authority; the option account
        // appears nowhere as a signer — this is not the account's payment
        SystemProgram.transfer({
          fromPubkey: sponsor.publicKey,
          toPubkey: recipient.publicKey,
          lamports: 1500,
        }),
      ],
    }).compileToLegacyMessage();
    const tx = Buffer.from(
      new VersionedTransaction(message).serialize(),
    ).toString('base64');
    expect(
      checkWcPaySolanaTxMatchesOrder({
        txBase64: tx,
        caip2ChainId: CHAIN,
        option: buildOption('1500'),
      }),
    ).toEqual({ ok: false, reason: 'account is not a signer' });
  });

  it('does not bill a sponsor-funded recipient ATA to the user', () => {
    const sponsor = Keypair.generate();
    const destination = Keypair.generate().publicKey;
    const leg = splTransferChecked(
      500_000n,
      payer.publicKey,
      6,
      TOKEN_PROGRAM_ID,
      destination,
    );
    const ataIx = new TransactionInstruction({
      programId: ASSOCIATED_TOKEN_PROGRAM_ID,
      keys: [
        // funder = the sponsor, not the user
        { pubkey: sponsor.publicKey, isSigner: true, isWritable: true },
        { pubkey: destination, isSigner: false, isWritable: true },
        {
          pubkey: Keypair.generate().publicKey,
          isSigner: false,
          isWritable: false,
        },
        { pubkey: mint, isSigner: false, isWritable: false },
        {
          pubkey: SystemProgram.programId,
          isSigner: false,
          isWritable: false,
        },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data: Buffer.from([1]), // CreateIdempotent
    });
    const message = new TransactionMessage({
      payerKey: sponsor.publicKey,
      recentBlockhash: BLOCKHASH,
      instructions: [ataIx, leg],
    }).compileToLegacyMessage();
    const tx = Buffer.from(
      new VersionedTransaction(message).serialize(),
    ).toString('base64');
    const result = checkWcPaySolanaTxMatchesOrder({
      txBase64: tx,
      caip2ChainId: CHAIN,
      option: buildOption('500000', 6, 'USDC'),
    });
    expect(result.ok).toBe(true);
    expect(result.ok && result.summary.sponsoredFee).toBe(true);
    expect(result.ok && result.summary.fundsRecipientAta).toBe(false);
  });

  it('refuses a chain that differs from the option chain', () => {
    const tx = toBase64([
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: recipient.publicKey,
        lamports: 1500,
      }),
    ]);
    expect(
      checkWcPaySolanaTxMatchesOrder({
        txBase64: tx,
        caip2ChainId: 'solana:devnet',
        option: buildOption('1500'),
      }),
    ).toEqual({ ok: false, reason: 'chain mismatch' });
  });

  it('refuses a transaction that resolves accounts through address lookup tables', () => {
    const lookupTable = new AddressLookupTableAccount({
      key: Keypair.generate().publicKey,
      state: {
        deactivationSlot: BigInt('18446744073709551615'),
        lastExtendedSlot: 0,
        lastExtendedSlotStartIndex: 0,
        authority: undefined,
        addresses: [recipient.publicKey],
      },
    });
    const message = new TransactionMessage({
      payerKey: payer.publicKey,
      recentBlockhash: BLOCKHASH,
      instructions: [
        SystemProgram.transfer({
          fromPubkey: payer.publicKey,
          toPubkey: recipient.publicKey,
          lamports: 1500,
        }),
      ],
    }).compileToV0Message([lookupTable]);
    const tx = Buffer.from(
      new VersionedTransaction(message).serialize(),
    ).toString('base64');
    expect(
      checkWcPaySolanaTxMatchesOrder({
        txBase64: tx,
        caip2ChainId: CHAIN,
        option: buildOption('1500'),
      }),
    ).toEqual({ ok: false, reason: 'address lookup tables' });
  });

  it('refuses an option account with an invalid CAIP-10 shape', () => {
    const tx = toBase64([
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: recipient.publicKey,
        lamports: 1500,
      }),
    ]);
    const option = buildOption('1500');
    expect(
      checkWcPaySolanaTxMatchesOrder({
        txBase64: tx,
        caip2ChainId: CHAIN,
        option: { ...option, account: 'solana:only-two' },
      }),
    ).toEqual({ ok: false, reason: 'invalid option account shape' });
  });

  it('refuses an order amount that is not a plain decimal string', () => {
    const tx = toBase64([
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: recipient.publicKey,
        lamports: 1500,
      }),
    ]);
    expect(
      checkWcPaySolanaTxMatchesOrder({
        txBase64: tx,
        caip2ChainId: CHAIN,
        option: buildOption('abc'),
      }),
    ).toEqual({ ok: false, reason: 'invalid order amount format' });
  });
});

describe('isWcPaySolanaMessageUnchanged', () => {
  it('is true when only signatures differ and false when the message differs', () => {
    const unsigned = new Transaction({
      recentBlockhash: BLOCKHASH,
      feePayer: payer.publicKey,
    }).add(
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: recipient.publicKey,
        lamports: 1500,
      }),
    );
    const unsignedB64 = unsigned
      .serialize({ requireAllSignatures: false, verifySignatures: false })
      .toString('base64');
    const signed = Transaction.from(Buffer.from(unsignedB64, 'base64'));
    signed.sign(payer);
    const signedB64 = signed.serialize().toString('base64');
    expect(isWcPaySolanaMessageUnchanged(unsignedB64, signedB64)).toBe(true);

    const mutated = new Transaction({
      recentBlockhash: BLOCKHASH,
      feePayer: payer.publicKey,
    }).add(
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: recipient.publicKey,
        lamports: 1501,
      }),
    );
    mutated.sign(payer);
    expect(
      isWcPaySolanaMessageUnchanged(
        unsignedB64,
        mutated.serialize().toString('base64'),
      ),
    ).toBe(false);
    expect(isWcPaySolanaMessageUnchanged(unsignedB64, 'zzz')).toBe(false);
  });

  it('is false when a ComputeBudget instruction is appended before signing', () => {
    const unsigned = new Transaction({
      recentBlockhash: BLOCKHASH,
      feePayer: payer.publicKey,
    }).add(
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: recipient.publicKey,
        lamports: 1500,
      }),
    );
    const unsignedB64 = unsigned
      .serialize({ requireAllSignatures: false, verifySignatures: false })
      .toString('base64');

    const withComputeBudget = new Transaction({
      recentBlockhash: BLOCKHASH,
      feePayer: payer.publicKey,
    })
      .add(
        SystemProgram.transfer({
          fromPubkey: payer.publicKey,
          toPubkey: recipient.publicKey,
          lamports: 1500,
        }),
      )
      .add(ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }));
    withComputeBudget.sign(payer);
    const signedB64 = withComputeBudget.serialize().toString('base64');

    expect(isWcPaySolanaMessageUnchanged(unsignedB64, signedB64)).toBe(false);
  });
});

describe('assertWcPaySolanaEncodedTxParses', () => {
  const invalidSolanaPayload = {
    info: { wcPayCode: EWcPayErrorCode.InvalidSolanaPayload },
  };

  it('throws the InvalidSolanaPayload verdict for bytes that are not a transaction', () => {
    // decodable, size-sane, and exactly what the sol vault's parser would
    // reject at execution time
    expect(() =>
      assertWcPaySolanaEncodedTxParses(bs58.encode(Buffer.from([1, 2, 3]))),
    ).toThrow(expect.objectContaining(invalidSolanaPayload));
    expect(() => assertWcPaySolanaEncodedTxParses('')).toThrow(
      expect.objectContaining(invalidSolanaPayload),
    );
  });

  it('accepts a serialized transaction', () => {
    const txBase64 = toBase64([
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: recipient.publicKey,
        lamports: 1,
      }),
    ]);
    expect(() =>
      assertWcPaySolanaEncodedTxParses(
        bs58.encode(Buffer.from(txBase64, 'base64')),
      ),
    ).not.toThrow();
  });
});
