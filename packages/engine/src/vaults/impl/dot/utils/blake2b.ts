import { blake2b } from '@noble/hashes/blake2b';
import { hexToBytes } from '@noble/hashes/utils';

import { addHexPrefix } from '@onekeyhq/engine/src/vaults/utils/hexUtils';

export function blake2bAsBytes(
  data: Uint8Array,
  bitLength: number,
  config: { key?: Uint8Array } = {},
): Uint8Array {
  const byteLength = Math.ceil(bitLength / 8);

  const hash = blake2b.create({ dkLen: byteLength, key: config.key });
  hash.update(data);
  return hash.digest();
}

export function blake2bAsHex(
  data: string,
  bitLength: number,
  config: { withPrefix: boolean; key?: Uint8Array } = { withPrefix: false },
): string {
  const hash = blake2bAsBytes(hexToBytes(data), bitLength, { key: config.key });
  const hex = Buffer.from(hash).toString('hex');

  return config.withPrefix ? addHexPrefix(hex) : hex;
}
