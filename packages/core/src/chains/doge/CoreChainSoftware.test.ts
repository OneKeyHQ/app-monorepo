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
    networkChainCode: 'doge',
    chainId: '0',
    networkId: 'doge--0',
    networkImpl: 'doge',
    isTestnet: false,
  },
  hdAccountTemplate: "m/44'/3'/$$INDEX$$'/0/0",
  hdAccounts: [
    {
      address: 'DTdKu8YgcxoXyjFCDtCeKimaZzsK27rcwT',
      addresses: { '0/0': 'DTdKu8YgcxoXyjFCDtCeKimaZzsK27rcwT' },
      path: "m/44'/3'/0'",
      relPaths: ['0/0'],
      xpub: 'dgub8sn8hvpMJJouWJh3GyJKLDmDfuRvAZLtHdJZXH78UnAau3ohH1SM7oeEWejBsWcDxuYWSojzAzxv6sf8aHrU6Z9isjRQ4sgTGWTVfw2KF87',
      xpvtRaw:
        '02fac39803db6d8c2f80000000794332fa322b20ef9f7d2e15e1a6eedb713971a2e0e09f7a8a915a77929f7c960040a03bcec86d90c9b24ff3a6144cd431b04b25c007721bdadcdae2eb58121973',
      publicKey:
        '028df5c5ff4af74130220bc00d3ec5a6c08a587f7bf9038be679e47980a63ff871',
      privateKeyRaw:
        'bcac54f1b5e7addea9a0eb4876095477975fdff397a37fc133c713d2782b20b2',
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

// yarn jest packages/core/src/chains/doge/CoreChainSoftware.test.ts
describe('DOGE Core tests', () => {
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
    // TODO doge tx mock
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
