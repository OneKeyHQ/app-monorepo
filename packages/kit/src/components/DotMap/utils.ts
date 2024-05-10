import * as bip39 from 'bip39';
import { padStart } from 'lodash';

import type { IDotMapValues } from './types';

const mnemonicWordToValueData = (word: string) => {
  const wordlist = bip39.wordlists.english;
  const index = wordlist.indexOf(word);
  if (index < 0) {
    throw new Error('Invalid mnemonic');
  }
  const binary = parseInt(`${index}`).toString(2);
  return padStart(binary, 12, '0')
    .split('')
    .map((bit) => bit === '1');
};

export const mnemonicToDotMapValues = (mnemonics: string) => {
  const usedMnemonic = mnemonics.trim().replace(/\s+/g, ' ');
  let validMnemonic = bip39.validateMnemonic(usedMnemonic);
  if (!validMnemonic) {
    throw new Error('Invalid mnemonic');
  }
  const words = usedMnemonic.split(' ');
  validMnemonic = bip39.validateMnemonic(words.join(' '));
  if (!validMnemonic) {
    throw new Error('Invalid mnemonic');
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
