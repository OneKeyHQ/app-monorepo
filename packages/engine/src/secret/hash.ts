import crypto from 'crypto';

import { HmacSha256, HmacSha512, Sha256 } from 'asmcrypto.js';

function hmacSHA256(key: Buffer, data: Buffer): Buffer {
  return Buffer.from(
    new HmacSha256(key).process(data).finish().result as Uint8Array,
  );
}

function hmacSHA512(key: Buffer, data: Buffer): Buffer {
  return Buffer.from(
    new HmacSha512(key).process(data).finish().result as Uint8Array,
  );
}

function sha256(data: Buffer): Buffer {
  return Buffer.from(new Sha256().process(data).finish().result as Uint8Array);
}

function hash160(data: Buffer): Buffer {
  return crypto.createHash('ripemd160').update(sha256(data)).digest();
}

export { hmacSHA256, hmacSHA512, sha256, hash160 };
