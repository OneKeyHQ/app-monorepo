import {
  encryptAES,
  decryptAES,
  encryptRSA,
  decryptRSA,
  generateKeyPair,
} from './cryptoUtils';

describe('cryptoUtils', () => {
  describe('AES encryption', () => {
    it('should encrypt and decrypt with AES', () => {
      const data = 'secret message';
      const key = 'my-secret-key-32-chars-long!!!!!'; // 32 chars for AES-256
      const encrypted = encryptAES(data, key);
      const decrypted = decryptAES(encrypted, key);
      expect(decrypted).toBe(data);
    });
  });

  describe('RSA encryption', () => {
    it('should have encryptRSA method', () => {
      expect(typeof encryptRSA).toBe('function');
    });

    it('should have decryptRSA method', () => {
      expect(typeof decryptRSA).toBe('function');
    });
  });

  describe('generateKeyPair', () => {
    it('should generate RSA key pair', () => {
      const keys = generateKeyPair();
      expect(keys.publicKey).toBeDefined();
      expect(keys.privateKey).toBeDefined();
    });
  });
});
