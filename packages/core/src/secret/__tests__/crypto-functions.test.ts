import appCrypto from '@onekeyhq/shared/src/appCrypto';

const { AES256_IV_LENGTH, PBKDF2_KEY_LENGTH, PBKDF2_SALT_LENGTH } =
  appCrypto.consts;

const {
  aesCbcDecrypt: aesCbcDecryptAsync,
  aesCbcDecryptSync,
  aesCbcEncrypt: aesCbcEncryptAsync,
  aesCbcEncryptSync,
} = appCrypto.aesCbc;

const { keyFromPasswordAndSaltSync } = appCrypto.keyGen.$legacyFunctions;
const { keyFromPasswordAndSalt: keyFromPasswordAndSaltAsync } =
  appCrypto.keyGen;

/*
yarn jest packages/core/src/secret/__tests__/crypto-functions.test.ts
*/

describe('Crypto Functions', () => {
  describe('keyFromPasswordAndSalt', () => {
    it('should match snapshot with normal password and salt', async () => {
      const password = 'test-password';
      const salt = Buffer.alloc(PBKDF2_SALT_LENGTH, 'a');
      const result = await keyFromPasswordAndSaltAsync({
        password,
        salt,
      });
      expect(result.toString('hex')).toMatchSnapshot();
    });

    it('should throw error with empty password', async () => {
      const password = '';
      const salt = Buffer.alloc(PBKDF2_SALT_LENGTH, 'a');
      await expect(
        keyFromPasswordAndSaltAsync({ password, salt }),
      ).rejects.toThrow('Zero-length password is not supported');
    });

    it('should throw error with empty salt', async () => {
      const password = 'test-password';
      const salt = Buffer.from('');
      await expect(
        keyFromPasswordAndSaltAsync({ password, salt }),
      ).rejects.toThrow('Zero-length salt is not supported');
    });

    it('should throw error with empty password and salt', async () => {
      const password = '';
      const salt = Buffer.from('');
      await expect(
        keyFromPasswordAndSaltAsync({ password, salt }),
      ).rejects.toThrow('Zero-length password is not supported');
    });

    it('should handle null or undefined parameters', async () => {
      const validPassword = 'test-password';
      const validSalt = Buffer.alloc(PBKDF2_SALT_LENGTH, 'a');

      await expect(
        keyFromPasswordAndSaltAsync({ password: null as any, salt: validSalt }),
      ).rejects.toThrow();
      await expect(
        keyFromPasswordAndSaltAsync({
          password: undefined as any,
          salt: validSalt,
        }),
      ).rejects.toThrow();
      await expect(
        keyFromPasswordAndSaltAsync({
          password: validPassword,
          salt: null as any,
        }),
      ).rejects.toThrow();
      await expect(
        keyFromPasswordAndSaltAsync({
          password: validPassword,
          salt: undefined as any,
        }),
      ).rejects.toThrow();
      await expect(
        keyFromPasswordAndSaltAsync({
          password: null as any,
          salt: null as any,
        }),
      ).rejects.toThrow();
    });

    it('should handle empty Buffer salt', async () => {
      const validPassword = 'test-password';
      const emptyBuffer = Buffer.alloc(0);

      await expect(
        keyFromPasswordAndSaltAsync({
          password: validPassword,
          salt: emptyBuffer,
        }),
      ).rejects.toThrow('Zero-length salt is not supported');

      await expect(
        keyFromPasswordAndSaltAsync({
          password: validPassword,
          salt: Buffer.from(''),
        }),
      ).rejects.toThrow('Zero-length salt is not supported');
    });

    it('should match snapshot with special characters in password', async () => {
      const password = '!@#$%^&*()_+-=[]{}|;:,.<>?';
      const salt = Buffer.alloc(PBKDF2_SALT_LENGTH, 'a');
      const result = await keyFromPasswordAndSaltAsync({ password, salt });
      expect(result.toString('hex')).toMatchSnapshot();
    });

    it('keyFromPasswordAndSalt and keyFromPasswordAndSaltSync must be equal', async () => {
      const password = 'test-password';
      const salt = Buffer.alloc(PBKDF2_SALT_LENGTH, 'a');
      const result = await keyFromPasswordAndSaltAsync({ password, salt });
      const resultSync = keyFromPasswordAndSaltSync({ password, salt });
      expect(result.toString('hex')).toBe(resultSync.toString('hex'));
    });

    it('should match snapshot with UTF-8 characters in password', async () => {
      const password = '你好世界🌍';
      const salt = Buffer.alloc(PBKDF2_SALT_LENGTH, 'a');
      const result = await keyFromPasswordAndSaltAsync({ password, salt });
      expect(result.toString('hex')).toMatchSnapshot();
    });

    it('should handle large password input', async () => {
      const largePassword = 'a'.repeat(1024 * 1024); // 1MB password
      const salt = Buffer.alloc(PBKDF2_SALT_LENGTH, 'a');
      const result = await keyFromPasswordAndSaltAsync({
        password: largePassword,
        salt,
      });
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBe(PBKDF2_KEY_LENGTH);
    });
  });

  describe('aesCbcEncrypt/aesCbcDecrypt', () => {
    const iv = Buffer.alloc(AES256_IV_LENGTH, 'b');
    const key = Buffer.alloc(PBKDF2_KEY_LENGTH, 'c');

    it('should match snapshot for encryption of normal data', async () => {
      const data = Buffer.from('Hello, World!');
      const encrypted = await aesCbcEncryptAsync({ iv, key, data });
      expect(encrypted.toString('hex')).toMatchSnapshot();
    });

    it('aesCbcEncrypt and aesCbcEncryptSync must be equal', async () => {
      const data = Buffer.from('Hello, World!');
      const encrypted = await aesCbcEncryptAsync({ iv, key, data });
      const encryptedSync = aesCbcEncryptSync({ iv, key, data });
      expect(encrypted.toString('hex')).toBe(encryptedSync.toString('hex'));
    });

    it('should throw error with empty data for encryption', async () => {
      const data = Buffer.from('');
      await expect(aesCbcEncryptAsync({ iv, key, data })).rejects.toThrow(
        'Zero-length data is not supported',
      );
    });

    it('aesCbcDecrypt and aesCbcDecryptSync must be equal', async () => {
      const data = Buffer.from('Hello, World!');
      const encrypted = await aesCbcEncryptAsync({ iv, key, data });
      const decrypted = await aesCbcDecryptAsync({ iv, key, data: encrypted });
      const decryptedSync = aesCbcDecryptSync({ iv, key, data: encrypted });
      expect(decrypted.toString('hex')).toBe(decryptedSync.toString('hex'));
    });

    it('should throw error with empty data for decryption', async () => {
      const data = Buffer.from('');
      await expect(aesCbcDecryptAsync({ iv, key, data })).rejects.toThrow(
        'Zero-length data is not supported',
      );
    });

    it('should match snapshot for encryption of long data', async () => {
      const data = Buffer.from('a'.repeat(1000));
      const encrypted = await aesCbcEncryptAsync({ iv, key, data });
      expect(encrypted.toString('hex')).toMatchSnapshot();
    });

    it('should successfully decrypt encrypted data', async () => {
      const originalData = Buffer.from('Hello, World!');
      const encrypted = await aesCbcEncryptAsync({
        iv,
        key,
        data: originalData,
      });
      const decrypted = await aesCbcDecryptAsync({ iv, key, data: encrypted });
      expect(decrypted.toString()).toBe(originalData.toString());
      expect(decrypted.toString('hex')).toMatchSnapshot();
    });

    it('should handle null or undefined parameters for encryption', async () => {
      const validData = Buffer.from('test-data');

      await expect(
        aesCbcEncryptAsync({ iv: null as any, key, data: validData }),
      ).rejects.toThrow();
      await expect(
        aesCbcEncryptAsync({ iv: undefined as any, key, data: validData }),
      ).rejects.toThrow();
      await expect(
        aesCbcEncryptAsync({ iv, key: null as any, data: validData }),
      ).rejects.toThrow();
      await expect(
        aesCbcEncryptAsync({ iv, key: undefined as any, data: validData }),
      ).rejects.toThrow();
      await expect(
        aesCbcEncryptAsync({ iv, key, data: null as any }),
      ).rejects.toThrow();
      await expect(
        aesCbcEncryptAsync({ iv, key, data: undefined as any }),
      ).rejects.toThrow();
    });

    it('should handle null or undefined parameters for decryption', async () => {
      const validData = Buffer.from('test-data');

      await expect(
        aesCbcDecryptAsync({ iv: null as any, key, data: validData }),
      ).rejects.toThrow();
      await expect(
        aesCbcDecryptAsync({ iv: undefined as any, key, data: validData }),
      ).rejects.toThrow();
      await expect(
        aesCbcDecryptAsync({ iv, key: null as any, data: validData }),
      ).rejects.toThrow();
      await expect(
        aesCbcDecryptAsync({ iv, key: undefined as any, data: validData }),
      ).rejects.toThrow();
      await expect(
        aesCbcDecryptAsync({ iv, key, data: null as any }),
      ).rejects.toThrow();
      await expect(
        aesCbcDecryptAsync({ iv, key, data: undefined as any }),
      ).rejects.toThrow();
    });

    it('should handle empty Buffer parameters for encryption', async () => {
      const validData = Buffer.from('test-data');
      const emptyBuffer = Buffer.alloc(0);

      await expect(
        aesCbcEncryptAsync({ iv: emptyBuffer, key, data: validData }),
      ).rejects.toThrow('Zero-length iv is not supported');

      await expect(
        aesCbcEncryptAsync({ iv: Buffer.from(''), key, data: validData }),
      ).rejects.toThrow('Zero-length iv is not supported');

      await expect(
        aesCbcEncryptAsync({ iv, key: emptyBuffer, data: validData }),
      ).rejects.toThrow('Zero-length key is not supported');

      await expect(
        aesCbcEncryptAsync({ iv, key: Buffer.from(''), data: validData }),
      ).rejects.toThrow('Zero-length key is not supported');

      await expect(
        aesCbcEncryptAsync({ iv, key, data: emptyBuffer }),
      ).rejects.toThrow('Zero-length data is not supported');

      await expect(
        aesCbcEncryptAsync({ iv, key, data: Buffer.from('') }),
      ).rejects.toThrow('Zero-length data is not supported');
    });

    it('should handle empty Buffer parameters for decryption', async () => {
      const validData = Buffer.from('test-data');
      const emptyBuffer = Buffer.alloc(0);

      await expect(
        aesCbcDecryptAsync({ iv: emptyBuffer, key, data: validData }),
      ).rejects.toThrow('Zero-length iv is not supported');

      await expect(
        aesCbcDecryptAsync({ iv: Buffer.from(''), key, data: validData }),
      ).rejects.toThrow('Zero-length iv is not supported');

      await expect(
        aesCbcDecryptAsync({ iv, key: emptyBuffer, data: validData }),
      ).rejects.toThrow('Zero-length key is not supported');

      await expect(
        aesCbcDecryptAsync({ iv, key: Buffer.from(''), data: validData }),
      ).rejects.toThrow('Zero-length key is not supported');

      await expect(
        aesCbcDecryptAsync({ iv, key, data: emptyBuffer }),
      ).rejects.toThrow('Zero-length data is not supported');

      await expect(
        aesCbcDecryptAsync({ iv, key, data: Buffer.from('') }),
      ).rejects.toThrow('Zero-length data is not supported');
    });

    it('should handle very large data input', async () => {
      const largeData = Buffer.alloc(1024 * 1024); // 1MB of data
      const encrypted = await aesCbcEncryptAsync({ iv, key, data: largeData });
      const decrypted = await aesCbcDecryptAsync({ iv, key, data: encrypted });
      expect(decrypted.length).toBe(largeData.length);
      expect(decrypted.equals(largeData)).toBe(true);
    });
  });
});
