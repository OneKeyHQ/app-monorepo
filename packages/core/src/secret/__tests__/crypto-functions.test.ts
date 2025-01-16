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
    it('should match snapshot with normal password and salt', () => {
      const password = 'test-password';
      const salt = Buffer.alloc(PBKDF2_SALT_LENGTH, 'a');
      const result = keyFromPasswordAndSalt(password, salt);
      expect(result.toString('hex')).toMatchSnapshot();
    });

    it('should match snapshot with empty password', () => {
      const password = '';
      const salt = Buffer.alloc(PBKDF2_SALT_LENGTH, 'a');
      const result = keyFromPasswordAndSalt(password, salt);
      expect(result.toString('hex')).toMatchSnapshot();
    });

    it('should match snapshot with special characters in password', () => {
      const password = '!@#$%^&*()_+-=[]{}|;:,.<>?';
      const salt = Buffer.alloc(PBKDF2_SALT_LENGTH, 'a');
      const result = keyFromPasswordAndSalt(password, salt);
      expect(result.toString('hex')).toMatchSnapshot();
    });

    it('should match snapshot with UTF-8 characters in password', () => {
      const password = '你好世界🌍';
      const salt = Buffer.alloc(PBKDF2_SALT_LENGTH, 'a');
      const result = keyFromPasswordAndSalt(password, salt);
      expect(result.toString('hex')).toMatchSnapshot();
    });
  });

  describe('aesCbcEncrypt/aesCbcDecrypt', () => {
    const iv = Buffer.alloc(AES256_IV_LENGTH, 'b');
    const key = Buffer.alloc(PBKDF2_KEY_LENGTH, 'c');

    it('should match snapshot for encryption of normal data', () => {
      const data = Buffer.from('Hello, World!');
      const encrypted = aesCbcEncrypt({ iv, key, data });
      expect(encrypted.toString('hex')).toMatchSnapshot();
    });

    it('should match snapshot for encryption of empty data', () => {
      const data = Buffer.from('');
      const encrypted = aesCbcEncrypt({ iv, key, data });
      expect(encrypted.toString('hex')).toMatchSnapshot();
    });

    it('should match snapshot for encryption of long data', () => {
      const data = Buffer.from('a'.repeat(1000));
      const encrypted = aesCbcEncrypt({ iv, key, data });
      expect(encrypted.toString('hex')).toMatchSnapshot();
    });

    it('should successfully decrypt encrypted data', () => {
      const originalData = Buffer.from('Hello, World!');
      const encrypted = aesCbcEncrypt({ iv, key, data: originalData });
      const decrypted = aesCbcDecrypt({ iv, key, data: encrypted });
      expect(decrypted.toString()).toBe(originalData.toString());
      expect(decrypted.toString('hex')).toMatchSnapshot();
    });

    it('should successfully decrypt encrypted empty data', () => {
      const originalData = Buffer.from('');
      const encrypted = aesCbcEncrypt({ iv, key, data: originalData });
      const decrypted = aesCbcDecrypt({ iv, key, data: encrypted });
      expect(decrypted.toString()).toBe(originalData.toString());
      expect(decrypted.toString('hex')).toMatchSnapshot();
    });

    it('should successfully decrypt encrypted long data', () => {
      const originalData = Buffer.from('a'.repeat(1000));
      const encrypted = aesCbcEncrypt({ iv, key, data: originalData });
      const decrypted = aesCbcDecrypt({ iv, key, data: encrypted });
      expect(decrypted.toString()).toBe(originalData.toString());
      expect(decrypted.toString('hex')).toMatchSnapshot();
    });
  });
});
