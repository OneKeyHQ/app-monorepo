import { Buffer } from 'buffer';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import {
  compressPublicKey,
  decryptImportedCredential,
  decryptVerifyString,
  encryptImportedCredential,
  encryptVerifyString,
  fixV4VerifyStringToV5,
  sign,
  uncompressPublicKey,
  verify,
} from '..';

import type { ICoreImportedCredential } from '../../types';

/*
yarn jest packages/core/src/secret/__tests__/credential-edge-cases.test.ts
*/

describe('Credential Edge Cases', () => {
  const TEST_PASSWORD = 'testPassword123';

  describe('encryptImportedCredential / decryptImportedCredential', () => {
    it('should roundtrip imported credential', async () => {
      const credential: ICoreImportedCredential = {
        privateKey:
          'e8f32e723decf4051aefac8e2c93c9c5b214313817cdb01a1494b917c8436b35',
      };
      const encrypted = await encryptImportedCredential({
        credential,
        password: TEST_PASSWORD,
      });
      const decrypted = await decryptImportedCredential({
        credential: encrypted,
        password: TEST_PASSWORD,
      });
      expect(decrypted.privateKey).toBe(credential.privateKey);
    });

    it('should reject null credential', async () => {
      await expect(
        encryptImportedCredential({
          credential: null as unknown as ICoreImportedCredential,
          password: TEST_PASSWORD,
        }),
      ).rejects.toThrow('Invalid credential object');
    });

    it('should reject credential without privateKey', async () => {
      await expect(
        encryptImportedCredential({
          credential: {} as ICoreImportedCredential,
          password: TEST_PASSWORD,
        }),
      ).rejects.toThrow('Invalid credential object');
    });

    it('should reject credential with empty privateKey', async () => {
      await expect(
        encryptImportedCredential({
          credential: { privateKey: '' },
          password: TEST_PASSWORD,
        }),
      ).rejects.toThrow('Invalid credential object');
    });

    it('should fail decryption with wrong password', async () => {
      const credential: ICoreImportedCredential = {
        privateKey: 'aabbccdd',
      };
      const encrypted = await encryptImportedCredential({
        credential,
        password: TEST_PASSWORD,
      });
      await expect(
        decryptImportedCredential({
          credential: encrypted,
          password: 'wrongPassword',
        }),
      ).rejects.toThrow();
    });

    it('should handle prefix stripping correctly', async () => {
      const credential: ICoreImportedCredential = {
        privateKey: 'deadbeef',
      };
      const encrypted = await encryptImportedCredential({
        credential,
        password: TEST_PASSWORD,
      });
      // Encrypted should have |PK| prefix
      expect(encrypted.startsWith('|PK|')).toBe(true);

      const decrypted = await decryptImportedCredential({
        credential: encrypted,
        password: TEST_PASSWORD,
      });
      expect(decrypted.privateKey).toBe('deadbeef');
    });
  });

  describe('encryptVerifyString / decryptVerifyString', () => {
    it('should roundtrip verify string', async () => {
      const encrypted = await encryptVerifyString({
        password: TEST_PASSWORD,
        allowRawPassword: true,
      });
      const decrypted = await decryptVerifyString({
        password: TEST_PASSWORD,
        verifyString: encrypted,
      });
      expect(decrypted).toBe('OneKey');
    });

    it('should fail with wrong password', async () => {
      const encrypted = await encryptVerifyString({
        password: TEST_PASSWORD,
        allowRawPassword: true,
      });
      await expect(
        decryptVerifyString({
          password: 'wrongpassword',
          verifyString: encrypted,
        }),
      ).rejects.toThrow();
    });

    it('should add prefix when addPrefixString=true', async () => {
      const encrypted = await encryptVerifyString({
        password: TEST_PASSWORD,
        addPrefixString: true,
        allowRawPassword: true,
      });
      expect(encrypted.startsWith('|VS|')).toBe(true);
    });

    it('should not add prefix when addPrefixString=false', async () => {
      const encrypted = await encryptVerifyString({
        password: TEST_PASSWORD,
        addPrefixString: false,
        allowRawPassword: true,
      });
      expect(encrypted.startsWith('|VS|')).toBe(false);
    });
  });

  describe('fixV4VerifyStringToV5', () => {
    it('should return DEFAULT_VERIFY_STRING unchanged', () => {
      expect(fixV4VerifyStringToV5({ verifyString: 'OneKey' })).toBe('OneKey');
    });

    it('should add |VS| prefix if not present', () => {
      const result = fixV4VerifyStringToV5({ verifyString: 'somehexdata' });
      expect(result).toBe('|VS|somehexdata');
    });

    it('should not double-prefix', () => {
      const result = fixV4VerifyStringToV5({
        verifyString: '|VS|somehexdata',
      });
      expect(result).toBe('|VS|somehexdata');
    });
  });

  describe('verify function', () => {
    it('should verify a valid secp256k1 signature', () => {
      const { secp256k1 } = require('../curves');
      const privateKey = Buffer.from(
        'e8f32e723decf4051aefac8e2c93c9c5b214313817cdb01a1494b917c8436b35',
        'hex',
      );
      const publicKey = secp256k1.publicFromPrivate(privateKey);
      const digest = Buffer.from('Hello World');
      const signature = secp256k1.sign(privateKey, digest);

      expect(verify('secp256k1', publicKey, digest, signature)).toBe(true);
    });

    it('should reject invalid signature', () => {
      const { secp256k1 } = require('../curves');
      const privateKey = Buffer.from(
        'e8f32e723decf4051aefac8e2c93c9c5b214313817cdb01a1494b917c8436b35',
        'hex',
      );
      const publicKey = secp256k1.publicFromPrivate(privateKey);
      const digest = Buffer.from('Hello World');
      const signature = secp256k1.sign(privateKey, digest);
      // Tamper with signature
      const tampered = Buffer.from(signature);
      tampered[0] = (tampered[0] + 1) % 256;

      expect(verify('secp256k1', publicKey, digest, tampered)).toBe(false);
    });
  });

  describe('compressPublicKey / uncompressPublicKey', () => {
    it('should return compressed key unchanged for 33-byte input', () => {
      const { secp256k1 } = require('../curves');
      const privateKey = Buffer.from(
        'e8f32e723decf4051aefac8e2c93c9c5b214313817cdb01a1494b917c8436b35',
        'hex',
      );
      const compressed = secp256k1.publicFromPrivate(privateKey); // 33 bytes
      expect(compressed.length).toBe(33);
      const result = compressPublicKey('secp256k1', compressed);
      expect(result).toEqual(compressed);
    });

    it('should return uncompressed key unchanged for 65-byte input', () => {
      const { secp256k1 } = require('../curves');
      const privateKey = Buffer.from(
        'e8f32e723decf4051aefac8e2c93c9c5b214313817cdb01a1494b917c8436b35',
        'hex',
      );
      const compressed = secp256k1.publicFromPrivate(privateKey);
      const uncompressed = uncompressPublicKey('secp256k1', compressed);
      expect(uncompressed.length).toBe(65);
      const result = uncompressPublicKey('secp256k1', uncompressed);
      expect(result).toEqual(uncompressed);
    });
  });
});
