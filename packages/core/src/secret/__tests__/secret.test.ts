/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Buffer } from 'buffer';

import { DEFAULT_VERIFY_STRING } from '@onekeyhq/shared/src/consts/dbConsts';
import {
  IncorrectPassword,
  InvalidMnemonic,
} from '@onekeyhq/shared/src/errors';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import {
  CKDPriv,
  CKDPub,
  N,
  batchGetPrivateKeys,
  batchGetPublicKeys,
  batchGetPublicKeysAsync,
  compressPublicKey,
  decrypt,
  decryptImportedCredential,
  decryptRevealableSeed,
  decryptVerifyString,
  encrypt,
  encryptImportedCredential,
  encryptRevealableSeed,
  encryptVerifyString,
  fixV4VerifyStringToV5,
  generateMasterKeyFromSeed,
  generateRootFingerprintHexAsync,
  mnemonicFromEntropyAsync,
  mnemonicToRevealableSeed,
  mnemonicToSeedAsync,
  publicFromPrivate,
  revealableSeedFromTonMnemonic,
  sign,
  tonMnemonicFromEntropy,
  uncompressPublicKey,
  verify,
} from '..';

import type { ICoreImportedCredential, ICurveName } from '../../types';
import type { IBip32ExtendedKey } from '../bip32';
import type { IBip39RevealableSeed } from '../bip39';

/*
yarn test packages/core/src/secret/__tests__/secret.test.ts
*/

// Mock crypto for deterministic encryption outputs
jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomBytes: jest.fn().mockImplementation((size: number) => {
    // Return specific bytes for deterministic encryption outputs
    if (size === 32) {
      return Buffer.from(
        '94b51c8f77aa44bdf1a6071872cd89aae44fba848cf8a50c28280a9b79a56b24',
        'hex',
      );
    }
    if (size === 16) {
      return Buffer.from('d3ebac3b568ef4e5369441a40eee4a24', 'hex');
    }
    if (size === 4) {
      return Buffer.from('0efcb8ef', 'hex');
    }
    return Buffer.alloc(size, 0xde);
  }),
}));

