import { blake2b } from '@noble/hashes/blake2b';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export type IZcashMemoEncoding = 'utf8' | 'hex';

export function encodeZcashMemo(
  value: string,
  encoding: IZcashMemoEncoding,
): string | undefined {
  if (!value) return undefined;
  let bytes: Buffer;
  if (encoding === 'hex') {
    const hex = value.replace(/^0x/i, '');
    if (!/^(?:[0-9a-fA-F]{2})+$/.test(hex)) {
      throw new OneKeyLocalError({
        key: ETranslations.message_signing_message_invalid_hex,
      });
    }
    bytes = Buffer.from(hex, 'hex');
  } else {
    bytes = Buffer.from(value, 'utf8');
    if (bytes.toString('utf8') !== value) {
      throw new OneKeyLocalError({
        key: ETranslations.privacy_memo_invalid_utf8__msg,
      });
    }
  }
  if (bytes.length > 512) {
    throw new OneKeyLocalError({
      key: ETranslations.send_memo_size_exceeded,
      info: { limit: 512, current: bytes.length, type: 'bytes' },
    });
  }
  // ZIP 302 commits to the complete field, including zero padding.
  const padded = Buffer.alloc(512);
  bytes.copy(padded);
  return padded.toString('hex');
}

export function validateZcashMemoHex(
  hex: string | undefined,
): string | undefined {
  if (hex === undefined) return undefined;
  if (!/^[0-9a-f]{1024}$/.test(hex)) {
    throw new OneKeyLocalError(
      'Zcash memo must be a canonical 512-byte HEX field',
    );
  }
  return hex;
}

export function getZcashMemoDisplay(hex: string): {
  hex: string;
  hash: string;
  text?: string;
} {
  validateZcashMemoHex(hex);
  const bytes = Buffer.from(hex, 'hex');
  const hash = Buffer.from(blake2b(bytes, { dkLen: 32 })).toString('hex');
  let text: string | undefined;
  if (bytes[0] <= 0xf4) {
    const content = Buffer.from(hex.replace(/(?:00)+$/, ''), 'hex');
    const decoded = content.toString('utf8');
    if (Buffer.from(decoded, 'utf8').equals(content)) text = decoded;
  }
  return { hex, hash, text };
}
