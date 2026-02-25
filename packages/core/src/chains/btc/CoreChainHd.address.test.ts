import coreTestsFixtures from '../../../@tests/fixtures/coreTestsFixtures';
import { EAddressEncodings } from '../../types';

import CoreChainHd from './CoreChainHd';

/*
yarn jest packages/core/src/chains/btc/CoreChainHd.address.test.ts
*/

const networkInfo = {
  networkChainCode: 'btc',
  chainId: '0',
  networkId: 'btc--0',
  networkImpl: 'btc',
  isTestnet: false,
};

const { hdCredential } = coreTestsFixtures.prepareCoreChainTestsFixtures({
  networkInfo,
  hdAccountTemplate: "m/49'/0'/$$INDEX$$'/0/0",
  hdAccounts: [],
  txSamples: [],
  msgSamples: [],
});

describe('BTC Address Derivation Tests', () => {
  jest.setTimeout(30_000);
  const coreApi = new CoreChainHd();

  describe('P2SH_P2WPKH (BIP49) - Nested SegWit', () => {
    const template = "m/49'/0'/$$INDEX$$'/0/0";

    it('should derive correct address at index 0', async () => {
      const result = await coreApi.getAddressesFromHd({
        networkInfo,
        password: hdCredential.password,
        hdCredential: hdCredential.hdCredentialHex,
        template,
        indexes: [0],
        addressEncoding: EAddressEncodings.P2SH_P2WPKH,
      });
      expect(result.addresses[0].address).toBe(
        '386yQdFWfbAuEUa1ctbZo9Lgacj3PhXs9R',
      );
    });

    it('should derive address starting with 3', async () => {
      const result = await coreApi.getAddressesFromHd({
        networkInfo,
        password: hdCredential.password,
        hdCredential: hdCredential.hdCredentialHex,
        template,
        indexes: [0],
        addressEncoding: EAddressEncodings.P2SH_P2WPKH,
      });
      expect(result.addresses[0].address).toMatch(/^3/);
    });

    it('should derive xpub starting with ypub', async () => {
      const result = await coreApi.getAddressesFromHd({
        networkInfo,
        password: hdCredential.password,
        hdCredential: hdCredential.hdCredentialHex,
        template,
        indexes: [0],
        addressEncoding: EAddressEncodings.P2SH_P2WPKH,
      });
      expect(result.addresses[0].xpub).toMatch(/^ypub/);
    });

    it('should return correct address from getAddressFromPublic with xpub', async () => {
      const xpub =
        'ypub6WoTEgqafv3Zx3Nk8zyMnYvK7ckrMy942G3mWzBpDSPJm8yXAUShZ31cH4jGQgUcbD8F1tY34nxrxxJi1ZAZAqFjacpdBmLGDVjpgxbEGKk';
      const result = await coreApi.getAddressFromPublic({
        networkInfo,
        publicKey: xpub,
        addressEncoding: EAddressEncodings.P2SH_P2WPKH,
      });
      expect(result.address).toBe('386yQdFWfbAuEUa1ctbZo9Lgacj3PhXs9R');
    });

    it('should return correct address from getAddressFromPrivate with xpvtRaw', async () => {
      const xpvtRaw =
        '049d7878032b357cdf80000000966c236dfa226d4ee87f9b9202a357a8f338a9fed2c1b355303ee83758cf142c0074cddc8d83dfcf62ab5ba18c4620c12f77c04bb3b75dd47ff3cffb8a8e25739f';
      const result = await coreApi.getAddressFromPrivate({
        networkInfo,
        privateKeyRaw: xpvtRaw,
        addressEncoding: EAddressEncodings.P2SH_P2WPKH,
      });
      expect(result.address).toBe('386yQdFWfbAuEUa1ctbZo9Lgacj3PhXs9R');
    });
  });

  describe('P2PKH (BIP44) - Legacy', () => {
    const template = "m/44'/0'/$$INDEX$$'/0/0";

    it('should derive address starting with 1', async () => {
      const result = await coreApi.getAddressesFromHd({
        networkInfo,
        password: hdCredential.password,
        hdCredential: hdCredential.hdCredentialHex,
        template,
        indexes: [0],
        addressEncoding: EAddressEncodings.P2PKH,
      });
      expect(result.addresses[0].address).toMatch(/^1/);
    });

    it('should derive xpub starting with xpub', async () => {
      const result = await coreApi.getAddressesFromHd({
        networkInfo,
        password: hdCredential.password,
        hdCredential: hdCredential.hdCredentialHex,
        template,
        indexes: [0],
        addressEncoding: EAddressEncodings.P2PKH,
      });
      expect(result.addresses[0].xpub).toMatch(/^xpub/);
    });

    it('should round-trip through getAddressFromPublic', async () => {
      const hdResult = await coreApi.getAddressesFromHd({
        networkInfo,
        password: hdCredential.password,
        hdCredential: hdCredential.hdCredentialHex,
        template,
        indexes: [0],
        addressEncoding: EAddressEncodings.P2PKH,
      });
      const xpub = hdResult.addresses[0].xpub!;
      const pubResult = await coreApi.getAddressFromPublic({
        networkInfo,
        publicKey: xpub,
        addressEncoding: EAddressEncodings.P2PKH,
      });
      expect(pubResult.address).toBe(hdResult.addresses[0].address);
    });
  });

  describe('P2WPKH (BIP84) - Native SegWit', () => {
    const template = "m/84'/0'/$$INDEX$$'/0/0";

    it('should derive address starting with bc1q', async () => {
      const result = await coreApi.getAddressesFromHd({
        networkInfo,
        password: hdCredential.password,
        hdCredential: hdCredential.hdCredentialHex,
        template,
        indexes: [0],
        addressEncoding: EAddressEncodings.P2WPKH,
      });
      expect(result.addresses[0].address).toMatch(/^bc1q/);
    });

    it('should derive xpub starting with zpub', async () => {
      const result = await coreApi.getAddressesFromHd({
        networkInfo,
        password: hdCredential.password,
        hdCredential: hdCredential.hdCredentialHex,
        template,
        indexes: [0],
        addressEncoding: EAddressEncodings.P2WPKH,
      });
      expect(result.addresses[0].xpub).toMatch(/^zpub/);
    });

    it('should round-trip through getAddressFromPublic', async () => {
      const hdResult = await coreApi.getAddressesFromHd({
        networkInfo,
        password: hdCredential.password,
        hdCredential: hdCredential.hdCredentialHex,
        template,
        indexes: [0],
        addressEncoding: EAddressEncodings.P2WPKH,
      });
      const xpub = hdResult.addresses[0].xpub!;
      const pubResult = await coreApi.getAddressFromPublic({
        networkInfo,
        publicKey: xpub,
        addressEncoding: EAddressEncodings.P2WPKH,
      });
      expect(pubResult.address).toBe(hdResult.addresses[0].address);
    });
  });

  describe('P2TR (BIP86) - Taproot', () => {
    const template = "m/86'/0'/$$INDEX$$'/0/0";

    it('should derive address starting with bc1p', async () => {
      const result = await coreApi.getAddressesFromHd({
        networkInfo,
        password: hdCredential.password,
        hdCredential: hdCredential.hdCredentialHex,
        template,
        indexes: [0],
        addressEncoding: EAddressEncodings.P2TR,
      });
      expect(result.addresses[0].address).toMatch(/^bc1p/);
    });

    it('should round-trip through getAddressFromPublic', async () => {
      const hdResult = await coreApi.getAddressesFromHd({
        networkInfo,
        password: hdCredential.password,
        hdCredential: hdCredential.hdCredentialHex,
        template,
        indexes: [0],
        addressEncoding: EAddressEncodings.P2TR,
      });
      const xpub = hdResult.addresses[0].xpub!;
      const pubResult = await coreApi.getAddressFromPublic({
        networkInfo,
        publicKey: xpub,
        addressEncoding: EAddressEncodings.P2TR,
      });
      expect(pubResult.address).toBe(hdResult.addresses[0].address);
    });
  });

  describe('Cross-encoding', () => {
    it('should derive 4 different addresses for same index with different encodings', async () => {
      const encodings = [
        {
          encoding: EAddressEncodings.P2SH_P2WPKH,
          template: "m/49'/0'/$$INDEX$$'/0/0",
        },
        {
          encoding: EAddressEncodings.P2PKH,
          template: "m/44'/0'/$$INDEX$$'/0/0",
        },
        {
          encoding: EAddressEncodings.P2WPKH,
          template: "m/84'/0'/$$INDEX$$'/0/0",
        },
        {
          encoding: EAddressEncodings.P2TR,
          template: "m/86'/0'/$$INDEX$$'/0/0",
        },
      ];

      const addresses: string[] = [];
      for (const { encoding, template } of encodings) {
        const result = await coreApi.getAddressesFromHd({
          networkInfo,
          password: hdCredential.password,
          hdCredential: hdCredential.hdCredentialHex,
          template,
          indexes: [0],
          addressEncoding: encoding,
        });
        addresses.push(result.addresses[0].address);
      }

      const unique = new Set(addresses);
      expect(unique.size).toBe(4);
    });
  });

  describe('Multiple indexes & edge cases', () => {
    const template = "m/49'/0'/$$INDEX$$'/0/0";

    it('should derive unique addresses for different indexes', async () => {
      const result = await coreApi.getAddressesFromHd({
        networkInfo,
        password: hdCredential.password,
        hdCredential: hdCredential.hdCredentialHex,
        template,
        indexes: [0, 1, 2],
        addressEncoding: EAddressEncodings.P2SH_P2WPKH,
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
        template,
        indexes: [0],
        addressEncoding: EAddressEncodings.P2SH_P2WPKH,
      });
      const result2 = await coreApi.getAddressesFromHd({
        networkInfo,
        password: hdCredential.password,
        hdCredential: hdCredential.hdCredentialHex,
        template,
        indexes: [0],
        addressEncoding: EAddressEncodings.P2SH_P2WPKH,
      });
      expect(result1.addresses[0].address).toBe(result2.addresses[0].address);
      expect(result1.addresses[0].xpub).toBe(result2.addresses[0].xpub);
    });

    it('should handle empty indexes array', async () => {
      const result = await coreApi.getAddressesFromHd({
        networkInfo,
        password: hdCredential.password,
        hdCredential: hdCredential.hdCredentialHex,
        template,
        indexes: [],
        addressEncoding: EAddressEncodings.P2SH_P2WPKH,
      });
      expect(result.addresses).toHaveLength(0);
    });

    it('should handle duplicate indexes', async () => {
      const result = await coreApi.getAddressesFromHd({
        networkInfo,
        password: hdCredential.password,
        hdCredential: hdCredential.hdCredentialHex,
        template,
        indexes: [0, 0, 0],
        addressEncoding: EAddressEncodings.P2SH_P2WPKH,
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
          template,
          indexes: [0],
          addressEncoding: EAddressEncodings.P2SH_P2WPKH,
        }),
      ).rejects.toThrow();
    });

    it('should reject invalid hdCredential', async () => {
      await expect(
        coreApi.getAddressesFromHd({
          networkInfo,
          password: hdCredential.password,
          hdCredential: 'invalidCredential',
          template,
          indexes: [0],
          addressEncoding: EAddressEncodings.P2SH_P2WPKH,
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
          template: "m/49'/0'/$$INDEX$$'/0/0",
          indexes: [0],
          addressEncoding: EAddressEncodings.P2SH_P2WPKH,
        });
      } catch (error: any) {
        expect(error.message).not.toContain('wrongPassword');
        expect(error.message).not.toContain(hdCredential.password);
      }
    });
  });
});
