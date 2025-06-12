import { bytesToHex } from '@noble/hashes/utils';
import { PublicKey } from '@onekeyfe/kaspa-core-lib';

import { tweakPublicKey } from '@onekeyhq/core/src/secret/bip340';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

export enum EKaspaSignType {
  Schnorr = 'schnorr',
  ECDSA = 'ecdsa',
}

export function publicKeyFromDER(der: string): PublicKey {
  // @ts-expect-error
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-return
  return PublicKey.fromString(der);
}

export function publicKeyFromX(odd: boolean, x: string): PublicKey {
  const pub = odd ? `02${x}` : `03${x}`;
  // @ts-expect-error
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-return
  return PublicKey.fromString(pub);
}

export function publicKeyFromOriginPubkey(pubkey: Buffer): PublicKey {
  const tweakPublic = tweakPublicKey(pubkey.subarray(1));
  if (!tweakPublic) throw new OneKeyLocalError('Public key tweak failed');
  const { parity, x: xOnlyPubkey } = tweakPublic;
  return publicKeyFromX(parity === 0, bytesToHex(xOnlyPubkey));
}
