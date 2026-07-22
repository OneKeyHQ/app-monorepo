import {
  buildPhraseFormValues,
  getInvalidWordErrors,
  mergePastedPhraseWords,
  resolvePhraseLengthAfterPaste,
} from './mnemonicPasteUtils';

describe('mnemonicPasteUtils', () => {
  it('updates the selected phrase length in either direction', () => {
    expect(resolvePhraseLengthAfterPaste(15, 12)).toBe(15);
    expect(resolvePhraseLengthAfterPaste(12, 24)).toBe(12);
  });

  it('keeps the selected phrase length for a non-standard word count', () => {
    expect(resolvePhraseLengthAfterPaste(13, 12)).toBe(12);
  });

  it('builds every dynamic field before the phrase length changes', () => {
    const pastedWords = Array.from(
      { length: 21 },
      (_, index) => `word-${index + 1}`,
    );
    const words = mergePastedPhraseWords({
      currentWords: Array.from({ length: 12 }, () => ''),
      pastedWords,
      inputIndex: 0,
      phraseLength: 21,
    });

    expect(buildPhraseFormValues(words)).toMatchObject({
      phrase1: 'word-1',
      phrase12: 'word-12',
      phrase13: 'word-13',
      phrase21: 'word-21',
    });
  });

  it('checks invalid words across the entire pasted phrase', () => {
    const words = [
      ...Array.from({ length: 12 }, () => 'valid'),
      'invalid-13',
      'invalid-14',
      'invalid-15',
    ];

    expect(getInvalidWordErrors(words, new Set(['valid']))).toEqual({
      12: true,
      13: true,
      14: true,
    });
  });
});
