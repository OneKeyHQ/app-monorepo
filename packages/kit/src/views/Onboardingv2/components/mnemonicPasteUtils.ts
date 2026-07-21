export const PHRASE_LENGTHS = [12, 15, 18, 21, 24] as const;

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
