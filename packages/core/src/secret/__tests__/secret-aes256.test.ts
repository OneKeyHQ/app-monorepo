/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Buffer } from 'buffer';

import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import {
  decodePassword,
  decodePasswordAsync,
  decodeSensitiveText,
  decodeSensitiveTextAsync,
  decrypt,
  decryptAsync,
  decryptString,
  decryptStringAsync,
  encodePassword,
  encodeSensitiveText,
  encrypt,
  encryptAsync,
  encryptString,
  encryptStringAsync,
  ensureSensitiveTextEncoded,
  getBgSensitiveTextEncodeKey,
  isEncodedSensitiveText,
  setBgSensitiveTextEncodeKey,
} from '../encryptors/aes256';

/*
yarn jest packages/core/src/secret/__tests__/secret-aes256.test.ts
*/

// Mock crypto for deterministic encryption outputs
jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomBytes: jest.fn().mockImplementation((size: number) => {
    // Return specific bytes for deterministic encryption outputs
    if (size === 32) {
      return Buffer.from(
        '94b51c8f77aa44bdf1a6071872cd89aae44fba848cf8a50c28280a9b79a56b24',
        'hex',
      );
    }
    if (size === 16) {
      return Buffer.from('d3ebac3b568ef4e5369441a40eee4a24', 'hex');
    }
    if (size === 4) {
      return Buffer.from('0efcb8ef', 'hex');
    }
    return Buffer.alloc(size, 0xde);
  }),
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  ...jest.requireActual('@onekeyhq/shared/src/platformEnv'),
  isJest: true,
}));

const platformEnv = jest.requireMock('@onekeyhq/shared/src/platformEnv');

