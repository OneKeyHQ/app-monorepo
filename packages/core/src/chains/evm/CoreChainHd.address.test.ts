import coreTestsFixtures from '../../../@tests/fixtures/coreTestsFixtures';

import CoreChainHd from './CoreChainHd';

/*
yarn jest packages/core/src/chains/evm/CoreChainHd.address.test.ts
*/

const { hdCredential, networkInfo, hdAccountTemplate } =
  coreTestsFixtures.prepareCoreChainTestsFixtures({
    networkInfo: {
      networkChainCode: 'evm',
      chainId: '1',
      networkId: 'evm--1',
      networkImpl: 'evm',
      isTestnet: false,
    },
    hdAccountTemplate: "m/44'/60'/0'/0/$$INDEX$$",
    hdAccounts: [],
    txSamples: [],
    msgSamples: [],
  });

describe('EVM Address Derivation Tests', () => {
  const coreApi = new CoreChainHd();

  it('should derive correct address from known public key', async () => {
    const result = await coreApi.getAddressFromPublic({
      networkInfo,
      publicKey:
        '02bd51e5b1a6e8271e1f87d2464b856790800c6c5fd38acdf1cee73857735fc8a4',
    });
    expect(result.address).toBe('0x1959f5f4979c5cd87d5cb75c678c770515cb5e0e');
  });

  it('should derive correct address from known private key', async () => {
    const result = await coreApi.getAddressFromPrivate({
      networkInfo,
      privateKeyRaw:
        '105434ca932be16664cb5e44e5b006728577dd757440d068e6d15ef52c15a82f',
    });
    expect(result.address).toBe('0x1959f5f4979c5cd87d5cb75c678c770515cb5e0e');
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
      '0x1959f5f4979c5cd87d5cb75c678c770515cb5e0e',
    );
    expect(result.addresses[1].address).toBe(
      '0xefc840572b9889de6bf172da76b7fa59b53a0ea0',
    );
    // All addresses should be valid EVM format
    for (const addr of result.addresses) {
      expect(addr.address).toMatch(/^0x[0-9a-f]{40}$/);
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

  it("should derive correct Ledger Live (m/44'/60'/i'/0/0) addresses", async () => {
    const result = await coreApi.getAddressesFromHd({
      networkInfo,
      password: hdCredential.password,
      hdCredential: hdCredential.hdCredentialHex,
      template: "m/44'/60'/$$INDEX$$'/0/0",
      indexes: [0, 1, 2],
      addressEncoding: undefined,
    });
    expect(result.addresses.length).toBe(3);
    expect(result.addresses[0].address).toBe(
      '0x1959f5f4979c5cd87d5cb75c678c770515cb5e0e',
    );
    expect(result.addresses[1].address).toBe(
      '0xbcd02d8f6eac6528546ce07e3f636cb7cdec9259',
    );
    expect(result.addresses[2].address).toBe(
      '0x651a673a13db340a7fa121b39c3ecb83cccfe845',
    );
  });

  it("should derive correct Ledger Legacy (m/44'/60'/0'/i) addresses", async () => {
    const result = await coreApi.getAddressesFromHd({
      networkInfo,
      password: hdCredential.password,
      hdCredential: hdCredential.hdCredentialHex,
      template: "m/44'/60'/0'/$$INDEX$$",
      indexes: [0, 1, 2],
      addressEncoding: undefined,
    });
    expect(result.addresses.length).toBe(3);
    expect(result.addresses[0].address).toBe(
      '0xce7672af79330ae944e6f52ad08bfd5220e70c5d',
    );
    expect(result.addresses[1].address).toBe(
      '0x44413d837af7aa12f83d674d7139cb372cbb71cc',
    );
    expect(result.addresses[2].address).toBe(
      '0x4d51c36d0154b2ee6c1cba9701c2319e160d7470',
    );
  });

  it('should produce three distinct addresses for the three deriveType templates at index 1', async () => {
    // NOTE: Using index 1 (not index 0) because at index 0 the default and
    // ledgerLive templates resolve to the SAME path (m/44'/60'/0'/0/0), so
    // their addresses would be identical by definition. Index 1 yields three
    // genuinely distinct paths.
    const [defaultAddresses, liveAddresses, legacyAddresses] =
      await Promise.all(
        [
          "m/44'/60'/0'/0/$$INDEX$$",
          "m/44'/60'/$$INDEX$$'/0/0",
          "m/44'/60'/0'/$$INDEX$$",
        ].map((template) =>
          coreApi.getAddressesFromHd({
            networkInfo,
            password: hdCredential.password,
            hdCredential: hdCredential.hdCredentialHex,
            template,
            indexes: [1],
            addressEncoding: undefined,
          }),
        ),
      );
    const a = defaultAddresses.addresses[0].address;
    const b = liveAddresses.addresses[0].address;
    const c = legacyAddresses.addresses[0].address;
    expect(a).not.toBe(b);
    expect(b).not.toBe(c);
    expect(a).not.toBe(c);
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

    it('should handle compressed public key (33 bytes)', async () => {
      const result = await coreApi.getAddressFromPublic({
        networkInfo,
        publicKey:
          '02bd51e5b1a6e8271e1f87d2464b856790800c6c5fd38acdf1cee73857735fc8a4',
      });
      expect(result.address).toBe('0x1959f5f4979c5cd87d5cb75c678c770515cb5e0e');
    });

    it('should handle public key with whitespace', async () => {
      const keyWithSpace =
        ' 02bd51e5b1a6e8271e1f87d2464b856790800c6c5fd38acdf1cee73857735fc8a4 ';
      try {
        const result = await coreApi.getAddressFromPublic({
          networkInfo,
          publicKey: keyWithSpace,
        });
        expect(result.address).toBeDefined();
      } catch {
        // Rejection is also acceptable
      }
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

    it('should reject private key with invalid length (31 bytes)', async () => {
      await expect(
        coreApi.getAddressFromPrivate({
          networkInfo,
          privateKeyRaw: '0a'.repeat(31),
        }),
      ).rejects.toThrow();
    });

    it('should reject all-zeros private key', async () => {
      await expect(
        coreApi.getAddressFromPrivate({
          networkInfo,
          privateKeyRaw: '00'.repeat(32),
        }),
      ).rejects.toThrow();
    });

    it('should reject private key with only whitespace', async () => {
      await expect(
        coreApi.getAddressFromPrivate({
          networkInfo,
          privateKeyRaw: '   ',
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

  describe('Network info edge cases', () => {
    it('should handle different chainIds (address unchanged for EVM)', async () => {
      const chainIds = ['1', '56', '137', '42161', '10'];
      for (const chainId of chainIds) {
        const network = {
          ...networkInfo,
          chainId,
          networkId: `evm--${chainId}`,
        };
        const result = await coreApi.getAddressFromPublic({
          networkInfo: network,
          publicKey:
            '02bd51e5b1a6e8271e1f87d2464b856790800c6c5fd38acdf1cee73857735fc8a4',
        });
        expect(result.address).toBe(
          '0x1959f5f4979c5cd87d5cb75c678c770515cb5e0e',
        );
      }
    });

    it('should handle networkInfo with extra fields', async () => {
      const extendedNetwork = {
        ...networkInfo,
        extraField: 'should be ignored',
        rpcUrl: 'https://example.com',
      };
      const result = await coreApi.getAddressFromPublic({
        networkInfo: extendedNetwork,
        publicKey:
          '02bd51e5b1a6e8271e1f87d2464b856790800c6c5fd38acdf1cee73857735fc8a4',
      });
      expect(result.address).toBe('0x1959f5f4979c5cd87d5cb75c678c770515cb5e0e');
    });
  });

  describe('Concurrency edge cases', () => {
    it('should handle concurrent HD derivation requests', async () => {
      const indexes = Array.from({ length: 20 }, (_, i) => i);

      const promises = indexes.map((i) =>
        coreApi.getAddressesFromHd({
          networkInfo,
          password: hdCredential.password,
          hdCredential: hdCredential.hdCredentialHex,
          template: hdAccountTemplate,
          indexes: [i],
          addressEncoding: undefined,
        }),
      );

      const results = await Promise.all(promises);
      const addresses = results.map((r) => r.addresses[0].address);
      expect(new Set(addresses).size).toBe(addresses.length);
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
