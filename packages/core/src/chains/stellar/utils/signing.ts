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
  publicKey?: Buffer; // 32-byte public key (optional - will extract from transaction if not provided)
  networkPassphrase: string; // Network passphrase for correct hash calculation
}): ISignedTxPro {
  const { encodedTx, signature, publicKey, networkPassphrase } = params;

  // Parse transaction envelope to get raw XDR structure
  const txEnvelope = sdkStellar.xdr.TransactionEnvelope.fromXDR(
    encodedTx,
    'base64',
  );

  // Parse as Transaction to get hash and source
  const tx = new sdkStellar.StellarSdk.Transaction(
    txEnvelope,
    networkPassphrase,
  );

  // Get public key from parameter or extract from transaction source
  let signingPublicKey = publicKey;
  if (!signingPublicKey) {
    // Extract from transaction source address
    const sourceAddress = tx.source;
    signingPublicKey = Buffer.from(
      sdkStellar.StrKey.decodeEd25519PublicKey(sourceAddress),
    );
  }

  // Create signature hint (last 4 bytes of public key)
  const signatureHint = signingPublicKey.subarray(-4);

  // Create decorated signature
  const decoratedSignature = new sdkStellar.xdr.DecoratedSignature({
    hint: signatureHint,
    signature,
  });

  // Add signature to transaction envelope
  txEnvelope.value().signatures().push(decoratedSignature);

  // Encode signed transaction
  const rawTx = txEnvelope.toXDR('base64');

  // Get transaction hash and txid
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
  networkPassphrase: string; // Network passphrase for correct hash calculation
}): ISignedTxPro {
  const { encodedTx, signatures, networkPassphrase } = params;

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
    networkPassphrase,
  );
  const txHash = tx.hash();
  const txid = bufferUtils.bytesToHex(txHash);

  return {
    encodedTx,
    txid,
    rawTx,
  };
}
