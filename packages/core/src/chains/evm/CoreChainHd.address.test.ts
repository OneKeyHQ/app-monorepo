import coreTestsFixtures from '../../../@tests/fixtures/coreTestsFixtures';

import CoreChainHd from './CoreChainHd';

/*
yarn jest packages/core/src/chains/evm/CoreChainHd.address.test.ts
*/

const {
  hdCredential,
  networkInfo,
  hdAccountTemplate,
} = coreTestsFixtures.prepareCoreChainTestsFixtures({
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
    expect(result.address).toBe(
      '0x1959f5f4979c5cd87d5cb75c678c770515cb5e0e',
    );
  });

  it('should derive correct address from known private key', async () => {
    const result = await coreApi.getAddressFromPrivate({
      networkInfo,
      privateKeyRaw:
        '105434ca932be16664cb5e44e5b006728577dd757440d068e6d15ef52c15a82f',
    });
    expect(result.address).toBe(
      '0x1959f5f4979c5cd87d5cb75c678c770515cb5e0e',
    );
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
    expect(result1.addresses[0].publicKey).toBe(
      result2.addresses[0].publicKey,
    );
  });
});
