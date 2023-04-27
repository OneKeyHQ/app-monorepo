import { PrivateKey } from '@kaspa/core-lib';
import { bytesToHex } from '@noble/hashes/utils';

import { tapTweakHash } from '@onekeyhq/engine/src/secret/bip340';
import ecc from '@onekeyhq/engine/src/vaults/utils/btcForkChain/provider/nobleSecp256k1Wrapper';

export function privateKeyFromWIF(wif: string): PrivateKey {
  // @ts-expect-error
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-return
  return PrivateKey.fromWIF(wif);
}

export function privateKeyFromBuffer(pri: Buffer, chainId: string): PrivateKey {
  // @ts-expect-error
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-return
  return PrivateKey.fromBuffer(pri, chainId);
}

export function privateKeyFromOriginPrivateKey(
  pri: Buffer,
  pub: Buffer,
  chainId: string,
): PrivateKey {
  let privateKey: Uint8Array | null = new Uint8Array(pri);
  const publicKey = pub;

  if (publicKey[0] === 3) {
    privateKey = ecc.privateNegate(privateKey);
  }

  if (!privateKey) {
    throw new Error('Private key is required for tweaking signer!');
  }

  const tweakedPrivateKey = ecc.privateAdd(
    privateKey,
    tapTweakHash(publicKey.slice(1), undefined),
  );

  // @ts-expect-error
  return new PrivateKey(bytesToHex(tweakedPrivateKey), chainId);
}
