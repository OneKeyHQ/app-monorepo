import * as crypto from 'crypto';

import {
  entropyToMnemonic,
  generateMnemonic,
  mnemonicToEntropy,
  mnemonicToSeedSync,
  validateMnemonic,
  wordlists,
} from 'bip39';

import { InvalidMnemonic } from '@onekeyhq/shared/src/errors';
import { check } from '@onekeyhq/shared/src/utils/assertUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import type { ICoreHdCredentialEncryptHex } from '../types';

export type IBip39RevealableSeed = {
  entropyWithLangPrefixed: string;
  seed: string;
};
// JSON.stringify(IBip39RevealableSeed) -> utf8 text -> hex -> encrypt -> encrypt hex
export type IBip39RevealableSeedEncryptHex = ICoreHdCredentialEncryptHex;

function mnemonicToRevealableSeed(
  mnemonic: string,
  passphrase?: string,
): IBip39RevealableSeed {
  try {
    const entropyHexStr = mnemonicToEntropy(mnemonic, wordlists.english);
    const entropyLength: number = entropyHexStr.length / 2;
    const seed: Buffer = mnemonicToSeedSync(mnemonic, passphrase);
    return {
      entropyWithLangPrefixed: bufferUtils.bytesToHex(
        Buffer.concat([
          Buffer.from([1]), // langCode is always 1 for english wordlist.
          Buffer.from([entropyLength]),
          Buffer.from(entropyHexStr, 'hex'),
          crypto.randomBytes(32 - entropyLength), // Always pad entropy to 32 bytes.
        ]),
      ),
      seed: bufferUtils.bytesToHex(seed),
    };
  } catch {
    throw new InvalidMnemonic();
  }
}

function revealEntropyToMnemonic(
  entropyWithLangPrefixed: Buffer | string,
): string {
  // eslint-disable-next-line no-param-reassign
  entropyWithLangPrefixed = bufferUtils.toBuffer(entropyWithLangPrefixed);
  const langCode: number = entropyWithLangPrefixed[0];
  const entropyLength: number = entropyWithLangPrefixed[1];
  check(
    // eslint-disable-next-line eqeqeq
    langCode == 1 && [16, 20, 24, 28, 32].includes(entropyLength),
    'invalid entropy',
  );
  return entropyToMnemonic(
    entropyWithLangPrefixed.slice(2, 2 + entropyLength),
    wordlists.english,
  );
}

export {
  generateMnemonic,
  mnemonicToRevealableSeed,
  revealEntropyToMnemonic,
  validateMnemonic,
};
