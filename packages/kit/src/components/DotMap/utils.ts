// Import only the English wordlist instead of the full bip39 barrel
// (which pulls 11 language JSON files ~100KB+ each into common).
import englishWordlist from 'bip39/src/wordlists/english.json';
import { padStart } from 'lodash';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import type { IDotMapValues } from './types';

// Recovery-phrase lengths a KeyTag can hold (one plate = 12 rows; >12 spills
// onto the back). Single source for the word-count picker and the validity gate.
export const KEY_TAG_WORD_COUNTS = [12, 15, 18, 21, 24] as const;

const VALID_MNEMONIC_LENGTHS = new Set<number>(KEY_TAG_WORD_COUNTS);

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

// ---------------------------------------------------------------------------
// KeyTag interactive input codec.
// A row is a packed 12-bit integer: bit 11 (MSB) is the leftmost hole (weight
// 2048) and bit 0 the rightmost (weight 1), matching the engraved scale on the
// physical plate and mnemonicWordToValueData() above. The decoded number is
// the 1-based BIP39 word index, so 0 means "no holes punched" and values
// 2049..4095 are representable but outside the wordlist.
// ---------------------------------------------------------------------------

export const KEY_TAG_ROW_BITS = 12;
export const KEY_TAG_PLATE_ROWS = 12;

export enum EKeyTagRowStatus {
  Unverified = 'unverified',
  Empty = 'empty',
  Verified = 'verified',
  Invalid = 'invalid',
}

export type IKeyTagRowDecoded = {
  status: EKeyTagRowStatus;
  wordIndexNumber: number;
  word?: string;
};

export function toggleKeyTagRowBit(value: number, holeIndex: number): number {
  return value ^ (1 << (KEY_TAG_ROW_BITS - 1 - holeIndex));
}

export function isKeyTagRowBitOn(value: number, holeIndex: number): boolean {
  return ((value >> (KEY_TAG_ROW_BITS - 1 - holeIndex)) & 1) === 1;
}

export function keyTagRowValueToBits(value: number): boolean[] {
  return Array.from({ length: KEY_TAG_ROW_BITS }, (_, holeIndex) =>
    isKeyTagRowBitOn(value, holeIndex),
  );
}

export function decodeKeyTagRow(
  value: number,
  { touched }: { touched: boolean },
): IKeyTagRowDecoded {
  if (value === 0) {
    return {
      status: touched ? EKeyTagRowStatus.Empty : EKeyTagRowStatus.Unverified,
      wordIndexNumber: 0,
    };
  }
  if (value <= englishWordlist.length) {
    return {
      status: EKeyTagRowStatus.Verified,
      wordIndexNumber: value,
      word: englishWordlist[value - 1],
    };
  }
  return { status: EKeyTagRowStatus.Invalid, wordIndexNumber: value };
}

export function encodeWordToKeyTagRowValue(word: string): number {
  const index = englishWordlist.indexOf(word);
  return index < 0 ? 0 : index + 1;
}

export function canSubmitKeyTagRows(values: number[]): boolean {
  return (
    values.length > 0 &&
    values.every((value) => value >= 1 && value <= englishWordlist.length)
  );
}

export function keyTagRowsToMnemonic(values: number[]): string {
  return values.map((value) => englishWordlist[value - 1] ?? '').join(' ');
}

export function firstNonVerifiedKeyTagRowIndex(values: number[]): number {
  return values.findIndex(
    (value) => !(value >= 1 && value <= englishWordlist.length),
  );
}

// Backup verification: the user re-enters their punched plate and each row is
// compared to the wallet's real per-row value. trueValues[i] is the packed
// 12-bit value of word i (1-based wordlist index). canSubmitKeyTagRows guards
// the degenerate case (a word not on the English list encodes to 0), so an
// empty/blank plate can never be mistaken for a match.
export function keyTagRowsMatchTrueValues(
  values: number[],
  trueValues: number[],
): boolean {
  return (
    canSubmitKeyTagRows(trueValues) &&
    values.length === trueValues.length &&
    values.every((value, index) => value === trueValues[index])
  );
}

export function firstKeyTagRowMismatchIndex(
  values: number[],
  trueValues: number[],
): number {
  return values.findIndex((value, index) => value !== trueValues[index]);
}

// 1-based row numbers whose entered value differs from the true value, for a
// color-independent "these rows don't match" message.
export function mismatchedKeyTagRowNumbers(
  values: number[],
  trueValues: number[],
): number[] {
  const out: number[] = [];
  values.forEach((value, index) => {
    if (value !== trueValues[index]) {
      out.push(index + 1);
    }
  });
  return out;
}

// Shrinking drops rows beyond nextCount; growing appends untouched rows.
export function resizeKeyTagRows(
  values: number[],
  nextCount: number,
): number[] {
  if (nextCount <= values.length) {
    return values.slice(0, nextCount);
  }
  return values.concat(new Array(nextCount - values.length).fill(0));
}

export function keyTagRowsShrinkDiscardsInput(
  values: number[],
  nextCount: number,
): boolean {
  return values.slice(nextCount).some((value) => value !== 0);
}

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
