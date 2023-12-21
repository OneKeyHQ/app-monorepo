import coreTestsUtils from '../../../@tests/coreTestsUtils';
import coreTestsFixtures from '../../../@tests/fixtures/coreTestsFixtures';

import CoreChainHd from './CoreChainHd';

const {
  hdCredential,
  // password,
  networkInfo,
  hdAccountTemplate,
  hdAccounts,
  txSamples,
} = coreTestsFixtures.prepareCoreChainTestsFixtures({
  networkInfo: {
    networkChainCode: 'bch',
    chainId: '0',
    networkId: 'bch--0',
    networkImpl: 'bch',
    isTestnet: false,
  },
  hdAccountTemplate: "m/44'/145'/$$INDEX$$'/0/0",
  hdAccounts: [
    {
      address: 'bitcoincash:qpj2p3ykvwktp9uvx5dpkq3uv3zqd5n67qcjtlynnp',
      addresses: {
        '0/0': 'bitcoincash:qpj2p3ykvwktp9uvx5dpkq3uv3zqd5n67qcjtlynnp',
      },
      path: "m/44'/145'/0'",
      relPaths: ['0/0'],
      xpub: 'xpub6CsXcwbJS7Go9ZmTiQjZF6dG6mhmTBEoKzxymQUwMsynCXEKAMXrzh8oym3vehjorx16T7mGuqCRKkZ84Zfc7PKuKVkBcCLn46VZCUXPWTH',
      xpvtRaw:
        '0488ade403a5fb656980000000b5ac535a2528d4641f006a3170b5cde3810f47d2f27872e1faac0798dd9eb07f0067eb4917b9f4d446d31b2ba3db99fe4c55c39f6d4ca024f18016af865548cd86',
      publicKey:
        '023342708de6a3557949806aa20f4a2d37e4e3e8a3314ebc211e0ef99b98234763',
      privateKeyRaw:
        '72f3446b193e0ebd2755f57d1c5d10b08f53b8e598e9fb236af231a5b7f82bbe',
    },
  ],
  txSamples: [
    {
      encodedTx: '',
      signedTx: {
        'encodedTx': null,
        'txid': '',
        'rawTx': '',
      },
    },
  ],
  msgSamples: [],
});

// yarn jest packages/core/src/chains/bch/CoreChainSoftware.test.ts
describe('BCH Core tests', () => {
  it('mnemonic verify', () => {
    coreTestsUtils.expectMnemonicValid({
      hdCredential,
    });
  });
  it('getAddressFromPublic', async () => {
    const coreApi = new CoreChainHd();
    await coreTestsUtils.expectGetAddressFromPublicOk({
      coreApi,
      networkInfo,
      hdAccounts,
    });
  });
  it('getAddressFromPrivate', async () => {
    const coreApi = new CoreChainHd();
    await coreTestsUtils.expectGetAddressFromPrivateOk({
      coreApi,
      networkInfo,
      hdAccounts,
    });
  });
  it('getAddressesFromHd', async () => {
    const coreApi = new CoreChainHd();
    await coreTestsUtils.expectGetAddressFromHdOk({
      coreApi,
      networkInfo,
      hdAccounts,
      hdAccountTemplate,
      hdCredential,
    });
  });
  it('getPrivateKeys hd', async () => {
    const coreApi = new CoreChainHd();
    await coreTestsUtils.expectGetPrivateKeysHdOk({
      coreApi,
      networkInfo,
      hdAccounts,
      hdCredential,
    });
  });

  it.skip('signTransaction', async () => {
    const coreApi = new CoreChainHd();
    // TODO bch tx mock
    await coreTestsUtils.expectSignTransactionOk({
      coreApi,
      networkInfo,
      account: hdAccounts[0],
      hdCredential,
      txSamples,
    });
  });

  it.skip('signMessage', async () => {
    // const coreApi = new CoreChainHd();
    // coreApi.signMessage
    throw new Error('Method not implemented.');
  });
});
