import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

// Strict: an odd length or a non-hex character is a caller bug. Decoding it
// anyway yields a silently wrong seed or PCZT (NaN bytes become 0).
export function zcashHexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (!/^(?:[0-9a-fA-F]{2})*$/.test(clean)) {
    throw new OneKeyLocalError('zcash: malformed hex input');
  }
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}
