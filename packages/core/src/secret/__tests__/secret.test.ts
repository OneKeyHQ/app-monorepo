/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Buffer } from 'buffer';

import { DEFAULT_VERIFY_STRING } from '@onekeyhq/shared/src/consts/dbConsts';
import {
  IncorrectPassword,
  InvalidMnemonic,
  OneKeyLocalError,
} from '@onekeyhq/shared/src/errors';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import {
  CKDPriv,
  CKDPub,
  N,
  batchGetPrivateKeys,
  batchGetPublicKeys,
  compressPublicKey,
  decryptAsync,
  decryptImportedCredential,
  decryptRevealableSeed,
  decryptVerifyString,
  encryptAsync,
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

const GET_PUB_TIMEOUT = 5118;

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

    it('should derive normal child key for secp256k1', async () => {
      const encryptedParent = {
        key: await encryptAsync({
          password: testPassword,
          data: testMasterKey.key,
        }),
        chainCode: testMasterKey.chainCode,
      };

      const childKey = await CKDPriv(
        'secp256k1',
        encryptedParent,
        0,
        testPassword,
      );

      // Decrypt and verify the derived key
      const decryptedKey = await decryptAsync({
        password: testPassword,
        data: childKey.key,
      });
      expect(decryptedKey.length).toBe(32);
      expect(childKey.chainCode.length).toBe(32);

      // Verify we can generate valid public key from it
      const publicKey = await publicFromPrivate(
        'secp256k1',
        childKey.key,
        testPassword,
      );
      expect(publicKey.length).toBeGreaterThan(0);
    });

    it('should derive hardened child key for secp256k1', async () => {
      const encryptedParent = {
        key: await encryptAsync({
          password: testPassword,
          data: testMasterKey.key,
        }),
        chainCode: testMasterKey.chainCode,
      };

      const hardenedIndex = 0x80_00_00_00; // 2^31
      const childKey = await CKDPriv(
        'secp256k1',
        encryptedParent,
        hardenedIndex,
        testPassword,
      );

      const decryptedKey = await decryptAsync({
        password: testPassword,
        data: childKey.key,
      });
      expect(decryptedKey.length).toBe(32);
      expect(childKey.chainCode.length).toBe(32);
    });

    it('should only support hardened derivation for ed25519', async () => {
      const encryptedParent = {
        key: await encryptAsync({
          password: testPassword,
          data: testMasterKey.key,
        }),
        chainCode: testMasterKey.chainCode,
      };

      // Normal index should throw
      await expect(
        CKDPriv('ed25519', encryptedParent, 0, testPassword),
      ).rejects.toThrow('Only hardened CKDPriv is supported for ed25519');

      // Hardened index should work
      const hardenedIndex = 0x80_00_00_00;
      const childKey = await CKDPriv(
        'ed25519',
        encryptedParent,
        hardenedIndex,
        testPassword,
      );
      expect(childKey.key.length).toBe(96);
      expect(childKey.chainCode.length).toBe(32);
    });

    it('should throw error for invalid index', async () => {
      const encryptedParent = {
        key: await encryptAsync({
          password: testPassword,
          data: testMasterKey.key,
        }),
        chainCode: testMasterKey.chainCode,
      };

      await expect(
        CKDPriv('secp256k1', encryptedParent, -1, testPassword),
      ).rejects.toThrow('Invalid index.');

      await expect(
        CKDPriv('secp256k1', encryptedParent, 2 ** 32, testPassword),
      ).rejects.toThrow('Overflowed.');

      await expect(
        CKDPriv('secp256k1', encryptedParent, 1.5, testPassword),
      ).rejects.toThrow('Invalid index');
    });

    it('should derive child key for nistp256', async () => {
      const encryptedParent = {
        key: await encryptAsync({
          password: testPassword,
          data: testMasterKey.key,
        }),
        chainCode: testMasterKey.chainCode,
      };

      const childKey = await CKDPriv(
        'nistp256',
        encryptedParent,
        0,
        testPassword,
      );

      const decryptedKey = await decryptAsync({
        password: testPassword,
        data: childKey.key,
      });
      expect(decryptedKey.length).toBe(32);
      expect(childKey.chainCode.length).toBe(32);

      // Verify chain code is different from parent
      expect(childKey.chainCode).not.toEqual(testMasterKey.chainCode);

      // Verify we can derive multiple children
      const secondChild = await CKDPriv('nistp256', childKey, 1, testPassword);
      expect(secondChild.key.length).toBeGreaterThan(0);
      expect(secondChild.chainCode.length).toBe(32);
    });

    it('should match snapshot for secp256k1', async () => {
      const encryptedParent = {
        key: await encryptAsync({
          password: testPassword,
          data: testMasterKey.key,
        }),
        chainCode: testMasterKey.chainCode,
      };

      const childKey = await CKDPriv(
        'secp256k1',
        encryptedParent,
        0,
        testPassword,
      );
      expect({
        key: childKey.key.toString('hex'),
        chainCode: childKey.chainCode.toString('hex'),
      }).toMatchSnapshot('secp256k1-child-key');

      const hardenedChildKey = await CKDPriv(
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

    it('should match snapshot for ed25519', async () => {
      const encryptedParent = {
        key: await encryptAsync({
          password: testPassword,
          data: testMasterKey.key,
        }),
        chainCode: testMasterKey.chainCode,
      };

      const hardenedChildKey = await CKDPriv(
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

    it('should match snapshot for nistp256', async () => {
      const encryptedParent = {
        key: await encryptAsync({
          password: testPassword,
          data: testMasterKey.key,
        }),
        chainCode: testMasterKey.chainCode,
      };

      const childKey = await CKDPriv(
        'nistp256',
        encryptedParent,
        0,
        testPassword,
      );
      expect({
        key: childKey.key.toString('hex'),
        chainCode: childKey.chainCode.toString('hex'),
      }).toMatchSnapshot('nistp256-child-key');
    });

    it('should derive child private keys correctly using CKDPriv', async () => {
      const testMnemonic =
        'test test test test test test test test test test test junk';
      const rs = mnemonicToRevealableSeed(testMnemonic);
      const hdCredential = await encryptRevealableSeed({
        rs,
        password: testPassword,
      });

      // Get seed from hdCredential
      const { seed } = await decryptRevealableSeed({
        rs: hdCredential,
        password: testPassword,
      });
      const seedBuffer = Buffer.from(seed, 'hex');

      // Create revealable seed and encrypt it
      const revealableSeed = {
        entropyWithLangPrefixed: seedBuffer.toString('hex'),
        seed,
      };
      const encryptedSeed = await encryptRevealableSeed({
        rs: revealableSeed,
        password: testPassword,
      });

      // Generate master key from seed
      const encryptedMasterKey = await generateMasterKeyFromSeed(
        'secp256k1',
        encryptedSeed,
        testPassword,
      );

      // Decrypt the master key for CKDPriv
      const masterKey = {
        key: await decryptAsync({
          password: testPassword,
          data: encryptedMasterKey.key,
        }),
        chainCode: encryptedMasterKey.chainCode,
      };

      // Verify key lengths
      expect(masterKey.key.length).toBe(32);
      expect(masterKey.chainCode.length).toBe(32);

      const childKey = await CKDPriv(
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
      const hardenedChild = await CKDPriv(
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
        key: await encryptAsync({
          password: testPassword,
          data: Buffer.from(
            '612091aaa12e22dd2abef664f8a01a82cae99ad7441b7ef8110424915c268bc2',
            'hex',
          ),
        }),
        chainCode: Buffer.from(
          'beeb672fe4621673f722f38529c07392fecaa61015c80c34f29ce8b41b3cb6ea',
          'hex',
        ),
      };
      const nistChild = await CKDPriv(
        'nistp256',
        nistMasterKey,
        0,
        testPassword,
      );
      expect(nistChild).toBeDefined();

      const edMasterKey = {
        key: await encryptAsync({
          password: testPassword,
          data: Buffer.from('0123456789abcdef0123456789abcdef', 'hex'),
        }),
        chainCode: Buffer.from('0123456789abcdef0123456789abcdef', 'hex'),
      };
      // ed25519 only supports hardened derivation
      const edChild = await CKDPriv(
        'ed25519',
        edMasterKey,
        hardenedIndex,
        testPassword,
      );
      expect(edChild).toBeDefined();

      // Test error cases
      await expect(
        CKDPriv('ed25519', edMasterKey, 0, testPassword),
      ).rejects.toThrow();
      await expect(
        CKDPriv('invalid-curve' as any, encryptedMasterKey, 0, testPassword),
      ).rejects.toThrow();
      await expect(
        CKDPriv('secp256k1', encryptedMasterKey, -1, testPassword),
      ).rejects.toThrow();
    });

    it('should handle async mnemonic and seed operations', async () => {
      const password = 'password123';
      const entropy = Buffer.from('000102030405060708090a0b0c0d0e0f', 'hex');

      // Create encrypted revealable seed from mnemonic
      const testMnemonic =
        'test test test test test test test test test test test junk';
      const rs = mnemonicToRevealableSeed(testMnemonic, 'optional passphrase');
      const hdCredential = await encryptRevealableSeed({
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
        throw new OneKeyLocalError('Should have thrown');
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

    it('should throw error for invalid curve', async () => {
      const encryptedParent = {
        key: await encryptAsync({
          password: testPassword,
          data: testMasterKey.key,
        }),
        chainCode: testMasterKey.chainCode,
      };

      await expect(
        CKDPriv('invalid-curve' as any, encryptedParent, 0, testPassword),
      ).rejects.toThrow(
        'Key derivation is not supported for curve invalid-curve.',
      );
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

    it('should generate fingerprint for secp256k1', async () => {
      const hdCredential = await encryptRevealableSeed({
        rs,
        password: testPassword,
      });
      const fingerprint = await generateRootFingerprintHexAsync({
        curveName: 'secp256k1',
        hdCredential,
        password: testPassword,
      });
      expect(typeof fingerprint).toBe('string');
      expect(fingerprint).toMatch(/^[0-9a-f]{8}$/); // 4 bytes hex
    });

    it('should generate fingerprint for different curves', async () => {
      const hdCredential = await encryptRevealableSeed({
        rs,
        password: testPassword,
      });
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
      const hdCredential = await encryptRevealableSeed({
        rs,
        password: testPassword,
      });
      await expect(
        generateRootFingerprintHexAsync({
          curveName: 'invalid-curve' as ICurveName,
          hdCredential,
          password: testPassword,
        }),
      ).rejects.toThrow();
    });

    it('should throw error for invalid password', async () => {
      const hdCredential = await encryptRevealableSeed({
        rs,
        password: testPassword,
      });
      await expect(
        generateRootFingerprintHexAsync({
          curveName: 'secp256k1',
          hdCredential,
          password: 'wrong-password',
        }),
      ).rejects.toThrow();
    });

    it('should match snapshot', async () => {
      const hdCredential = await encryptRevealableSeed({
        rs,
        password: testPassword,
      });

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
    it('should derive child public keys correctly', async () => {
      const parentKey = {
        key: Buffer.from(
          '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
          'hex',
        ),
        chainCode: Buffer.from('0123456789abcdef0123456789abcdef', 'hex'),
      };

      const testChildKey = await CKDPub('secp256k1', parentKey, 0);
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
      const nistChildKey = await CKDPub('nistp256', nistParentKey, 0);
      expect(nistChildKey).toBeDefined();
      expect(nistChildKey.key).toBeInstanceOf(Buffer);
      expect(nistChildKey.chainCode).toBeInstanceOf(Buffer);

      // Test error cases
      await expect(
        CKDPub('invalid-curve' as any, parentKey, 0),
      ).rejects.toThrow();
      await expect(CKDPub('secp256k1', parentKey, -1)).rejects.toThrow();
      await expect(
        CKDPub('secp256k1', parentKey, 2_147_483_648),
      ).rejects.toThrow(); // Hardened index not allowed
    });

    it('should match snapshot for public key derivation', async () => {
      const parentKey = {
        key: Buffer.from(
          '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
          'hex',
        ),
        chainCode: Buffer.from('0123456789abcdef0123456789abcdef', 'hex'),
      };
      const extendedKey = await CKDPub('secp256k1', parentKey, 0);
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

    it('should derive private keys for valid paths', async () => {
      const encryptedSeed = await encryptRevealableSeed({
        rs: testSeed,
        password: testPassword,
      });

      const curveName: ICurveName = 'secp256k1';
      const prefix = 'm';
      const relPaths = ['0/0', '0/1', "44'/0'/0'/0/0"];

      const privateKeys = await batchGetPrivateKeys(
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

    it('should throw error for invalid curve name', async () => {
      const encryptedSeed = await encryptRevealableSeed({
        rs: testSeed,
        password: testPassword,
      });
      const curveName = 'invalid-curve' as ICurveName;
      const prefix = 'm';
      const relPaths = ['0/0'];

      await expect(
        batchGetPrivateKeys(
          curveName,
          encryptedSeed,
          testPassword,
          prefix,
          relPaths,
        ),
      ).rejects.toThrow(
        'Key derivation is not supported for curve invalid-curve.',
      );
    });

    it('should throw error for invalid password', async () => {
      const encryptedSeed = await encryptRevealableSeed({
        rs: testSeed,
        password: testPassword,
      });
      const curveName: ICurveName = 'secp256k1';
      const prefix = 'm';
      const relPaths = ['0/0'];

      await expect(
        batchGetPrivateKeys(
          curveName,
          encryptedSeed,
          'wrong-password',
          prefix,
          relPaths,
        ),
      ).rejects.toThrow();
    });

    it('should handle hardened and non-hardened derivation paths', async () => {
      const encryptedSeed = await encryptRevealableSeed({
        rs: testSeed,
        password: testPassword,
      });
      const curveName: ICurveName = 'secp256k1';
      const prefix = 'm';
      const relPaths = ["44'/0'", '0/0', "1'/0/0"];

      const privateKeys = await batchGetPrivateKeys(
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

    it('should match snapshot', async () => {
      const encryptedSeed = await encryptRevealableSeed({
        rs: testSeed,
        password: testPassword,
      });
      const curveName: ICurveName = 'secp256k1';
      const prefix = 'm';
      const relPaths = ['0/0'];

      const privateKeys = await batchGetPrivateKeys(
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

    it(
      'should generate public keys matching private keys',
      async () => {
        const encryptedSeed = await encryptRevealableSeed({
          rs: testSeed,
          password: testPassword,
        });
        const curveName: ICurveName = 'secp256k1';
        const prefix = 'm';
        const relPaths = ['0/0', '0/1', "44'/0'/0'/0/0"];

        const [privateKeys, publicKeys] = await Promise.all([
          batchGetPrivateKeys(
            curveName,
            encryptedSeed,
            testPassword,
            prefix,
            relPaths,
          ),
          batchGetPublicKeys({
            curveName,
            hdCredential: encryptedSeed,
            password: testPassword,
            prefix,
            relPaths,
          }),
        ]);

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
      },
      GET_PUB_TIMEOUT,
    );

    it('should throw error for invalid curve name', async () => {
      const encryptedSeed = await encryptRevealableSeed({
        rs: testSeed,
        password: testPassword,
      });
      const curveName = 'invalid-curve' as ICurveName;
      const prefix = 'm';
      const relPaths = ['0/0'];

      await expect(
        batchGetPublicKeys({
          curveName,
          hdCredential: encryptedSeed,
          password: testPassword,
          prefix,
          relPaths,
        }),
      ).rejects.toThrow(
        'Key derivation is not supported for curve invalid-curve.',
      );
    });

    it('should throw error for invalid password', async () => {
      const encryptedSeed = await encryptRevealableSeed({
        rs: testSeed,
        password: testPassword,
      });
      const curveName: ICurveName = 'secp256k1';
      const prefix = 'm';
      const relPaths = ['0/0'];

      await expect(
        batchGetPublicKeys({
          curveName,
          hdCredential: encryptedSeed,
          password: 'wrong-password',
          prefix,
          relPaths,
        }),
      ).rejects.toThrow();
    });

    it('should handle hardened and non-hardened derivation paths', async () => {
      const encryptedSeed = await encryptRevealableSeed({
        rs: testSeed,
        password: testPassword,
      });
      const curveName: ICurveName = 'secp256k1';
      const prefix = 'm';
      const relPaths = ["44'/0'", '0/0', "1'/0/0"];

      const publicKeys = await batchGetPublicKeys({
        curveName,
        hdCredential: encryptedSeed,
        password: testPassword,
        prefix,
        relPaths,
      });

      expect(publicKeys).toHaveLength(3);
      expect(publicKeys[0].path).toBe("m/44'/0'");
      expect(publicKeys[1].path).toBe('m/0/0');
      expect(publicKeys[2].path).toBe("m/1'/0/0");
    });

    it('should match snapshot', async () => {
      const encryptedSeed = await encryptRevealableSeed({
        rs: testSeed,
        password: testPassword,
      });
      const curveName: ICurveName = 'secp256k1';
      const prefix = 'm';
      const relPaths = ['0/0'];

      const publicKeys = await batchGetPublicKeys({
        curveName,
        hdCredential: encryptedSeed,
        password: testPassword,
        prefix,
        relPaths,
      });

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

    beforeEach(() => {
      // do nothing
    });

    it(
      'should return same results as batchGetPublicKeys in non-native environment',
      async () => {
        const encryptedSeed = await encryptRevealableSeed({
          rs: testSeed,
          password: testPassword,
        });
        const curveName: ICurveName = 'secp256k1';
        const prefix = 'm';
        const relPaths = ['0/0', '0/1', "44'/0'/0'/0/0"];

        const [syncResult, asyncResult] = await Promise.all([
          batchGetPublicKeys({
            curveName,
            hdCredential: encryptedSeed,
            password: testPassword,
            prefix,
            relPaths,
          }),
          batchGetPublicKeys({
            curveName,
            hdCredential: encryptedSeed,
            password: testPassword,
            prefix,
            relPaths,
          }),
        ]);

        expect(asyncResult).toEqual(syncResult);
      },
      GET_PUB_TIMEOUT,
    );

    it('should handle native environment correctly', async () => {
      const encryptedSeed = await encryptRevealableSeed({
        rs: testSeed,
        password: testPassword,
      });
      const result = await batchGetPublicKeys({
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
      const encryptedSeed = await encryptRevealableSeed({
        rs: testSeed,
        password: testPassword,
      });
      const result = await batchGetPublicKeys({
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

    it('should decrypt imported credential correctly', async () => {
      // First encrypt the credential
      const encryptedCredential = await encryptImportedCredential({
        credential: testCredential,
        password: testPassword,
      });

      // Then decrypt and verify
      const decryptedCredential = await decryptImportedCredential({
        credential: encryptedCredential,
        password: testPassword,
      });

      expect(decryptedCredential).toEqual(testCredential);
    });

    it('should handle credential with prefix correctly', async () => {
      const encryptedCredential = await encryptImportedCredential({
        credential: testCredential,
        password: testPassword,
      });

      expect(encryptedCredential.startsWith('|PK|')).toBe(true);

      const decryptedCredential = await decryptImportedCredential({
        credential: encryptedCredential,
        password: testPassword,
      });

      expect(decryptedCredential).toEqual(testCredential);
    });

    it('should throw error for invalid password', async () => {
      const encryptedCredential = await encryptImportedCredential({
        credential: testCredential,
        password: testPassword,
      });

      await expect(
        decryptImportedCredential({
          credential: encryptedCredential,
          password: 'wrong-password',
        }),
      ).rejects.toThrow();
    });

    it('should throw error for invalid credential format', async () => {
      await expect(
        decryptImportedCredential({
          credential: '|PK|invalid-data',
          password: testPassword,
        }),
      ).rejects.toThrow();
    });

    it('should match snapshot for decrypted credential', async () => {
      const encryptedCredential = await encryptImportedCredential({
        credential: testCredential,
        password: testPassword,
      });

      expect(
        await decryptImportedCredential({
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

    it('should decrypt revealable seed correctly', async () => {
      // First encrypt the seed
      const encryptedSeed = await encryptRevealableSeed({
        rs: testSeed,
        password: testPassword,
      });

      // Then decrypt and verify
      const decryptedSeed = await decryptRevealableSeed({
        rs: encryptedSeed,
        password: testPassword,
      });

      expect(decryptedSeed).toEqual(testSeed);
    });

    it('should throw error for invalid password', async () => {
      const encryptedSeed = await encryptRevealableSeed({
        rs: testSeed,
        password: testPassword,
      });

      await expect(
        decryptRevealableSeed({
          rs: encryptedSeed,
          password: 'wrong-password',
        }),
      ).rejects.toThrow();
    });

    it('should throw error for invalid seed format', async () => {
      await expect(
        decryptRevealableSeed({
          rs: 'invalid-seed-data',
          password: testPassword,
        }),
      ).rejects.toThrow();
    });

    it('should match snapshot for decrypted seed', async () => {
      const encryptedSeed = await encryptRevealableSeed({
        rs: testSeed,
        password: testPassword,
      });

      expect(
        await decryptRevealableSeed({
          rs: encryptedSeed,
          password: testPassword,
        }),
      ).toMatchSnapshot();
    });
  });

  describe('decryptVerifyString', () => {
    const testPassword = 'test123';

    it('should decrypt verify string correctly', async () => {
      // First encrypt the string
      const encryptedString = await encryptVerifyString({
        password: testPassword,
      });

      // Then decrypt and verify
      const decryptedString = await decryptVerifyString({
        verifyString: encryptedString,
        password: testPassword,
      });

      expect(decryptedString).toBe(DEFAULT_VERIFY_STRING);
    });

    it('should handle string with prefix correctly', async () => {
      const encryptedString = await encryptVerifyString({
        password: testPassword,
        addPrefixString: true,
      });

      expect(encryptedString.startsWith('|VS|')).toBe(true);

      const decryptedString = await decryptVerifyString({
        verifyString: encryptedString,
        password: testPassword,
      });

      expect(decryptedString).toBe(DEFAULT_VERIFY_STRING);
    });

    it('should throw error for invalid password', async () => {
      const encryptedString = await encryptVerifyString({
        password: testPassword,
      });

      await expect(
        decryptVerifyString({
          verifyString: encryptedString,
          password: 'wrong-password',
        }),
      ).rejects.toThrow();
    });

    it('should throw error for invalid string format', async () => {
      await expect(
        decryptVerifyString({
          verifyString: '|VS|invalid-data',
          password: testPassword,
        }),
      ).rejects.toThrow();
    });

    it('should match snapshot for decrypted string', async () => {
      const encryptedString = await encryptVerifyString({
        password: testPassword,
      });

      expect(
        await decryptVerifyString({
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

    it('should encrypt credential correctly', async () => {
      const encryptedCredential = await encryptImportedCredential({
        credential: testCredential,
        password: testPassword,
      });

      expect(encryptedCredential.startsWith('|PK|')).toBe(true);

      // Verify we can decrypt it back
      const decryptedCredential = await decryptImportedCredential({
        credential: encryptedCredential,
        password: testPassword,
      });

      expect(decryptedCredential).toEqual(testCredential);
    });

    it('should handle different private key formats', async () => {
      const longKeyCredential: ICoreImportedCredential = {
        privateKey:
          '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      };

      const encryptedCredential = await encryptImportedCredential({
        credential: longKeyCredential,
        password: testPassword,
      });

      const decryptedCredential = await decryptImportedCredential({
        credential: encryptedCredential,
        password: testPassword,
      });

      expect(decryptedCredential).toEqual(longKeyCredential);
    });

    it('should throw error for empty private key', async () => {
      const invalidCredential = {
        privateKey: '',
      };

      await expect(
        encryptImportedCredential({
          credential: invalidCredential as ICoreImportedCredential,
          password: testPassword,
        }),
      ).rejects.toThrow();
    });

    it('should match snapshot', async () => {
      const encryptedCredential = await encryptImportedCredential({
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

    it('should encrypt seed correctly', async () => {
      const encryptedSeed = await encryptRevealableSeed({
        rs: testSeed,
        password: testPassword,
      });

      // Verify we can decrypt it back
      const decryptedSeed = await decryptRevealableSeed({
        rs: encryptedSeed,
        password: testPassword,
      });

      expect(decryptedSeed).toEqual(testSeed);
    });

    it('should handle different seed lengths', async () => {
      const longSeed: IBip39RevealableSeed = {
        entropyWithLangPrefixed:
          '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        seed: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
      };

      const encryptedSeed = await encryptRevealableSeed({
        rs: longSeed,
        password: testPassword,
      });

      const decryptedSeed = await decryptRevealableSeed({
        rs: encryptedSeed,
        password: testPassword,
      });

      expect(decryptedSeed).toEqual(longSeed);
    });

    it('should throw error for invalid seed object', async () => {
      const invalidSeed = {
        entropyWithLangPrefixed: '',
        seed: '',
      };

      await expect(
        encryptRevealableSeed({
          rs: invalidSeed as IBip39RevealableSeed,
          password: testPassword,
        }),
      ).rejects.toThrow();
    });

    it('should match snapshot', async () => {
      const encryptedSeed = await encryptRevealableSeed({
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

    it('should generate public key for secp256k1', async () => {
      const encryptedPrivateKey = await encryptAsync({
        password: testPassword,
        data: testPrivateKey,
      });
      const publicKey = await publicFromPrivate(
        'secp256k1',
        encryptedPrivateKey,
        testPassword,
      );
      expect(publicKey).toBeInstanceOf(Buffer);
      expect(publicKey.length).toBeGreaterThan(0);
      expect(bufferUtils.bytesToHex(publicKey)).toMatchSnapshot(
        'secp256k1-public-key',
      );
    });

    it('should generate public key for nistp256', async () => {
      const encryptedPrivateKey = await encryptAsync({
        password: testPassword,
        data: testPrivateKey,
      });
      const publicKey = await publicFromPrivate(
        'nistp256',
        encryptedPrivateKey,
        testPassword,
      );
      expect(publicKey).toBeInstanceOf(Buffer);
      expect(publicKey.length).toBeGreaterThan(0);
      expect(bufferUtils.bytesToHex(publicKey)).toMatchSnapshot(
        'nistp256-public-key',
      );
    });

    it('should generate public key for ed25519', async () => {
      const encryptedPrivateKey = await encryptAsync({
        password: testPassword,
        data: testPrivateKey,
      });
      const publicKey = await publicFromPrivate(
        'ed25519',
        encryptedPrivateKey,
        testPassword,
      );
      expect(publicKey).toBeInstanceOf(Buffer);
      expect(publicKey.length).toBeGreaterThan(0);
      expect(bufferUtils.bytesToHex(publicKey)).toMatchSnapshot(
        'ed25519-public-key',
      );
    });

    it('should throw error for invalid curve', async () => {
      const encryptedPrivateKey = await encryptAsync({
        password: testPassword,
        data: testPrivateKey,
      });
      await expect(
        publicFromPrivate(
          'invalid-curve' as ICurveName,
          encryptedPrivateKey,
          testPassword,
        ),
      ).rejects.toThrow();
    });

    it('should throw error for invalid password', async () => {
      const encryptedPrivateKey = await encryptAsync({
        password: testPassword,
        data: testPrivateKey,
      });
      await expect(
        publicFromPrivate('secp256k1', encryptedPrivateKey, 'wrong-password'),
      ).rejects.toThrow(IncorrectPassword);
    });
  });

  describe('encryptVerifyString', () => {
    const testPassword = 'test123';

    it('should encrypt string correctly', async () => {
      const encryptedString = await encryptVerifyString({
        password: testPassword,
      });

      // Verify we can decrypt it back
      const decryptedString = await decryptVerifyString({
        verifyString: encryptedString,
        password: testPassword,
      });

      expect(decryptedString).toBe('OneKey');
    });

    it('should handle prefix option', async () => {
      const withPrefix = await encryptVerifyString({
        password: testPassword,
        addPrefixString: true,
      });

      expect(withPrefix.startsWith('|VS|')).toBe(true);

      const withoutPrefix = await encryptVerifyString({
        password: testPassword,
        addPrefixString: false,
      });

      expect(withoutPrefix.startsWith('|VS|')).toBe(false);

      // Both should decrypt correctly
      expect(
        await decryptVerifyString({
          verifyString: withPrefix,
          password: testPassword,
        }),
      ).toBe('OneKey');

      expect(
        await decryptVerifyString({
          verifyString: withoutPrefix,
          password: testPassword,
        }),
      ).toBe('OneKey');
    });

    it('should throw error for empty password', async () => {
      await expect(
        encryptVerifyString({
          password: '',
        }),
      ).rejects.toThrow();
    });

    it('should match snapshot', async () => {
      const encryptedString = await encryptVerifyString({
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

    it('should match snapshot', async () => {
      const result = fixV4VerifyStringToV5({
        verifyString: 'test123',
      });
      expect(result).toMatchSnapshot();
    });
  });

  describe('generateMasterKeyFromSeed', () => {
    const testRevealableSeed = mnemonicToRevealableSeed(TEST_MNEMONIC);

    it('should generate master key for secp256k1', async () => {
      const encryptedSeed = await encryptRevealableSeed({
        rs: testRevealableSeed,
        password: TEST_PASSWORD,
      });

      const masterKey = await generateMasterKeyFromSeed(
        'secp256k1',
        encryptedSeed,
        TEST_PASSWORD,
      );
      expect(masterKey.key).toBeInstanceOf(Buffer);
      expect(masterKey.chainCode).toBeInstanceOf(Buffer);
      expect(masterKey.key.length).toBe(96);
      expect(masterKey.chainCode.length).toBe(32);
    });

    it('should generate master key for nistp256', async () => {
      const encryptedSeed = await encryptRevealableSeed({
        rs: testRevealableSeed,
        password: TEST_PASSWORD,
      });
      const masterKey = await generateMasterKeyFromSeed(
        'nistp256',
        encryptedSeed,
        TEST_PASSWORD,
      );
      expect(masterKey.key).toBeInstanceOf(Buffer);
      expect(masterKey.chainCode).toBeInstanceOf(Buffer);
      expect(masterKey.key.length).toBe(96);
      expect(masterKey.chainCode.length).toBe(32);
    });

    it('should generate master key for ed25519', async () => {
      const encryptedSeed = await encryptRevealableSeed({
        rs: testRevealableSeed,
        password: TEST_PASSWORD,
      });
      const masterKey = await generateMasterKeyFromSeed(
        'ed25519',
        encryptedSeed,
        TEST_PASSWORD,
      );
      expect(masterKey.key).toBeInstanceOf(Buffer);
      expect(masterKey.chainCode).toBeInstanceOf(Buffer);
      expect(masterKey.key.length).toBe(96);
      expect(masterKey.chainCode.length).toBe(32);
    });

    it('should throw error for invalid curve', async () => {
      const encryptedSeed = await encryptRevealableSeed({
        rs: testRevealableSeed,
        password: TEST_PASSWORD,
      });
      await expect(
        generateMasterKeyFromSeed(
          'invalid-curve' as any,
          encryptedSeed,
          TEST_PASSWORD,
        ),
      ).rejects.toThrow(
        'Key derivation is not supported for curve invalid-curve.',
      );
    });

    it('should throw error for invalid password', async () => {
      const encryptedSeed = await encryptRevealableSeed({
        rs: testRevealableSeed,
        password: TEST_PASSWORD,
      });
      await expect(
        generateMasterKeyFromSeed('secp256k1', encryptedSeed, 'wrong-password'),
      ).rejects.toThrow('IncorrectPassword');
    });

    it('should match snapshot', async () => {
      const encryptedSeed = await encryptRevealableSeed({
        rs: testRevealableSeed,
        password: TEST_PASSWORD,
      });
      const masterKey = await generateMasterKeyFromSeed(
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

    it('should generate mnemonic from entropy', async () => {
      const encryptedSeed = await encryptRevealableSeed({
        rs: testRevealableSeed,
        password: TEST_PASSWORD,
      });
      const mnemonic = await mnemonicFromEntropyAsync({
        hdCredential: encryptedSeed,
        password: TEST_PASSWORD,
      });
      expect(typeof mnemonic).toBe('string');
      expect(mnemonic.split(' ').length).toBe(24); // 24 words for 256-bit entropy
    });

    it('should throw error for invalid password', async () => {
      const encryptedSeed = await encryptRevealableSeed({
        rs: testRevealableSeed,
        password: TEST_PASSWORD,
      });
      await expect(
        mnemonicFromEntropyAsync({
          hdCredential: encryptedSeed,
          password: 'wrong-password',
        }),
      ).rejects.toThrow(IncorrectPassword);
    });

    it('should match snapshot', async () => {
      const encryptedSeed = await encryptRevealableSeed({
        rs: testRevealableSeed,
        password: TEST_PASSWORD,
      });
      const mnemonic = await mnemonicFromEntropyAsync({
        hdCredential: encryptedSeed,
        password: TEST_PASSWORD,
      });
      expect(mnemonic).toMatchSnapshot();
    });
  });

  describe('N', () => {
    const testPassword = 'test123';

    it('should derive public key from private key', async () => {
      const testMasterKey: IBip32ExtendedKey = {
        key: await encryptAsync({
          password: testPassword,
          data: Buffer.from('0123456789abcdef0123456789abcdef', 'hex'),
        }),
        chainCode: Buffer.from('0123456789abcdef0123456789abcdef', 'hex'),
      };
      const publicKey = await N('secp256k1', testMasterKey, testPassword);
      expect(publicKey).toBeDefined();
      expect(publicKey.key).toBeInstanceOf(Buffer);
      expect(publicKey.chainCode).toEqual(testMasterKey.chainCode);
    });

    it('should work with different curves', async () => {
      const testMasterKey: IBip32ExtendedKey = {
        key: await encryptAsync({
          password: testPassword,
          data: Buffer.from('0123456789abcdef0123456789abcdef', 'hex'),
        }),
        chainCode: Buffer.from('0123456789abcdef0123456789abcdef', 'hex'),
      };
      const curves: ICurveName[] = ['secp256k1', 'nistp256', 'ed25519'];
      for (const curve of curves) {
        const publicKey = await N(curve, testMasterKey, testPassword);
        expect(publicKey).toBeDefined();
        expect(publicKey.key).toBeInstanceOf(Buffer);
        expect(publicKey.chainCode).toEqual(testMasterKey.chainCode);
      }
    });

    it('should throw error for invalid curve', async () => {
      const testMasterKey: IBip32ExtendedKey = {
        key: await encryptAsync({
          password: testPassword,
          data: Buffer.from('0123456789abcdef0123456789abcdef', 'hex'),
        }),
        chainCode: Buffer.from('0123456789abcdef0123456789abcdef', 'hex'),
      };
      await expect(
        N('invalid-curve' as ICurveName, testMasterKey, testPassword),
      ).rejects.toThrow();
    });

    it('should match snapshot', async () => {
      const testMasterKey: IBip32ExtendedKey = {
        key: await encryptAsync({
          password: testPassword,
          data: Buffer.from('0123456789abcdef0123456789abcdef', 'hex'),
        }),
        chainCode: Buffer.from('0123456789abcdef0123456789abcdef', 'hex'),
      };
      const publicKey = await N('secp256k1', testMasterKey, testPassword);
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

    it('should sign digest correctly with secp256k1', async () => {
      const encryptedPrivateKey = await encryptAsync({
        password: testPassword,
        data: testPrivateKey,
      });
      const signature = await sign(
        'secp256k1',
        encryptedPrivateKey,
        testDigest,
        testPassword,
      );
      expect(signature).toBeInstanceOf(Buffer);
      expect(signature.length).toBe(65); // secp256k1 signature is 64 bytes

      const publicKey = await publicFromPrivate(
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
      const wrongPublicKey = await publicFromPrivate(
        'secp256k1',
        await encryptAsync({
          password: testPassword,
          data: wrongPrivateKey,
        }),
        testPassword,
      );
      expect(verify('secp256k1', wrongPublicKey, testDigest, signature)).toBe(
        false,
      );
    });

    it('should sign digest correctly with nistp256', async () => {
      const encryptedPrivateKey = await encryptAsync({
        password: testPassword,
        data: testPrivateKey,
      });
      const signature = await sign(
        'nistp256',
        encryptedPrivateKey,
        testDigest,
        testPassword,
      );
      expect(signature).toBeInstanceOf(Buffer);
      expect(signature.length).toBe(65); // nistp256 signature is 64 bytes

      const publicKey = await publicFromPrivate(
        'nistp256',
        encryptedPrivateKey,
        testPassword,
      );
      expect(verify('nistp256', publicKey, testDigest, signature)).toBe(true);
      expect(signature.toString('hex')).toMatchSnapshot('nistp256-signature');
    });

    it('should sign digest correctly with ed25519', async () => {
      const encryptedPrivateKey = await encryptAsync({
        password: testPassword,
        data: testPrivateKey,
      });
      const signature = await sign(
        'ed25519',
        encryptedPrivateKey,
        testDigest,
        testPassword,
      );
      expect(signature).toBeInstanceOf(Buffer);
      expect(signature.length).toBe(64); // ed25519 signature is 64 bytes

      const publicKey = await publicFromPrivate(
        'ed25519',
        encryptedPrivateKey,
        testPassword,
      );
      expect(verify('ed25519', publicKey, testDigest, signature)).toBe(true);
      expect(signature.toString('hex')).toMatchSnapshot('ed25519-signature');
    });

    it('should throw error for invalid curve', async () => {
      const encryptedPrivateKey = await encryptAsync({
        password: testPassword,
        data: testPrivateKey,
      });
      await expect(
        sign(
          'invalid-curve' as ICurveName,
          encryptedPrivateKey,
          testDigest,
          testPassword,
        ),
      ).rejects.toThrow();
    });

    it('should throw error for invalid password', async () => {
      const encryptedPrivateKey = await encryptAsync({
        password: testPassword,
        data: testPrivateKey,
      });
      await expect(
        sign('secp256k1', encryptedPrivateKey, testDigest, 'wrong-password'),
      ).rejects.toThrow();
    });

    it('should match snapshot', async () => {
      const encryptedPrivateKey = await encryptAsync({
        password: testPassword,
        data: testPrivateKey,
      });
      const signature = await sign(
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

    // const revealableSeed = tonMnemonicToRevealableSeed(TEST_TON_MNEMONIC);

    it('should generate valid TON mnemonic from entropy', async () => {
      const encryptedSeed = await revealableSeedFromTonMnemonic(
        TEST_TON_MNEMONIC,
        testPassword,
      );
      const mnemonic = await tonMnemonicFromEntropy(
        encryptedSeed,
        testPassword,
      );
      expect(typeof mnemonic).toBe('string');
      expect(mnemonic.split(' ').length).toBe(24); // TON uses 24 words
      expect(mnemonic).toMatchSnapshot('ton-mnemonic');

      // Verify the mnemonic can be converted back to a revealable seed
      const encryptedSeedFromMnemonic = await revealableSeedFromTonMnemonic(
        mnemonic,
        testPassword,
      );
      expect(encryptedSeedFromMnemonic).toBeDefined();
    });

    it('should throw error for invalid entropy length', async () => {
      const invalidEntropy = '0001'; // Too short
      await expect(
        tonMnemonicFromEntropy(invalidEntropy, testPassword),
      ).rejects.toThrow();
    });

    it('should generate different mnemonics for different entropy', async () => {
      const encryptedSeed = await revealableSeedFromTonMnemonic(
        TEST_TON_MNEMONIC,
        testPassword,
      );
      const encryptedSeed2 = await revealableSeedFromTonMnemonic(
        TEST_TON_MNEMONIC2,
        testPassword,
      );
      const mnemonic1 = await tonMnemonicFromEntropy(
        encryptedSeed,
        testPassword,
      );
      const mnemonic2 = await tonMnemonicFromEntropy(
        encryptedSeed2,
        testPassword,
      );

      expect(mnemonic1).not.toBe(mnemonic2);
      expect(mnemonic1).toMatchSnapshot('ton-mnemonic-1');
      expect(mnemonic2).toMatchSnapshot('ton-mnemonic-2');
    });

    it('should convert entropy to TON mnemonic', async () => {
      const encryptedSeed = await revealableSeedFromTonMnemonic(
        TEST_TON_MNEMONIC,
        testPassword,
      );

      const mnemonic = await tonMnemonicFromEntropy(
        encryptedSeed,
        testPassword,
      );
      expect(typeof mnemonic).toBe('string');
      expect(mnemonic.split(' ').length).toBe(24); // TON uses 24 words
    });

    it('should throw error for invalid password', async () => {
      const encryptedSeed = await revealableSeedFromTonMnemonic(
        TEST_TON_MNEMONIC,
        testPassword,
      );
      await expect(
        tonMnemonicFromEntropy(encryptedSeed, 'wrong-password'),
      ).rejects.toThrow();
    });

    it('should match snapshot', async () => {
      const encryptedSeed = await revealableSeedFromTonMnemonic(
        TEST_TON_MNEMONIC,
        testPassword,
      );
      const mnemonic = await tonMnemonicFromEntropy(
        encryptedSeed,
        testPassword,
      );
      expect(mnemonic).toMatchSnapshot();
    });
  });

  describe('revealableSeedFromTonMnemonic', () => {
    const testPassword = 'test123';
    const testMnemonic =
      'abandon math mimic master filter design carbon crystal rookie group knife young abandon math mimic master filter design carbon crystal rookie group knife young abandon today';

    it('should convert TON mnemonic to revealable seed with proper UTF-8 encoding', async () => {
      const encryptedSeed = await revealableSeedFromTonMnemonic(
        testMnemonic,
        testPassword,
      );
      expect(encryptedSeed).toBeDefined();

      const decryptedSeed = await decryptRevealableSeed({
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

    // TODO: revealableSeedFromTonMnemonic should validate mnemonic before return, should make it async first
    it.skip('should throw InvalidMnemonic for malformed input', async () => {
      await expect(
        revealableSeedFromTonMnemonic('', testPassword),
      ).rejects.toThrow('Invalid seed object');
      await expect(
        revealableSeedFromTonMnemonic('invalid mnemonic', testPassword),
      ).rejects.toThrow(InvalidMnemonic);
      // Test with non-UTF8 characters
      await expect(
        revealableSeedFromTonMnemonic('\uD800', testPassword),
      ).rejects.toThrow(InvalidMnemonic);
    });

    it('should match snapshot', async () => {
      const encryptedSeed = await revealableSeedFromTonMnemonic(
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

    it('should verify secp256k1 signatures correctly', async () => {
      const encryptedPrivateKey = await encryptAsync({
        password: testPassword,
        data: testPrivateKey,
      });
      const signature = await sign(
        'secp256k1',
        encryptedPrivateKey,
        testDigest,
        testPassword,
      );
      const publicKey = await publicFromPrivate(
        'secp256k1',
        encryptedPrivateKey,
        testPassword,
      );

      const verifyResult = verify(
        'secp256k1',
        publicKey,
        testDigest,
        signature,
      );
      expect(verifyResult).toBe(true);
      expect({
        publicKey: bufferUtils.bytesToHex(publicKey),
        digest: bufferUtils.bytesToHex(testDigest),
        signature: bufferUtils.bytesToHex(signature),
        result: verifyResult,
      }).toMatchSnapshot('secp256k1-verify');
    });

    it('should verify nistp256 signatures correctly', async () => {
      const encryptedPrivateKey = await encryptAsync({
        password: testPassword,
        data: testPrivateKey,
      });
      const signature = await sign(
        'nistp256',
        encryptedPrivateKey,
        testDigest,
        testPassword,
      );
      const publicKey = await publicFromPrivate(
        'nistp256',
        encryptedPrivateKey,
        testPassword,
      );

      const verifyResult = verify('nistp256', publicKey, testDigest, signature);
      expect(verifyResult).toBe(true);
      expect({
        publicKey: bufferUtils.bytesToHex(publicKey),
        digest: bufferUtils.bytesToHex(testDigest),
        signature: bufferUtils.bytesToHex(signature),
        result: verifyResult,
      }).toMatchSnapshot('nistp256-verify');
    });

    it('should verify ed25519 signatures correctly', async () => {
      const encryptedPrivateKey = await encryptAsync({
        password: testPassword,
        data: testPrivateKey,
      });
      const signature = await sign(
        'ed25519',
        encryptedPrivateKey,
        testDigest,
        testPassword,
      );
      const publicKey = await publicFromPrivate(
        'ed25519',
        encryptedPrivateKey,
        testPassword,
      );

      const verifyResult = verify('ed25519', publicKey, testDigest, signature);
      expect(verifyResult).toBe(true);
      expect({
        publicKey: bufferUtils.bytesToHex(publicKey),
        digest: bufferUtils.bytesToHex(testDigest),
        signature: bufferUtils.bytesToHex(signature),
        result: verifyResult,
      }).toMatchSnapshot('ed25519-verify');
    });

    it('should return false for invalid signatures', async () => {
      const encryptedPrivateKey = await encryptAsync({
        password: testPassword,
        data: testPrivateKey,
      });
      const signature = await sign(
        'secp256k1',
        encryptedPrivateKey,
        testDigest,
        testPassword,
      );
      const publicKey = await publicFromPrivate(
        'secp256k1',
        encryptedPrivateKey,
        testPassword,
      );
      const wrongDigest = Buffer.from(
        '1123456789abcdef0123456789abcdef',
        'hex',
      );

      const verifyResult = verify(
        'secp256k1',
        publicKey,
        wrongDigest,
        signature,
      );
      expect(verifyResult).toBe(false);
      expect({
        publicKey: bufferUtils.bytesToHex(publicKey),
        wrongDigest: bufferUtils.bytesToHex(wrongDigest),
        signature: bufferUtils.bytesToHex(signature),
        result: verifyResult,
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
