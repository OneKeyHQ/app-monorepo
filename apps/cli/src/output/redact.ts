import { createHash } from 'node:crypto';

const DISPLAY_ADDRESS_PREFIX_LENGTH = 8;
const DISPLAY_ADDRESS_SUFFIX_LENGTH = 6;
const KEY_ID_VISIBLE_LENGTH = 8;
const PRIVATE_KEY_REGEX = /0x[a-fA-F0-9]{64}(?![a-fA-F0-9])/g;
const MNEMONIC_REGEX = /\b([a-z]{3,8} ){11,23}[a-z]{3,8}\b/g;
const BEARER_TOKEN_REGEX = /\bBearer\s+([A-Za-z0-9._~+/=-]{8,})\b/gi;

export function redactDisplayAddress(addr: string): string {
  if (
    addr.length <=
    DISPLAY_ADDRESS_PREFIX_LENGTH + DISPLAY_ADDRESS_SUFFIX_LENGTH
  ) {
    return addr;
  }

  return `${addr.slice(0, DISPLAY_ADDRESS_PREFIX_LENGTH)}...${addr.slice(
    -DISPLAY_ADDRESS_SUFFIX_LENGTH,
  )}`;
}

export function redactKeyId(id: string): string {
  return id.slice(0, KEY_ID_VISIBLE_LENGTH);
}

export function redactSecret(s: string): string {
  const digest = createHash('sha256').update(s).digest('hex').slice(0, 8);
  return `<REDACTED:sha256:${digest}>`;
}

export function redactSensitiveText(text: string): string {
  return text
    .replace(PRIVATE_KEY_REGEX, (value) => redactSecret(value))
    .replace(MNEMONIC_REGEX, (value) => redactSecret(value))
    .replace(BEARER_TOKEN_REGEX, (_value, token: string) => {
      return `Bearer ${redactSecret(token)}`;
    });
}