beforeEach(() => {
  platformEnv.isExtensionUi = false;
  platformEnv.isWebEmbed = false;
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'trace').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('AES256 Encryption Tests', () => {
  const TEST_PASSWORD = 'password123';
  const TEST_DATA = 'Hello AES256';
  const TEST_BUFFER = Buffer.from(TEST_DATA);
  const TEST_DATA_HEX = TEST_BUFFER.toString('hex');

  describe('encrypt/decrypt (sync)', () => {
    beforeEach(() => {
      jest.spyOn(console, 'warn').mockImplementation(() => {});
      jest.spyOn(console, 'trace').mockImplementation(() => {});
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should log deprecation warning when using decrypt', () => {
      const encrypted = encrypt(TEST_PASSWORD, TEST_DATA_HEX);
      decrypt(TEST_PASSWORD, encrypted);
      expect(console.warn).toHaveBeenCalledWith(
        'decrypt() 已弃用 (deprecated). Please use decryptAsync() instead',
      );
    });
    it('should throw error on utf-8 data', () => {
      expect(() => encrypt(TEST_PASSWORD, TEST_DATA)).toThrow();
    });

    it('should encrypt and decrypt string data with snapshot', () => {
      const encrypted = encrypt(TEST_PASSWORD, TEST_DATA_HEX);
      expect(encrypted.toString('hex')).toMatchSnapshot('encrypt-string-data');

      const decrypted = decrypt(TEST_PASSWORD, encrypted);
      expect(decrypted.length).toBe(TEST_BUFFER.length);
      expect(bufferUtils.bytesToUtf8(decrypted)).toBe(TEST_DATA);
    });

    it('should encrypt and decrypt buffer data with snapshot', () => {
      const encrypted = encrypt(TEST_PASSWORD, TEST_BUFFER);
      expect(encrypted.toString('hex')).toMatchSnapshot('encrypt-buffer-data');

      const decrypted = decrypt(TEST_PASSWORD, encrypted);
      expect(decrypted.toString()).toBe(TEST_DATA);
    });

    it('should throw on incorrect password', async () => {
      const encrypted = encrypt(TEST_PASSWORD, TEST_DATA_HEX);
      const encodedPassword = await encodePassword({
        password: 'wrong-password',
      });
      expect(() => decrypt(encodedPassword, encrypted)).toThrow();
    });

    it('should throw on empty password', () => {
      expect(() => encrypt('', TEST_DATA_HEX)).toThrow();
      const encrypted = encrypt(TEST_PASSWORD, TEST_DATA_HEX);
      expect(() => decrypt('', encrypted)).toThrow();
    });
  });

  describe('encryptAsync/decryptAsync', () => {
    it('should async encrypt/decrypt string data with snapshot', async () => {
      const encrypted = await encryptAsync({
        password: TEST_PASSWORD,
        data: TEST_DATA_HEX,
      });
      expect(encrypted.toString('hex')).toMatchSnapshot(
        'encryptAsync-string-data',
      );

      const decrypted = await decryptAsync({
        password: TEST_PASSWORD,
        data: encrypted,
      });
      expect(decrypted.toString()).toBe(TEST_DATA);
    });

    it('should async encrypt/decrypt buffer data with snapshot', async () => {
      const encrypted = await encryptAsync({
        password: TEST_PASSWORD,
        data: TEST_BUFFER,
      });
      expect(encrypted.toString('hex')).toMatchSnapshot(
        'encryptAsync-buffer-data',
      );

      const decrypted = await decryptAsync({
        password: TEST_PASSWORD,
        data: encrypted,
      });
      expect(decrypted.toString()).toBe(TEST_DATA);
    });

    it('should throw on incorrect password', async () => {
      const encrypted = await encryptAsync({
        password: TEST_PASSWORD,
        data: TEST_DATA_HEX,
      });
      await expect(
        decryptAsync({
          password: 'wrong-password',
          data: encrypted,
        }),
      ).rejects.toThrow();
    });

    it('should throw on empty password', async () => {
      await expect(
        encryptAsync({
          password: '',
          data: TEST_DATA_HEX,
        }),
      ).rejects.toThrow();

      const encrypted = await encryptAsync({
        password: TEST_PASSWORD,
        data: TEST_DATA_HEX,
      });
      await expect(
        decryptAsync({
          password: '',
          data: encrypted,
        }),
      ).rejects.toThrow();
    });
  });

  describe('encryptString/decryptString', () => {
    beforeEach(() => {
      jest.spyOn(console, 'warn').mockImplementation(() => {});
      jest.spyOn(console, 'trace').mockImplementation(() => {});
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should log deprecation warning when using decryptString', () => {
      const encrypted = encryptString({
        password: TEST_PASSWORD,
        data: TEST_DATA_HEX,
      });
      decryptString({
        password: TEST_PASSWORD,
        data: encrypted,
      });
      expect(console.warn).toHaveBeenCalledWith(
        'decryptString() 已弃用 (deprecated). Please use decryptStringAsync() instead',
      );
    });
    it('should encrypt and decrypt string with hex encoding and snapshot', async () => {
      const encrypted = await encryptStringAsync({
        password: TEST_PASSWORD,
        data: TEST_DATA_HEX,
      });
      expect(encrypted).toMatchSnapshot('encryptString-hex');

      const decrypted = await decryptStringAsync({
        password: TEST_PASSWORD,
        data: encrypted,
      });
      expect(bufferUtils.hexToText(decrypted)).toBe(TEST_DATA);
    });

    it('should support different encodings with snapshot', async () => {
      const base64Data = Buffer.from(TEST_DATA).toString('base64');
      const encrypted = await encryptStringAsync({
        password: TEST_PASSWORD,
        data: base64Data,
        dataEncoding: 'base64',
      });
      expect(encrypted).toMatchSnapshot('encryptString-base64');

      const decrypted = await decryptStringAsync({
        password: TEST_PASSWORD,
        data: encrypted,
        dataEncoding: 'hex',
        resultEncoding: 'base64',
      });
      expect(decrypted).toBe(base64Data);
    });

    it('should throw on incorrect password (sync)', () => {
      const encrypted = encryptString({
        password: TEST_PASSWORD,
        data: TEST_DATA_HEX,
      });
      expect(() =>
        decryptString({
          password: 'wrong-password',
          data: encrypted,
        }),
      ).toThrow();
    });

    it('should throw on incorrect password (async)', async () => {
      const encrypted = await encryptStringAsync({
        password: TEST_PASSWORD,
        data: TEST_DATA_HEX,
      });
      await expect(
        decryptStringAsync({
          password: 'wrong-password',
          data: encrypted,
        }),
      ).rejects.toThrow();
    });
  });

  describe('encodePassword/decodePassword', () => {
    it('should encode and decode password with snapshot', async () => {
      const encoded = await encodePassword({
        password: TEST_PASSWORD,
        key: 'test-key',
      });
      expect(encoded).toMatchSnapshot('encodePassword');

      const decoded = await decodePasswordAsync({
        password: encoded,
        key: 'test-key',
      });
      expect(decoded).toBe(TEST_PASSWORD);
    });

    it('should throw on incorrect key (sync)', async () => {
      const encoded = await encodePassword({
        password: TEST_PASSWORD,
        key: 'test-key',
      });
      expect(() =>
        decodePassword({
          password: encoded,
          key: 'wrong-key',
        }),
      ).toThrow();
    });

    it('should throw on incorrect key (async)', async () => {
      const encoded = await encodePassword({
        password: TEST_PASSWORD,
        key: 'test-key',
      });
      await expect(
        decodePasswordAsync({
          password: encoded,
          key: 'wrong-key',
        }),
      ).rejects.toThrow();
    });

    // TODO empty key should throw
    it.skip('should throw on empty key (sync and async)', async () => {
      await expect(
        encodePassword({
          password: TEST_PASSWORD,
          key: '',
        }),
      ).rejects.toThrow();

      const encoded = await encodePassword({
        password: TEST_PASSWORD,
        key: 'test-key',
      });

      // Test sync version
      expect(() =>
        decodePassword({
          password: encoded,
          key: '',
        }),
      ).toThrow();

      // Test async version
      await expect(
        decodePasswordAsync({
          password: encoded,
          key: '',
        }),
      ).rejects.toThrow();
    });
  });

  describe('encodeSensitiveText/decodeSensitiveText', () => {
    beforeEach(() => {
      jest.spyOn(console, 'warn').mockImplementation(() => {});
      jest.spyOn(console, 'trace').mockImplementation(() => {});
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should log deprecation warning when using decodeSensitiveText', async () => {
      const encoded = await encodeSensitiveText({
        text: TEST_DATA,
        key: 'test-key',
      });
      decodeSensitiveText({
        encodedText: encoded,
        key: 'test-key',
      });
      expect(console.warn).toHaveBeenCalledWith(
        'decodeSensitiveText() 已弃用 (deprecated). Please use decodeSensitiveTextAsync() instead',
      );
    });
    beforeEach(() => {
      jest.spyOn(console, 'warn').mockImplementation(() => {});
      jest.spyOn(console, 'trace').mockImplementation(() => {});
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should encode and decode sensitive text with snapshot', async () => {
      const encoded = await encodeSensitiveText({
        text: TEST_DATA,
        key: 'test-key',
      });
      expect(encoded).toMatchSnapshot('encodeSensitiveText');

      const decoded = await decodeSensitiveTextAsync({
        encodedText: encoded,
        key: 'test-key',
      });
      expect(decoded).toBe(TEST_DATA);
    });

    it('should throw on incorrect key (sync)', async () => {
      const encoded = await encodeSensitiveText({
        text: TEST_DATA,
        key: 'test-key',
      });
      expect(() =>
        decodeSensitiveText({
          encodedText: encoded,
          key: 'wrong-key',
        }),
      ).toThrow();
    });

    it('should throw on incorrect key (async)', async () => {
      const encoded = await encodeSensitiveText({
        text: TEST_DATA,
        key: 'test-key',
      });
      await expect(
        decodeSensitiveTextAsync({
          encodedText: encoded,
          key: 'wrong-key',
        }),
      ).rejects.toThrow();
    });

    // TODO empty key should throw
    it.skip('should throw on empty key', async () => {
      expect(() =>
        encodeSensitiveText({
          text: TEST_DATA,
          key: '',
        }),
      ).toThrow();

      const encoded = await encodeSensitiveText({
        text: TEST_DATA,
        key: 'test-key',
      });
      expect(() =>
        decodeSensitiveText({
          encodedText: encoded,
          key: '',
        }),
      ).toThrow();
    });

    it('should throw on invalid encoded text', () => {
      expect(() =>
        decodeSensitiveText({
          encodedText: 'invalid-encoded-text',
          key: 'test-key',
        }),
      ).toThrow('Not correct encoded text');
    });
  });

  describe('Background Key Management', () => {
    it('should throw when getting key from extension UI', () => {
      // Mock extension UI environment
      platformEnv.isExtensionUi = true;

      expect(() => getBgSensitiveTextEncodeKey()).toThrow(
        'Not allow to call ()getBgSensitiveTextEncodeKey from extension ui',
      );

      // Restore original environment
      platformEnv.isExtensionUi = false;
    });

    it('should throw when setting key from extension UI', () => {
      // Mock extension UI environment
      platformEnv.isExtensionUi = true;

      expect(() => setBgSensitiveTextEncodeKey('test-key')).toThrow(
        'Not allow to call setBgSensitiveTextEncodeKey() from extension ui',
      );

      // Restore original environment
      platformEnv.isExtensionUi = false;
    });

    it('should throw when setting key from non-webembed', () => {
      // Mock non-webembed environment
      platformEnv.isExtensionUi = false;
      platformEnv.isWebEmbed = false;

      expect(() => setBgSensitiveTextEncodeKey('test-key')).toThrow(
        'Only allow to call setBgSensitiveTextEncodeKey() from webembed',
      );

      // Restore original environment
      platformEnv.isWebEmbed = false;
    });

    it('should set and get key in webembed environment', () => {
      // Mock webembed environment
      platformEnv.isExtensionUi = false;
      platformEnv.isWebEmbed = true;

      const testKey = 'test-key-123';
      setBgSensitiveTextEncodeKey(testKey);
      expect(getBgSensitiveTextEncodeKey()).toBe(testKey);

      // Restore original environment
      platformEnv.isWebEmbed = false;
    });
  });

  describe('isEncodedSensitiveText and ensureSensitiveTextEncoded', () => {
    it('should correctly identify encoded sensitive text', async () => {
      const encoded = await encodeSensitiveText({
        text: TEST_DATA,
        key: 'test-key',
      });
      expect(isEncodedSensitiveText(encoded)).toBe(true);
      expect(isEncodedSensitiveText('not-encoded-text')).toBe(false);
    });

    it('should handle both aes and xor prefixes', async () => {
      const aesEncoded = await encodeSensitiveText({
        text: TEST_DATA,
        key: 'test-key',
      });
      expect(isEncodedSensitiveText(aesEncoded)).toBe(true);

      // 手动构造一个带有 xor 前缀的文本来测试
      const xorPrefix =
        'SENSITIVE_ENCODE::AAAAAAAA-2E51-4DC6-A913-79EB1C62D09E::';
      const mockXorEncoded = `${xorPrefix}some-encoded-data`;
      expect(isEncodedSensitiveText(mockXorEncoded)).toBe(true);
    });

    it('should throw for non-encoded text in ensureSensitiveTextEncoded', () => {
      expect(() => ensureSensitiveTextEncoded('not-encoded-text')).toThrow(
        'Not encoded sensitive text',
      );
    });

    it('should not throw for valid encoded text in ensureSensitiveTextEncoded', async () => {
      const encoded = await encodeSensitiveText({
        text: TEST_DATA,
        key: 'test-key',
      });
      expect(() => ensureSensitiveTextEncoded(encoded)).not.toThrow();
    });

    it('should handle empty string', () => {
      expect(isEncodedSensitiveText('')).toBe(false);
      expect(() => ensureSensitiveTextEncoded('')).toThrow(
        'Not encoded sensitive text',
      );
    });

    it('should handle undefined and null', () => {
      // @ts-expect-error for testing undefined
      expect(() => isEncodedSensitiveText(undefined)).toThrow();
      // @ts-expect-error for testing null
      expect(() => isEncodedSensitiveText(null)).toThrow();

      // @ts-expect-error for testing undefined
      expect(() => ensureSensitiveTextEncoded(undefined)).toThrow();
      // @ts-expect-error for testing null
      expect(() => ensureSensitiveTextEncoded(null)).toThrow();
    });

    it('should handle prefix-only text', () => {
      const aesPrefix =
        'SENSITIVE_ENCODE::AE7EADC1-CDA0-45FA-A340-E93BEDDEA21E::';
      const xorPrefix =
        'SENSITIVE_ENCODE::AAAAAAAA-2E51-4DC6-A913-79EB1C62D09E::';

      expect(isEncodedSensitiveText(aesPrefix)).toBe(true);
      expect(isEncodedSensitiveText(xorPrefix)).toBe(true);

      expect(() => ensureSensitiveTextEncoded(aesPrefix)).not.toThrow();
      expect(() => ensureSensitiveTextEncoded(xorPrefix)).not.toThrow();
    });
  });
});
