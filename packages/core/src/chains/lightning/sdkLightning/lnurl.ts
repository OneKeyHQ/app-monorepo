import { hmac } from '@noble/hashes/hmac';
import { sha256 } from '@noble/hashes/sha256';

import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

export function getPathSuffix(domain: string, privateKeyHex: string) {
  const derivationMaterial = bufferUtils.bytesToHex(
    hmac(
      sha256,
      Buffer.from(domain, 'utf-8'),
      Buffer.from(privateKeyHex, 'hex'),
    ),
  );

  const buf = Buffer.from(derivationMaterial, 'hex');

  const pathSuffix = [];
  for (let i = 0; i < 4; i += 1) {
    pathSuffix.push(buf.readUInt32BE(i * 4));
  }
  return pathSuffix;
}
