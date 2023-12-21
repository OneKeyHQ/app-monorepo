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
    networkChainCode: 'kaspa',
    chainId: 'kaspa',
    networkId: 'kaspa--kaspa',
    networkImpl: 'kaspa',
    isTestnet: false,
  },
  hdAccountTemplate: "m/44'/111111'/0'/0/$$INDEX$$",
  hdAccounts: [
    {
      address:
        'kaspa:qz6ey0j433zey0txecm7e4as4q44jnafqxtclxj5xfl3559lft0p78rdmumy9',
      addresses: {},
      path: "m/44'/111111'/0'/0/0",
      publicKey:
        '02075486d05cea119d15af20cee6763d685ac68df5954c4c8bec190270d83e5ec3',
      privateKeyRaw:
        'ce88dc4c3170700ef1ae899271e3d6467d839e13fa9c7c54c1bf6c9c19b4580b',
    },
  ],
  txSamples: [
    {
      encodedTx: {
        'utxoIds': [
          '86cbbbaa7627e371402f98d82a7472210144734d945355ec3266385e8267b3e91',
        ],
        'inputs': [
          {
            'txid':
              '86cbbbaa7627e371402f98d82a7472210144734d945355ec3266385e8267b3e9',
            'address':
              'kaspa:qz6ey0j433zey0txecm7e4as4q44jnafqxtclxj5xfl3559lft0p78rdmumy9',
            'vout': 1,
            'scriptPubKey':
              '207afdae557e69c0040fd4135adffc60f9486fb21f4cbae233fd6db3e84ba47c55ac',
            'scriptPublicKeyVersion': 0,
            'satoshis': 4549745588,
            'blockDaaScore': 58668091,
          },
        ],
        'outputs': [
          {
            'address':
              'kaspa:qz6ey0j433zey0txecm7e4as4q44jnafqxtclxj5xfl3559lft0p78rdmumy9',
            'value': '100000000',
          },
        ],
        'feeInfo': { 'price': '0.00000001', 'limit': '2276' },
        'hasMaxSend': false,
        'mass': 2276,
      },
      signedTx: {
        'encodedTx': null,
        txid: '',
        rawTx:
          '0000010000000000000086cbbbaa7627e371402f98d82a7472210144734d945355ec3266385e8267b3e90100000000000000000000000000000000000000020000000000000000e1f505000000000000220000000000000020b5923e558c45923d66ce37ecd7b0a82b594fa901978f9a54327f1a50bf4ade1facd0b13909010000000000220000000000000020b5923e558c45923d66ce37ecd7b0a82b594fa901978f9a54327f1a50bf4ade1fac00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
      },
    },
  ],
  msgSamples: [],
});

// yarn jest packages/core/src/chains/kaspa/CoreChainSoftware.test.ts
describe('KASPA Core tests', () => {
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
