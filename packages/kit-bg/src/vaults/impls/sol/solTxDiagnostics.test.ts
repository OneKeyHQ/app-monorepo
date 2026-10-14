/* eslint-disable onekey/no-raw-error */
import {
  Keypair,
  SystemProgram,
  Transaction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import bs58 from 'bs58';

import type { ISolanaTxDiagnosticContext } from '@onekeyhq/shared/types/solanaTxDiagnostics';

import {
  inspectSolTxDiagnostic,
  withSolTxDiagnosticBlockhash,
} from './solTxDiagnostics';

jest.mock('@onekeyhq/shared/src/errors', () => ({ OneKeyLocalError: Error }));
jest.mock('./sdkSol/ClientSol', () => ({
  EParamsEncodings: { BASE64: 'base64' },
}));

const blockhash = bs58.encode(Buffer.alloc(32, 1));
const payer = Keypair.generate();
const recipient = Keypair.generate();
const other = Keypair.generate();
const transfer = SystemProgram.transfer({
  fromPubkey: payer.publicKey,
  toPubkey: recipient.publicKey,
  lamports: 1,
});
const context: ISolanaTxDiagnosticContext = {
  correlationId: '11111111-2222-4333-8444-555555555555',
  startedAt: 1000,
};

function legacy(instructions = [transfer], signed = false) {
  const tx = new Transaction({
    feePayer: payer.publicKey,
    recentBlockhash: blockhash,
  }).add(...instructions);
  if (signed) tx.partialSign(payer);
  return bs58.encode(tx.serialize({ requireAllSignatures: false }));
}

function versioned(instructions = [transfer]) {
  const message = new TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message();
  return bs58.encode(new VersionedTransaction(message).serialize());
}

describe('Solana public transaction diagnostics', () => {
  it.each([legacy(), versioned()])(
    'extracts public shape only, without accounts or signatures',
    (encodedTx) => {
      const details = inspectSolTxDiagnostic(encodedTx);
      expect(details.recentBlockhash).toBe(blockhash);
      expect(details.requiredSignatures).toBe(1);
      expect(details.hasExistingSignatures).toBe(false);
      expect(JSON.stringify(details)).not.toContain(payer.publicKey.toBase58());
      expect(JSON.stringify(details)).not.toContain(
        recipient.publicKey.toBase58(),
      );
      expect(JSON.stringify(details)).not.toContain(encodedTx);
    },
  );

  it('reports accurate refresh exclusions for signed, multisigner and durable nonce transactions', () => {
    expect(inspectSolTxDiagnostic(legacy([transfer], true)).reason).toBe(
      'alreadySigned',
    );
    const multi = [
      transfer,
      SystemProgram.transfer({
        fromPubkey: other.publicKey,
        toPubkey: recipient.publicKey,
        lamports: 1,
      }),
    ];
    expect(inspectSolTxDiagnostic(versioned(multi)).reason).toBe(
      'multipleSigners',
    );
    const nonce = [
      SystemProgram.nonceAdvance({
        noncePubkey: other.publicKey,
        authorizedPubkey: payer.publicKey,
      }),
      transfer,
    ];
    for (const encodedTx of [legacy(nonce), versioned(nonce)]) {
      const details = inspectSolTxDiagnostic(encodedTx);
      expect(details.reason).toBe('durableNonce');
      expect(details.recentBlockhash).toBeUndefined();
      expect(details.lastValidBlockHeight).toBeUndefined();
    }
  });

  it('keeps provider acquisition unknown and preserves per-transaction metadata across copies', () => {
    const a = withSolTxDiagnosticBlockhash(context, legacy(), {
      recentBlockhash: blockhash,
      blockhashFetchedAt: 1100,
      lastValidBlockHeight: 150,
    });
    const b = withSolTxDiagnosticBlockhash(
      { ...context, correlationId: '22222222-2222-4333-8444-555555555555' },
      legacy(),
      {
        recentBlockhash: blockhash,
        blockhashFetchedAt: 1200,
        lastValidBlockHeight: 151,
      },
    );
    expect(withSolTxDiagnosticBlockhash(a, legacy())?.blockhashFetchedAt).toBe(
      1100,
    );
    expect(withSolTxDiagnosticBlockhash(b, legacy())?.blockhashFetchedAt).toBe(
      1200,
    );
    expect(
      withSolTxDiagnosticBlockhash(context, legacy())?.blockhashFetchedAt,
    ).toBeUndefined();
    expect(
      withSolTxDiagnosticBlockhash(context, legacy())?.lastValidBlockHeight,
    ).toBeUndefined();
  });

  it('accepts explicit refresh metadata even if the network returns the same hash', () => {
    const old = {
      ...context,
      recentBlockhash: blockhash,
      blockhashFetchedAt: 1100,
    };
    expect(
      withSolTxDiagnosticBlockhash(old, legacy(), {
        recentBlockhash: blockhash,
        blockhashFetchedAt: 1200,
      })?.blockhashFetchedAt,
    ).toBe(1200);
  });

  it('fails open for malformed payload and context without reporting private values', () => {
    expect(inspectSolTxDiagnostic('synthetic-invalid-tx').reason).toBe(
      'unparseable',
    );
    const hostile = Object.defineProperty({}, 'correlationId', {
      get: () => {
        throw new Error('synthetic-private-value');
      },
    });
    expect(
      withSolTxDiagnosticBlockhash(
        hostile as ISolanaTxDiagnosticContext,
        legacy(),
      ),
    ).toBeUndefined();
  });
});
