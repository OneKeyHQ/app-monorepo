export const isPassphraseValid = (
  passphrase: string,
  options?: {
    onDevice?: boolean;
  },
): boolean => {
  let regExp = /^[\x20-\xFF]*$/;
  if (options?.onDevice) {
    regExp = /^[\x20-\x7F]*$/;
  }

  return regExp.test(passphrase);
};
