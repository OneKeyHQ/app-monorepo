import {
  createStacksPrivateKey,
  signMessageHashRsv,
  verifySignature,
} from '@stacks/transactions';

export function reverseBuffer(buffer: Buffer | string): Buffer {
  const buf = typeof buffer === 'string' ? Buffer.from(buffer, 'hex') : buffer;
  const { length } = buf;
  const reversed = Buffer.alloc(length);
  for (let i = 0; i < length; i += 1) {
    reversed[i] = buf[length - i - 1];
  }
  return reversed;
}

export function sign(privateKey: Buffer, digest: Buffer): Buffer {
  const signature = signMessageHashRsv({
    messageHash: digest.toString('hex'),
    privateKey: createStacksPrivateKey(privateKey),
  });
  return Buffer.from(signature.data);
}

export function verify(
  publicKey: Buffer,
  digest: Buffer,
  signature: Buffer,
): boolean {
  if (signature.length !== 64) {
    return false;
  }
  return verifySignature(
    signature.toString('hex'),
    digest.toString('hex'),
    publicKey.toString('hex'),
  );
}
