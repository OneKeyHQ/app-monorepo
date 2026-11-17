import { Transaction, VersionedTransaction } from '@solana/web3.js';

import { parseToNativeTx } from '@onekeyhq/core/src/chains/sol/sdkSol/parse';
import type { IEncodedTx } from '@onekeyhq/core/src/types';
import type {
  ISolanaBlockhashDiagnostic,
  ISolanaTxDiagnosticContext,
  ISolanaTxDiagnosticDetails,
} from '@onekeyhq/shared/types/solanaTxDiagnostics';

import { isDurableNonceSolTx } from './utils';

// Parse only public chain metadata and shape flags, never serialize a tx for logs.
export function inspectSolTxDiagnostic(
  encodedTx: IEncodedTx | null,
): ISolanaTxDiagnosticDetails & ISolanaBlockhashDiagnostic {
  const details: ISolanaTxDiagnosticDetails = {
    stage: 'refresh',
    status: 'skipped',
    reason: 'unparseable',
  };
  try {
    if (typeof encodedTx !== 'string') return details;
    const tx = parseToNativeTx(encodedTx);
    if (!tx) return details;
    const versioned = tx instanceof VersionedTransaction;
    const durableNonce = isDurableNonceSolTx(tx);
    const requiredSignatures = versioned
      ? tx.message.header.numRequiredSignatures
      : tx.signatures.length;
    const hasExistingSignatures = versioned
      ? tx.signatures.some((signature) => signature.some((byte) => byte !== 0))
      : tx.signatures.some(({ signature }) => signature !== null);
    const recentBlockhash = versioned
      ? tx.message.recentBlockhash
      : tx.recentBlockhash;
    let reason: ISolanaTxDiagnosticDetails['reason'];
    if (requiredSignatures > 1) reason = 'multipleSigners';
    else if (hasExistingSignatures) reason = 'alreadySigned';
    else if (durableNonce) reason = 'durableNonce';
    return {
      ...details,
      transactionVersion: versioned ? 'versioned' : 'legacy',
      requiredSignatures,
      hasExistingSignatures,
      durableNonce,
      // A nonce is not a recent blockhash: do not emit its account-scoped value.
      recentBlockhash: durableNonce ? undefined : recentBlockhash,
      lastValidBlockHeight:
        !durableNonce && tx instanceof Transaction
          ? tx.lastValidBlockHeight
          : undefined,
      reason,
    };
  } catch {
    return details;
  }
}

export function withSolTxDiagnosticBlockhash(
  context: ISolanaTxDiagnosticContext | undefined,
  encodedTx: IEncodedTx | null,
  fetched?: ISolanaBlockhashDiagnostic,
): ISolanaTxDiagnosticContext | undefined {
  if (!context) return undefined;
  try {
    const { recentBlockhash, lastValidBlockHeight } =
      inspectSolTxDiagnostic(encodedTx);
    let observed: ISolanaBlockhashDiagnostic | undefined;
    if (context.recentBlockhash === recentBlockhash && recentBlockhash) {
      observed = context;
    }
    // Only an explicit response from this transaction's refresh replaces
    // its observation, including a fresh response carrying the same hash.
    if (fetched?.recentBlockhash === recentBlockhash && recentBlockhash) {
      observed = fetched;
    }
    return {
      correlationId: context.correlationId,
      startedAt: context.startedAt,
      recentBlockhash,
      lastValidBlockHeight:
        observed?.lastValidBlockHeight ?? lastValidBlockHeight,
      contextSlot: observed?.contextSlot,
      commitment: observed?.commitment,
      blockhashFetchedAt: observed?.blockhashFetchedAt,
      blockhashFetchAttempts: observed?.blockhashFetchAttempts,
      blockhashFetchDurationMs: observed?.blockhashFetchDurationMs,
    };
  } catch {
    return undefined;
  }
}
