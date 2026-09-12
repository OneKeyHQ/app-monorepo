/**
 * Protocol V2 devices (Pro 2 / Neo class) take the passphrase as UTF-8:
 * the app normalizes it to NFKD so a visually identical entry always
 * reaches the device as the same bytes, and the device's limit is on the
 * encoded length, not the character count. Everything older takes
 * printable ASCII only.
 */
export const PROTOCOL_V2_PASSPHRASE_MAX_BYTES = 50;

export const normalizeProtocolV2Passphrase = (passphrase: string) =>
  passphrase.normalize('NFKD');

export const protocolV2Utf8ByteLength = (value: string) => {
  let length = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint >= 0xd8_00 && codePoint <= 0xdf_ff)
      return Number.POSITIVE_INFINITY;
    if (codePoint <= 0x7f) length += 1;
    else if (codePoint <= 0x7_ff) length += 2;
    else if (codePoint <= 0xff_ff) length += 3;
    else length += 4;
  }
  return length;
};

export const isPassphraseValid = (
  passphrase: string,
  options?: {
    allowExtendedASCII?: boolean;
    allowProtocolV2Utf8?: boolean;
  },
): boolean => {
  if (options?.allowProtocolV2Utf8) {
    const normalized = normalizeProtocolV2Passphrase(passphrase);
    return (
      !normalized.includes('\0') &&
      protocolV2Utf8ByteLength(normalized) <= PROTOCOL_V2_PASSPHRASE_MAX_BYTES
    );
  }

  let regExp = /^[\x20-\x7E]*$/;
  if (options?.allowExtendedASCII) {
    regExp = /^[\x20-\xFF]*$/;
  }

  return regExp.test(passphrase);
};
