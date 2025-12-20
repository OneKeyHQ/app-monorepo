import { Buffer } from 'buffer';

import elliptic from 'elliptic';

import appCrypto from '@onekeyhq/shared/src/appCrypto';

const { sha256: sha256Hash } = appCrypto.hash;

// eslint-disable-next-line new-cap
const curveInstance = new elliptic.ec('p256');

interface ISignatureObject {
  r: string;
  s: string;
}

async function sha256(hex: string): Promise<string> {
  // sha256Hash(Buffer.from(hex, 'hex')).toString('hex');
  return (await sha256Hash(Buffer.from(hex, 'hex'))).toString('hex');
}

function getPublicKeyUnencoded(publicKey: string): string {
  const publicKeyBuffer = Buffer.from(publicKey, 'hex');
  const keyPair = curveInstance.keyFromPublic(publicKeyBuffer, 'hex');
  return keyPair.getPublic().encode('hex', true);
}

/**
 * Gets an encoded public key from unencoded format
 * @param unencodedKey - Unencoded public key
 * @returns Encoded public key
 */
function getPublicKeyEncoded(unencodedKey: string): string {
  const keyBuffer = Buffer.from(unencodedKey, 'hex');
  const keyPair = curveInstance.keyFromPublic(keyBuffer, 'hex');
  const point = keyPair.getPublic();
  const prefix = point.getY().isOdd() ? '03' : '02';
  return prefix + point.getX().toString(16, 64);
}

/**
 * Gets a signature object from a hex signature string
 * @param signatureHex - Hex-formatted signature
 * @returns Signature object
 */
function getSignatureFromHex(signatureHex: string): ISignatureObject {
  const r = signatureHex.substring(0, 64);
  const s = signatureHex.substring(64, 128);
  return { r, s };
}

/**
 * Checks if a hex string is a valid public key
 * @param key - Public key to check
 * @param encoded - Optional parameter to specify a specific form
 * @returns Whether the key is valid
 */
export function isPublicKey(key: string, encoded?: boolean): boolean {
  try {
    let encodedKey: string;
    switch (key.substring(0, 2)) {
      case '04':
        if (encoded === true) {
          return false;
        }
        encodedKey = getPublicKeyEncoded(key);
        break;
      case '02':
      case '03':
        if (encoded === false) {
          return false;
        }
        encodedKey = key;
        break;
      default:
        return false;
    }

    try {
      const keyPair = curveInstance.keyFromPublic(encodedKey, 'hex');
      return !!keyPair;
    } catch (e) {
      return false;
    }
  } catch (e) {
    return false;
  }
}

/**
 * Verifies a signature
 * @param hex - Message to verify (hex format)
 * @param sig - Signature (hex format)
 * @param publicKey - Public key (hex format)
 * @returns Verification result, true for valid signature
 */
export async function verify(
  hex: string,
  sig: string,
  publicKey: string,
): Promise<boolean> {
  try {
    if (!isPublicKey(publicKey, true)) {
      // eslint-disable-next-line no-param-reassign
      publicKey = getPublicKeyUnencoded(publicKey);
    }

    const sigObj = getSignatureFromHex(sig);
    const messageHash = await sha256(hex);
    const publicKeyPair = curveInstance.keyFromPublic(publicKey, 'hex');
    return publicKeyPair.verify(messageHash, sigObj);
  } catch (error) {
    return false;
  }
}
