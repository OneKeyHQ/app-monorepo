import * as bip39 from 'bip39';

import { KeyTagMnemonicStatus } from './types';

import type { KeyTagMnemonic } from './types';

export const Bip39DotmapUrl = 'https://onekey.so/bip39-dotmap';
export const keyTagShoppingUrl = 'https://onekey.so/products/onekey-keytag';

const bitCount = 12;

const mnemonicIndexNumberToDotMapData = (mnemonicIndexNumber: number) => {
  if (mnemonicIndexNumber < 0) return [];
  const binary = parseInt(`${mnemonicIndexNumber}`).toString(2);
  let zeroPreCount = bitCount - binary.length;
  let zeroPreStr = '';
  while (zeroPreCount > 0) {
    zeroPreStr += '0';
    zeroPreCount -= 1;
  }
  const binaryArr = (zeroPreStr + binary).split('');
  const binaryToBoolean: boolean[] = [];
  binaryArr.forEach((binaryBit) => {
    binaryToBoolean.push(binaryBit === '1');
  });
  return binaryToBoolean;
};

const getMnemonicWordIndexNumber = (mnemonicWord: string) => {
  const wordlist = bip39.wordlists.english;
  const index = wordlist.indexOf(mnemonicWord);
  return index === -1 ? -1 : index + 1;
};

export const mnemonicWordToKeyTagMnemonic = (mnemonic: string) => {
  const mnemonicIndexNumber = getMnemonicWordIndexNumber(mnemonic);
  const status =
    mnemonicIndexNumber === -1
      ? KeyTagMnemonicStatus.INCORRECT
      : KeyTagMnemonicStatus.VERIF;
  const dotMapData = mnemonicIndexNumberToDotMapData(mnemonicIndexNumber);
  return { mnemonicIndexNumber, status, dotMapData };
};

export const mnemonicWordsToKeyTagMnemonic = (mnemonics: string) => {
  const usedMnemonic = mnemonics.trim().replace(/\s+/g, ' ');
  const validMnemonic = bip39.validateMnemonic(usedMnemonic);
  if (validMnemonic) {
    const words = usedMnemonic.split(' ');
    const keyTagMnemonics: KeyTagMnemonic[] = [];
    words.forEach((word, index) => {
      let keyTagMnemonic: KeyTagMnemonic = {
        index: index + 1,
        mnemonicWord: word,
      };
      keyTagMnemonic = Object.assign(
        keyTagMnemonic,
        mnemonicWordToKeyTagMnemonic(word),
      );
      keyTagMnemonics.push(keyTagMnemonic);
    });
    return keyTagMnemonics;
  }
};

export const keyTagWordDataToMnemonic = (data: boolean[]) => {
  let binaryStr = '';
  data.forEach((b) => {
    binaryStr += b ? '1' : '0';
  });
  let mnemonicWord;
  let status = KeyTagMnemonicStatus.UNVERIF;
  const mnemonicIndexNumber = parseInt(binaryStr, 2);
  const wordlist = bip39.wordlists.english;
  if (mnemonicIndexNumber === 0 || Number.isNaN(mnemonicIndexNumber)) {
    status = KeyTagMnemonicStatus.EMPTY;
  } else if (mnemonicIndexNumber - 1 < wordlist.length) {
    mnemonicWord = wordlist[mnemonicIndexNumber - 1];
    status = KeyTagMnemonicStatus.VERIF;
  } else {
    status = KeyTagMnemonicStatus.INCORRECT;
  }
  return { mnemonicWord, mnemonicIndexNumber, status };
};

export const generalKeyTagMnemonic = (
  mnemonicCount: number,
  origin?: KeyTagMnemonic[],
) => {
  let res = [];
  if (origin && origin.length >= mnemonicCount) {
    res = [...origin.slice(0, mnemonicCount)];
  } else {
    res = origin ? [...origin] : [];
    const addCount = origin ? mnemonicCount - origin.length : mnemonicCount;
    for (let i = mnemonicCount - addCount; i < mnemonicCount; i += 1) {
      const defaultKeyTagMnemonic: KeyTagMnemonic = {
        index: i + 1,
        dotMapData: new Array(bitCount).fill(false),
        status: KeyTagMnemonicStatus.UNVERIF,
      };
      res.push(defaultKeyTagMnemonic);
    }
  }
  return res;
};
