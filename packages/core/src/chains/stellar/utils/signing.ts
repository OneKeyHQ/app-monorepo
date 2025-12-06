import type { ISignedTxPro } from '@onekeyhq/core/src/types';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import sdkStellar from '../sdkStellar';

/**
 * Assemble signed transaction from unsigned transaction and signature
 * Used for hardware wallet signing
 */
export function assembleSignedTransaction(params: {
  encodedTx: string; // Unsigned transaction XDR
  signature: Buffer; // 64-byte Ed25519 signature
  publicKey: Buffer; // 32-byte public key
}): ISignedTxPro {
  const { encodedTx, signature, publicKey } = params;

  // Parse transaction envelope to get raw XDR structure
  const txEnvelope = sdkStellar.xdr.TransactionEnvelope.fromXDR(
    encodedTx,
    'base64',
  );

  // Create signature hint (last 4 bytes of public key)
  const signatureHint = publicKey.subarray(-4);

  // Create decorated signature
  const decoratedSignature = new sdkStellar.xdr.DecoratedSignature({
    hint: signatureHint,
    signature,
  });

  // Add signature to transaction envelope
  txEnvelope.value().signatures().push(decoratedSignature);

  // Encode signed transaction
  const rawTx = txEnvelope.toXDR('base64');

  // Parse as Transaction to get hash
  const tx = new sdkStellar.StellarSdk.Transaction(
    txEnvelope,
    sdkStellar.Networks.PUBLIC,
  );
  const txHash = tx.hash();
  const txid = bufferUtils.bytesToHex(txHash);

  return {
    encodedTx,
    txid,
    rawTx,
  };
}

/**
 * Assemble multi-signature transaction
 * Used when transaction requires multiple signatures
 */
export function assembleMultiSignedTransaction(params: {
  encodedTx: string;
  signatures: Array<{
    signature: Buffer;
    publicKey: Buffer;
  }>;
}): ISignedTxPro {
  const { encodedTx, signatures } = params;

  // Parse transaction envelope to get raw XDR structure
  const txEnvelope = sdkStellar.xdr.TransactionEnvelope.fromXDR(
    encodedTx,
    'base64',
  );

  // Add all signatures
  for (const { signature, publicKey } of signatures) {
    const signatureHint = publicKey.subarray(-4);
    const decoratedSignature = new sdkStellar.xdr.DecoratedSignature({
      hint: signatureHint,
      signature,
    });
    txEnvelope.value().signatures().push(decoratedSignature);
  }

  // Encode signed transaction
  const rawTx = txEnvelope.toXDR('base64');

  // Parse as Transaction to get hash
  const tx = new sdkStellar.StellarSdk.Transaction(
    txEnvelope,
    sdkStellar.Networks.PUBLIC,
  );
  const txHash = tx.hash();
  const txid = bufferUtils.bytesToHex(txHash);

  return {
    encodedTx,
    txid,
    rawTx,
  };
}

/**
 * Verify if transaction has valid signature
 */
export function verifyTransactionSignature(params: {
  encodedTx: string;
  rawTx: string;
  publicKey: Buffer;
}): boolean {
  try {
    const { rawTx, publicKey } = params;

    // Parse signed transaction
    const signedTxEnvelope = sdkStellar.xdr.TransactionEnvelope.fromXDR(
      rawTx,
      'base64',
    );

    const signatures = signedTxEnvelope.value().signatures();

    // Check if any signature matches the public key
    const publicKeyHint = publicKey.subarray(-4);

    for (const sig of signatures) {
      const hint = sig.hint();
      if (Buffer.compare(hint, publicKeyHint) === 0) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Count signatures in transaction
 */
export function countSignatures(rawTx: string): number {
  try {
    const txEnvelope = sdkStellar.xdr.TransactionEnvelope.fromXDR(
      rawTx,
      'base64',
    );
    return txEnvelope.value().signatures().length;
  } catch {
    return 0;
  }
}