describe('Secret Module Tests', () => {
  const TEST_PASSWORD = 'password123';
  const TEST_MNEMONIC =
    'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo vote';

  const TEST_TON_MNEMONIC =
    'outside autumn laundry state body little sauce urge pelican hospital divide tired liberty fresh atom kidney flower travel second share arrive chicken member rice';
  const TEST_TON_MNEMONIC2 =
    'mushroom run point midnight gallery access soldier captain spring ship ready awesome exhaust resource boy blur promote immune text bean seek solar route volume';

  describe('CKDPriv', () => {
    const testPassword = 'password123';
    const testSeed = Buffer.from('000102030405060708090a0b0c0d0e0f', 'hex');

    // Test vectors based on BIP32 test vectors
    const testMasterKey = {
      key: Buffer.from(
        'e8f32e723decf4051aefac8e2c93c9c5b214313817cdb01a1494b917c8436b35',
        'hex',
      ),
      chainCode: Buffer.from(
        '873dff81c02f525623fd1fe5167eac3a55a049de3d314bb42ee227ffed37d508',
        'hex',
      ),
    };

    it('should derive normal child key for secp256k1', () => {
      const encryptedParent = {
        key: encrypt(testPassword, testMasterKey.key),
        chainCode: testMasterKey.chainCode,
      };

      const childKey = CKDPriv('secp256k1', encryptedParent, 0, testPassword);

      // Decrypt and verify the derived key
      const decryptedKey = decrypt(testPassword, childKey.key);
      expect(decryptedKey.length).toBe(32);
      expect(childKey.chainCode.length).toBe(32);

      // Verify we can generate valid public key from it
      const publicKey = publicFromPrivate(
        'secp256k1',
        childKey.key,
        testPassword,
      );
      expect(publicKey.length).toBeGreaterThan(0);
    });

    it('should derive hardened child key for secp256k1', () => {
      const encryptedParent = {
        key: encrypt(testPassword, testMasterKey.key),
        chainCode: testMasterKey.chainCode,
      };

      const hardenedIndex = 0x80_00_00_00; // 2^31
      const childKey = CKDPriv(
        'secp256k1',
        encryptedParent,
        hardenedIndex,
        testPassword,
      );

      const decryptedKey = decrypt(testPassword, childKey.key);
      expect(decryptedKey.length).toBe(32);
      expect(childKey.chainCode.length).toBe(32);
    });

    it('should only support hardened derivation for ed25519', () => {
      const encryptedParent = {
        key: encrypt(testPassword, testMasterKey.key),
        chainCode: testMasterKey.chainCode,
      };

      // Normal index should throw
      expect(() => {
        CKDPriv('ed25519', encryptedParent, 0, testPassword);
      }).toThrow('Only hardened CKDPriv is supported for ed25519');

      // Hardened index should work
      const hardenedIndex = 0x80_00_00_00;
      const childKey = CKDPriv(
        'ed25519',
        encryptedParent,
        hardenedIndex,
        testPassword,
      );
      expect(childKey.key.length).toBe(96);
      expect(childKey.chainCode.length).toBe(32);
    });

    it('should throw error for invalid index', () => {
      const encryptedParent = {
        key: encrypt(testPassword, testMasterKey.key),
        chainCode: testMasterKey.chainCode,
      };

      expect(() => {
        CKDPriv('secp256k1', encryptedParent, -1, testPassword);
      }).toThrow('Overflowed.');

      expect(() => {
        CKDPriv('secp256k1', encryptedParent, 2 ** 32, testPassword);
      }).toThrow('Overflowed.');

      expect(() => {
        CKDPriv('secp256k1', encryptedParent, 1.5, testPassword);
      }).toThrow('Invalid index');
    });

    it('should derive child key for nistp256', () => {
      const encryptedParent = {
        key: encrypt(testPassword, testMasterKey.key),
        chainCode: testMasterKey.chainCode,
      };

      const childKey = CKDPriv('nistp256', encryptedParent, 0, testPassword);

      const decryptedKey = decrypt(testPassword, childKey.key);
      expect(decryptedKey.length).toBe(32);
      expect(childKey.chainCode.length).toBe(32);

      // Verify chain code is different from parent
      expect(childKey.chainCode).not.toEqual(testMasterKey.chainCode);

      // Verify we can derive multiple children
      const secondChild = CKDPriv('nistp256', childKey, 1, testPassword);
      expect(secondChild.key.length).toBeGreaterThan(0);
      expect(secondChild.chainCode.length).toBe(32);
    });

    it('should match snapshot for secp256k1', () => {
      const encryptedParent = {
        key: encrypt(testPassword, testMasterKey.key),
        chainCode: testMasterKey.chainCode,
      };

      const childKey = CKDPriv('secp256k1', encryptedParent, 0, testPassword);
      expect({
        key: childKey.key.toString('hex'),
        chainCode: childKey.chainCode.toString('hex'),
      }).toMatchSnapshot('secp256k1-child-key');

      const hardenedChildKey = CKDPriv(
        'secp256k1',
        encryptedParent,
        0x80_00_00_00,
        testPassword,
      );
      expect({
        key: hardenedChildKey.key.toString('hex'),
        chainCode: hardenedChildKey.chainCode.toString('hex'),
      }).toMatchSnapshot('secp256k1-hardened-child-key');
    });

    it('should match snapshot for ed25519', () => {
      const encryptedParent = {
        key: encrypt(testPassword, testMasterKey.key),
        chainCode: testMasterKey.chainCode,
      };

      const hardenedChildKey = CKDPriv(
        'ed25519',
        encryptedParent,
        0x80_00_00_00,
        testPassword,
      );
      expect({
        key: hardenedChildKey.key.toString('hex'),
        chainCode: hardenedChildKey.chainCode.toString('hex'),
      }).toMatchSnapshot('ed25519-hardened-child-key');
    });

    it('should match snapshot for nistp256', () => {
      const encryptedParent = {
        key: encrypt(testPassword, testMasterKey.key),
        chainCode: testMasterKey.chainCode,
      };

      const childKey = CKDPriv('nistp256', encryptedParent, 0, testPassword);
      expect({
        key: childKey.key.toString('hex'),
        chainCode: childKey.chainCode.toString('hex'),
      }).toMatchSnapshot('nistp256-child-key');
    });

    it('should derive child private keys correctly using CKDPriv', () => {
      const testMnemonic =
        'test test test test test test test test test test test junk';
      const rs = mnemonicToRevealableSeed(testMnemonic);
      const hdCredential = encryptRevealableSeed({
        rs,
        password: testPassword,
      });

      // Get seed from hdCredential
      const { seed } = decryptRevealableSeed({
        rs: hdCredential,
        password: testPassword,
      });
      const seedBuffer = Buffer.from(seed, 'hex');

      // Create revealable seed and encrypt it
      const revealableSeed = {
        entropyWithLangPrefixed: seedBuffer.toString('hex'),
        seed,
      };
      const encryptedSeed = encryptRevealableSeed({
        rs: revealableSeed,
        password: testPassword,
      });

      // Generate master key from seed
      const encryptedMasterKey = generateMasterKeyFromSeed(
        'secp256k1',
        encryptedSeed,
        testPassword,
      );

      // Decrypt the master key for CKDPriv
      const masterKey = {
        key: decrypt(testPassword, encryptedMasterKey.key),
        chainCode: encryptedMasterKey.chainCode,
      };

      // Verify key lengths
      expect(masterKey.key.length).toBe(32);
      expect(masterKey.chainCode.length).toBe(32);

      const childKey = CKDPriv(
        'secp256k1',
        encryptedMasterKey,
        0,
        testPassword,
      );
      expect(childKey).toBeDefined();
      expect(childKey.key).toBeInstanceOf(Buffer);
      expect(childKey.chainCode).toBeInstanceOf(Buffer);

      // Test hardened index derivation
      const hardenedIndex = 2_147_483_648; // 2^31, first hardened index
      const hardenedChild = CKDPriv(
        'secp256k1',
        encryptedMasterKey,
        hardenedIndex,
        testPassword,
      );
      expect(hardenedChild).toBeDefined();
      expect(hardenedChild.key).toBeInstanceOf(Buffer);
      expect(hardenedChild.chainCode).toBeInstanceOf(Buffer);

      // Test with different curves
      const nistMasterKey = {
        key: encrypt(
          testPassword,
          Buffer.from(
            '612091aaa12e22dd2abef664f8a01a82cae99ad7441b7ef8110424915c268bc2',
            'hex',
          ),
        ),
        chainCode: Buffer.from(
          'beeb672fe4621673f722f38529c07392fecaa61015c80c34f29ce8b41b3cb6ea',
          'hex',
        ),
      };
      const nistChild = CKDPriv('nistp256', nistMasterKey, 0, testPassword);
      expect(nistChild).toBeDefined();

      const edMasterKey = {
        key: encrypt(
          testPassword,
          Buffer.from('0123456789abcdef0123456789abcdef', 'hex'),
        ),
        chainCode: Buffer.from('0123456789abcdef0123456789abcdef', 'hex'),
      };
      // ed25519 only supports hardened derivation
      const edChild = CKDPriv(
        'ed25519',
        edMasterKey,
        hardenedIndex,
        testPassword,
      );
      expect(edChild).toBeDefined();

      // Test error cases
      expect(() => CKDPriv('ed25519', edMasterKey, 0, testPassword)).toThrow();
      expect(() =>
        CKDPriv('invalid-curve' as any, encryptedMasterKey, 0, testPassword),
      ).toThrow();
      expect(() =>
        CKDPriv('secp256k1', encryptedMasterKey, -1, testPassword),
      ).toThrow();
    });

    it('should handle async mnemonic and seed operations', async () => {
      const password = 'password123';
      const entropy = Buffer.from('000102030405060708090a0b0c0d0e0f', 'hex');

      // Create encrypted revealable seed from mnemonic
      const testMnemonic =
        'test test test test test test test test test test test junk';
      const rs = mnemonicToRevealableSeed(testMnemonic, 'optional passphrase');
      const hdCredential = encryptRevealableSeed({
        rs,
        password,
      });

      // Test mnemonicFromEntropyAsync
      const mnemonic = await mnemonicFromEntropyAsync({
        hdCredential,
        password,
      });
      expect(typeof mnemonic).toBe('string');
      expect(mnemonic.split(' ').length).toBe(12); // 12 words for 128-bit entropy

      // Test mnemonicToSeedAsync
      const seedBuffer = await mnemonicToSeedAsync({
        mnemonic,
        passphrase: 'optional passphrase',
      });
      expect(seedBuffer).toBeInstanceOf(Buffer);
      expect(seedBuffer.length).toBe(64); // 512 bits

      // Test generateRootFingerprintHexAsync
      const fingerprint = await generateRootFingerprintHexAsync({
        curveName: 'secp256k1',
        hdCredential,
        password,
      });
      expect(typeof fingerprint).toBe('string');
      expect(fingerprint).toMatch(/^[0-9a-f]{8}$/); // 4 bytes hex

      // Test error cases
      await expect(
        mnemonicFromEntropyAsync({
          hdCredential: 'invalid',
          password: 'wrong',
        }),
      ).rejects.toThrow();

      try {
        await mnemonicToSeedAsync({
          mnemonic: 'invalid mnemonic',
        });
        throw new Error('Should have thrown');
      } catch (error) {
        expect(error).toBeDefined();
      }

      await expect(
        generateRootFingerprintHexAsync({
          curveName: 'secp256k1' as ICurveName,
          hdCredential: 'invalid',
          password: 'wrong',
        }),
      ).rejects.toThrow();
    });

    it('should throw error for invalid curve', () => {
      const encryptedParent = {
        key: encrypt(testPassword, testMasterKey.key),
        chainCode: testMasterKey.chainCode,
      };

      expect(() => {
        CKDPriv('invalid-curve' as any, encryptedParent, 0, testPassword);
      }).toThrow('Key derivation is not supported for curve invalid-curve.');
    });
  });

  describe('mnemonicToSeedAsync', () => {
    const testMnemonic =
      'test test test test test test test test test test test junk';
    const testPassphrase = 'optional passphrase';

    it('should generate seed from mnemonic', async () => {
      const seedBuffer = await mnemonicToSeedAsync({
        mnemonic: testMnemonic,
        passphrase: testPassphrase,
      });
      expect(seedBuffer).toBeInstanceOf(Buffer);
      expect(seedBuffer.length).toBe(64); // 512 bits
    });

    it('should work without passphrase', async () => {
      const seedBuffer = await mnemonicToSeedAsync({
        mnemonic: testMnemonic,
      });
      expect(seedBuffer).toBeInstanceOf(Buffer);
      expect(seedBuffer.length).toBe(64);
    });

    it('should throw error for invalid mnemonic', async () => {
      await expect(
        mnemonicToSeedAsync({
          mnemonic: 'invalid mnemonic',
        }),
      ).rejects.toThrow();
    });

    it('should match snapshot', async () => {
      const seedBuffer = await mnemonicToSeedAsync({
        mnemonic: testMnemonic,
        passphrase: testPassphrase,
      });
      expect(seedBuffer.toString('hex')).toMatchSnapshot('mnemonic-to-seed');
    });
  });

  describe('generateRootFingerprintHexAsync', () => {
    const testPassword = 'test123';
    const testMnemonic =
      'test test test test test test test test test test test junk';
    const rs = mnemonicToRevealableSeed(testMnemonic);
    const hdCredential = encryptRevealableSeed({
      rs,
      password: testPassword,
    });

    it('should generate fingerprint for secp256k1', async () => {
      const fingerprint = await generateRootFingerprintHexAsync({
        curveName: 'secp256k1',
        hdCredential,
        password: testPassword,
      });
      expect(typeof fingerprint).toBe('string');
      expect(fingerprint).toMatch(/^[0-9a-f]{8}$/); // 4 bytes hex
    });

    it('should generate fingerprint for different curves', async () => {
      const curves: ICurveName[] = ['secp256k1', 'nistp256', 'ed25519'];
      for (const curve of curves) {
        const fingerprint = await generateRootFingerprintHexAsync({
          curveName: curve,
          hdCredential,
          password: testPassword,
        });
        expect(fingerprint).toMatch(/^[0-9a-f]{8}$/);
      }
    });

    it('should throw error for invalid curve', async () => {
      await expect(
        generateRootFingerprintHexAsync({
          curveName: 'invalid-curve' as ICurveName,
          hdCredential,
          password: testPassword,
        }),
      ).rejects.toThrow();
    });

    it('should throw error for invalid password', async () => {
      await expect(
        generateRootFingerprintHexAsync({
          curveName: 'secp256k1',
          hdCredential,
          password: 'wrong-password',
        }),
      ).rejects.toThrow();
    });

    it('should match snapshot', async () => {
      const fingerprint = await generateRootFingerprintHexAsync({
        curveName: 'secp256k1',
        hdCredential,
        password: testPassword,
      });
      expect(fingerprint).toMatchSnapshot('root-fingerprint');
    });
  });

  // Test CKDPub function
  describe('CKDPub', () => {
    it('should derive child public keys correctly', () => {
      const parentKey = {
        key: Buffer.from(
          '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
          'hex',
        ),
        chainCode: Buffer.from('0123456789abcdef0123456789abcdef', 'hex'),
      };

      const testChildKey = CKDPub('secp256k1', parentKey, 0);
      expect(testChildKey).toBeDefined();
      expect(testChildKey.key).toBeInstanceOf(Buffer);
      expect(testChildKey.chainCode).toBeInstanceOf(Buffer);

      // Test with different curves
      const nistParentKey = {
        key: Buffer.from(
          '03b5d465bc991d8f0f7fa68dafa4cce5e3c57e3d0d70b3c1b6f9e4e57aed0b1a87',
          'hex',
        ),
        chainCode: Buffer.from('0123456789abcdef0123456789abcdef', 'hex'),
      };
      const nistChildKey = CKDPub('nistp256', nistParentKey, 0);
      expect(nistChildKey).toBeDefined();
      expect(nistChildKey.key).toBeInstanceOf(Buffer);
      expect(nistChildKey.chainCode).toBeInstanceOf(Buffer);

      // Test error cases
      expect(() => CKDPub('invalid-curve' as any, parentKey, 0)).toThrow();
      expect(() => CKDPub('secp256k1', parentKey, -1)).toThrow();
      expect(() => CKDPub('secp256k1', parentKey, 2_147_483_648)).toThrow(); // Hardened index not allowed
    });

    it('should match snapshot for public key derivation', () => {
      const parentKey = {
        key: Buffer.from(
          '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
          'hex',
        ),
        chainCode: Buffer.from('0123456789abcdef0123456789abcdef', 'hex'),
      };
      const extendedKey = CKDPub('secp256k1', parentKey, 0);
      expect({
        key: extendedKey.key.toString('hex'),
        chainCode: extendedKey.chainCode.toString('hex'),
      }).toMatchSnapshot();
    });
  });

  describe('batchGetPrivateKeys', () => {
    const testPassword = 'password123';
    const testSeed: IBip39RevealableSeed = {
      entropyWithLangPrefixed: '00112233445566778899aabbccddeeff',
      seed: '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff',
    };

    const encryptedSeed = encryptRevealableSeed({
      rs: testSeed,
      password: testPassword,
    });

    it('should derive private keys for valid paths', () => {
      const curveName: ICurveName = 'secp256k1';
      const prefix = 'm';
      const relPaths = ['0/0', '0/1', "44'/0'/0'/0/0"];

      const privateKeys = batchGetPrivateKeys(
        curveName,
        encryptedSeed,
        testPassword,
        prefix,
        relPaths,
      );

      expect(privateKeys).toHaveLength(3);
      privateKeys.forEach((key, index) => {
        expect(key).toHaveProperty('path');
        expect(key).toHaveProperty('parentFingerPrint');
        expect(key).toHaveProperty('extendedKey');
        expect(key.extendedKey).toHaveProperty('key');
        expect(key.extendedKey).toHaveProperty('chainCode');
        expect(Buffer.isBuffer(key.parentFingerPrint)).toBe(true);
        expect(Buffer.isBuffer(key.extendedKey.key)).toBe(true);
        expect(Buffer.isBuffer(key.extendedKey.chainCode)).toBe(true);
      });
    });

    it('should throw error for invalid curve name', () => {
      const curveName = 'invalid-curve' as ICurveName;
      const prefix = 'm';
      const relPaths = ['0/0'];

      expect(() =>
        batchGetPrivateKeys(
          curveName,
          encryptedSeed,
          testPassword,
          prefix,
          relPaths,
        ),
      ).toThrow('Key derivation is not supported for curve invalid-curve.');
    });

    it('should throw error for invalid password', () => {
      const curveName: ICurveName = 'secp256k1';
      const prefix = 'm';
      const relPaths = ['0/0'];

      expect(() =>
        batchGetPrivateKeys(
          curveName,
          encryptedSeed,
          'wrong-password',
          prefix,
          relPaths,
        ),
      ).toThrow();
    });

    it('should handle hardened and non-hardened derivation paths', () => {
      const curveName: ICurveName = 'secp256k1';
      const prefix = 'm';
      const relPaths = ["44'/0'", '0/0', "1'/0/0"];

      const privateKeys = batchGetPrivateKeys(
        curveName,
        encryptedSeed,
        testPassword,
        prefix,
        relPaths,
      );

      expect(privateKeys).toHaveLength(3);
      expect(privateKeys[0].path).toBe("m/44'/0'");
      expect(privateKeys[1].path).toBe('m/0/0');
      expect(privateKeys[2].path).toBe("m/1'/0/0");
    });

    it('should match snapshot', () => {
      const curveName: ICurveName = 'secp256k1';
      const prefix = 'm';
      const relPaths = ['0/0'];

      const privateKeys = batchGetPrivateKeys(
        curveName,
        encryptedSeed,
        testPassword,
        prefix,
        relPaths,
      );

      expect(
        privateKeys.map((key) => ({
          path: key.path,
          parentFingerPrint: key.parentFingerPrint.toString('hex'),
          extendedKey: {
            key: key.extendedKey.key.toString('hex'),
            chainCode: key.extendedKey.chainCode.toString('hex'),
          },
        })),
      ).toMatchSnapshot('batch-private-keys');
    });
  });

  describe('batchGetPublicKeys', () => {
    const testPassword = 'password123';
    const testSeed: IBip39RevealableSeed = {
      entropyWithLangPrefixed: '00112233445566778899aabbccddeeff',
      seed: '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff',
    };

    const encryptedSeed = encryptRevealableSeed({
      rs: testSeed,
      password: testPassword,
    });

    it('should generate public keys matching private keys', () => {
      const curveName: ICurveName = 'secp256k1';
      const prefix = 'm';
      const relPaths = ['0/0', '0/1', "44'/0'/0'/0/0"];

      const privateKeys = batchGetPrivateKeys(
        curveName,
        encryptedSeed,
        testPassword,
        prefix,
        relPaths,
      );

      const publicKeys = batchGetPublicKeys(
        curveName,
        encryptedSeed,
        testPassword,
        prefix,
        relPaths,
      );

      expect(publicKeys).toHaveLength(privateKeys.length);
      publicKeys.forEach((pubKey, index) => {
        expect(pubKey.path).toBe(privateKeys[index].path);
        expect(pubKey.parentFingerPrint).toEqual(
          privateKeys[index].parentFingerPrint,
        );
        expect(Buffer.isBuffer(pubKey.extendedKey.key)).toBe(true);
        expect(Buffer.isBuffer(pubKey.extendedKey.chainCode)).toBe(true);
        // Public key should be different from private key
        expect(pubKey.extendedKey.key).not.toEqual(
          privateKeys[index].extendedKey.key,
        );
      });
    });

    it('should throw error for invalid curve name', () => {
      const curveName = 'invalid-curve' as ICurveName;
      const prefix = 'm';
      const relPaths = ['0/0'];

      expect(() =>
        batchGetPublicKeys(
          curveName,
          encryptedSeed,
          testPassword,
          prefix,
          relPaths,
        ),
      ).toThrow('Key derivation is not supported for curve invalid-curve.');
    });

    it('should throw error for invalid password', () => {
      const curveName: ICurveName = 'secp256k1';
      const prefix = 'm';
      const relPaths = ['0/0'];

      expect(() =>
        batchGetPublicKeys(
          curveName,
          encryptedSeed,
          'wrong-password',
          prefix,
          relPaths,
        ),
      ).toThrow();
    });

    it('should handle hardened and non-hardened derivation paths', () => {
      const curveName: ICurveName = 'secp256k1';
      const prefix = 'm';
      const relPaths = ["44'/0'", '0/0', "1'/0/0"];

      const publicKeys = batchGetPublicKeys(
        curveName,
        encryptedSeed,
        testPassword,
        prefix,
        relPaths,
      );

      expect(publicKeys).toHaveLength(3);
      expect(publicKeys[0].path).toBe("m/44'/0'");
      expect(publicKeys[1].path).toBe('m/0/0');
      expect(publicKeys[2].path).toBe("m/1'/0/0");
    });

    it('should match snapshot', () => {
      const curveName: ICurveName = 'secp256k1';
      const prefix = 'm';
      const relPaths = ['0/0'];

      const publicKeys = batchGetPublicKeys(
        curveName,
        encryptedSeed,
        testPassword,
        prefix,
        relPaths,
      );

      expect(
        publicKeys.map((key) => ({
          path: key.path,
          parentFingerPrint: key.parentFingerPrint.toString('hex'),
          extendedKey: {
            key: key.extendedKey.key.toString('hex'),
            chainCode: key.extendedKey.chainCode.toString('hex'),
          },
        })),
      ).toMatchSnapshot('batch-public-keys');
    });
  });

  describe('batchGetPublicKeysAsync', () => {
    const testPassword = 'password123';
    const testSeed: IBip39RevealableSeed = {
      entropyWithLangPrefixed: '00112233445566778899aabbccddeeff',
      seed: '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff',
    };

    const encryptedSeed = encryptRevealableSeed({
      rs: testSeed,
      password: testPassword,
    });

    beforeEach(() => {
      // do nothing
    });

    it('should return same results as batchGetPublicKeys in non-native environment', async () => {
      const curveName: ICurveName = 'secp256k1';
      const prefix = 'm';
      const relPaths = ['0/0', '0/1', "44'/0'/0'/0/0"];

      const syncResult = batchGetPublicKeys(
        curveName,
        encryptedSeed,
        testPassword,
        prefix,
        relPaths,
      );

      const asyncResult = await batchGetPublicKeysAsync({
        curveName,
        hdCredential: encryptedSeed,
        password: testPassword,
        prefix,
        relPaths,
      });

      expect(asyncResult).toEqual(syncResult);
    });

    it('should handle native environment correctly', async () => {
      const result = await batchGetPublicKeysAsync({
        curveName: 'secp256k1',
        hdCredential: encryptedSeed,
        password: testPassword,
        prefix: 'm',
        relPaths: ['0/0'],
      });

      expect(result).toHaveLength(1);
      expect(result[0].path).toBe('m/0/0');
      expect(Buffer.isBuffer(result[0].parentFingerPrint)).toBe(true);
      expect(result[0].parentFingerPrint.toString('hex')).toBe('0efcb8ef');
      expect(Buffer.isBuffer(result[0].extendedKey.key)).toBe(true);
      expect(result[0].extendedKey.key.toString('hex')).toBe(
        '034b009b02f0db41298e367d4aa2b1d8b4512d16a014d3da5cc9d8854987e3cb67',
      );
      expect(Buffer.isBuffer(result[0].extendedKey.chainCode)).toBe(true);
      expect(result[0].extendedKey.chainCode.toString('hex')).toBe(
        '2b30a28ef711c984c636a28d41821bc927332cbcd1e0f7220cd9ebc9ebb8aa0a',
      );
    });

    it('should match snapshot', async () => {
      const result = await batchGetPublicKeysAsync({
        curveName: 'secp256k1',
        hdCredential: encryptedSeed,
        password: testPassword,
        prefix: 'm',
        relPaths: ['0/0'],
      });

      expect(
        result.map((key) => ({
          path: key.path,
          parentFingerPrint: key.parentFingerPrint.toString('hex'),
          extendedKey: {
            key: key.extendedKey.key.toString('hex'),
            chainCode: key.extendedKey.chainCode.toString('hex'),
          },
        })),
      ).toMatchSnapshot('batch-public-keys-async');
    });

    afterEach(() => {
      // do nothing
    });
  });

  describe('compressPublicKey', () => {
    it('should compress public keys correctly', () => {
      // Test with uncompressed secp256k1 public key
      const uncompressedKey = Buffer.from(
        '04a0434d9e47f3c86235477c7b1ae6ae5d3442d49b1943c2b752a68e2a47e247c7893aba425419bc27a3b6c7e693a24c696f794c2ed877a1593cbee53b037368d7',
        'hex',
      );
      const compressedKey = compressPublicKey('secp256k1', uncompressedKey);
      expect(compressedKey).toBeInstanceOf(Buffer);
      expect(compressedKey.length).toBe(33); // Compressed public key length

      // Test with already compressed key
      const alreadyCompressed = Buffer.from(
        '02a0434d9e47f3c86235477c7b1ae6ae5d3442d49b1943c2b752a68e2a47e247c7',
        'hex',
      );
      const recompressed = compressPublicKey('secp256k1', alreadyCompressed);
      expect(recompressed).toEqual(alreadyCompressed);

      // Test with different curves
      const nistUncompressed = Buffer.from(
        '04b5d465bc991d8f0f7fa68dafa4cce5e3c57e3d0d70b3c1b6f9e4e57aed0b1a87d2390d1ca0323c898db9f3e51c4a7ead23108dd9c41d4d99f4ce0a9307048d54',
        'hex',
      );
      const nistCompressed = compressPublicKey('nistp256', nistUncompressed);
      expect(nistCompressed.length).toBe(33);

      // Test error cases
      expect(() =>
        compressPublicKey('invalid-curve' as any, uncompressedKey),
      ).toThrow();
      expect(() =>
        compressPublicKey('secp256k1', Buffer.from('invalid')),
      ).toThrow();
    });

    it('should match snapshot for compressed public key', () => {
      const uncompressedKey = Buffer.from(
        '04a0434d9e47f3c86235477c7b1ae6ae5d3442d49b1943c2b752a68e2a47e247c7893aba425419bc27a3b6c7e693a24c696f794c2ed877a1593cbee53b037368d7',
        'hex',
      );
      const compressedKey = compressPublicKey('secp256k1', uncompressedKey);
      expect(compressedKey.toString('hex')).toMatchSnapshot();
    });
  });

  describe('decryptImportedCredential', () => {
    const testPassword = 'test123';
    const testCredential: ICoreImportedCredential = {
      privateKey: '0123456789abcdef',
    };

    it('should decrypt imported credential correctly', () => {
      // First encrypt the credential
      const encryptedCredential = encryptImportedCredential({
        credential: testCredential,
        password: testPassword,
      });

      // Then decrypt and verify
      const decryptedCredential = decryptImportedCredential({
        credential: encryptedCredential,
        password: testPassword,
      });

      expect(decryptedCredential).toEqual(testCredential);
    });

    it('should handle credential with prefix correctly', () => {
      const encryptedCredential = encryptImportedCredential({
        credential: testCredential,
        password: testPassword,
      });

      expect(encryptedCredential.startsWith('|PK|')).toBe(true);

      const decryptedCredential = decryptImportedCredential({
        credential: encryptedCredential,
        password: testPassword,
      });

      expect(decryptedCredential).toEqual(testCredential);
    });

    it('should throw error for invalid password', () => {
      const encryptedCredential = encryptImportedCredential({
        credential: testCredential,
        password: testPassword,
      });

      expect(() =>
        decryptImportedCredential({
          credential: encryptedCredential,
          password: 'wrong-password',
        }),
      ).toThrow();
    });

    it('should throw error for invalid credential format', () => {
      expect(() =>
        decryptImportedCredential({
          credential: '|PK|invalid-data',
          password: testPassword,
        }),
      ).toThrow();
    });

    it('should match snapshot for decrypted credential', () => {
      const encryptedCredential = encryptImportedCredential({
        credential: testCredential,
        password: testPassword,
      });

      expect(
        decryptImportedCredential({
          credential: encryptedCredential,
          password: testPassword,
        }),
      ).toMatchSnapshot();
    });
  });

  describe('decryptRevealableSeed', () => {
    const testPassword = 'test123';
    const testSeed: IBip39RevealableSeed = {
      entropyWithLangPrefixed: '00112233445566778899aabbccddeeff',
      seed: '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff',
    };

    it('should decrypt revealable seed correctly', () => {
      // First encrypt the seed
      const encryptedSeed = encryptRevealableSeed({
        rs: testSeed,
        password: testPassword,
      });

      // Then decrypt and verify
      const decryptedSeed = decryptRevealableSeed({
        rs: encryptedSeed,
        password: testPassword,
      });

      expect(decryptedSeed).toEqual(testSeed);
    });

    it('should throw error for invalid password', () => {
      const encryptedSeed = encryptRevealableSeed({
        rs: testSeed,
        password: testPassword,
      });

      expect(() =>
        decryptRevealableSeed({
          rs: encryptedSeed,
          password: 'wrong-password',
        }),
      ).toThrow();
    });

    it('should throw error for invalid seed format', () => {
      expect(() =>
        decryptRevealableSeed({
          rs: 'invalid-seed-data',
          password: testPassword,
        }),
      ).toThrow();
    });

    it('should match snapshot for decrypted seed', () => {
      const encryptedSeed = encryptRevealableSeed({
        rs: testSeed,
        password: testPassword,
      });

      expect(
        decryptRevealableSeed({
          rs: encryptedSeed,
          password: testPassword,
        }),
      ).toMatchSnapshot();
    });
  });

  describe('decryptVerifyString', () => {
    const testPassword = 'test123';

    it('should decrypt verify string correctly', () => {
      // First encrypt the string
      const encryptedString = encryptVerifyString({
        password: testPassword,
      });

      // Then decrypt and verify
      const decryptedString = decryptVerifyString({
        verifyString: encryptedString,
        password: testPassword,
      });

      expect(decryptedString).toBe(DEFAULT_VERIFY_STRING);
    });

    it('should handle string with prefix correctly', () => {
      const encryptedString = encryptVerifyString({
        password: testPassword,
        addPrefixString: true,
      });

      expect(encryptedString.startsWith('|VS|')).toBe(true);

      const decryptedString = decryptVerifyString({
        verifyString: encryptedString,
        password: testPassword,
      });

      expect(decryptedString).toBe(DEFAULT_VERIFY_STRING);
    });

    it('should throw error for invalid password', () => {
      const encryptedString = encryptVerifyString({
        password: testPassword,
      });

      expect(() =>
        decryptVerifyString({
          verifyString: encryptedString,
          password: 'wrong-password',
        }),
      ).toThrow();
    });

    it('should throw error for invalid string format', () => {
      expect(() =>
        decryptVerifyString({
          verifyString: '|VS|invalid-data',
          password: testPassword,
        }),
      ).toThrow();
    });

    it('should match snapshot for decrypted string', () => {
      const encryptedString = encryptVerifyString({
        password: testPassword,
      });

      expect(
        decryptVerifyString({
          verifyString: encryptedString,
          password: testPassword,
        }),
      ).toMatchSnapshot();
    });
  });

  describe('encryptImportedCredential', () => {
    const testPassword = 'test123';
    const testCredential: ICoreImportedCredential = {
      privateKey: '0123456789abcdef',
    };

    it('should encrypt credential correctly', () => {
      const encryptedCredential = encryptImportedCredential({
        credential: testCredential,
        password: testPassword,
      });

      expect(encryptedCredential.startsWith('|PK|')).toBe(true);

      // Verify we can decrypt it back
      const decryptedCredential = decryptImportedCredential({
        credential: encryptedCredential,
        password: testPassword,
      });

      expect(decryptedCredential).toEqual(testCredential);
    });

    it('should handle different private key formats', () => {
      const longKeyCredential: ICoreImportedCredential = {
        privateKey:
          '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      };

      const encryptedCredential = encryptImportedCredential({
        credential: longKeyCredential,
        password: testPassword,
      });

      const decryptedCredential = decryptImportedCredential({
        credential: encryptedCredential,
        password: testPassword,
      });

      expect(decryptedCredential).toEqual(longKeyCredential);
    });

    it('should throw error for empty private key', () => {
      const invalidCredential = {
        privateKey: '',
      };

      expect(() =>
        encryptImportedCredential({
          credential: invalidCredential as ICoreImportedCredential,
          password: testPassword,
        }),
      ).toThrow();
    });

    it('should match snapshot', () => {
      const encryptedCredential = encryptImportedCredential({
        credential: testCredential,
        password: testPassword,
      });

      expect(encryptedCredential).toMatchSnapshot();
    });
  });

  describe('encryptRevealableSeed', () => {
    const testPassword = 'test123';
    const testSeed: IBip39RevealableSeed = {
      entropyWithLangPrefixed: '0123456789abcdef0123456789abcdef',
      seed: 'deadbeefdeadbeefdeadbeefdeadbeef',
    };

    it('should encrypt seed correctly', () => {
      const encryptedSeed = encryptRevealableSeed({
        rs: testSeed,
        password: testPassword,
      });

      // Verify we can decrypt it back
      const decryptedSeed = decryptRevealableSeed({
        rs: encryptedSeed,
        password: testPassword,
      });

      expect(decryptedSeed).toEqual(testSeed);
    });

    it('should handle different seed lengths', () => {
      const longSeed: IBip39RevealableSeed = {
        entropyWithLangPrefixed:
          '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        seed: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
      };

      const encryptedSeed = encryptRevealableSeed({
        rs: longSeed,
        password: testPassword,
      });

      const decryptedSeed = decryptRevealableSeed({
        rs: encryptedSeed,
        password: testPassword,
      });

      expect(decryptedSeed).toEqual(longSeed);
    });

    it('should throw error for invalid seed object', () => {
      const invalidSeed = {
        entropyWithLangPrefixed: '',
        seed: '',
      };

      expect(() =>
        encryptRevealableSeed({
          rs: invalidSeed as IBip39RevealableSeed,
          password: testPassword,
        }),
      ).toThrow();
    });

    it('should match snapshot', () => {
      const encryptedSeed = encryptRevealableSeed({
        rs: testSeed,
        password: testPassword,
      });

      expect(encryptedSeed).toMatchSnapshot();
    });
  });

  describe('publicFromPrivate', () => {
    const testPassword = 'test123';
    const testPrivateKey = Buffer.from(
      'e8f32e723decf4051aefac8e2c93c9c5b214313817cdb01a1494b917c8436b35',
      'hex',
    );
    const encryptedPrivateKey = encrypt(testPassword, testPrivateKey);

    it('should generate public key for secp256k1', () => {
      const publicKey = publicFromPrivate(
        'secp256k1',
        encryptedPrivateKey,
        testPassword,
      );
      expect(publicKey).toBeInstanceOf(Buffer);
      expect(publicKey.length).toBeGreaterThan(0);
      expect(publicKey.toString('hex')).toMatchSnapshot('secp256k1-public-key');
    });

    it('should generate public key for nistp256', () => {
      const publicKey = publicFromPrivate(
        'nistp256',
        encryptedPrivateKey,
        testPassword,
      );
      expect(publicKey).toBeInstanceOf(Buffer);
      expect(publicKey.length).toBeGreaterThan(0);
      expect(publicKey.toString('hex')).toMatchSnapshot('nistp256-public-key');
    });

    it('should generate public key for ed25519', () => {
      const publicKey = publicFromPrivate(
        'ed25519',
        encryptedPrivateKey,
        testPassword,
      );
      expect(publicKey).toBeInstanceOf(Buffer);
      expect(publicKey.length).toBeGreaterThan(0);
      expect(publicKey.toString('hex')).toMatchSnapshot('ed25519-public-key');
    });

    it('should throw error for invalid curve', () => {
      expect(() =>
        publicFromPrivate(
          'invalid-curve' as ICurveName,
          encryptedPrivateKey,
          testPassword,
        ),
      ).toThrow();
    });

    it('should throw error for invalid password', () => {
      expect(() =>
        publicFromPrivate('secp256k1', encryptedPrivateKey, 'wrong-password'),
      ).toThrow(IncorrectPassword);
    });
  });

  describe('encryptVerifyString', () => {
    const testPassword = 'test123';

    it('should encrypt string correctly', () => {
      const encryptedString = encryptVerifyString({
        password: testPassword,
      });

      // Verify we can decrypt it back
      const decryptedString = decryptVerifyString({
        verifyString: encryptedString,
        password: testPassword,
      });

      expect(decryptedString).toBe('OneKey');
    });

    it('should handle prefix option', () => {
      const withPrefix = encryptVerifyString({
        password: testPassword,
        addPrefixString: true,
      });

      expect(withPrefix.startsWith('|VS|')).toBe(true);

      const withoutPrefix = encryptVerifyString({
        password: testPassword,
        addPrefixString: false,
      });

      expect(withoutPrefix.startsWith('|VS|')).toBe(false);

      // Both should decrypt correctly
      expect(
        decryptVerifyString({
          verifyString: withPrefix,
          password: testPassword,
        }),
      ).toBe('OneKey');

      expect(
        decryptVerifyString({
          verifyString: withoutPrefix,
          password: testPassword,
        }),
      ).toBe('OneKey');
    });

    it('should throw error for empty password', () => {
      expect(() =>
        encryptVerifyString({
          password: '',
        }),
      ).toThrow();
    });

    it('should match snapshot', () => {
      const encryptedString = encryptVerifyString({
        password: testPassword,
      });

      expect(encryptedString).toMatchSnapshot();
    });
  });

  describe('fixV4VerifyStringToV5', () => {
    const defaultVerifyString = 'OneKey';

    it('should not modify DEFAULT_VERIFY_STRING', () => {
      const result = fixV4VerifyStringToV5({
        verifyString: defaultVerifyString,
      });
      expect(result).toBe(defaultVerifyString);
    });

    it('should add prefix if missing', () => {
      const testString = 'abc123';
      const result = fixV4VerifyStringToV5({
        verifyString: testString,
      });
      expect(result).toBe('|VS|abc123');
    });

    it('should not duplicate prefix if already present', () => {
      const testString = '|VS|abc123';
      const result = fixV4VerifyStringToV5({
        verifyString: testString,
      });
      expect(result).toBe('|VS|abc123');
    });

    it('should match snapshot', () => {
      const result = fixV4VerifyStringToV5({
        verifyString: 'test123',
      });
      expect(result).toMatchSnapshot();
    });
  });

  describe('generateMasterKeyFromSeed', () => {
    const testRevealableSeed = mnemonicToRevealableSeed(TEST_MNEMONIC);

    const encryptedSeed = encryptRevealableSeed({
      rs: testRevealableSeed,
      password: TEST_PASSWORD,
    });

    it('should generate master key for secp256k1', () => {
      const masterKey = generateMasterKeyFromSeed(
        'secp256k1',
        encryptedSeed,
        TEST_PASSWORD,
      );
      expect(masterKey.key).toBeInstanceOf(Buffer);
      expect(masterKey.chainCode).toBeInstanceOf(Buffer);
      expect(masterKey.key.length).toBe(96);
      expect(masterKey.chainCode.length).toBe(32);
    });

    it('should generate master key for nistp256', () => {
      const masterKey = generateMasterKeyFromSeed(
        'nistp256',
        encryptedSeed,
        TEST_PASSWORD,
      );
      expect(masterKey.key).toBeInstanceOf(Buffer);
      expect(masterKey.chainCode).toBeInstanceOf(Buffer);
      expect(masterKey.key.length).toBe(96);
      expect(masterKey.chainCode.length).toBe(32);
    });

    it('should generate master key for ed25519', () => {
      const masterKey = generateMasterKeyFromSeed(
        'ed25519',
        encryptedSeed,
        TEST_PASSWORD,
      );
      expect(masterKey.key).toBeInstanceOf(Buffer);
      expect(masterKey.chainCode).toBeInstanceOf(Buffer);
      expect(masterKey.key.length).toBe(96);
      expect(masterKey.chainCode.length).toBe(32);
    });

    it('should throw error for invalid curve', () => {
      expect(() => {
        generateMasterKeyFromSeed(
          'invalid-curve' as any,
          encryptedSeed,
          TEST_PASSWORD,
        );
      }).toThrow('Key derivation is not supported for curve invalid-curve.');
    });

    it('should throw error for invalid password', () => {
      expect(() => {
        generateMasterKeyFromSeed('secp256k1', encryptedSeed, 'wrong-password');
      }).toThrow('IncorrectPassword');
    });

    it('should match snapshot', () => {
      const masterKey = generateMasterKeyFromSeed(
        'secp256k1',
        encryptedSeed,
        TEST_PASSWORD,
      );
      expect({
        key: masterKey.key.toString('hex'),
        chainCode: masterKey.chainCode.toString('hex'),
      }).toMatchSnapshot();
    });
  });

  describe('mnemonicFromEntropyAsync', () => {
    const testRevealableSeed = mnemonicToRevealableSeed(TEST_MNEMONIC);

    const encryptedSeed = encryptRevealableSeed({
      rs: testRevealableSeed,
      password: TEST_PASSWORD,
    });

    it('should generate mnemonic from entropy', async () => {
      const mnemonic = await mnemonicFromEntropyAsync({
        hdCredential: encryptedSeed,
        password: TEST_PASSWORD,
      });
      expect(typeof mnemonic).toBe('string');
      expect(mnemonic.split(' ').length).toBe(24); // 24 words for 256-bit entropy
    });

    it('should throw error for invalid password', async () => {
      await expect(
        mnemonicFromEntropyAsync({
          hdCredential: encryptedSeed,
          password: 'wrong-password',
        }),
      ).rejects.toThrow(IncorrectPassword);
    });

    it('should match snapshot', async () => {
      const mnemonic = await mnemonicFromEntropyAsync({
        hdCredential: encryptedSeed,
        password: TEST_PASSWORD,
      });
      expect(mnemonic).toMatchSnapshot();
    });
  });

  describe('N', () => {
    const testPassword = 'test123';
    const testMasterKey: IBip32ExtendedKey = {
      key: encrypt(
        testPassword,
        Buffer.from('0123456789abcdef0123456789abcdef', 'hex'),
      ),
      chainCode: Buffer.from('0123456789abcdef0123456789abcdef', 'hex'),
    };

    it('should derive public key from private key', () => {
      const publicKey = N('secp256k1', testMasterKey, testPassword);
      expect(publicKey).toBeDefined();
      expect(publicKey.key).toBeInstanceOf(Buffer);
      expect(publicKey.chainCode).toEqual(testMasterKey.chainCode);
    });

    it('should work with different curves', () => {
      const curves: ICurveName[] = ['secp256k1', 'nistp256', 'ed25519'];
      curves.forEach((curve) => {
        const publicKey = N(curve, testMasterKey, testPassword);
        expect(publicKey).toBeDefined();
        expect(publicKey.key).toBeInstanceOf(Buffer);
        expect(publicKey.chainCode).toEqual(testMasterKey.chainCode);
      });
    });

    it('should throw error for invalid curve', () => {
      expect(() =>
        N('invalid-curve' as ICurveName, testMasterKey, testPassword),
      ).toThrow();
    });

    it('should match snapshot', () => {
      const publicKey = N('secp256k1', testMasterKey, testPassword);
      expect({
        key: publicKey.key.toString('hex'),
        chainCode: publicKey.chainCode.toString('hex'),
      }).toMatchSnapshot();
    });
  });

  describe('sign', () => {
    const testPassword = 'test123';
    const testPrivateKey = Buffer.from(
      '0123456789abcdef0123456789abcdef',
      'hex',
    );
    const testDigest = Buffer.from('0123456789abcdef0123456789abcdef', 'hex');
    const encryptedPrivateKey = encrypt(testPassword, testPrivateKey);

    it('should sign digest correctly with secp256k1', () => {
      const signature = sign(
        'secp256k1',
        encryptedPrivateKey,
        testDigest,
        testPassword,
      );
      expect(signature).toBeInstanceOf(Buffer);
      expect(signature.length).toBe(65); // secp256k1 signature is 64 bytes

      const publicKey = publicFromPrivate(
        'secp256k1',
        encryptedPrivateKey,
        testPassword,
      );
      expect(verify('secp256k1', publicKey, testDigest, signature)).toBe(true);

      // Verify signature with wrong public key fails
      const wrongPrivateKey = Buffer.from(
        '1123456789abcdef0123456789abcdef',
        'hex',
      );
      const wrongPublicKey = publicFromPrivate(
        'secp256k1',
        encrypt(testPassword, wrongPrivateKey),
        testPassword,
      );
      expect(verify('secp256k1', wrongPublicKey, testDigest, signature)).toBe(
        false,
      );
    });

    it('should sign digest correctly with nistp256', () => {
      const signature = sign(
        'nistp256',
        encryptedPrivateKey,
        testDigest,
        testPassword,
      );
      expect(signature).toBeInstanceOf(Buffer);
      expect(signature.length).toBe(65); // nistp256 signature is 64 bytes

      const publicKey = publicFromPrivate(
        'nistp256',
        encryptedPrivateKey,
        testPassword,
      );
      expect(verify('nistp256', publicKey, testDigest, signature)).toBe(true);
      expect(signature.toString('hex')).toMatchSnapshot('nistp256-signature');
    });

    it('should sign digest correctly with ed25519', () => {
      const signature = sign(
        'ed25519',
        encryptedPrivateKey,
        testDigest,
        testPassword,
      );
      expect(signature).toBeInstanceOf(Buffer);
      expect(signature.length).toBe(64); // ed25519 signature is 64 bytes

      const publicKey = publicFromPrivate(
        'ed25519',
        encryptedPrivateKey,
        testPassword,
      );
      expect(verify('ed25519', publicKey, testDigest, signature)).toBe(true);
      expect(signature.toString('hex')).toMatchSnapshot('ed25519-signature');
    });

    it('should throw error for invalid curve', () => {
      expect(() =>
        sign(
          'invalid-curve' as ICurveName,
          encryptedPrivateKey,
          testDigest,
          testPassword,
        ),
      ).toThrow();
    });

    it('should throw error for invalid password', () => {
      expect(() =>
        sign('secp256k1', encryptedPrivateKey, testDigest, 'wrong-password'),
      ).toThrow();
    });

    it('should match snapshot', () => {
      const signature = sign(
        'secp256k1',
        encryptedPrivateKey,
        testDigest,
        testPassword,
      );
      expect(signature.toString('hex')).toMatchSnapshot();
    });
  });

  describe('tonMnemonicFromEntropy', () => {
    const testPassword = 'test123';

    const encryptedSeed = revealableSeedFromTonMnemonic(
      TEST_TON_MNEMONIC,
      testPassword,
    );
    const encryptedSeed2 = revealableSeedFromTonMnemonic(
      TEST_TON_MNEMONIC2,
      testPassword,
    );
    // const revealableSeed = tonMnemonicToRevealableSeed(TEST_TON_MNEMONIC);

    it('should generate valid TON mnemonic from entropy', () => {
      const mnemonic = tonMnemonicFromEntropy(encryptedSeed, testPassword);
      expect(typeof mnemonic).toBe('string');
      expect(mnemonic.split(' ').length).toBe(24); // TON uses 24 words
      expect(mnemonic).toMatchSnapshot('ton-mnemonic');

      // Verify the mnemonic can be converted back to a revealable seed
      const encryptedSeedFromMnemonic = revealableSeedFromTonMnemonic(
        mnemonic,
        testPassword,
      );
      expect(encryptedSeedFromMnemonic).toBeDefined();
    });

    it('should throw error for invalid entropy length', () => {
      const invalidEntropy = '0001'; // Too short
      expect(() =>
        tonMnemonicFromEntropy(invalidEntropy, testPassword),
      ).toThrow();
    });

    it('should generate different mnemonics for different entropy', () => {
      const mnemonic1 = tonMnemonicFromEntropy(encryptedSeed, testPassword);
      const mnemonic2 = tonMnemonicFromEntropy(encryptedSeed2, testPassword);

      expect(mnemonic1).not.toBe(mnemonic2);
      expect(mnemonic1).toMatchSnapshot('ton-mnemonic-1');
      expect(mnemonic2).toMatchSnapshot('ton-mnemonic-2');
    });

    it('should convert entropy to TON mnemonic', () => {
      const mnemonic = tonMnemonicFromEntropy(encryptedSeed, testPassword);
      expect(typeof mnemonic).toBe('string');
      expect(mnemonic.split(' ').length).toBe(24); // TON uses 24 words
    });

    it('should throw error for invalid password', () => {
      expect(() =>
        tonMnemonicFromEntropy(encryptedSeed, 'wrong-password'),
      ).toThrow();
    });

    it('should match snapshot', () => {
      const mnemonic = tonMnemonicFromEntropy(encryptedSeed, testPassword);
      expect(mnemonic).toMatchSnapshot();
    });
  });

  describe('revealableSeedFromTonMnemonic', () => {
    const testPassword = 'test123';
    const testMnemonic =
      'abandon math mimic master filter design carbon crystal rookie group knife young abandon math mimic master filter design carbon crystal rookie group knife young abandon today';

    it('should convert TON mnemonic to revealable seed with proper UTF-8 encoding', () => {
      const encryptedSeed = revealableSeedFromTonMnemonic(
        testMnemonic,
        testPassword,
      );
      expect(encryptedSeed).toBeDefined();

      const decryptedSeed = decryptRevealableSeed({
        rs: encryptedSeed,
        password: testPassword,
      });

      // Verify UTF-8 encoding is preserved
      expect(decryptedSeed.entropyWithLangPrefixed).toBe(
        bufferUtils.bytesToHex(Buffer.from(testMnemonic, 'utf-8')),
      );
      expect(decryptedSeed.seed).toBe(
        bufferUtils.bytesToHex(Buffer.from(testMnemonic, 'utf-8')),
      );
    });

    // TODO: revealableSeedFromTonMnemonic should validate mnemonic before return, should make it async
    it.skip('should throw InvalidMnemonic for malformed input', () => {
      expect(() => revealableSeedFromTonMnemonic('', testPassword)).toThrow(
        'Invalid seed object',
      );
      expect(() =>
        revealableSeedFromTonMnemonic('invalid mnemonic', testPassword),
      ).toThrow(InvalidMnemonic);
      // Test with non-UTF8 characters
      expect(() =>
        revealableSeedFromTonMnemonic('\uD800', testPassword),
      ).toThrow(InvalidMnemonic);
    });

    it('should match snapshot', () => {
      const encryptedSeed = revealableSeedFromTonMnemonic(
        testMnemonic,
        testPassword,
      );
      expect(encryptedSeed).toMatchSnapshot();
    });
  });

  describe('verify', () => {
    const testPassword = 'test123';
    const testPrivateKey = Buffer.from(
      '0123456789abcdef0123456789abcdef',
      'hex',
    );
    const testDigest = Buffer.from('0123456789abcdef0123456789abcdef', 'hex');
    const encryptedPrivateKey = encrypt(testPassword, testPrivateKey);

    it('should verify secp256k1 signatures correctly', () => {
      const signature = sign(
        'secp256k1',
        encryptedPrivateKey,
        testDigest,
        testPassword,
      );
      const publicKey = publicFromPrivate(
        'secp256k1',
        encryptedPrivateKey,
        testPassword,
      );

      expect(verify('secp256k1', publicKey, testDigest, signature)).toBe(true);
      expect({
        publicKey: publicKey.toString('hex'),
        digest: testDigest.toString('hex'),
        signature: signature.toString('hex'),
        result: verify('secp256k1', publicKey, testDigest, signature),
      }).toMatchSnapshot('secp256k1-verify');
    });

    it('should verify nistp256 signatures correctly', () => {
      const signature = sign(
        'nistp256',
        encryptedPrivateKey,
        testDigest,
        testPassword,
      );
      const publicKey = publicFromPrivate(
        'nistp256',
        encryptedPrivateKey,
        testPassword,
      );

      expect(verify('nistp256', publicKey, testDigest, signature)).toBe(true);
      expect({
        publicKey: publicKey.toString('hex'),
        digest: testDigest.toString('hex'),
        signature: signature.toString('hex'),
        result: verify('nistp256', publicKey, testDigest, signature),
      }).toMatchSnapshot('nistp256-verify');
    });

    it('should verify ed25519 signatures correctly', () => {
      const signature = sign(
        'ed25519',
        encryptedPrivateKey,
        testDigest,
        testPassword,
      );
      const publicKey = publicFromPrivate(
        'ed25519',
        encryptedPrivateKey,
        testPassword,
      );

      expect(verify('ed25519', publicKey, testDigest, signature)).toBe(true);
      expect({
        publicKey: publicKey.toString('hex'),
        digest: testDigest.toString('hex'),
        signature: signature.toString('hex'),
        result: verify('ed25519', publicKey, testDigest, signature),
      }).toMatchSnapshot('ed25519-verify');
    });

    it('should return false for invalid signatures', () => {
      const signature = sign(
        'secp256k1',
        encryptedPrivateKey,
        testDigest,
        testPassword,
      );
      const publicKey = publicFromPrivate(
        'secp256k1',
        encryptedPrivateKey,
        testPassword,
      );
      const wrongDigest = Buffer.from(
        '1123456789abcdef0123456789abcdef',
        'hex',
      );

      expect(verify('secp256k1', publicKey, wrongDigest, signature)).toBe(
        false,
      );
      expect({
        publicKey: publicKey.toString('hex'),
        wrongDigest: wrongDigest.toString('hex'),
        signature: signature.toString('hex'),
        result: verify('secp256k1', publicKey, wrongDigest, signature),
      }).toMatchSnapshot('invalid-verify');
    });

    it('should throw error for invalid curve', () => {
      const signature = Buffer.from('00'.repeat(64), 'hex');
      const publicKey = Buffer.from('00'.repeat(33), 'hex');
      expect(() =>
        verify('invalid-curve' as ICurveName, publicKey, testDigest, signature),
      ).toThrow();
    });
  });

  describe('uncompressPublicKey', () => {
    it('should uncompress secp256k1 public key correctly', () => {
      const compressedKey = Buffer.from(
        '02a0434d9e47f3c86235477c7b1ae6ae5d3442d49b1943c2b752a68e2a47e247c7',
        'hex',
      );
      const uncompressedKey = uncompressPublicKey('secp256k1', compressedKey);
      expect(uncompressedKey).toBeInstanceOf(Buffer);
      expect(uncompressedKey.length).toBe(65); // Uncompressed public key length
      expect(uncompressedKey.toString('hex')).toMatchSnapshot(
        'secp256k1-uncompressed',
      );
    });

    it('should uncompress nistp256 public key correctly', () => {
      const compressedKey = Buffer.from(
        '03b5d465bc991d8f0f7fa68dafa4cce5e3c57e3d0d70b3c1b6f9e4e57aed0b1a87',
        'hex',
      );
      const uncompressedKey = uncompressPublicKey('nistp256', compressedKey);
      expect(uncompressedKey).toBeInstanceOf(Buffer);
      expect(uncompressedKey.length).toBe(65);
      expect(uncompressedKey.toString('hex')).toMatchSnapshot(
        'nistp256-uncompressed',
      );
    });

    it('should throw error for invalid curve', () => {
      const compressedKey = Buffer.from(
        '02a0434d9e47f3c86235477c7b1ae6ae5d3442d49b1943c2b752a68e2a47e247c7',
        'hex',
      );
      expect(() =>
        uncompressPublicKey('invalid-curve' as ICurveName, compressedKey),
      ).toThrow();
    });

    it('should throw error for invalid key format', () => {
      const invalidKey = Buffer.from('invalid', 'hex');
      expect(() => uncompressPublicKey('secp256k1', invalidKey)).toThrow();
    });
  });
});
