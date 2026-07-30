import {
  buildPhraseFormValues,
  getInvalidWordErrors,
  getMnemonicPasteWordsFromChangeText,
  mergePastedPhraseWords,
  resolvePhraseLengthAfterPaste,
} from './mnemonicPasteUtils';

describe('mnemonicPasteUtils', () => {
  it('uses change text as a paste fallback only on native', () => {
    const value = Array.from({ length: 12 }, () => 'abandon').join(' ');

    expect(
      getMnemonicPasteWordsFromChangeText({ value, isNative: false }),
    ).toBeNull();
    expect(
      getMnemonicPasteWordsFromChangeText({ value, isNative: true }),
    ).toHaveLength(12);
    expect(
      getMnemonicPasteWordsFromChangeText({
        value: 'abandon',
        isNative: true,
      }),
    ).toBeNull();
  });

  it('updates the selected phrase length for a full phrase replacement', () => {
    expect(
      resolvePhraseLengthAfterPaste({
        pastedWordCount: 15,
        currentPhraseLength: 12,
        inputIndex: 0,
      }),
    ).toBe(15);
    expect(
      resolvePhraseLengthAfterPaste({
        pastedWordCount: 12,
        currentPhraseLength: 24,
        inputIndex: 0,
      }),
    ).toBe(12);
  });

  it('rejects a non-standard word count', () => {
    expect(
      resolvePhraseLengthAfterPaste({
        pastedWordCount: 13,
        currentPhraseLength: 12,
        inputIndex: 0,
      }),
    ).toBeNull();
  });

  it('keeps the selected length when a non-first paste fits', () => {
    expect(
      resolvePhraseLengthAfterPaste({
        pastedWordCount: 12,
        currentPhraseLength: 24,
        inputIndex: 1,
      }),
    ).toBe(24);
  });

  it('rejects a non-first paste that would overflow the current phrase', () => {
    expect(
      resolvePhraseLengthAfterPaste({
        pastedWordCount: 12,
        currentPhraseLength: 12,
        inputIndex: 1,
      }),
    ).toBeNull();
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

  it('overwrites only the pasted range for a non-first paste', () => {
    const words = mergePastedPhraseWords({
      currentWords: Array.from(
        { length: 24 },
        (_, index) => `current-${index + 1}`,
      ),
      pastedWords: Array.from(
        { length: 12 },
        (_, index) => `pasted-${index + 1}`,
      ),
      inputIndex: 1,
      phraseLength: 24,
    });

    expect(words[0]).toBe('current-1');
    expect(words[1]).toBe('pasted-1');
    expect(words[12]).toBe('pasted-12');
    expect(words[13]).toBe('current-14');
    expect(words).toHaveLength(24);
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
