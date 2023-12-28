import coreTestsUtils from '../../../@tests/coreTestsUtils';
import coreTestsFixtures from '../../../@tests/fixtures/coreTestsFixtures';
import { EAddressEncodings } from '../../types';

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
    networkChainCode: 'btc',
    chainId: '0',
    networkId: 'btc--0',
    networkImpl: 'btc',
    isTestnet: false,
  },
  hdAccountTemplate: "m/49'/0'/$$INDEX$$'/0/0",
  hdAccounts: [
    {
      address: '386yQdFWfbAuEUa1ctbZo9Lgacj3PhXs9R',
      addresses: {
        '0/0': '386yQdFWfbAuEUa1ctbZo9Lgacj3PhXs9R',
      },
      path: "m/49'/0'/0'",
      relPaths: ['0/0'],
      xpub: 'ypub6WoTEgqafv3Zx3Nk8zyMnYvK7ckrMy942G3mWzBpDSPJm8yXAUShZ31cH4jGQgUcbD8F1tY34nxrxxJi1ZAZAqFjacpdBmLGDVjpgxbEGKk',
      xpvtRaw:
        '049d7878032b357cdf80000000966c236dfa226d4ee87f9b9202a357a8f338a9fed2c1b355303ee83758cf142c0074cddc8d83dfcf62ab5ba18c4620c12f77c04bb3b75dd47ff3cffb8a8e25739f',
      publicKey:
        '03098891dd952dd6f6bde1489761d0befbfa31815e9c0e64058d12b83de852a18c',
      privateKeyRaw:
        '0f1ed8d7b952569b93d66e8727a532b8b7d95144b4c93ed3605491ac08f81f15',
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

// yarn jest packages/core/src/chains/btc/CoreChainSoftware.test.ts
describe('BTC Core tests', () => {
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
      addressEncoding: EAddressEncodings.P2SH_P2WPKH,
    });
  });
  it('getAddressFromPrivate', async () => {
    const coreApi = new CoreChainHd();
    await coreTestsUtils.expectGetAddressFromPrivateOk({
      coreApi,
      networkInfo,
      hdAccounts,
      addressEncoding: EAddressEncodings.P2SH_P2WPKH,
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
      addressEncoding: EAddressEncodings.P2SH_P2WPKH,
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
    // TODO BTC tx mock
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
