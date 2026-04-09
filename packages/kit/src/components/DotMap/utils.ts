// Import only the English wordlist instead of the full bip39 barrel
// (which pulls 11 language JSON files ~100KB+ each into common).
import englishWordlist from 'bip39/src/wordlists/english.json';
import { padStart } from 'lodash';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import type { IDotMapValues } from './types';

const VALID_MNEMONIC_LENGTHS = [12, 15, 18, 21, 24];

function validateMnemonic(mnemonic: string): boolean {
  const words = mnemonic.split(' ');
  if (!VALID_MNEMONIC_LENGTHS.includes(words.length)) return false;
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
