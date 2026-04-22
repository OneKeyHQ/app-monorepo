import { OneKeyLocalError } from '../errors';

const ENCODE_TEXT_PREFIX = {
  aes: 'SENSITIVE_ENCODE::AE7EADC1-CDA0-45FA-A340-E93BEDDEA21E::',
  xor: 'SENSITIVE_ENCODE::AAAAAAAA-2E51-4DC6-A913-79EB1C62D09E::',
};

function isEncodedSensitiveText(text: string) {
  return (
    text.startsWith(ENCODE_TEXT_PREFIX.aes) ||
    text.startsWith(ENCODE_TEXT_PREFIX.xor)
  );
}

function ensureSensitiveTextEncoded(text: string) {
  if (!isEncodedSensitiveText(text)) {
    throw new OneKeyLocalError('Not encoded sensitive text');
  }
}

export {
  ENCODE_TEXT_PREFIX,
  ensureSensitiveTextEncoded,
  isEncodedSensitiveText,
};
