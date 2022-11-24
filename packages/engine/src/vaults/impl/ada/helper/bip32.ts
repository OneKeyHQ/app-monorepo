/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */

import { mnemonicFromEntropy } from '@onekeyfe/blockchain-libs/dist/secret';
import { revealEntropy } from '@onekeyfe/blockchain-libs/dist/secret/bip39';
import { entropyToMnemonic } from 'bip39';
// @ts-expect-error
import { mnemonicToRootKeypair } from 'cardano-crypto.js';

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

export async function getRootKey(
  password: string,
  entropy: Buffer,
): Promise<Buffer> {
  const mnemonic = mnemonicFromEntropy(entropy, password);
  const rootKey = await mnemonicToRootKeypair(mnemonic, DERIVATION_SCHEME);
  return rootKey;
}
