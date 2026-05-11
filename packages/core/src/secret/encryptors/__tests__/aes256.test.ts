import { EAppCryptoAesEncryptionMode } from '@onekeyhq/shared/src/appCrypto/consts';

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
  const goldenVectorPassword = 'golden-vector-password';
  const goldenVectorPlaintext = 'golden vector plaintext';
  const goldenVectorPlaintextBuffer = Buffer.from(goldenVectorPlaintext);
  const goldenVectorSalt = Buffer.from(
    '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f',
    'hex',
  );
  const goldenVectorCbcIv = Buffer.from(
    '202122232425262728292a2b2c2d2e2f',
    'hex',
  );
  const goldenVectorGcmNonce = Buffer.from('303132333435363738393a3b', 'hex');
  const goldenVectorAad = 'golden-vector-aad-v1';

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

    it('should encrypt and decrypt data correctly using AES-GCM mode', async () => {
      const aad = 'aes256-test-gcm-aad-v1';
      const encrypted = await encryptAsync({
        password: testPassword,
        data: testBuffer,
        allowRawPassword: true,
        mode: EAppCryptoAesEncryptionMode.gcm,
        aad,
      });
      const decrypted = await decryptAsync({
        password: testPassword,
        data: encrypted,
        ignoreLogger: false,
        allowRawPassword: true,
        mode: EAppCryptoAesEncryptionMode.gcm,
        aad,
      });
      expect(decrypted.toString()).toBe(testData);
    });

    it('should auto-detect AES-GCM payload when mode is not provided', async () => {
      const aad = 'aes256-test-gcm-aad-v1';
      const encrypted = await encryptAsync({
        password: testPassword,
        data: testBuffer,
        allowRawPassword: true,
        mode: EAppCryptoAesEncryptionMode.gcm,
        aad,
      });
      const decrypted = await decryptAsync({
        password: testPassword,
        data: encrypted,
        ignoreLogger: false,
        allowRawPassword: true,
        aad,
      });
      expect(decrypted.toString()).toBe(testData);
    });

    it('should fail to decrypt AES-GCM data when AAD is missing', async () => {
      const encrypted = await encryptAsync({
        password: testPassword,
        data: testBuffer,
        allowRawPassword: true,
        mode: EAppCryptoAesEncryptionMode.gcm,
        aad: 'aes256-test-gcm-aad-v1',
      });
      await expect(
        decryptAsync({
          password: testPassword,
          data: encrypted,
          ignoreLogger: false,
          allowRawPassword: true,
        }),
      ).rejects.toThrow();
    });

    it('should fail to decrypt AES-GCM data when AAD is incorrect', async () => {
      const encrypted = await encryptAsync({
        password: testPassword,
        data: testBuffer,
        allowRawPassword: true,
        mode: EAppCryptoAesEncryptionMode.gcm,
        aad: 'aes256-test-gcm-aad-v1',
      });
      await expect(
        decryptAsync({
          password: testPassword,
          data: encrypted,
          ignoreLogger: false,
          allowRawPassword: true,
          aad: 'aes256-test-gcm-aad-v2',
        }),
      ).rejects.toThrow();
    });

    it('should fail to decrypt when AES-GCM ciphertext is tampered', async () => {
      const encrypted = await encryptAsync({
        password: testPassword,
        data: testBuffer,
        allowRawPassword: true,
        mode: EAppCryptoAesEncryptionMode.gcm,
        aad: 'aes256-test-gcm-aad-v1',
      });
      const tampered = Buffer.from(encrypted);
      // Mutate ciphertext to ensure auth verification fails, without using bitwise assignment.
      tampered[tampered.length - 1] = (tampered[tampered.length - 1] + 1) % 256;
      await expect(
        decryptAsync({
          password: testPassword,
          data: tampered,
          ignoreLogger: false,
          allowRawPassword: true,
          aad: 'aes256-test-gcm-aad-v1',
        }),
      ).rejects.toThrow();
    });
  });

  describe('golden vectors', () => {
    it('should keep legacy AES-CBC default-iteration payload compatible', async () => {
      const expectedPayloadHex =
        '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2fc3d3c7af07504bb7142fece30c944197be663ce7a86c78d5b3baa38b806844dd';

      const encrypted = await encryptAsync({
        password: goldenVectorPassword,
        data: goldenVectorPlaintextBuffer,
        allowRawPassword: true,
        customSalt: goldenVectorSalt,
        customIv: goldenVectorCbcIv,
      });
      expect(encrypted.toString('hex')).toBe(expectedPayloadHex);

      const decrypted = await decryptAsync({
        password: goldenVectorPassword,
        data: Buffer.from(expectedPayloadHex, 'hex'),
        ignoreLogger: false,
        allowRawPassword: true,
      });
      expect(decrypted.toString()).toBe(goldenVectorPlaintext);
    });

    it('should keep legacy AES-GCM default-iteration payload compatible', async () => {
      const expectedPayloadHex =
        '314b5f4145535f47434d000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f303132333435363738393a3bca961ba8e44619d55335f5de7fa8e6b74ca14ab210f8409b32f4ff48a4117254fc76021827ea30';

      const encrypted = await encryptAsync({
        password: goldenVectorPassword,
        data: goldenVectorPlaintextBuffer,
        allowRawPassword: true,
        customSalt: goldenVectorSalt,
        customIv: goldenVectorGcmNonce,
        mode: EAppCryptoAesEncryptionMode.gcm,
        aad: goldenVectorAad,
      });
      expect(encrypted.toString('hex')).toBe(expectedPayloadHex);

      const decrypted = await decryptAsync({
        password: goldenVectorPassword,
        data: Buffer.from(expectedPayloadHex, 'hex'),
        ignoreLogger: false,
        allowRawPassword: true,
        aad: goldenVectorAad,
      });
      expect(decrypted.toString()).toBe(goldenVectorPlaintext);
    });

    it('should require caller-provided iterations for legacy custom-iteration payloads', async () => {
      const customIterations = 1234;
      const expectedPayloadHex =
        '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f656a5d6dd1b3adab1c01ce09273164f2bb1080ed6072a18f6f9519a62af21f51';

      const encrypted = await encryptAsync({
        password: goldenVectorPassword,
        data: goldenVectorPlaintextBuffer,
        allowRawPassword: true,
        customSalt: goldenVectorSalt,
        customIv: goldenVectorCbcIv,
        iterations: customIterations,
      });
      expect(encrypted.toString('hex')).toBe(expectedPayloadHex);

      const decrypted = await decryptAsync({
        password: goldenVectorPassword,
        data: Buffer.from(expectedPayloadHex, 'hex'),
        ignoreLogger: false,
        allowRawPassword: true,
        iterations: customIterations,
      });
      expect(decrypted.toString()).toBe(goldenVectorPlaintext);

      await expect(
        decryptAsync({
          password: goldenVectorPassword,
          data: Buffer.from(expectedPayloadHex, 'hex'),
          ignoreLogger: false,
          allowRawPassword: true,
        }),
      ).rejects.toThrow();
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

    it('should encrypt and decrypt strings correctly using AES-GCM mode', async () => {
      const aad = 'aes256-test-gcm-aad-v1';
      const encrypted = await encryptStringAsync({
        password: testPassword,
        data: testData,
        dataEncoding: 'utf8',
        allowRawPassword: true,
        mode: EAppCryptoAesEncryptionMode.gcm,
        aad,
      });
      const decrypted = await decryptStringAsync({
        password: testPassword,
        data: encrypted,
        dataEncoding: 'hex',
        resultEncoding: 'utf8',
        allowRawPassword: true,
        mode: EAppCryptoAesEncryptionMode.gcm,
        aad,
      });
      expect(decrypted).toBe(testData);
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
