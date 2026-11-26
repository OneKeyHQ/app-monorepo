import { IMPL_LIGHTNING_SPARK } from '@onekeyhq/shared/src/engine/engineConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

// The Spark key helpers are imported from their files, not the secret index:
// the index loads at background startup, these only with this chain.
import { seedFromHdCredentialAsync } from '../../secret';
import {
  LIGHTNING_SPARK_BIP85_PATH,
  deriveLightningSparkChildMnemonic,
} from '../../secret/bip85';
import {
  deriveLightningSparkIdentityPublicKey,
  encodeLightningSparkAddress,
} from '../../secret/lightningSpark';

import type { ISeedFromHdCredentialAsyncParams } from '../../secret';
import type { ILightningSparkNetwork } from '../../secret/lightningSpark';

// Spec v1 fixes the BIP-85 index, so every wallet has exactly one Spark
// account.
export const SPARK_ACCOUNT_INDEX = 0;

export const SPARK_ACCOUNT_PATH = `m/${LIGHTNING_SPARK_BIP85_PATH.map(
  (index) => `${index}'`,
).join('/')}`;

// The Spark network comes from the impl because addresses and identity keys
// differ per network; the chainId of the network is just '0'.
export function getSparkNetworkFromImpl(impl: string): ILightningSparkNetwork {
  if (impl === IMPL_LIGHTNING_SPARK) {
    return 'mainnet';
  }
  throw new OneKeyLocalError(`Unsupported Spark impl: ${impl}`);
}

/**
 * Derives the BIP-85 Lightning child mnemonic of an HD wallet. The result is
 * the wallet's full Lightning spending secret: it must never be persisted,
 * logged, or returned to the UI.
 */
export async function deriveSparkChildMnemonicFromHdCredential(
  params: ISeedFromHdCredentialAsyncParams,
): Promise<string> {
  const seed = await seedFromHdCredentialAsync(params);
  try {
    return deriveLightningSparkChildMnemonic({ seed });
  } finally {
    seed.fill(0);
  }
}

export function getSparkAccountFromChildMnemonic({
  childMnemonic,
  network,
}: {
  childMnemonic: string;
  network: ILightningSparkNetwork;
}): { publicKey: string; address: string } {
  const identityPublicKey = deriveLightningSparkIdentityPublicKey({
    childMnemonic,
    network,
  });
  return {
    publicKey: identityPublicKey.toString('hex'),
    address: encodeLightningSparkAddress({ identityPublicKey, network }),
  };
}
