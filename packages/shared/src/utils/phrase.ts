export const parseSecretRecoveryPhrase = (seedPhrase: string) =>
  (seedPhrase || '').trim().toLowerCase().match(/\w+/gu)?.join(' ') || '';

export const parseSecretRecoveryPhraseToWords = (seedPhrase: string) => {
  const phrase = parseSecretRecoveryPhrase(seedPhrase);
  return phrase ? phrase.split(' ') : [];
};
