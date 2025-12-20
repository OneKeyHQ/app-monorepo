import {
  decryptAsync,
  decryptStringAsync,
  encryptAsync,
  encryptStringAsync,
} from '../aes256';

/* run test ==============================

yarn jest packages/core/src/secret/encryptors/__tests__/aes256.test.ts

*/

describe('aes256', () => {
  const testPassword = 'testPassword123';
  const testData = 'Hello, World!';
  const testBuffer = Buffer.from(testData);

  describe('encrypt/decrypt', () => {
    it('should encrypt and decrypt data correctly using sync methods', async () => {
      const encrypted = await encryptAsync({
        password: testPassword,
        data: testBuffer,
        allowRawPassword: true,
      });
      const decrypted = await decryptAsync({
        password: testPassword,
        data: encrypted,
        ignoreLogger: false,
        allowRawPassword: true,
      });
      expect(decrypted.toString()).toBe(testData);
    });

    it('should encrypt and decrypt data correctly using async methods', async () => {
      const encrypted = await encryptAsync({
        password: testPassword,
        data: testBuffer,
      });
      const decrypted = await decryptAsync({
        password: testPassword,
        data: encrypted,
        ignoreLogger: false,
        allowRawPassword: true,
      });
      expect(decrypted.toString()).toBe(testData);
    });

    it('should produce different ciphertexts for same input', async () => {
      const encrypted1 = await encryptAsync({
        password: testPassword,
        data: testBuffer,
      });
      const encrypted2 = await encryptAsync({
        password: testPassword,
        data: testBuffer,
      });
      expect(encrypted1.toString('hex')).not.toBe(encrypted2.toString('hex'));
    });
  });

  describe('encryptString/decryptString', () => {
    it('should encrypt and decrypt strings correctly using sync methods', async () => {
      const encrypted = await encryptStringAsync({
        password: testPassword,
        data: testData,
        dataEncoding: 'utf8',
        allowRawPassword: true,
      });
      console.log('encrypted', encrypted);
      const decrypted = await decryptStringAsync({
        password: testPassword,
        data: encrypted,
        dataEncoding: 'hex',
        resultEncoding: 'utf8',
        allowRawPassword: true,
      });
      expect(decrypted).toBe(testData);
    });

    it('should encrypt and decrypt strings correctly using async methods', async () => {
      const encrypted = await encryptStringAsync({
        password: testPassword,
        data: testData,
        dataEncoding: 'utf8',
        allowRawPassword: true,
      });
      const decrypted = await decryptStringAsync({
        password: testPassword,
        data: encrypted,
        dataEncoding: 'hex',
        resultEncoding: 'utf8',
        allowRawPassword: true,
      });
      expect(decrypted).toBe(testData);
    });

    it('should handle different encodings correctly', async () => {
      const hexData = Buffer.from(testData).toString('hex');
      const encrypted = await encryptStringAsync({
        password: testPassword,
        data: hexData,
        dataEncoding: 'hex',
        allowRawPassword: true,
      });
      const decrypted = await decryptStringAsync({
        password: testPassword,
        data: encrypted,
        dataEncoding: 'hex',
        resultEncoding: 'hex',
        allowRawPassword: true,
      });
      expect(Buffer.from(decrypted, 'hex').toString()).toBe(testData);
    });
  });

  describe('custom iterations parameter', () => {
    it('should encrypt and decrypt data correctly with custom low iterations', async () => {
      const customIterations = 100;
      const encrypted = await encryptAsync({
        password: testPassword,
        data: testBuffer,
        allowRawPassword: true,
        iterations: customIterations,
      });
      const decrypted = await decryptAsync({
        password: testPassword,
        data: encrypted,
        ignoreLogger: false,
        allowRawPassword: true,
        iterations: customIterations,
      });
      expect(decrypted.toString()).toBe(testData);
    });

    it('should encrypt and decrypt strings correctly with custom iterations', async () => {
      const customIterations = 200;
      const encrypted = await encryptStringAsync({
        password: testPassword,
        data: testData,
        dataEncoding: 'utf8',
        allowRawPassword: true,
        iterations: customIterations,
      });
      const decrypted = await decryptStringAsync({
        password: testPassword,
        data: encrypted,
        dataEncoding: 'hex',
        resultEncoding: 'utf8',
        allowRawPassword: true,
        iterations: customIterations,
      });
      expect(decrypted).toBe(testData);
    });

    it('should fail to decrypt when iterations parameter does not match', async () => {
      const customIterations = 150;
      const wrongIterations = 300;

      const encrypted = await encryptAsync({
        password: testPassword,
        data: testBuffer,
        allowRawPassword: true,
        iterations: customIterations,
      });

      await expect(
        decryptAsync({
          password: testPassword,
          data: encrypted,
          ignoreLogger: false,
          allowRawPassword: true,
          iterations: wrongIterations,
        }),
      ).rejects.toThrow();
    });

    it('should use default iterations when parameter is not provided', async () => {
      const encryptedWithDefault = await encryptAsync({
        password: testPassword,
        data: testBuffer,
        allowRawPassword: true,
      });

      const decryptedWithDefault = await decryptAsync({
        password: testPassword,
        data: encryptedWithDefault,
        ignoreLogger: false,
        allowRawPassword: true,
      });

      expect(decryptedWithDefault.toString()).toBe(testData);
    });
  });
});
