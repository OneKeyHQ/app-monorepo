import base58 from 'bs58';

import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import coreTestsFixtures from '../../../@tests/fixtures/coreTestsFixtures';

import CoreChainHd from './CoreChainHd';

/*
yarn jest packages/core/src/chains/sol/CoreChainHd.address.test.ts
*/

const {
  hdCredential,
  networkInfo,
  hdAccountTemplate,
} = coreTestsFixtures.prepareCoreChainTestsFixtures({
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
    expect(result.address).toBe(
      '4wX8yu9YmSe4mv9ZPtTeoF9pe6Ji4ScjuJEffS3sCKZ4',
    );
  });

  it('should derive correct address from known public key', async () => {
    const publicKeyBase58 = '4wX8yu9YmSe4mv9ZPtTeoF9pe6Ji4ScjuJEffS3sCKZ4';
    const publicKeyHex = bufferUtils.bytesToHex(
      base58.decode(publicKeyBase58),
    );
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
});
