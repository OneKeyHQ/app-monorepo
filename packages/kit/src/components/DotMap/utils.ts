import * as bip39 from 'bip39';
import { padStart } from 'lodash';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import type { IDotMapValues } from './types';

const mnemonicWordToValueData = (word: string) => {
  const wordlist = bip39.wordlists.english;
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
  let validMnemonic = bip39.validateMnemonic(usedMnemonic);
  if (!validMnemonic) {
    throw new OneKeyLocalError('Invalid mnemonic');
  }
  const words = usedMnemonic.split(' ');
  validMnemonic = bip39.validateMnemonic(words.join(' '));
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

export const dotMapValueToIndex = (values: boolean[]): number | null => {
  if (values.length !== 12) {
    return null;
  }
  const binary = values.map((bit) => (bit ? '1' : '0')).join('');
  const index = parseInt(binary, 2);
  if (index < 1 || index > 2048) {
    return null;
  }
  return index;
};

export const dotMapValueToWord = (values: boolean[]): string | null => {
  const index = dotMapValueToIndex(values);
  if (index === null) {
    return null;
  }
  const wordlist = bip39.wordlists.english;
  return wordlist[index - 1] || null;
};
