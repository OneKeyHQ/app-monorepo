import bs58 from 'bs58';
import nacl from 'tweetnacl';

export function verifySignedMessage({
  address,
  message,
  signature,
}: {
  message: string;
  address: string;
  signature: string;
}) {
  try {
    const pubkey = bs58.decode(address); // 32 bytes
    const sig =
      typeof signature === 'string' ? bs58.decode(signature) : signature;
    const msg =
      typeof message === 'string' ? Buffer.from(message, 'utf8') : message;

    return nacl.sign.detached.verify(msg, sig, pubkey);
  } catch {
    return false;
  }
}
