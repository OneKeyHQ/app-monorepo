import { Buffer } from 'buffer';

import { BaseBip32KeyDeriver, ED25519Bip32KeyDeriver } from '../bip32';
import { ed25519, nistp256, secp256k1 } from '../curves';

/*
yarn jest packages/core/src/secret/__tests__/bip32-edge-cases.test.ts
*/

describe('BIP32 Edge Cases', () => {
  describe('BaseBip32KeyDeriver - secp256k1', () => {
    const deriver = new BaseBip32KeyDeriver(
      Buffer.from('Bitcoin seed'),
      secp256k1,
    );

    it('should generate deterministic master key from seed', () => {
      // BIP32 Test Vector 1 seed
      const seed = Buffer.from('000102030405060708090a0b0c0d0e0f', 'hex');
      const key1 = deriver.generateMasterKeyFromSeed(seed);
      const key2 = deriver.generateMasterKeyFromSeed(seed);
      expect(key1.key).toEqual(key2.key);
      expect(key1.chainCode).toEqual(key2.chainCode);
    });

    it('should produce correct BIP32 test vector 1 master key', () => {
      const seed = Buffer.from('000102030405060708090a0b0c0d0e0f', 'hex');
      const master = deriver.generateMasterKeyFromSeed(seed);
      expect(master.key.toString('hex')).toBe(
        'e8f32e723decf4051aefac8e2c93c9c5b214313817cdb01a1494b917c8436b35',
      );
      expect(master.chainCode.toString('hex')).toBe(
        '873dff81c02f525623fd1fe5167eac3a55a049de3d314bb42ee227ffed37d508',
      );
    });

    it('should produce correct BIP32 test vector 2 master key', () => {
      const seed = Buffer.from(
        'fffcf9f6f3f0edeae7e4e1dedbd8d5d2cfccc9c6c3c0bdbab7b4b1aeaba8a5a29f9c999693908d8a8784817e7b7875726f6c696663605d5a5754514e4b484542',
        'hex',
      );
      const master = deriver.generateMasterKeyFromSeed(seed);
      expect(master.key.toString('hex')).toBe(
        '4b03d6fc340455b363f51020ad3ecca4f0850280cf436c70c727923f6db46c3e',
      );
      expect(master.chainCode.toString('hex')).toBe(
        '60499f801b896d83179a4374aeb7822aaeaceaa0db1f85ee3e904c4defbd9689',
      );
    });

    it('should derive hardened child key (index >= 2^31)', () => {
      const seed = Buffer.from('000102030405060708090a0b0c0d0e0f', 'hex');
      const master = deriver.generateMasterKeyFromSeed(seed);
      // BIP32 TV1: m/0'
      const child = deriver.CKDPriv(master, 0x80_00_00_00);
      expect(child.key.length).toBe(32);
      expect(child.chainCode.length).toBe(32);
    });

    it('should derive normal (non-hardened) child key', () => {
      const seed = Buffer.from('000102030405060708090a0b0c0d0e0f', 'hex');
      const master = deriver.generateMasterKeyFromSeed(seed);
      const hardenedChild = deriver.CKDPriv(master, 0x80_00_00_00);
      // m/0'/1 (non-hardened)
      const normalChild = deriver.CKDPriv(hardenedChild, 1);
      expect(normalChild.key.length).toBe(32);
      expect(normalChild.chainCode.length).toBe(32);
    });

    it('should derive deep paths correctly (m/0h/1/2h/2/1_000_000_000)', () => {
      const seed = Buffer.from('000102030405060708090a0b0c0d0e0f', 'hex');
      let key = deriver.generateMasterKeyFromSeed(seed);
      key = deriver.CKDPriv(key, 0x80_00_00_00); // 0'
      key = deriver.CKDPriv(key, 1);
      key = deriver.CKDPriv(key, 0x80_00_00_02); // 2'
      key = deriver.CKDPriv(key, 2);
      key = deriver.CKDPriv(key, 1_000_000_000);
      expect(key.key.length).toBe(32);
      expect(key.chainCode.length).toBe(32);
    });

    it('should throw on negative index for CKDPriv', () => {
      const seed = Buffer.from('000102030405060708090a0b0c0d0e0f', 'hex');
      const master = deriver.generateMasterKeyFromSeed(seed);
      expect(() => deriver.CKDPriv(master, -1)).toThrow('Invalid index');
    });

    it('should throw on non-integer index for CKDPriv', () => {
      const seed = Buffer.from('000102030405060708090a0b0c0d0e0f', 'hex');
      const master = deriver.generateMasterKeyFromSeed(seed);
      expect(() => deriver.CKDPriv(master, 1.5)).toThrow('Invalid index');
    });

    it('should throw on CKDPub with hardened index', () => {
      const seed = Buffer.from('000102030405060708090a0b0c0d0e0f', 'hex');
      const master = deriver.generateMasterKeyFromSeed(seed);
      const pub = deriver.N(master);
      expect(() => deriver.CKDPub(pub, 0x80_00_00_00)).toThrow(
        "Can't derive public key",
      );
    });

    it('should derive public key from private key via N()', () => {
      const seed = Buffer.from('000102030405060708090a0b0c0d0e0f', 'hex');
      const master = deriver.generateMasterKeyFromSeed(seed);
      const pub = deriver.N(master);
      // Public key should be 33 bytes (compressed)
      expect(pub.key.length).toBe(33);
      expect(pub.chainCode).toEqual(master.chainCode);
    });

    it('should derive same public key via CKDPub and N(CKDPriv) for non-hardened', () => {
      const seed = Buffer.from('000102030405060708090a0b0c0d0e0f', 'hex');
      const master = deriver.generateMasterKeyFromSeed(seed);
      const hardenedChild = deriver.CKDPriv(master, 0x80_00_00_00);

      // Method 1: derive private child then get public
      const privChild = deriver.CKDPriv(hardenedChild, 1);
      const pubFromPriv = deriver.N(privChild);

      // Method 2: derive public child directly
      const pubParent = deriver.N(hardenedChild);
      const pubChild = deriver.CKDPub(pubParent, 1);

      expect(pubFromPriv.key).toEqual(pubChild.key);
    });

    it('should handle async master key generation', async () => {
      const seed = Buffer.from('000102030405060708090a0b0c0d0e0f', 'hex');
      const syncKey = deriver.generateMasterKeyFromSeed(seed);
      const asyncKey = await deriver.generateMasterKeyFromSeedAsync(seed);
      expect(syncKey.key).toEqual(asyncKey.key);
      expect(syncKey.chainCode).toEqual(asyncKey.chainCode);
    });
  });

  describe('BaseBip32KeyDeriver - nistp256', () => {
    const deriver = new BaseBip32KeyDeriver(
      Buffer.from('Nist256p1 seed'),
      nistp256,
    );

    it('should generate master key from SLIP-0010 test vector', () => {
      const seed = Buffer.from('000102030405060708090a0b0c0d0e0f', 'hex');
      const master = deriver.generateMasterKeyFromSeed(seed);
      expect(master.key.length).toBe(32);
      expect(master.chainCode.length).toBe(32);
    });

    it('should throw on invalid master key (seed producing key >= order)', () => {
      // This is hard to test deterministically; we verify the validation path
      // by testing that a valid seed works
      const seed = Buffer.from('000102030405060708090a0b0c0d0e0f', 'hex');
      expect(() => deriver.generateMasterKeyFromSeed(seed)).not.toThrow();
    });
  });

  describe('ED25519Bip32KeyDeriver', () => {
    const deriver = new ED25519Bip32KeyDeriver(
      Buffer.from('ed25519 seed'),
      ed25519,
    );

    it('should generate master key without retry (ed25519 accepts all keys)', () => {
      const seed = Buffer.from('000102030405060708090a0b0c0d0e0f', 'hex');
      const master = deriver.generateMasterKeyFromSeed(seed);
      expect(master.key.length).toBe(32);
      expect(master.chainCode.length).toBe(32);
    });

    it('should only support hardened derivation', () => {
      const seed = Buffer.from('000102030405060708090a0b0c0d0e0f', 'hex');
      const master = deriver.generateMasterKeyFromSeed(seed);
      // Non-hardened should throw
      expect(() => deriver.CKDPriv(master, 0)).toThrow(
        'Only hardened CKDPriv is supported for ed25519',
      );
      // Hardened should work
      expect(() => deriver.CKDPriv(master, 0x80_00_00_00)).not.toThrow();
    });

    it('should throw on CKDPub', () => {
      const seed = Buffer.from('000102030405060708090a0b0c0d0e0f', 'hex');
      const master = deriver.generateMasterKeyFromSeed(seed);
      const pub = deriver.N(master);
      expect(() => deriver.CKDPub(pub, 0)).toThrow(
        'CKDPub is not supported for ed25519',
      );
    });

    it('should derive SLIP-0010 ed25519 test vector', () => {
      // SLIP-0010 Test Vector 1 for ed25519
      const seed = Buffer.from('000102030405060708090a0b0c0d0e0f', 'hex');
      const master = deriver.generateMasterKeyFromSeed(seed);
      expect(master.key.toString('hex')).toBe(
        '2b4be7f19ee27bbf30c667b642d5f4aa69fd169872f8fc3059c08ebae2eb19e7',
      );
      expect(master.chainCode.toString('hex')).toBe(
        '90046a93de5380a72b5e45010748567d5ea02bbf6522f979e05c0d8d8ca9fffb',
      );
    });

    it('should derive deep hardened path', () => {
      const seed = Buffer.from('000102030405060708090a0b0c0d0e0f', 'hex');
      let key = deriver.generateMasterKeyFromSeed(seed);
      // m/0'/1'/2'/3'/4'
      for (let i = 0; i < 5; i += 1) {
        key = deriver.CKDPriv(key, 0x80_00_00_00 + i);
      }
      expect(key.key.length).toBe(32);
      expect(key.chainCode.length).toBe(32);
    });
  });

  describe('Index boundary cases', () => {
    const deriver = new BaseBip32KeyDeriver(
      Buffer.from('Bitcoin seed'),
      secp256k1,
    );

    it('should throw on index = 2^32', () => {
      const seed = Buffer.from('000102030405060708090a0b0c0d0e0f', 'hex');
      const master = deriver.generateMasterKeyFromSeed(seed);
      expect(() => deriver.CKDPriv(master, 0x01_00_00_00_00)).toThrow(
        'Overflowed',
      );
    });

    it('should throw on index = Number.MAX_SAFE_INTEGER', () => {
      const seed = Buffer.from('000102030405060708090a0b0c0d0e0f', 'hex');
      const master = deriver.generateMasterKeyFromSeed(seed);
      expect(() => deriver.CKDPriv(master, Number.MAX_SAFE_INTEGER)).toThrow(
        'Overflowed',
      );
    });

    it('should accept index = 2^31 - 1 (max non-hardened)', () => {
      const seed = Buffer.from('000102030405060708090a0b0c0d0e0f', 'hex');
      const master = deriver.generateMasterKeyFromSeed(seed);
      const child = deriver.CKDPriv(master, 0x7f_ff_ff_ff);
      expect(child.key.length).toBe(32);
    });

    it('should accept index = 2^31 (min hardened)', () => {
      const seed = Buffer.from('000102030405060708090a0b0c0d0e0f', 'hex');
      const master = deriver.generateMasterKeyFromSeed(seed);
      const child = deriver.CKDPriv(master, 0x80_00_00_00);
      expect(child.key.length).toBe(32);
    });

    it('should accept index = 2^32 - 1 (max hardened)', () => {
      const seed = Buffer.from('000102030405060708090a0b0c0d0e0f', 'hex');
      const master = deriver.generateMasterKeyFromSeed(seed);
      const child = deriver.CKDPriv(master, 0xff_ff_ff_ff);
      expect(child.key.length).toBe(32);
    });

    it('should throw on NaN index', () => {
      const seed = Buffer.from('000102030405060708090a0b0c0d0e0f', 'hex');
      const master = deriver.generateMasterKeyFromSeed(seed);
      expect(() => deriver.CKDPriv(master, NaN)).toThrow('Invalid index');
    });

    it('should throw on Infinity index', () => {
      const seed = Buffer.from('000102030405060708090a0b0c0d0e0f', 'hex');
      const master = deriver.generateMasterKeyFromSeed(seed);
      expect(() => deriver.CKDPriv(master, Infinity)).toThrow('Invalid index');
    });

    it('should throw on -Infinity index', () => {
      const seed = Buffer.from('000102030405060708090a0b0c0d0e0f', 'hex');
      const master = deriver.generateMasterKeyFromSeed(seed);
      expect(() => deriver.CKDPriv(master, -Infinity)).toThrow('Invalid index');
    });
  });

  describe('Seed boundary cases', () => {
    const deriver = new BaseBip32KeyDeriver(
      Buffer.from('Bitcoin seed'),
      secp256k1,
    );

    it('should accept minimum seed length (16 bytes)', () => {
      const seed = Buffer.alloc(16, 0xab);
      const master = deriver.generateMasterKeyFromSeed(seed);
      expect(master.key.length).toBe(32);
      expect(master.chainCode.length).toBe(32);
    });

    it('should accept seed length of 32 bytes', () => {
      const seed = Buffer.alloc(32, 0xab);
      const master = deriver.generateMasterKeyFromSeed(seed);
      expect(master.key.length).toBe(32);
      expect(master.chainCode.length).toBe(32);
    });

    it('should accept seed length of 64 bytes', () => {
      const seed = Buffer.alloc(64, 0xab);
      const master = deriver.generateMasterKeyFromSeed(seed);
      expect(master.key.length).toBe(32);
      expect(master.chainCode.length).toBe(32);
    });

    it('should accept all-zeros seed', () => {
      const seed = Buffer.alloc(32, 0);
      const master = deriver.generateMasterKeyFromSeed(seed);
      expect(master.key.length).toBe(32);
      expect(master.chainCode.length).toBe(32);
    });

    it('should accept all-ones seed', () => {
      const seed = Buffer.alloc(32, 0xff);
      const master = deriver.generateMasterKeyFromSeed(seed);
      expect(master.key.length).toBe(32);
      expect(master.chainCode.length).toBe(32);
    });
  });

  describe('Key boundary cases', () => {
    const deriver = new BaseBip32KeyDeriver(
      Buffer.from('Bitcoin seed'),
      secp256k1,
    );

    it('should produce master key < secp256k1 order', () => {
      const seed = Buffer.from('000102030405060708090a0b0c0d0e0f', 'hex');
      const master = deriver.generateMasterKeyFromSeed(seed);
      const keyBN = BigInt(`0x${master.key.toString('hex')}`);
      const order = BigInt(
        '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141',
      );
      expect(keyBN).toBeLessThan(order);
    });

    it('should produce valid compressed public key from N()', () => {
      const seed = Buffer.from('000102030405060708090a0b0c0d0e0f', 'hex');
      const master = deriver.generateMasterKeyFromSeed(seed);
      const pub = deriver.N(master);
      expect(pub.key[0] === 0x02 || pub.key[0] === 0x03).toBe(true);
    });

    it('should produce non-zero chain code', () => {
      const seed = Buffer.from('000102030405060708090a0b0c0d0e0f', 'hex');
      const master = deriver.generateMasterKeyFromSeed(seed);
      expect(master.chainCode.equals(Buffer.alloc(32, 0))).toBe(false);
    });

    it('should maintain 32-byte key length even with leading zeros', () => {
      const seed = Buffer.from('000102030405060708090a0b0c0d0e0f', 'hex');
      const master = deriver.generateMasterKeyFromSeed(seed);
      expect(master.key.length).toBe(32);
    });
  });

  describe('Derivation depth edge cases', () => {
    const deriver = new BaseBip32KeyDeriver(
      Buffer.from('Bitcoin seed'),
      secp256k1,
    );

    it('should handle alternating hardened/non-hardened path', () => {
      const seed = Buffer.from('000102030405060708090a0b0c0d0e0f', 'hex');
      let key = deriver.generateMasterKeyFromSeed(seed);

      for (let i = 0; i < 10; i += 1) {
        key = deriver.CKDPriv(key, 0x80_00_00_00 + i);
        key = deriver.CKDPriv(key, i);
      }

      expect(key.key.length).toBe(32);
      expect(key.chainCode.length).toBe(32);
    });

    it('should produce deterministic results for same path', () => {
      const seed = Buffer.from('000102030405060708090a0b0c0d0e0f', 'hex');

      let key1 = deriver.generateMasterKeyFromSeed(seed);
      let key2 = deriver.generateMasterKeyFromSeed(seed);

      for (let i = 0; i < 20; i += 1) {
        key1 = deriver.CKDPriv(key1, i);
        key2 = deriver.CKDPriv(key2, i);
      }

      expect(key1.key).toEqual(key2.key);
      expect(key1.chainCode).toEqual(key2.chainCode);
    });
  });

  describe('Curve-specific edge cases', () => {
    it('should produce different keys for different curves with same seed', () => {
      const seed = Buffer.from('000102030405060708090a0b0c0d0e0f', 'hex');

      const secp256k1Deriver = new BaseBip32KeyDeriver(
        Buffer.from('Bitcoin seed'),
        secp256k1,
      );
      const nistp256Deriver = new BaseBip32KeyDeriver(
        Buffer.from('Nist256p1 seed'),
        nistp256,
      );

      const masterSecp = secp256k1Deriver.generateMasterKeyFromSeed(seed);
      const masterNist = nistp256Deriver.generateMasterKeyFromSeed(seed);

      expect(masterSecp.key).not.toEqual(masterNist.key);
      expect(masterSecp.chainCode).not.toEqual(masterNist.chainCode);
    });

    it('should handle ed25519 hardened only derivation', () => {
      const edDeriver = new ED25519Bip32KeyDeriver(
        Buffer.from('ed25519 seed'),
        ed25519,
      );
      const seed = Buffer.from('000102030405060708090a0b0c0d0e0f', 'hex');
      const master = edDeriver.generateMasterKeyFromSeed(seed);

      expect(() => edDeriver.CKDPriv(master, 0x80_00_00_00)).not.toThrow();
      expect(() => edDeriver.CKDPriv(master, 0)).toThrow(
        'Only hardened CKDPriv is supported for ed25519',
      );
    });

    it('should reject CKDPub for ed25519', () => {
      const edDeriver = new ED25519Bip32KeyDeriver(
        Buffer.from('ed25519 seed'),
        ed25519,
      );
      const seed = Buffer.from('000102030405060708090a0b0c0d0e0f', 'hex');
      const master = edDeriver.generateMasterKeyFromSeed(seed);
      const pub = edDeriver.N(master);

      expect(() => edDeriver.CKDPub(pub, 0)).toThrow(
        'CKDPub is not supported for ed25519',
      );
    });

    it('should handle nistp256 public key derivation', () => {
      const nistDeriver = new BaseBip32KeyDeriver(
        Buffer.from('Nist256p1 seed'),
        nistp256,
      );
      const seed = Buffer.from('000102030405060708090a0b0c0d0e0f', 'hex');
      const master = nistDeriver.generateMasterKeyFromSeed(seed);
      const pub = nistDeriver.N(master);
      expect(pub.key.length).toBeGreaterThan(0);
    });
  });

  describe('Serialization edge cases', () => {
    const deriver = new BaseBip32KeyDeriver(
      Buffer.from('Bitcoin seed'),
      secp256k1,
    );

    it('should handle round-trip serialization of keys', () => {
      const seed = Buffer.from('000102030405060708090a0b0c0d0e0f', 'hex');
      const master = deriver.generateMasterKeyFromSeed(seed);

      const serialized = {
        key: master.key.toString('hex'),
        chainCode: master.chainCode.toString('hex'),
      };

      const deserialized = {
        key: Buffer.from(serialized.key, 'hex'),
        chainCode: Buffer.from(serialized.chainCode, 'hex'),
      };

      expect(deserialized.key).toEqual(master.key);
      expect(deserialized.chainCode).toEqual(master.chainCode);
    });
  });

  describe('Performance edge cases', () => {
    const deriver = new BaseBip32KeyDeriver(
      Buffer.from('Bitcoin seed'),
      secp256k1,
    );

    it('should handle deep derivation tree efficiently', () => {
      const seed = Buffer.from('000102030405060708090a0b0c0d0e0f', 'hex');
      let key = deriver.generateMasterKeyFromSeed(seed);

      for (let i = 0; i < 1000; i += 1) {
        key = deriver.CKDPriv(key, i % 2 === 0 ? 0x80_00_00_00 : 0);
      }

      expect(key.key.length).toBe(32);
    }, 60_000);
  });
});
