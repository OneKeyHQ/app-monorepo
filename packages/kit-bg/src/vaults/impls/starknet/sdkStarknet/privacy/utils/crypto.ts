import { ec, encode, BigNumberish } from "starknet";
import { toHex, toBytes, toBigInt } from "./convert";

// ============ Hash Types ============

export type Hash = bigint;
export type ChannelKey = bigint;
export type PublicKey = BigNumberish;
export type PrivateKey = BigNumberish;

// ============ Hash Function ============

/**
 * Convert a short string (up to 31 chars) to a felt, matching Cairo's short string literals.
 * e.g., 'channel_key:v1' in Cairo becomes the same bigint.
 */
export function shortStringToFelt(str: string): bigint {
  if (str.length > 31) {
    throw new Error(`Short string must be <= 31 chars, got ${str.length}`);
  }
  return BigInt(toHex(str));
}

/**
 * Check if a string is a numeric string (hex like "0x..." or decimal digits only).
 */
function isNumericString(str: string): boolean {
  return /^0x[0-9a-fA-F]+$/.test(str) || /^[0-9]+$/.test(str);
}

/**
 * Poseidon hash of multiple felts.
 * String arguments are converted as follows:
 * - Numeric strings (hex "0x..." or decimal) are converted via toBigInt
 * - Short ASCII strings (domain tags like "channel_key:v1") are converted as Cairo short strings
 *
 * Note: This matches Cairo's hash function which does:
 *   PoseidonTrait::new().update_with(poseidon_hash_span(data)).finalize()
 * This is effectively h(h(data)) - a double hash.
 */
export function hash(...values: (BigNumberish | string)[]): Hash {
  const feltValues = values.map((v) => {
    if (typeof v === "string") {
      // Numeric strings should be converted to bigint, not as short strings
      return isNumericString(v) ? toBigInt(v) : shortStringToFelt(v);
    }
    return toBigInt(v);
  });

  // Match Cairo's hash function: h(data)
  return ec.starkCurve.poseidonHashMany(feltValues);
}

// ============ ECDH Utilities ============

const starkCurve = ec.starkCurve;

/**
 * Get the x-coordinate from a public key bytes (compressed or uncompressed).
 */
function getXCoordinateFromBytes(publicKeyBytes: Uint8Array): bigint {
  // If 33 bytes (compressed), skip the prefix byte
  // If 65 bytes (uncompressed), skip prefix and take first 32 bytes
  const start = publicKeyBytes.length === 33 ? 1 : publicKeyBytes.length === 65 ? 1 : 0;
  const end = start + 32;
  return BigInt(toHex(publicKeyBytes.slice(start, end)));
}

/**
 * Derive public key from private key (returns x-coordinate).
 */
export function derivePublicKey(privateKey: PrivateKey): bigint {
  const privateKeyBytes = toBytes(privateKey);
  const publicKeyBytes = starkCurve.getPublicKey(privateKeyBytes);
  return getXCoordinateFromBytes(publicKeyBytes);
}

// ============ Symmetric Encryption ============
/** Generate a random bigint for use in encryption */
export function generateRandom(): bigint {
  // Generate a 252-bit random value (valid felt252)
  return encode.uint8ArrayToBigInt(starkCurve.utils.randomPrivateKey());
}

// onekey: upstream used the bare `crypto` global. Route through `globalThis` and
// fail loudly when the CSPRNG is missing rather than throwing a bare ReferenceError.
// React Native gets it from react-native-get-random-values, polyfilled at app startup.
function fillRandomBytes(bytes: Uint8Array<ArrayBuffer>): void {
  const webCrypto = globalThis.crypto;
  if (typeof webCrypto?.getRandomValues !== "function") {
    throw new Error(
      "starknet-privacy-sdk: globalThis.crypto.getRandomValues is unavailable; a CSPRNG polyfill must be installed before use"
    );
  }
  webCrypto.getRandomValues(bytes);
}

/** Generate a 120-bit random value for note encryption */
export function generateRandom120(): bigint {
  const bytes = new Uint8Array(15); // 15 bytes = 120 bits
  fillRandomBytes(bytes);
  let result = 0n;
  for (const byte of bytes) {
    result = (result << 8n) | BigInt(byte);
  }
  return result;
}

export type SymmetricEncryption = {
  r: bigint;
  enc: bigint;
};

export function encryptSymmetric(
  shared: bigint,
  data: BigNumberish,
  r: bigint
): SymmetricEncryption {
  // make sure r is  a felt252
  if (r < 0n || r >= starkCurve.CURVE.n) {
    throw new Error(`r must be a felt252, got ${r}`);
  }
  return {
    r,
    enc: (hash(shared, r) + toBigInt(data)) % starkCurve.CURVE.n,
  };
}

export function decryptSymmetric(encryption: SymmetricEncryption, shared: bigint): bigint {
  return encryption.enc - (hash(shared, encryption.r) % starkCurve.CURVE.n);
}

// Re-export toBigInt for backwards compatibility
export { toBigInt } from "./convert";
