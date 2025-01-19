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

    it('should match snapshot with empty password', async () => {
      const password = '';
      const salt = Buffer.alloc(PBKDF2_SALT_LENGTH, 'a');
      const result = await keyFromPasswordAndSalt(password, salt);
      expect(result.toString('hex')).toMatchSnapshot();
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
  });

  describe('aesCbcEncrypt/aesCbcDecrypt', () => {
    const iv = Buffer.alloc(AES256_IV_LENGTH, 'b');
    const key = Buffer.alloc(PBKDF2_KEY_LENGTH, 'c');

    it('should match snapshot for encryption of normal data', async () => {
      const data = Buffer.from('Hello, World!');
      const encrypted = await aesCbcEncrypt({ iv, key, data });
      expect(encrypted.toString('hex')).toMatchSnapshot();
    });

    it('should match snapshot for encryption of empty data', async () => {
      const data = Buffer.from('');
      const encrypted = await aesCbcEncrypt({ iv, key, data });
      expect(encrypted.toString('hex')).toMatchSnapshot();
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

    it('should successfully decrypt encrypted empty data', async () => {
      const originalData = Buffer.from('');
      const encrypted = await aesCbcEncrypt({ iv, key, data: originalData });
      const decrypted = await aesCbcDecrypt({ iv, key, data: encrypted });
      expect(decrypted.toString()).toBe(originalData.toString());
      expect(decrypted.toString('hex')).toMatchSnapshot();
    });

    it('should successfully decrypt encrypted long data', async () => {
      const originalData = Buffer.from('a'.repeat(1000));
      const encrypted = await aesCbcEncrypt({ iv, key, data: originalData });
      const decrypted = await aesCbcDecrypt({ iv, key, data: encrypted });
      expect(decrypted.toString()).toBe(originalData.toString());
      expect(decrypted.toString('hex')).toMatchSnapshot();
    });
  });
});
