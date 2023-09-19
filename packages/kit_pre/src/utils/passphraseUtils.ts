export const isPassphraseValid = (
  passphrase: string,
  options?: {
    allowExtendedASCII?: boolean;
  },
): boolean => {
  let regExp = /^[\x20-\x7E]*$/;
  if (options?.allowExtendedASCII) {
    regExp = /^[\x20-\xFF]*$/;
  }

  return regExp.test(passphrase);
};
