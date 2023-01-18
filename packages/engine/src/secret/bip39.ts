import * as crypto from 'crypto';

import * as bip39 from 'bip39';

import { InvalidMnemonic } from '@onekeyhq/shared/src/errors/common-errors';
import { check } from '@onekeyhq/shared/src/utils/assertUtils';

export type RevealableSeed = {
  entropyWithLangPrefixed: Buffer;
  seed: Buffer;
};

function mnemonicToRevealableSeed(
  mnemonic: string,
  passphrase?: string,
): RevealableSeed {
  try {
    const entropyHexStr = bip39.mnemonicToEntropy(
      mnemonic,
      bip39.wordlists.english,
    );
    const entropyLength: number = entropyHexStr.length / 2;
    const seed: Buffer = bip39.mnemonicToSeedSync(mnemonic, passphrase);
    return {
      entropyWithLangPrefixed: Buffer.concat([
        Buffer.from([1]), // langCode is always 1 for english wordlist.
        Buffer.from([entropyLength]),
        Buffer.from(entropyHexStr, 'hex'),
        crypto.randomBytes(32 - entropyLength), // Always pad entropy to 32 bytes.
      ]),
      seed,
    };
  } catch {
    throw new InvalidMnemonic();
  }
}

function revealEntropy(entropyWithLangPrefixed: Buffer): string {
  const langCode: number = entropyWithLangPrefixed[0];
  const entropyLength: number = entropyWithLangPrefixed[1];
  check(
    // eslint-disable-next-line eqeqeq
    langCode == 1 && [16, 20, 24, 28, 32].includes(entropyLength),
    'invalid entropy',
  );
  return bip39.entropyToMnemonic(
    entropyWithLangPrefixed.slice(2, 2 + entropyLength),
    bip39.wordlists.english,
  );
}

export { mnemonicToRevealableSeed, revealEntropy };
