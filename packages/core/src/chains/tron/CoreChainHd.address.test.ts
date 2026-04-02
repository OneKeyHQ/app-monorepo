import coreTestsFixtures from '../../../@tests/fixtures/coreTestsFixtures';

import CoreChainHd from './CoreChainHd';

/*
yarn jest packages/core/src/chains/tron/CoreChainHd.address.test.ts
*/

const { hdCredential, networkInfo, hdAccountTemplate } =
  coreTestsFixtures.prepareCoreChainTestsFixtures({
    networkInfo: {
      networkChainCode: 'tron',
      chainId: '0',
      networkId: 'tron--0x2b6653dc',
      networkImpl: 'tron',
      isTestnet: false,
    },
    hdAccountTemplate: "m/44'/195'/0'/0/$$INDEX$$",
    hdAccounts: [],
    txSamples: [],
    msgSamples: [],
  });

describe('TRON Address Derivation Tests', () => {
  const coreApi = new CoreChainHd();

  it('should derive correct address from known public key', async () => {
    const result = await coreApi.getAddressFromPublic({
      networkInfo,
      publicKey:
        '025414abc40dbcb07c2204e04a34261090851bb28e1616ba77212d3d270d4b4761',
    });
    expect(result.address).toBe('TNsC5fdh1ZfbTZpMjbiXZifseoxKRgNrqb');
  });

  it('should derive correct address from known private key', async () => {
    const result = await coreApi.getAddressFromPrivate({
      networkInfo,
      privateKeyRaw:
        '435e5da99714e2806ea1b0b93db43d4e74ecaab786d7f1a55a155b855542b907',
    });
    expect(result.address).toBe('TNsC5fdh1ZfbTZpMjbiXZifseoxKRgNrqb');
  });

  it('should derive correct addresses from HD wallet for multiple indexes', async () => {
    const result = await coreApi.getAddressesFromHd({
      networkInfo,
      password: hdCredential.password,
      hdCredential: hdCredential.hdCredentialHex,
      template: hdAccountTemplate,
      indexes: [0, 1, 2],
      addressEncoding: undefined,
    });
    expect(result.addresses.length).toBe(3);
    // First address from standard test mnemonic
    expect(result.addresses[0].address).toBe(
      'TNsC5fdh1ZfbTZpMjbiXZifseoxKRgNrqb',
    );
    // All addresses should be valid TRON format (T prefix, base58check)
    for (const addr of result.addresses) {
      expect(addr.address).toMatch(/^T[1-9A-HJ-NP-Za-km-z]{33}$/);
    }
  });

  it('should derive unique addresses for different indexes', async () => {
    const result = await coreApi.getAddressesFromHd({
      networkInfo,
      password: hdCredential.password,
      hdCredential: hdCredential.hdCredentialHex,
      template: hdAccountTemplate,
      indexes: [0, 1, 2, 3, 4],
      addressEncoding: undefined,
    });
    const addresses = result.addresses.map((a) => a.address);
    const unique = new Set(addresses);
    expect(unique.size).toBe(addresses.length);
  });

  it('should produce deterministic results for same index', async () => {
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
    expect(result1.addresses[0].publicKey).toBe(result2.addresses[0].publicKey);
  });

  it('should produce consistent address from public and private key', async () => {
    const fromPub = await coreApi.getAddressFromPublic({
      networkInfo,
      publicKey:
        '025414abc40dbcb07c2204e04a34261090851bb28e1616ba77212d3d270d4b4761',
    });
    const fromPriv = await coreApi.getAddressFromPrivate({
      networkInfo,
      privateKeyRaw:
        '435e5da99714e2806ea1b0b93db43d4e74ecaab786d7f1a55a155b855542b907',
    });
    expect(fromPub.address).toBe(fromPriv.address);
  });

  describe('Invalid public key inputs', () => {
    it('should reject empty public key', async () => {
      await expect(
        coreApi.getAddressFromPublic({
          networkInfo,
          publicKey: '',
        }),
      ).rejects.toThrow();
    });

    it('should reject non-hex characters', async () => {
      await expect(
        coreApi.getAddressFromPublic({
          networkInfo,
          publicKey:
            '0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG',
        }),
      ).rejects.toThrow();
    });

    it('should reject public key with 0x prefix only', async () => {
      await expect(
        coreApi.getAddressFromPublic({
          networkInfo,
          publicKey: '0x',
        }),
      ).rejects.toThrow();
    });
  });

  describe('Invalid private key inputs', () => {
    it('should reject empty private key', async () => {
      await expect(
        coreApi.getAddressFromPrivate({
          networkInfo,
          privateKeyRaw: '',
        }),
      ).rejects.toThrow();
    });

    it('should handle private key with non-standard length (31 bytes)', async () => {
      // secp256k1 implementations may accept non-standard lengths by padding
      const result = await coreApi.getAddressFromPrivate({
        networkInfo,
        privateKeyRaw: '0a'.repeat(31),
      });
      expect(result.address).toMatch(/^T[1-9A-HJ-NP-Za-km-z]{33}$/);
    });

    it('should reject all-zeros private key', async () => {
      await expect(
        coreApi.getAddressFromPrivate({
          networkInfo,
          privateKeyRaw: '00'.repeat(32),
        }),
      ).rejects.toThrow();
    });
  });

  describe('HD derivation edge cases', () => {
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
      expect(result.addresses[1].address).toBe(result.addresses[2].address);
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

  describe('Security edge cases', () => {
    it('should not leak sensitive data in error messages', async () => {
      expect.assertions(2);
      try {
        await coreApi.getAddressesFromHd({
          networkInfo,
          password: 'wrongPassword',
          hdCredential: hdCredential.hdCredentialHex,
          template: hdAccountTemplate,
          indexes: [0],
          addressEncoding: undefined,
        });
      } catch (error: any) {
        expect(error.message).not.toContain('wrongPassword');
        expect(error.message).not.toContain(hdCredential.password);
      }
    });
  });
});
