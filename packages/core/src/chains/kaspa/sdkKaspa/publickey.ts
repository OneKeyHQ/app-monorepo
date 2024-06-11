import { PublicKey } from '@kaspa/core-lib';
import { bytesToHex } from '@noble/hashes/utils';

import { tweakPublicKey } from '@onekeyhq/core/src/secret/bip340';

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
  const tweakPublic = tweakPublicKey(Buffer.from(pubkey.slice(1)));
  if (!tweakPublic) throw new Error('Public key tweak failed');
  const { parity, x: xOnlyPubkey } = tweakPublic;
  return publicKeyFromX(parity === 0, bytesToHex(xOnlyPubkey));
}
