import appCrypto from '@onekeyhq/shared/src/appCrypto';
import {
  EAppCryptoAesEncryptionMode,
  PBKDF2_CURRENT_NUM_OF_ITERATIONS,
  PBKDF2_LEGACY_NUM_OF_ITERATIONS,
} from '@onekeyhq/shared/src/appCrypto/consts';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  ESecretEncryptPayloadFormat,
  ESecretEncryptPayloadVersion,
  decryptAsync,
  decryptAsyncWithMetadata,
  decryptStringAsync,
  encryptAsync,
  encryptStringAsync,
  getSecretEncryptV2LocalTargetIterations,
  readSecretEncryptPayloadMetadata,
  shouldUpgradeSecretEncryptPayload,
} from '../aes256';

const {
  clearPbkdf2Cache,
  clearPbkdf2InvocationByProbeId,
  getPbkdf2InvocationByProbeId,
} = appCrypto.pbkdf2;

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
      expect(encrypted.slice(0, 9).toString('utf8')).toBe('1K_ENC_V2');
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

    it('should enable pbkdf2 cache for encryptAsync KDF calls', async () => {
      const firstDebugCryptoProbeId = 'encryptAsync-pbkdf2-cache-first';
      const secondDebugCryptoProbeId = 'encryptAsync-pbkdf2-cache-second';
      clearPbkdf2Cache();
      clearPbkdf2InvocationByProbeId(firstDebugCryptoProbeId);
      clearPbkdf2InvocationByProbeId(secondDebugCryptoProbeId);

      const firstEncrypted = await encryptAsync({
        password: testPassword,
        data: testBuffer,
        allowRawPassword: true,
        customSalt: goldenVectorSalt,
        customIv: goldenVectorGcmNonce,
        iterations: 2,
        debugCryptoProbeId: firstDebugCryptoProbeId,
      });
      const secondEncrypted = await encryptAsync({
        password: testPassword,
        data: testBuffer,
        allowRawPassword: true,
        customSalt: goldenVectorSalt,
        customIv: goldenVectorGcmNonce,
        iterations: 2,
        debugCryptoProbeId: secondDebugCryptoProbeId,
      });

      expect(secondEncrypted.toString('hex')).toBe(
        firstEncrypted.toString('hex'),
      );
      expect(
        getPbkdf2InvocationByProbeId(firstDebugCryptoProbeId),
      ).toBeTruthy();
      expect(
        getPbkdf2InvocationByProbeId(secondDebugCryptoProbeId),
      ).toBeUndefined();
    });

    it('should enable pbkdf2 cache for decryptAsync KDF calls', async () => {
      const firstDebugCryptoProbeId = 'decryptAsync-pbkdf2-cache-first';
      const secondDebugCryptoProbeId = 'decryptAsync-pbkdf2-cache-second';
      const encrypted = await encryptAsync({
        password: testPassword,
        data: testBuffer,
        allowRawPassword: true,
        customSalt: goldenVectorSalt,
        customIv: goldenVectorGcmNonce,
        iterations: 2,
      });
      clearPbkdf2Cache();
      clearPbkdf2InvocationByProbeId(firstDebugCryptoProbeId);
      clearPbkdf2InvocationByProbeId(secondDebugCryptoProbeId);

      const firstDecrypted = await decryptAsync({
        password: testPassword,
        data: encrypted,
        allowRawPassword: true,
        debugCryptoProbeId: firstDebugCryptoProbeId,
      });
      const secondDecrypted = await decryptAsync({
        password: testPassword,
        data: encrypted,
        allowRawPassword: true,
        debugCryptoProbeId: secondDebugCryptoProbeId,
      });

      expect(firstDecrypted.toString()).toBe(testData);
      expect(secondDecrypted.toString()).toBe(testData);
      expect(
        getPbkdf2InvocationByProbeId(firstDebugCryptoProbeId),
      ).toBeTruthy();
      expect(
        getPbkdf2InvocationByProbeId(secondDebugCryptoProbeId),
      ).toBeUndefined();
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
        format: ESecretEncryptPayloadFormat.legacy,
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
        format: ESecretEncryptPayloadFormat.legacy,
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
        format: ESecretEncryptPayloadFormat.legacy,
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

  describe('v2 envelope', () => {
    it('should encrypt and decrypt v2 payload using header iterations', async () => {
      const encrypted = await encryptAsync({
        password: goldenVectorPassword,
        data: goldenVectorPlaintextBuffer,
        allowRawPassword: true,
        customSalt: goldenVectorSalt,
        customIv: goldenVectorGcmNonce,
        iterations: 1234,
        format: ESecretEncryptPayloadFormat.v2,
        aad: goldenVectorAad,
        dataType: 'golden-vector',
      });

      expect(encrypted.slice(0, 9).toString('utf8')).toBe('1K_ENC_V2');

      const decrypted = await decryptAsync({
        password: goldenVectorPassword,
        data: encrypted,
        ignoreLogger: false,
        allowRawPassword: true,
        aad: goldenVectorAad,
        dataType: 'golden-vector',
      });
      expect(decrypted.toString()).toBe(goldenVectorPlaintext);
    });

    it('should return metadata for v2 and legacy payloads', async () => {
      const encryptedV2 = await encryptAsync({
        password: goldenVectorPassword,
        data: goldenVectorPlaintextBuffer,
        allowRawPassword: true,
        customSalt: goldenVectorSalt,
        customIv: goldenVectorGcmNonce,
        iterations: 1234,
        format: ESecretEncryptPayloadFormat.v2,
        dataType: 'metadata-test',
      });
      const v2Result = await decryptAsyncWithMetadata({
        password: goldenVectorPassword,
        data: encryptedV2,
        ignoreLogger: false,
        allowRawPassword: true,
        dataType: 'metadata-test',
      });
      expect(v2Result.plaintext.toString()).toBe(goldenVectorPlaintext);
      expect(v2Result.format).toBe(ESecretEncryptPayloadFormat.v2);
      expect(v2Result.version).toBe(ESecretEncryptPayloadVersion.v2);
      expect(v2Result.cipher).toBe(EAppCryptoAesEncryptionMode.gcm);
      expect(v2Result.iterations).toBe(1234);
      expect(v2Result.dataType).toBe('metadata-test');
      expect(v2Result.needsUpgrade).toBe(false);

      const encryptedLegacy = await encryptAsync({
        password: goldenVectorPassword,
        data: goldenVectorPlaintextBuffer,
        allowRawPassword: true,
        customSalt: goldenVectorSalt,
        customIv: goldenVectorCbcIv,
        format: ESecretEncryptPayloadFormat.legacy,
      });
      const legacyResult = await decryptAsyncWithMetadata({
        password: goldenVectorPassword,
        data: encryptedLegacy,
        ignoreLogger: false,
        allowRawPassword: true,
      });
      expect(legacyResult.plaintext.toString()).toBe(goldenVectorPlaintext);
      expect(legacyResult.format).toBe(ESecretEncryptPayloadFormat.legacy);
      expect(legacyResult.version).toBe(ESecretEncryptPayloadVersion.legacyCbc);
      expect(legacyResult.needsUpgrade).toBe(true);
    });

    it('should use local target iterations for default v2 writes', async () => {
      const originalIsNativeAndroid = platformEnv.isNativeAndroid;
      platformEnv.isNativeAndroid = true;

      try {
        const encrypted = await encryptAsync({
          password: goldenVectorPassword,
          data: goldenVectorPlaintextBuffer,
          allowRawPassword: true,
          format: ESecretEncryptPayloadFormat.v2,
        });
        const result = await decryptAsyncWithMetadata({
          password: goldenVectorPassword,
          data: encrypted,
          allowRawPassword: true,
          upgradeTargetIterations: getSecretEncryptV2LocalTargetIterations(),
        });

        expect(result.iterations).toBe(PBKDF2_CURRENT_NUM_OF_ITERATIONS);
        expect(result.needsUpgrade).toBe(false);

        platformEnv.isNativeAndroid = false;
        const decryptedOnNonAndroid = await decryptAsync({
          password: goldenVectorPassword,
          data: encrypted,
          allowRawPassword: true,
        });
        expect(decryptedOnNonAndroid.toString()).toBe(goldenVectorPlaintext);

        const nonAndroidResult = await decryptAsyncWithMetadata({
          password: goldenVectorPassword,
          data: encrypted,
          allowRawPassword: true,
          upgradeTargetIterations: getSecretEncryptV2LocalTargetIterations(),
        });
        expect(nonAndroidResult.needsUpgrade).toBe(false);
      } finally {
        platformEnv.isNativeAndroid = originalIsNativeAndroid;
      }
    });

    it('should read non-Android local v2 payloads on Android using header iterations', async () => {
      const originalIsNativeAndroid = platformEnv.isNativeAndroid;
      platformEnv.isNativeAndroid = false;

      try {
        const encrypted = await encryptAsync({
          password: goldenVectorPassword,
          data: goldenVectorPlaintextBuffer,
          allowRawPassword: true,
          format: ESecretEncryptPayloadFormat.v2,
        });
        const nonAndroidResult = await decryptAsyncWithMetadata({
          password: goldenVectorPassword,
          data: encrypted,
          allowRawPassword: true,
          upgradeTargetIterations: getSecretEncryptV2LocalTargetIterations(),
        });
        expect(nonAndroidResult.iterations).toBe(
          PBKDF2_CURRENT_NUM_OF_ITERATIONS,
        );
        expect(nonAndroidResult.needsUpgrade).toBe(false);

        platformEnv.isNativeAndroid = true;
        const androidResult = await decryptAsyncWithMetadata({
          password: goldenVectorPassword,
          data: encrypted,
          allowRawPassword: true,
          upgradeTargetIterations: getSecretEncryptV2LocalTargetIterations(),
        });
        expect(androidResult.plaintext.toString()).toBe(goldenVectorPlaintext);
        expect(androidResult.iterations).toBe(PBKDF2_CURRENT_NUM_OF_ITERATIONS);
        expect(androidResult.needsUpgrade).toBe(false);
      } finally {
        platformEnv.isNativeAndroid = originalIsNativeAndroid;
      }
    });

    it('should mark v2 payloads below the supplied local target as needing upgrade', async () => {
      const encryptedLowIterationV2 = await encryptAsync({
        password: goldenVectorPassword,
        data: goldenVectorPlaintextBuffer,
        allowRawPassword: true,
        customSalt: goldenVectorSalt,
        customIv: goldenVectorGcmNonce,
        iterations: PBKDF2_LEGACY_NUM_OF_ITERATIONS,
        format: ESecretEncryptPayloadFormat.v2,
      });

      const genericResult = await decryptAsyncWithMetadata({
        password: goldenVectorPassword,
        data: encryptedLowIterationV2,
        allowRawPassword: true,
      });
      expect(genericResult.needsUpgrade).toBe(false);

      const localResult = await decryptAsyncWithMetadata({
        password: goldenVectorPassword,
        data: encryptedLowIterationV2,
        allowRawPassword: true,
        upgradeTargetIterations: PBKDF2_CURRENT_NUM_OF_ITERATIONS,
      });
      expect(localResult.iterations).toBe(PBKDF2_LEGACY_NUM_OF_ITERATIONS);
      expect(localResult.needsUpgrade).toBe(true);
      expect(
        shouldUpgradeSecretEncryptPayload({
          data: encryptedLowIterationV2,
          targetIterations: PBKDF2_CURRENT_NUM_OF_ITERATIONS,
        }),
      ).toBe(true);
    });

    it('should fail v2 decrypt when AAD, dataType, or authenticated header is wrong', async () => {
      const encrypted = await encryptAsync({
        password: goldenVectorPassword,
        data: goldenVectorPlaintextBuffer,
        allowRawPassword: true,
        customSalt: goldenVectorSalt,
        customIv: goldenVectorGcmNonce,
        iterations: 1234,
        format: ESecretEncryptPayloadFormat.v2,
        aad: goldenVectorAad,
        dataType: 'tamper-test',
      });

      await expect(
        decryptAsync({
          password: goldenVectorPassword,
          data: encrypted,
          ignoreLogger: false,
          allowRawPassword: true,
          aad: 'wrong-aad',
          dataType: 'tamper-test',
        }),
      ).rejects.toThrow();

      await expect(
        decryptAsync({
          password: goldenVectorPassword,
          data: encrypted,
          ignoreLogger: false,
          allowRawPassword: true,
          aad: goldenVectorAad,
          dataType: 'wrong-data-type',
        }),
      ).rejects.toThrow();

      const tamperedHeader = Buffer.from(encrypted);
      tamperedHeader[16] = (tamperedHeader[16] + 1) % 256;
      await expect(
        decryptAsync({
          password: goldenVectorPassword,
          data: tamperedHeader,
          ignoreLogger: false,
          allowRawPassword: true,
          aad: goldenVectorAad,
          dataType: 'tamper-test',
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

    it('should encrypt and decrypt strings correctly using v2 format', async () => {
      const encrypted = await encryptStringAsync({
        password: testPassword,
        data: testData,
        dataEncoding: 'utf8',
        allowRawPassword: true,
        iterations: 1234,
        format: ESecretEncryptPayloadFormat.v2,
        aad: 'aes256-test-v2-string-aad',
        dataType: 'string-test',
      });
      const decrypted = await decryptStringAsync({
        password: testPassword,
        data: encrypted,
        dataEncoding: 'hex',
        resultEncoding: 'utf8',
        allowRawPassword: true,
        aad: 'aes256-test-v2-string-aad',
        dataType: 'string-test',
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
        format: ESecretEncryptPayloadFormat.legacy,
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
        format: ESecretEncryptPayloadFormat.legacy,
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

  describe('readSecretEncryptPayloadMetadata', () => {
    it('reads v2 container method + KDF iterations from the header only', async () => {
      const encrypted = await encryptAsync({
        password: goldenVectorPassword,
        data: goldenVectorPlaintextBuffer,
        allowRawPassword: true,
        customSalt: goldenVectorSalt,
        customIv: goldenVectorGcmNonce,
        iterations: 1234,
        format: ESecretEncryptPayloadFormat.v2,
        dataType: 'metadata-test',
      });
      const meta = readSecretEncryptPayloadMetadata({ data: encrypted });
      expect(meta).toEqual({
        format: 'v2',
        cipher: 'AES-256-GCM',
        kdf: 'PBKDF2-SHA256',
        iterations: 1234,
      });
    });

    it('accepts a hex string (the on-disk credential payload form)', async () => {
      const encrypted = await encryptAsync({
        password: testPassword,
        data: testBuffer,
      });
      const meta = readSecretEncryptPayloadMetadata({
        data: encrypted.toString('hex'),
      });
      expect(meta.format).toBe('v2');
      expect(meta.cipher).toBe('AES-256-GCM');
      expect(meta.kdf).toBe('PBKDF2-SHA256');
      expect(meta.iterations).toBe(getSecretEncryptV2LocalTargetIterations());
    });

    it('detects legacy GCM container without iterations', async () => {
      const encrypted = await encryptAsync({
        password: goldenVectorPassword,
        data: goldenVectorPlaintextBuffer,
        allowRawPassword: true,
        customSalt: goldenVectorSalt,
        customIv: goldenVectorGcmNonce,
        mode: EAppCryptoAesEncryptionMode.gcm,
        format: ESecretEncryptPayloadFormat.legacy,
      });
      const meta = readSecretEncryptPayloadMetadata({ data: encrypted });
      expect(meta.format).toBe('legacy-gcm');
      expect(meta.iterations).toBeUndefined();
    });

    it('treats legacy CBC / unrecognized container as legacy-cbc-or-unknown', async () => {
      const encrypted = await encryptAsync({
        password: goldenVectorPassword,
        data: goldenVectorPlaintextBuffer,
        allowRawPassword: true,
        customSalt: goldenVectorSalt,
        customIv: goldenVectorCbcIv,
        format: ESecretEncryptPayloadFormat.legacy,
      });
      const meta = readSecretEncryptPayloadMetadata({ data: encrypted });
      expect(meta.format).toBe('legacy-cbc-or-unknown');
      expect(meta.iterations).toBeUndefined();
    });

    it('never returns secret material (salt / nonce / ciphertext / plaintext / aad)', async () => {
      const encrypted = await encryptAsync({
        password: goldenVectorPassword,
        data: goldenVectorPlaintextBuffer,
        allowRawPassword: true,
        customSalt: goldenVectorSalt,
        customIv: goldenVectorGcmNonce,
        iterations: 1234,
        format: ESecretEncryptPayloadFormat.v2,
        dataType: 'metadata-test',
      });
      const meta = readSecretEncryptPayloadMetadata({ data: encrypted });
      // The returned object may only carry these non-secret container fields.
      expect(Object.keys(meta).toSorted()).toEqual(
        ['cipher', 'format', 'iterations', 'kdf'].toSorted(),
      );
      const forbiddenKeys = [
        'salt',
        'nonce',
        'iv',
        'aad',
        'ciphertext',
        'ciphertextWithTag',
        'dataType',
        'plaintext',
      ];
      for (const key of forbiddenKeys) {
        expect(meta).not.toHaveProperty(key);
      }
    });

    it('returns legacy-cbc-or-unknown for malformed (non-hex) input instead of throwing', () => {
      const meta = readSecretEncryptPayloadMetadata({
        data: 'not-a-hex-payload-zzz',
      });
      expect(meta.format).toBe('legacy-cbc-or-unknown');
    });
  });
});
