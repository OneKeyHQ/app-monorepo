// Import only the English wordlist instead of the full bip39 barrel
// (which pulls 11 language JSON files ~100KB+ each into common).
import englishWordlist from 'bip39/src/wordlists/english.json';
import { padStart } from 'lodash';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import type { IDotMapValues } from './types';

const VALID_MNEMONIC_LENGTHS = new Set([12, 15, 18, 21, 24]);

// TODO: this check does not verify the BIP39 checksum (unlike the
// bip39.validateMnemonic() it replaced). A mnemonic with valid words but an
// invalid checksum would still render a DotMap. Authoritative validation
// still happens at wallet import/creation time, so this is cosmetic only,
// but we should restore checksum verification here without pulling back
// all 11 wordlist JSON files.
function validateMnemonic(mnemonic: string): boolean {
  const words = mnemonic.split(' ');
  if (!VALID_MNEMONIC_LENGTHS.has(words.length)) return false;
  return words.every((word) => englishWordlist.includes(word));
}

const mnemonicWordToValueData = (word: string) => {
  const wordlist = englishWordlist;
  const index = wordlist.indexOf(word);
  if (index < 0) {
    throw new OneKeyLocalError('Invalid mnemonic');
  }
  const binary = parseInt(`${index + 1}`, 10).toString(2);
  return padStart(binary, 12, '0')
    .split('')
    .map((bit) => bit === '1');
};

export const mnemonicToDotMapValues = (mnemonics: string) => {
  const usedMnemonic = mnemonics.trim().replace(/\s+/g, ' ');
  let validMnemonic = validateMnemonic(usedMnemonic);
  if (!validMnemonic) {
    throw new OneKeyLocalError('Invalid mnemonic');
  }
  const words = usedMnemonic.split(' ');
  validMnemonic = validateMnemonic(words.join(' '));
  if (!validMnemonic) {
    throw new OneKeyLocalError('Invalid mnemonic');
  }
  const keyTagMnemonics: IDotMapValues[] = [];
  words.forEach((word, index) => {
    const keyTagMnemonic: IDotMapValues = {
      index: index + 1,
      values: mnemonicWordToValueData(word),
    };
    keyTagMnemonics.push(keyTagMnemonic);
  });
  return keyTagMnemonics;
};
