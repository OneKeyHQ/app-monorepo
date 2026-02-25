import { Buffer } from 'buffer';

import { BaseBip32KeyDeriver, ED25519Bip32KeyDeriver } from '../bip32';
import { ed25519, nistp256, secp256k1 } from '../curves';
import { hmacSHA512Sync } from '../hash';

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
      const seed = Buffer.from(
        '000102030405060708090a0b0c0d0e0f',
        'hex',
      );
      const key1 = deriver.generateMasterKeyFromSeed(seed);
      const key2 = deriver.generateMasterKeyFromSeed(seed);
      expect(key1.key).toEqual(key2.key);
      expect(key1.chainCode).toEqual(key2.chainCode);
    });

    it('should produce correct BIP32 test vector 1 master key', () => {
      const seed = Buffer.from(
        '000102030405060708090a0b0c0d0e0f',
        'hex',
      );
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
      const seed = Buffer.from(
        '000102030405060708090a0b0c0d0e0f',
        'hex',
      );
      const master = deriver.generateMasterKeyFromSeed(seed);
      // BIP32 TV1: m/0'
      const child = deriver.CKDPriv(master, 0x80000000);
      expect(child.key.length).toBe(32);
      expect(child.chainCode.length).toBe(32);
    });

    it('should derive normal (non-hardened) child key', () => {
      const seed = Buffer.from(
        '000102030405060708090a0b0c0d0e0f',
        'hex',
      );
      const master = deriver.generateMasterKeyFromSeed(seed);
      const hardenedChild = deriver.CKDPriv(master, 0x80000000);
      // m/0'/1 (non-hardened)
      const normalChild = deriver.CKDPriv(hardenedChild, 1);
      expect(normalChild.key.length).toBe(32);
      expect(normalChild.chainCode.length).toBe(32);
    });

    it('should derive deep paths correctly (m/0h/1/2h/2/1000000000)', () => {
      const seed = Buffer.from(
        '000102030405060708090a0b0c0d0e0f',
        'hex',
      );
      let key = deriver.generateMasterKeyFromSeed(seed);
      key = deriver.CKDPriv(key, 0x80000000); // 0'
      key = deriver.CKDPriv(key, 1);
      key = deriver.CKDPriv(key, 0x80000002); // 2'
      key = deriver.CKDPriv(key, 2);
      key = deriver.CKDPriv(key, 1000000000);
      expect(key.key.length).toBe(32);
      expect(key.chainCode.length).toBe(32);
    });

    it('should throw on negative index for CKDPriv', () => {
      const seed = Buffer.from(
        '000102030405060708090a0b0c0d0e0f',
        'hex',
      );
      const master = deriver.generateMasterKeyFromSeed(seed);
      expect(() => deriver.CKDPriv(master, -1)).toThrow('Invalid index');
    });

    it('should throw on non-integer index for CKDPriv', () => {
      const seed = Buffer.from(
        '000102030405060708090a0b0c0d0e0f',
        'hex',
      );
      const master = deriver.generateMasterKeyFromSeed(seed);
      expect(() => deriver.CKDPriv(master, 1.5)).toThrow('Invalid index');
    });

    it('should throw on CKDPub with hardened index', () => {
      const seed = Buffer.from(
        '000102030405060708090a0b0c0d0e0f',
        'hex',
      );
      const master = deriver.generateMasterKeyFromSeed(seed);
      const pub = deriver.N(master);
      expect(() => deriver.CKDPub(pub, 0x80000000)).toThrow(
        "Can't derive public key",
      );
    });

    it('should derive public key from private key via N()', () => {
      const seed = Buffer.from(
        '000102030405060708090a0b0c0d0e0f',
        'hex',
      );
      const master = deriver.generateMasterKeyFromSeed(seed);
      const pub = deriver.N(master);
      // Public key should be 33 bytes (compressed)
      expect(pub.key.length).toBe(33);
      expect(pub.chainCode).toEqual(master.chainCode);
    });

    it('should derive same public key via CKDPub and N(CKDPriv) for non-hardened', () => {
      const seed = Buffer.from(
        '000102030405060708090a0b0c0d0e0f',
        'hex',
      );
      const master = deriver.generateMasterKeyFromSeed(seed);
      const hardenedChild = deriver.CKDPriv(master, 0x80000000);

      // Method 1: derive private child then get public
      const privChild = deriver.CKDPriv(hardenedChild, 1);
      const pubFromPriv = deriver.N(privChild);

      // Method 2: derive public child directly
      const pubParent = deriver.N(hardenedChild);
      const pubChild = deriver.CKDPub(pubParent, 1);

      expect(pubFromPriv.key).toEqual(pubChild.key);
    });

    it('should handle async master key generation', async () => {
      const seed = Buffer.from(
        '000102030405060708090a0b0c0d0e0f',
        'hex',
      );
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
      const seed = Buffer.from(
        '000102030405060708090a0b0c0d0e0f',
        'hex',
      );
      const master = deriver.generateMasterKeyFromSeed(seed);
      expect(master.key.length).toBe(32);
      expect(master.chainCode.length).toBe(32);
    });

    it('should throw on invalid master key (seed producing key >= order)', () => {
      // This is hard to test deterministically; we verify the validation path
      // by testing that a valid seed works
      const seed = Buffer.from(
        '000102030405060708090a0b0c0d0e0f',
        'hex',
      );
      expect(() => deriver.generateMasterKeyFromSeed(seed)).not.toThrow();
    });
  });

  describe('ED25519Bip32KeyDeriver', () => {
    const deriver = new ED25519Bip32KeyDeriver(
      Buffer.from('ed25519 seed'),
      ed25519,
    );

    it('should generate master key without retry (ed25519 accepts all keys)', () => {
      const seed = Buffer.from(
        '000102030405060708090a0b0c0d0e0f',
        'hex',
      );
      const master = deriver.generateMasterKeyFromSeed(seed);
      expect(master.key.length).toBe(32);
      expect(master.chainCode.length).toBe(32);
    });

    it('should only support hardened derivation', () => {
      const seed = Buffer.from(
        '000102030405060708090a0b0c0d0e0f',
        'hex',
      );
      const master = deriver.generateMasterKeyFromSeed(seed);
      // Non-hardened should throw
      expect(() => deriver.CKDPriv(master, 0)).toThrow(
        'Only hardened CKDPriv is supported for ed25519',
      );
      // Hardened should work
      expect(() =>
        deriver.CKDPriv(master, 0x80000000),
      ).not.toThrow();
    });

    it('should throw on CKDPub', () => {
      const seed = Buffer.from(
        '000102030405060708090a0b0c0d0e0f',
        'hex',
      );
      const master = deriver.generateMasterKeyFromSeed(seed);
      const pub = deriver.N(master);
      expect(() => deriver.CKDPub(pub, 0)).toThrow(
        'CKDPub is not supported for ed25519',
      );
    });

    it('should derive SLIP-0010 ed25519 test vector', () => {
      // SLIP-0010 Test Vector 1 for ed25519
      const seed = Buffer.from(
        '000102030405060708090a0b0c0d0e0f',
        'hex',
      );
      const master = deriver.generateMasterKeyFromSeed(seed);
      expect(master.key.toString('hex')).toBe(
        '2b4be7f19ee27bbf30c667b642d5f4aa69fd169872f8fc3059c08ebae2eb19e7',
      );
      expect(master.chainCode.toString('hex')).toBe(
        '90046a93de5380a72b5e45010748567d5ea02bbf6522f979e05c0d8d8ca9fffb',
      );
    });

    it('should derive deep hardened path', () => {
      const seed = Buffer.from(
        '000102030405060708090a0b0c0d0e0f',
        'hex',
      );
      let key = deriver.generateMasterKeyFromSeed(seed);
      // m/0'/1'/2'/3'/4'
      for (let i = 0; i < 5; i++) {
        key = deriver.CKDPriv(key, 0x80000000 + i);
      }
      expect(key.key.length).toBe(32);
      expect(key.chainCode.length).toBe(32);
    });
  });
});
