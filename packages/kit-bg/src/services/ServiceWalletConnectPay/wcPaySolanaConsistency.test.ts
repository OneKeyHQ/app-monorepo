import {
  AddressLookupTableAccount,
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';

import type { IWcPayOption } from '@onekeyhq/shared/src/walletConnect/payTypes';

import {
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

function splTransferChecked(
  amount: bigint,
  authority: PublicKey,
  decimals = 6,
  programId: PublicKey = TOKEN_PROGRAM_ID,
) {
  const data = Buffer.alloc(10);
  data.writeUInt8(12, 0); // TransferChecked
  data.writeBigUInt64LE(amount, 1);
  data.writeUInt8(decimals, 9);
  return new TransactionInstruction({
    programId,
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
      { pubkey: authority, isSigner: true, isWritable: false },
    ],
    data,
  });
}

function splTransfer(amount: bigint, authority: PublicKey) {
  const data = Buffer.alloc(9);
  data.writeUInt8(3, 0); // Transfer
  data.writeBigUInt64LE(amount, 1);
  return new TransactionInstruction({
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
    ).toEqual({ ok: true, summary: { amountRaw: '1500', kind: 'native' } });
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
      },
    });
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
    ).toEqual({ ok: true, summary: { amountRaw: '1500', kind: 'native' } });
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

  it('refuses a fee payer that is not the option account', () => {
    const other = Keypair.generate();
    const message = new TransactionMessage({
      payerKey: other.publicKey,
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
    ).toEqual({ ok: false, reason: 'fee payer mismatch' });
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
});
