import {
  AES256_IV_LENGTH,
  PBKDF2_KEY_LENGTH,
  PBKDF2_SALT_LENGTH,
  aesCbcDecrypt,
  aesCbcEncrypt,
  keyFromPasswordAndSalt,
} from '../crypto-functions';

/*
yarn jest packages/core/src/secret/__tests__/crypto-functions.test.ts
*/

describe('Crypto Functions', () => {
  describe('keyFromPasswordAndSalt', () => {
    it('should match snapshot with normal password and salt', async () => {
      const password = 'test-password';
      const salt = Buffer.alloc(PBKDF2_SALT_LENGTH, 'a');
      const result = await keyFromPasswordAndSalt(password, salt);
      expect(result.toString('hex')).toMatchSnapshot();
    });

    it('should throw error with empty password', async () => {
      const password = '';
      const salt = Buffer.alloc(PBKDF2_SALT_LENGTH, 'a');
      await expect(keyFromPasswordAndSalt(password, salt)).rejects.toThrow(
        'Zero-length password is not supported',
      );
    });

    it('should throw error with empty salt', async () => {
      const password = 'test-password';
      const salt = Buffer.from('');
      await expect(keyFromPasswordAndSalt(password, salt)).rejects.toThrow(
        'Zero-length salt is not supported',
      );
    });

    it('should throw error with empty password and salt', async () => {
      const password = '';
      const salt = Buffer.from('');
      await expect(keyFromPasswordAndSalt(password, salt)).rejects.toThrow(
        'Zero-length password is not supported',
      );
    });

    it('should handle null or undefined parameters', async () => {
      const validPassword = 'test-password';
      const validSalt = Buffer.alloc(PBKDF2_SALT_LENGTH, 'a');

      await expect(
        keyFromPasswordAndSalt(null as any, validSalt),
      ).rejects.toThrow();
      await expect(
        keyFromPasswordAndSalt(undefined as any, validSalt),
      ).rejects.toThrow();
      await expect(
        keyFromPasswordAndSalt(validPassword, null as any),
      ).rejects.toThrow();
      await expect(
        keyFromPasswordAndSalt(validPassword, undefined as any),
      ).rejects.toThrow();
      await expect(
        keyFromPasswordAndSalt(null as any, null as any),
      ).rejects.toThrow();
      await expect(
        keyFromPasswordAndSalt(undefined as any, undefined as any),
      ).rejects.toThrow();
    });

    it('should handle empty Buffer salt', async () => {
      const validPassword = 'test-password';
      const emptyBuffer = Buffer.alloc(0);

      await expect(
        keyFromPasswordAndSalt(validPassword, emptyBuffer),
      ).rejects.toThrow('Zero-length salt is not supported');

      await expect(
        keyFromPasswordAndSalt(validPassword, Buffer.from('')),
      ).rejects.toThrow('Zero-length salt is not supported');
    });

    it('should match snapshot with special characters in password', async () => {
      const password = '!@#$%^&*()_+-=[]{}|;:,.<>?';
      const salt = Buffer.alloc(PBKDF2_SALT_LENGTH, 'a');
      const result = await keyFromPasswordAndSalt(password, salt);
      expect(result.toString('hex')).toMatchSnapshot();
    });

    it('should match snapshot with UTF-8 characters in password', async () => {
      const password = '你好世界🌍';
      const salt = Buffer.alloc(PBKDF2_SALT_LENGTH, 'a');
      const result = await keyFromPasswordAndSalt(password, salt);
      expect(result.toString('hex')).toMatchSnapshot();
    });

    it('should handle large password input', async () => {
      const largePassword = 'a'.repeat(1024 * 1024); // 1MB password
      const salt = Buffer.alloc(PBKDF2_SALT_LENGTH, 'a');
      const result = await keyFromPasswordAndSalt(largePassword, salt);
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBe(PBKDF2_KEY_LENGTH);
    });
  });

  describe('aesCbcEncrypt/aesCbcDecrypt', () => {
    const iv = Buffer.alloc(AES256_IV_LENGTH, 'b');
    const key = Buffer.alloc(PBKDF2_KEY_LENGTH, 'c');

    it('should match snapshot for encryption of normal data', async () => {
      const data = Buffer.from('Hello, World!');
      const encrypted = await aesCbcEncrypt({ iv, key, data });
      expect(encrypted.toString('hex')).toMatchSnapshot();
    });

    it('should throw error with empty data for encryption', async () => {
      const data = Buffer.from('');
      await expect(aesCbcEncrypt({ iv, key, data })).rejects.toThrow(
        'Zero-length data is not supported',
      );
    });

    it('should throw error with empty data for decryption', async () => {
      const data = Buffer.from('');
      await expect(aesCbcDecrypt({ iv, key, data })).rejects.toThrow(
        'Zero-length data is not supported',
      );
    });

    it('should match snapshot for encryption of long data', async () => {
      const data = Buffer.from('a'.repeat(1000));
      const encrypted = await aesCbcEncrypt({ iv, key, data });
      expect(encrypted.toString('hex')).toMatchSnapshot();
    });

    it('should successfully decrypt encrypted data', async () => {
      const originalData = Buffer.from('Hello, World!');
      const encrypted = await aesCbcEncrypt({ iv, key, data: originalData });
      const decrypted = await aesCbcDecrypt({ iv, key, data: encrypted });
      expect(decrypted.toString()).toBe(originalData.toString());
      expect(decrypted.toString('hex')).toMatchSnapshot();
    });

    it('should handle null or undefined parameters for encryption', async () => {
      const validData = Buffer.from('test-data');

      await expect(
        aesCbcEncrypt({ iv: null as any, key, data: validData }),
      ).rejects.toThrow();
      await expect(
        aesCbcEncrypt({ iv: undefined as any, key, data: validData }),
      ).rejects.toThrow();
      await expect(
        aesCbcEncrypt({ iv, key: null as any, data: validData }),
      ).rejects.toThrow();
      await expect(
        aesCbcEncrypt({ iv, key: undefined as any, data: validData }),
      ).rejects.toThrow();
      await expect(
        aesCbcEncrypt({ iv, key, data: null as any }),
      ).rejects.toThrow();
      await expect(
        aesCbcEncrypt({ iv, key, data: undefined as any }),
      ).rejects.toThrow();
    });

    it('should handle null or undefined parameters for decryption', async () => {
      const validData = Buffer.from('test-data');

      await expect(
        aesCbcDecrypt({ iv: null as any, key, data: validData }),
      ).rejects.toThrow();
      await expect(
        aesCbcDecrypt({ iv: undefined as any, key, data: validData }),
      ).rejects.toThrow();
      await expect(
        aesCbcDecrypt({ iv, key: null as any, data: validData }),
      ).rejects.toThrow();
      await expect(
        aesCbcDecrypt({ iv, key: undefined as any, data: validData }),
      ).rejects.toThrow();
      await expect(
        aesCbcDecrypt({ iv, key, data: null as any }),
      ).rejects.toThrow();
      await expect(
        aesCbcDecrypt({ iv, key, data: undefined as any }),
      ).rejects.toThrow();
    });

    it('should handle empty Buffer parameters for encryption', async () => {
      const validData = Buffer.from('test-data');
      const emptyBuffer = Buffer.alloc(0);

      await expect(
        aesCbcEncrypt({ iv: emptyBuffer, key, data: validData }),
      ).rejects.toThrow('Zero-length iv is not supported');

      await expect(
        aesCbcEncrypt({ iv: Buffer.from(''), key, data: validData }),
      ).rejects.toThrow('Zero-length iv is not supported');

      await expect(
        aesCbcEncrypt({ iv, key: emptyBuffer, data: validData }),
      ).rejects.toThrow('Zero-length key is not supported');

      await expect(
        aesCbcEncrypt({ iv, key: Buffer.from(''), data: validData }),
      ).rejects.toThrow('Zero-length key is not supported');

      await expect(
        aesCbcEncrypt({ iv, key, data: emptyBuffer }),
      ).rejects.toThrow('Zero-length data is not supported');

      await expect(
        aesCbcEncrypt({ iv, key, data: Buffer.from('') }),
      ).rejects.toThrow('Zero-length data is not supported');
    });

    it('should handle empty Buffer parameters for decryption', async () => {
      const validData = Buffer.from('test-data');
      const emptyBuffer = Buffer.alloc(0);

      await expect(
        aesCbcDecrypt({ iv: emptyBuffer, key, data: validData }),
      ).rejects.toThrow('Zero-length iv is not supported');

      await expect(
        aesCbcDecrypt({ iv: Buffer.from(''), key, data: validData }),
      ).rejects.toThrow('Zero-length iv is not supported');

      await expect(
        aesCbcDecrypt({ iv, key: emptyBuffer, data: validData }),
      ).rejects.toThrow('Zero-length key is not supported');

      await expect(
        aesCbcDecrypt({ iv, key: Buffer.from(''), data: validData }),
      ).rejects.toThrow('Zero-length key is not supported');

      await expect(
        aesCbcDecrypt({ iv, key, data: emptyBuffer }),
      ).rejects.toThrow('Zero-length data is not supported');

      await expect(
        aesCbcDecrypt({ iv, key, data: Buffer.from('') }),
      ).rejects.toThrow('Zero-length data is not supported');
    });

    it('should handle very large data input', async () => {
      const largeData = Buffer.alloc(1024 * 1024); // 1MB of data
      const encrypted = await aesCbcEncrypt({ iv, key, data: largeData });
      const decrypted = await aesCbcDecrypt({ iv, key, data: encrypted });
      expect(decrypted.length).toBe(largeData.length);
      expect(decrypted.equals(largeData)).toBe(true);
    });
  });
});
