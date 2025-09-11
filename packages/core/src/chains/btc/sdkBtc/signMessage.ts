import { Verifier } from 'bip322-js';
import bitcoinMessage from 'bitcoinjs-message';

export function verifyBitcoinMessage({
  message,
  address,
  signature,
  format,
}: {
  message: string;
  address: string;
  signature: string;
  format: string;
}) {
  try {
    if (format === 'bip322') {
      return Verifier.verifySignature(address, message, signature);
    }
    return bitcoinMessage.verify(
      message,
      address,
      Buffer.from(signature, 'base64'),
      undefined,
      true,
    );
  } catch (e) {
    console.log('btc verifymessage error: ', e);
    return false;
  }
}
