/* eslint-disable no-restricted-syntax */
import crypto from 'crypto';

// TODO use node native module
import {
  AES_GCM as AsmcryptoAesGcm,
  Sha256 as AsmcryptoSha256,
} from 'asmcrypto.js';
import { nanoid } from 'nanoid';

import bufferUtils from './bufferUtils';
import stringUtils from './stringUtils';

type IAesGcmInvokeParams = {
  iv: Buffer;
  key: Buffer;
  data: Buffer;
};
function _aesGcmInvokeCheck({ iv, key, data }: IAesGcmInvokeParams) {
  if (!iv || iv.length <= 0) {
    throw new Error('Zero-length iv is not supported');
  }
  if (!key || key.length <= 0) {
    throw new Error('Zero-length key is not supported');
  }
  if (!data || data.length <= 0) {
    throw new Error('Zero-length data is not supported');
  }
}

function aesGcmEncryptByAsmcrypto({ iv, key, data }: IAesGcmInvokeParams): {
  ciphertext: Buffer;
  tag: Buffer;
} {
  _aesGcmInvokeCheck({ iv, key, data });

  const result = AsmcryptoAesGcm.encrypt(data, key, iv);
  const ciphertext = Buffer.from(result.slice(0, -16)); // All but last 16 bytes
  const tag = Buffer.from(result.slice(-16)); // Last 16 bytes are the tag
  return { ciphertext, tag };
}

function aesGcmDecryptByAsmcrypto({
  iv,
  key,
  data,
  tag,
}: IAesGcmInvokeParams & { tag: Buffer }): Buffer {
  _aesGcmInvokeCheck({ iv, key, data });

  if (!tag || tag.length !== 16) {
    throw new Error('Invalid authentication tag');
  }

  // Combine ciphertext and tag for asmcrypto
  const combined = Buffer.concat([data, tag]);
  const r: Buffer = Buffer.from(AsmcryptoAesGcm.decrypt(combined, key, iv));
  return r;
}

function sha256ByAsmcrypto(data: Buffer): Buffer {
  const result: Uint8Array | null = new AsmcryptoSha256()
    .process(data)
    .finish().result;
  if (!result) {
    throw new Error('Failed to hash data by Sha256ByAsmcrypto');
  }
  return Buffer.from(result);
}

export default class CryptoUtils {
  /**
   * Generate random encryption key
   * @returns 32-byte hexadecimal key string
   */
  static generateEncryptionKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate random room ID
   * @returns Unique room ID
   */
  static generateRoomId(): string {
    const roomId = stringUtils.randomString(10, {
      chars: stringUtils.randomStringCharsSet.base58UpperCase,
      groupSeparator: '-',
      groupSize: 5,
    });
    return roomId;
  }

  /**
   * Generate random user ID
   * @returns Unique user ID
   */
  static generateUserId(): string {
    const verifyCode = stringUtils.randomString(6, {
      chars: stringUtils.randomStringCharsSet.numberOnly,
    });
    const userId = stringUtils.randomString(16, {
      chars: stringUtils.randomStringCharsSet.numberAndLetter,
    });
    return `${userId}--${verifyCode}`; // Generate 8-character user ID
  }

  /**
   * Encrypt data using AES-256-GCM
   * @param data Data to encrypt
   * @param key Encryption key
   * @returns Encrypted data object containing ciphertext, IV, and authentication tag
   */
  static encrypt(
    data: string,
    key: string,
  ): { encrypted: string; iv: string; tag: string } {
    try {
      const iv = crypto.randomBytes(12); // GCM mode uses 12-byte IV
      const { ciphertext, tag } = aesGcmEncryptByAsmcrypto({
        data: bufferUtils.toBuffer(data, 'utf8'),
        key: bufferUtils.toBuffer(key),
        iv,
      });

      return {
        encrypted: bufferUtils.bytesToHex(ciphertext),
        iv: bufferUtils.bytesToHex(iv),
        tag: bufferUtils.bytesToHex(tag),
      };
    } catch (error) {
      throw new Error(
        `Encryption failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }

  /**
   * Decrypt data using AES-256-GCM
   * @param encryptedData Encrypted data object with ciphertext, IV, and authentication tag
   * @param key Decryption key
   * @returns Decrypted original data
   */
  static decrypt(
    encryptedData: { encrypted: string; iv: string; tag: string },
    key: string,
  ): string {
    try {
      const iv = bufferUtils.toBuffer(encryptedData.iv);
      const tag = bufferUtils.toBuffer(encryptedData.tag);

      // Decrypt using AES-256-GCM
      const decrypted = aesGcmDecryptByAsmcrypto({
        data: bufferUtils.toBuffer(encryptedData.encrypted),
        key: bufferUtils.toBuffer(key),
        iv,
        tag,
      });

      const decryptedText = bufferUtils.bytesToUtf8(decrypted);

      if (!decryptedText) {
        throw new Error(
          'Decryption result is empty, possibly due to wrong key or corrupted data',
        );
      }

      return decryptedText;
    } catch (error) {
      throw new Error(
        `Decryption failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }

  /**
   * Validate encryption key format
   * @param key Key to validate
   * @returns Whether it's a valid key format
   */
  static isValidKey(key: string): boolean {
    if (!key || typeof key !== 'string') {
      return false;
    }

    // Check if it's a 64-character hexadecimal string (32 bytes = 256 bits)
    const hexRegex = /^[a-fA-F0-9]{64}$/;
    return hexRegex.test(key);
  }

  /**
   * Validate room ID format
   * @param roomId Room ID to validate
   * @returns Whether it's a valid room ID format
   */
  static isValidRoomId(roomId: string): boolean {
    if (!roomId || typeof roomId !== 'string') {
      return false;
    }

    // Room ID format: 5 alphanumeric chars + separator + 5 alphanumeric chars
    // Example: ABC12-DEF34, 12345-ABCDE
    const roomIdRegex = /^[a-zA-Z0-9]{5}-[a-zA-Z0-9]{5}$/;
    return roomIdRegex.test(roomId);
  }

  /**
   * Create data integrity hash
   * @param data Data to hash
   * @returns SHA-256 hash value
   */
  static createHash(data: string): string {
    return sha256ByAsmcrypto(bufferUtils.toBuffer(data, 'utf8')).toString(
      'hex',
    );
  }

  /**
   * Verify data integrity
   * @param data Original data
   * @param hash Expected hash value
   * @returns Whether data is intact
   */
  static verifyHash(data: string, hash: string): boolean {
    const computedHash = this.createHash(data);
    return computedHash === hash;
  }

  /**
   * Safely compare two strings (prevent timing attacks)
   * @param a String A
   * @param b String B
   * @returns Whether they are equal
   */
  static secureCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i += 1) {
      // eslint-disable-next-line no-bitwise
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }
}
