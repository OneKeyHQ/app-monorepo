export const PHRASE_LENGTHS = [12, 15, 18, 21, 24] as const;

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
  const words = [...currentWords.slice(0, inputIndex), ...pastedWords].slice(
    0,
    phraseLength,
  );

  if (words.length < phraseLength) {
    words.push(...currentWords.slice(words.length, phraseLength));
  }

  return words;
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

export function resolvePhraseLengthAfterPaste(
  pastedWordCount: number,
  currentPhraseLength: number,
) {
  return PHRASE_LENGTHS.includes(
    pastedWordCount as (typeof PHRASE_LENGTHS)[number],
  )
    ? pastedWordCount
    : currentPhraseLength;
}
