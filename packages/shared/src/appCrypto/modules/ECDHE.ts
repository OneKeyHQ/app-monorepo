import * as secp256k1 from '@noble/secp256k1';

import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import { OneKeyLocalError } from '../../errors';

// Generate ECDHE key pair
export async function generateECDHEKeyPair({
  isCompressed = true,
}: {
  isCompressed?: boolean;
} = {}): Promise<{
  privateKey: string;
  publicKey: string;
}> {
  const privateKey = secp256k1.utils.randomPrivateKey();
  const publicKey = secp256k1.getPublicKey(privateKey, isCompressed); // compressed
  return {
    privateKey: bufferUtils.bytesToHex(privateKey),
    publicKey: bufferUtils.bytesToHex(publicKey),
  };
}

export async function getSharedSecret({
  isCompressed = true,
  privateKey,
  publicKey,
}: {
  isCompressed?: boolean;
  privateKey: string;
  publicKey: string;
}): Promise<string> {
  if (privateKey.length !== 64) {
    throw new OneKeyLocalError('Invalid private key');
  }
  if (publicKey.length !== 66) {
    throw new OneKeyLocalError('Invalid public key');
  }
  const privateKeyBytes = bufferUtils.hexToBytes(privateKey);
  const publicKeyBytes = bufferUtils.hexToBytes(publicKey);
  const sharedSecret = secp256k1.getSharedSecret(
    privateKeyBytes,
    publicKeyBytes,
    isCompressed,
  );
  const sharedSecretHex = bufferUtils.bytesToHex(sharedSecret);
  if (
    !sharedSecret ||
    sharedSecret?.length === 0 ||
    sharedSecretHex.length !== 66
  ) {
    throw new OneKeyLocalError('Invalid shared secret');
  }
  return sharedSecretHex;
}
