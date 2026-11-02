import { bech32m } from 'bech32';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { mnemonicToSeedSync } from './bip39';
import {
  deriveSecp256k1HardenedPath,
  generateSecp256k1MasterKeyFromSeed,
} from './bip85';
import { secp256k1 } from './curves';

export type ILightningSparkNetwork = 'mainnet' | 'regtest';

const SPARK_KEY_PURPOSE = 8_797_555;
const SPARK_IDENTITY_KEY_INDEX = 0;

// Breez SDK 0.26.1 defaults when no account number is configured. They are
// part of every Spark identity, so they are pinned here and in the vectors.
const SPARK_ACCOUNT_NUMBER: Record<ILightningSparkNetwork, number> = {
  mainnet: 1,
  regtest: 0,
};

const SPARK_ADDRESS_HRP: Record<ILightningSparkNetwork, string> = {
  mainnet: 'spark',
  regtest: 'sparkrt',
};

// A Spark address is bech32m over a protobuf message whose field 1 is the
// 33-byte identity public key.
const SPARK_ADDRESS_IDENTITY_FIELD_PREFIX = Buffer.from([0x0a, 0x21]);

/**
 * Computes the Spark identity public key the Breez SDK uses for
 * `Seed.Mnemonic(childMnemonic)` with an empty passphrase, at
 * m/8797555'/<account>'/0', without connecting the SDK.
 */
export function deriveLightningSparkIdentityPublicKey({
  childMnemonic,
  network,
}: {
  childMnemonic: string;
  network: ILightningSparkNetwork;
}): Buffer {
  const seed = mnemonicToSeedSync(childMnemonic, '');
  const root = generateSecp256k1MasterKeyFromSeed(seed);
  const node = deriveSecp256k1HardenedPath(root, [
    SPARK_KEY_PURPOSE,
    SPARK_ACCOUNT_NUMBER[network],
    SPARK_IDENTITY_KEY_INDEX,
  ]);
  try {
    return secp256k1.publicFromPrivate(node.key);
  } finally {
    seed.fill(0);
    root.key.fill(0);
    root.chainCode.fill(0);
    node.key.fill(0);
    node.chainCode.fill(0);
  }
}

export function encodeLightningSparkAddress({
  identityPublicKey,
  network,
}: {
  identityPublicKey: Buffer;
  network: ILightningSparkNetwork;
}): string {
  if (identityPublicKey.length !== 33) {
    throw new OneKeyLocalError('Invalid Spark identity public key');
  }
  const payload = Buffer.concat([
    SPARK_ADDRESS_IDENTITY_FIELD_PREFIX,
    identityPublicKey,
  ]);
  return bech32m.encode(SPARK_ADDRESS_HRP[network], bech32m.toWords(payload));
}

/**
 * Decodes a plain Spark address of `network` (no invoice fields). Throws on
 * any other input, including the other network's addresses.
 */
export function decodeLightningSparkAddress({
  address,
  network,
}: {
  address: string;
  network: ILightningSparkNetwork;
}): { identityPublicKey: Buffer } {
  if (address !== address.toLowerCase()) {
    throw new OneKeyLocalError('Invalid Spark address');
  }
  let decoded: ReturnType<typeof bech32m.decode>;
  try {
    decoded = bech32m.decode(address);
  } catch {
    throw new OneKeyLocalError('Invalid Spark address');
  }
  const payload = Buffer.from(bech32m.fromWords(decoded.words));
  const identityPublicKey = payload.subarray(
    SPARK_ADDRESS_IDENTITY_FIELD_PREFIX.length,
  );
  if (
    decoded.prefix !== SPARK_ADDRESS_HRP[network] ||
    payload.length !== SPARK_ADDRESS_IDENTITY_FIELD_PREFIX.length + 33 ||
    !payload
      .subarray(0, SPARK_ADDRESS_IDENTITY_FIELD_PREFIX.length)
      .equals(SPARK_ADDRESS_IDENTITY_FIELD_PREFIX)
  ) {
    throw new OneKeyLocalError('Invalid Spark address');
  }
  try {
    secp256k1.transformPublicKey(identityPublicKey);
  } catch {
    throw new OneKeyLocalError('Invalid Spark address');
  }
  return { identityPublicKey: Buffer.from(identityPublicKey) };
}
