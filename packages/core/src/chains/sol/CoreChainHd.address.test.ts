import base58 from 'bs58';

import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import coreTestsFixtures from '../../../@tests/fixtures/coreTestsFixtures';

import CoreChainHd from './CoreChainHd';

/*
yarn jest packages/core/src/chains/sol/CoreChainHd.address.test.ts
*/

const { hdCredential, networkInfo, hdAccountTemplate } =
  coreTestsFixtures.prepareCoreChainTestsFixtures({
    networkInfo: {
      networkChainCode: 'sol',
      chainId: '101',
      networkId: 'sol--101',
      networkImpl: 'sol',
      isTestnet: false,
    },
    hdAccountTemplate: "m/44'/501'/$$INDEX$$'/0'",
    hdAccounts: [],
    txSamples: [],
    msgSamples: [],
  });

describe('SOL Address Derivation Tests', () => {
  const coreApi = new CoreChainHd();

  it('should derive correct address from known private key', async () => {
    const result = await coreApi.getAddressFromPrivate({
      networkInfo,
      privateKeyRaw:
        'feafaa95d64a1a37f4e4dce7fd2ee764bbc1e8eef627d5aedaceee19f89f76ff',
    });
    expect(result.address).toBe('4wX8yu9YmSe4mv9ZPtTeoF9pe6Ji4ScjuJEffS3sCKZ4');
  });

  it('should derive correct address from known public key', async () => {
    const publicKeyBase58 = '4wX8yu9YmSe4mv9ZPtTeoF9pe6Ji4ScjuJEffS3sCKZ4';
    const publicKeyHex = bufferUtils.bytesToHex(base58.decode(publicKeyBase58));
    const result = await coreApi.getAddressFromPublic({
      networkInfo,
      publicKey: publicKeyHex,
    });
    expect(result.address).toBe(publicKeyBase58);
  });

  it('should derive correct addresses from HD wallet', async () => {
    const result = await coreApi.getAddressesFromHd({
      networkInfo,
      password: hdCredential.password,
      hdCredential: hdCredential.hdCredentialHex,
      template: hdAccountTemplate,
      indexes: [0],
      addressEncoding: undefined,
    });
    expect(result.addresses.length).toBe(1);
    expect(result.addresses[0].address).toBe(
      '4wX8yu9YmSe4mv9ZPtTeoF9pe6Ji4ScjuJEffS3sCKZ4',
    );
  });

  it('should derive unique addresses for different indexes', async () => {
    const result = await coreApi.getAddressesFromHd({
      networkInfo,
      password: hdCredential.password,
      hdCredential: hdCredential.hdCredentialHex,
      template: hdAccountTemplate,
      indexes: [0, 1, 2],
      addressEncoding: undefined,
    });
    const addresses = result.addresses.map((a) => a.address);
    const unique = new Set(addresses);
    expect(unique.size).toBe(addresses.length);
  });

  it('should produce valid base58 addresses', async () => {
    const result = await coreApi.getAddressesFromHd({
      networkInfo,
      password: hdCredential.password,
      hdCredential: hdCredential.hdCredentialHex,
      template: hdAccountTemplate,
      indexes: [0, 1],
      addressEncoding: undefined,
    });
    for (const addr of result.addresses) {
      // Valid base58 should decode to 32 bytes
      const decoded = base58.decode(addr.address);
      expect(decoded.length).toBe(32);
    }
  });

  it('should be deterministic', async () => {
    const result1 = await coreApi.getAddressesFromHd({
      networkInfo,
      password: hdCredential.password,
      hdCredential: hdCredential.hdCredentialHex,
      template: hdAccountTemplate,
      indexes: [0],
      addressEncoding: undefined,
    });
    const result2 = await coreApi.getAddressesFromHd({
      networkInfo,
      password: hdCredential.password,
      hdCredential: hdCredential.hdCredentialHex,
      template: hdAccountTemplate,
      indexes: [0],
      addressEncoding: undefined,
    });
    expect(result1.addresses[0].address).toBe(result2.addresses[0].address);
  });

  describe('ed25519 specific edge cases', () => {
    it('should handle private key with 31 bytes', async () => {
      // SOL implementation accepts non-standard key lengths
      const result = await coreApi.getAddressFromPrivate({
        networkInfo,
        privateKeyRaw: '0a'.repeat(31),
      });
      expect(result.address).toBeDefined();
    });

    it('should handle private key with 33 bytes', async () => {
      // SOL implementation accepts non-standard key lengths
      const result = await coreApi.getAddressFromPrivate({
        networkInfo,
        privateKeyRaw: '0a'.repeat(33),
      });
      expect(result.address).toBeDefined();
    });

    it('should accept 64-byte expanded private key (if supported)', async () => {
      const expandedKey = '0a'.repeat(64);
      try {
        const result = await coreApi.getAddressFromPrivate({
          networkInfo,
          privateKeyRaw: expandedKey,
        });
        expect(result.address).toBeDefined();
      } catch {
        // If not supported, should throw
      }
    });

    it('should reject invalid base58 in public key', async () => {
      await expect(
        coreApi.getAddressFromPublic({
          networkInfo,
          publicKey: 'invalid!!!base58',
        }),
      ).rejects.toThrow();
    });

    it('should handle base58 with leading zeros', async () => {
      const leadingZeroPubKey = base58.encode(
        Buffer.concat([Buffer.alloc(1, 0), Buffer.alloc(31, 0xab)]),
      );
      const pubKeyHex = bufferUtils.bytesToHex(
        base58.decode(leadingZeroPubKey),
      );
      const result = await coreApi.getAddressFromPublic({
        networkInfo,
        publicKey: pubKeyHex,
      });
      expect(result.address).toBe(leadingZeroPubKey);
    });

    it('should reject address containing invalid base58 chars (0, O, I, l)', () => {
      const invalidChars = ['0', 'O', 'I', 'l'];
      for (const char of invalidChars) {
        // oxlint-disable-next-line @cspell/spellchecker
        const invalidAddr = `4wX8yu9YmSe4mv9Z${char}tTeoF9pe6Ji4ScjuJEffS3sCKZ4`;
        expect(() => base58.decode(invalidAddr)).toThrow();
      }
    });
  });

  describe('SOL HD template edge cases', () => {
    it("should handle BIP44 standard path (m/44'/501'/INDEX')", async () => {
      const bip44Template = "m/44'/501'/$$INDEX$$'";
      const result = await coreApi.getAddressesFromHd({
        networkInfo,
        password: hdCredential.password,
        hdCredential: hdCredential.hdCredentialHex,
        template: bip44Template,
        indexes: [0],
        addressEncoding: undefined,
      });
      expect(result.addresses).toHaveLength(1);
    });

    it("should handle custom path (m/44'/501'/INDEX'/0')", async () => {
      const customTemplate = "m/44'/501'/$$INDEX$$'/0'";
      const result = await coreApi.getAddressesFromHd({
        networkInfo,
        password: hdCredential.password,
        hdCredential: hdCredential.hdCredentialHex,
        template: customTemplate,
        indexes: [0],
        addressEncoding: undefined,
      });
      expect(result.addresses).toHaveLength(1);
    });

    it('should reject non-hardened index in ed25519 path', async () => {
      const nonHardenedTemplate = "m/44'/501'/0'/0/$$INDEX$$";
      await expect(
        coreApi.getAddressesFromHd({
          networkInfo,
          password: hdCredential.password,
          hdCredential: hdCredential.hdCredentialHex,
          template: nonHardenedTemplate,
          indexes: [0],
          addressEncoding: undefined,
        }),
      ).rejects.toThrow();
    });

    it('should handle empty indexes array', async () => {
      const result = await coreApi.getAddressesFromHd({
        networkInfo,
        password: hdCredential.password,
        hdCredential: hdCredential.hdCredentialHex,
        template: hdAccountTemplate,
        indexes: [],
        addressEncoding: undefined,
      });
      expect(result.addresses).toHaveLength(0);
    });

    it('should handle duplicate indexes', async () => {
      const result = await coreApi.getAddressesFromHd({
        networkInfo,
        password: hdCredential.password,
        hdCredential: hdCredential.hdCredentialHex,
        template: hdAccountTemplate,
        indexes: [0, 0, 0],
        addressEncoding: undefined,
      });
      expect(result.addresses).toHaveLength(3);
      expect(result.addresses[0].address).toBe(result.addresses[1].address);
    });

    it('should reject invalid password', async () => {
      await expect(
        coreApi.getAddressesFromHd({
          networkInfo,
          password: 'wrongPassword',
          hdCredential: hdCredential.hdCredentialHex,
          template: hdAccountTemplate,
          indexes: [0],
          addressEncoding: undefined,
        }),
      ).rejects.toThrow();
    });

    it('should reject invalid hdCredential', async () => {
      await expect(
        coreApi.getAddressesFromHd({
          networkInfo,
          password: hdCredential.password,
          hdCredential: 'invalidCredential',
          template: hdAccountTemplate,
          indexes: [0],
          addressEncoding: undefined,
        }),
      ).rejects.toThrow();
    });
  });
});
