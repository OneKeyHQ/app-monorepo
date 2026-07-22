export const PHRASE_LENGTHS = [12, 15, 18, 21, 24] as const;

export function resolvePhraseLengthAfterPaste({
  pastedWordCount,
  currentPhraseLength,
  inputIndex,
}: {
  pastedWordCount: number;
  currentPhraseLength: number;
  inputIndex: number;
}) {
  if (
    !PHRASE_LENGTHS.includes(pastedWordCount as (typeof PHRASE_LENGTHS)[number])
  ) {
    return null;
  }

  if (inputIndex === 0) {
    return pastedWordCount;
  }

  return inputIndex + pastedWordCount <= currentPhraseLength
    ? currentPhraseLength
    : null;
}

export function mergePastedPhraseWords({
  currentWords,
  pastedWords,
  inputIndex,
  phraseLength,
}: {
  currentWords: string[];
  pastedWords: string[];
  inputIndex: number;
  phraseLength: number;
}) {
  const words = [...currentWords];
  pastedWords.forEach((word, index) => {
    words[inputIndex + index] = word;
  });

  return Array.from({ length: phraseLength }, (_, index) => words[index] ?? '');
}

export function buildPhraseFormValues(words: string[]) {
  return words.reduce(
    (values, word, index) => {
      values[`phrase${index + 1}`] = word;
      return values;
    },
    {} as Record<`phrase${number}`, string>,
  );
}

export function getInvalidWordErrors(
  words: string[],
  validWords: ReadonlySet<string>,
) {
  return words.reduce(
    (errors, word, index) => {
      if (word && !validWords.has(word)) {
        errors[index] = true;
      }
      return errors;
    },
    {} as Record<string, boolean>,
  );
}
