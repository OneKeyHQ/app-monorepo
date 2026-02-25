import {
  encrypt,
  decrypt,
  hash,
} from './encryptUtils';

describe('encryptUtils', () => {
  describe('encrypt & decrypt', () => {
    it('should encrypt and decrypt data', () => {
      const data = 'sensitive data';
      const password = 'password123';
      
      const encrypted = encrypt(data, password);
      expect(encrypted).not.toBe(data);
      
      const decrypted = decrypt(encrypted, password);
      expect(decrypted).toBe(data);
    });

    it('should produce different encrypted output for same data', () => {
      const data = 'test data';
      const password = 'password';
      
      const encrypted1 = encrypt(data, password);
      const encrypted2 = encrypt(data, password);
      
      expect(encrypted1).not.toBe(encrypted2);
    });
  });

  describe('hash', () => {
    it('should hash data consistently', () => {
      const data = 'test data';
      const hash1 = hash(data);
      const hash2 = hash(data);
      
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different data', () => {
      const hash1 = hash('data1');
      const hash2 = hash('data2');
      
      expect(hash1).not.toBe(hash2);
    });
  });
});
