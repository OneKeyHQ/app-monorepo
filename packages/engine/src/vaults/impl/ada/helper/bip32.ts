/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */

import { mnemonicFromEntropy } from '@onekeyfe/blockchain-libs/dist/secret';
// @ts-expect-error
import { bech32, mnemonicToRootKeypair } from 'cardano-crypto.js';

import { BIP32Path } from '../types';

import { DERIVATION_SCHEME, HARDENED_THRESHOLD } from './constants';

export function toBip32StringPath(derivationPath: BIP32Path) {
  return `m/${derivationPath
    .map(
      (item) =>
        // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
        (item % HARDENED_THRESHOLD) + (item >= HARDENED_THRESHOLD ? "'" : ''),
    )
    .join('/')}`;
}

export function getPathIndex(path: string) {
  return path.split('/').slice(3, 4)[0].slice(0, -1);
}

export async function getRootKey(
  password: string,
  entropy: Buffer,
): Promise<Buffer> {
  const mnemonic = mnemonicFromEntropy(entropy, password);
  const rootKey = await mnemonicToRootKeypair(mnemonic, DERIVATION_SCHEME);
  return rootKey;
}

export async function getXprvString(password: string, entropy: Buffer) {
  const rootKey = await getRootKey(password, entropy);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const xprv = bech32.encode(
    'xprv',
    Buffer.concat([rootKey.slice(0, 64), rootKey.slice(96)]),
  ) as string;
  return xprv;
}
