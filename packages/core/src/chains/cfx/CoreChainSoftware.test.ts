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
    networkChainCode: 'cfx',
    chainId: '1029',
    networkId: 'cfx--1029',
    networkImpl: 'cfx',
    isTestnet: false,
  },
  hdAccountTemplate: "m/44'/503'/0'/0/$$INDEX$$",
  hdAccounts: [
    {
      address: '0x1a8348d02ae925bb86e4a4ac031ec42c28a4b5dc',
      addresses: {
        'cfx--1029': 'cfx:aarjgwgufnywns6g6wwm2a282u0cvkfz5uekxw2hsm',
      },
      path: "m/44'/503'/0'/0/0",
      publicKey:
        '02474b4c1b1f3830fc0c161badc1b90ef06513593c67adaaab53e1140ca94cb652',
      privateKeyRaw:
        '468e1d6a29086e162746c66f491ddc3cbe3f11a8d826f8e1d4368e8f9bb1275c',
    },
  ],
  txSamples: [
    {
      encodedTx: {
        'from': 'cfx:aarjgwgufnywns6g6wwm2a282u0cvkfz5uekxw2hsm',
        'to': 'cfx:aarjgwgufnywns6g6wwm2a282u0cvkfz5uekxw2hsm',
        'value': '0',
        'data': '0x',
        'gas': '0x5208',
        'gasLimit': '0x5208',
        'gasPrice': '1000000000',
        'nonce': 0,
        'epochHeight': 81203903,
        'chainId': 1029,
        'storageLimit': '0',
      },
      signedTx: {
        encodedTx: null,
        'digest':
          '0x830f7330fe140d0515381cad22f7796b2e2f7a5c451641797f7bb4ee5aed7eeb',
        'txid':
          '0xf94d5db32cdfd3c644274c17003a975a2082eb4fffcea4900b5e8a9c10a11884',
        'rawTx':
          '0xf86de980843b9aca00825208941a8348d02ae925bb86e4a4ac031ec42c28a4b5dc80808404d712bf8204058001a0c57de20f6d4c8c3785e675cfc76a5fad0fcb6e80bb15edb020ee8c71dfb54b27a003158bbebc413d8ecbd69475f60d8b6b1156c18aeb46d4afd7028a96cdcedfa3',
      },
    },
  ],
  msgSamples: [],
});

// yarn jest packages/core/src/chains/cfx/CoreChainSoftware.test.ts
describe('CFX Core tests', () => {
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

  it('signTransaction', async () => {
    const coreApi = new CoreChainHd();
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
