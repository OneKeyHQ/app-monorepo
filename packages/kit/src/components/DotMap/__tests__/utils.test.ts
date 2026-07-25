import englishWordlist from 'bip39/src/wordlists/english.json';

import {
  EKeyTagRowStatus,
  KEY_TAG_ROW_BITS,
  canSubmitKeyTagRows,
  decodeKeyTagRow,
  encodeWordToKeyTagRowValue,
  firstKeyTagRowMismatchIndex,
  firstNonVerifiedKeyTagRowIndex,
  isKeyTagRowBitOn,
  keyTagRowValueToBits,
  keyTagRowsMatchTrueValues,
  keyTagRowsShrinkDiscardsInput,
  keyTagRowsToMnemonic,
  mismatchedKeyTagRowNumbers,
  mnemonicToDotMapValues,
  resizeKeyTagRows,
  toggleKeyTagRowBit,
} from '../utils';

describe('KeyTag row codec', () => {
  it('round-trips every BIP39 word through encode/decode', () => {
    expect(englishWordlist).toHaveLength(2048);
    englishWordlist.forEach((word) => {
      const value = encodeWordToKeyTagRowValue(word);
      const decoded = decodeKeyTagRow(value, { touched: true });
      expect(decoded.status).toBe(EKeyTagRowStatus.Verified);
      expect(decoded.word).toBe(word);
    });
  });

  it('agrees with the display encoder on bit order (MSB-first)', () => {
    ['abandon', 'key', 'zoo'].forEach((word) => {
      const value = encodeWordToKeyTagRowValue(word);
      const displayBits = mnemonicToDotMapValues(
        new Array(12).fill(word).join(' '),
      )[0].values;
      expect(keyTagRowValueToBits(value)).toEqual(displayBits);
    });
  });

  it('decodes boundary values', () => {
    expect(decodeKeyTagRow(0, { touched: false }).status).toBe(
      EKeyTagRowStatus.Unverified,
    );
    expect(decodeKeyTagRow(0, { touched: true }).status).toBe(
      EKeyTagRowStatus.Empty,
    );
    expect(decodeKeyTagRow(1, { touched: true })).toMatchObject({
      status: EKeyTagRowStatus.Verified,
      word: 'abandon',
    });
    expect(decodeKeyTagRow(2048, { touched: true })).toMatchObject({
      status: EKeyTagRowStatus.Verified,
      word: 'zoo',
    });
    expect(decodeKeyTagRow(2049, { touched: true }).status).toBe(
      EKeyTagRowStatus.Invalid,
    );
    expect(decodeKeyTagRow(4095, { touched: true }).status).toBe(
      EKeyTagRowStatus.Invalid,
    );
  });

  it('toggles holes with MSB-first weights', () => {
    // Hole 0 is the leftmost dot and carries weight 2048.
    expect(toggleKeyTagRowBit(0, 0)).toBe(2048);
    expect(toggleKeyTagRowBit(0, KEY_TAG_ROW_BITS - 1)).toBe(1);
    const value = toggleKeyTagRowBit(toggleKeyTagRowBit(0, 3), 11);
    expect(isKeyTagRowBitOn(value, 3)).toBe(true);
    expect(isKeyTagRowBitOn(value, 11)).toBe(true);
    expect(isKeyTagRowBitOn(value, 0)).toBe(false);
    // Toggling twice restores the original value.
    expect(toggleKeyTagRowBit(toggleKeyTagRowBit(123, 5), 5)).toBe(123);
  });

  it('gates submission on every row decoding to a wordlist entry', () => {
    const verified = englishWordlist
      .slice(0, 12)
      .map((word) => encodeWordToKeyTagRowValue(word));
    expect(canSubmitKeyTagRows(verified)).toBe(true);
    expect(keyTagRowsToMnemonic(verified)).toBe(
      englishWordlist.slice(0, 12).join(' '),
    );
    expect(canSubmitKeyTagRows([])).toBe(false);
    expect(canSubmitKeyTagRows([...verified.slice(0, 11), 0])).toBe(false);
    expect(canSubmitKeyTagRows([...verified.slice(0, 11), 2049])).toBe(false);
  });

  it('finds the first incomplete row', () => {
    const rows = [1, 2048, 0, 2049, 5];
    expect(firstNonVerifiedKeyTagRowIndex(rows)).toBe(2);
    expect(firstNonVerifiedKeyTagRowIndex([1, 2, 3])).toBe(-1);
  });

  it('resizes by truncating or padding with untouched rows', () => {
    const rows = [1, 2, 3, 4];
    expect(resizeKeyTagRows(rows, 2)).toEqual([1, 2]);
    expect(resizeKeyTagRows(rows, 6)).toEqual([1, 2, 3, 4, 0, 0]);
    expect(resizeKeyTagRows(rows, 4)).toEqual(rows);
  });

  it('flags shrink operations that would discard punched rows', () => {
    expect(keyTagRowsShrinkDiscardsInput([1, 2, 0, 0], 2)).toBe(false);
    expect(keyTagRowsShrinkDiscardsInput([1, 2, 5, 0], 2)).toBe(true);
    expect(keyTagRowsShrinkDiscardsInput([1, 2], 2)).toBe(false);
  });
});

describe('KeyTag backup verification', () => {
  const truth = [1, 2, 3, 4, 5];

  it('passes only on an exact per-row match', () => {
    expect(keyTagRowsMatchTrueValues([1, 2, 3, 4, 5], truth)).toBe(true);
    // one wrong-but-valid word (the silent fund-loss case) must fail
    expect(keyTagRowsMatchTrueValues([1, 2, 99, 4, 5], truth)).toBe(false);
    // length mismatch fails
    expect(keyTagRowsMatchTrueValues([1, 2, 3, 4], truth)).toBe(false);
  });

  it('never passes a blank plate, even against blank truth', () => {
    // canSubmitKeyTagRows(trueValues) guards the degenerate case: an all-zero
    // (or unmapped-word) truth can never be "matched" by an empty entry.
    expect(keyTagRowsMatchTrueValues([0, 0, 0], [0, 0, 0])).toBe(false);
    expect(keyTagRowsMatchTrueValues([0, 0, 0, 0, 0], truth)).toBe(false);
  });

  it('locates and lists the mismatched rows', () => {
    expect(firstKeyTagRowMismatchIndex([1, 2, 3, 4, 5], truth)).toBe(-1);
    expect(firstKeyTagRowMismatchIndex([1, 9, 3, 4, 5], truth)).toBe(1);
    // 1-based row numbers for a color-independent message
    expect(mismatchedKeyTagRowNumbers([1, 9, 3, 0, 5], truth)).toEqual([2, 4]);
    expect(mismatchedKeyTagRowNumbers([1, 2, 3, 4, 5], truth)).toEqual([]);
  });
});
