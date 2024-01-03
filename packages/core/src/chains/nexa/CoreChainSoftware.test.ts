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
    networkChainCode: 'nexa',
    chainId: 'testnet',
    networkId: 'nexa--testnet',
    networkImpl: 'nexa',
    isTestnet: false,
  },
  hdAccountTemplate: "m/44'/29223'/$$INDEX$$'/0/0",
  hdAccounts: [
    {
      address:
        '03b4aa175890261128b480e0691d7cd2eb8719d0471e19f424ea5ab30b92948266',
      addresses: {
        'nexa--testnet':
          'nexatest:nqtsq5g5n00l0akmkpyfm9w4ry69gj8x2s5vnk03mxx9yypz',
      },
      relPaths: ['0/0'],
      path: "m/44'/29223'/0'",
      publicKey:
        '03b4aa175890261128b480e0691d7cd2eb8719d0471e19f424ea5ab30b92948266',
      privateKeyRaw:
        '23f2c41613989d67873f4abb0809ab9da433c82d7c5ab25d47868706ef4fd6e4',
    },
  ],
  txSamples: [
    {
      unsignedTx: {
        payload: {
          address: 'nexatest:nqtsq5g5n00l0akmkpyfm9w4ry69gj8x2s5vnk03mxx9yypz',
        },
        encodedTx: {
          'inputs': [
            {
              'txId':
                'f366fedfb3cae4e6acef86cd25ac8f2103413660a1c1be77f38366444642b1c7',
              'outputIndex': 0,
              'satoshis': '10000',
              'address':
                'nexatest:nqtsq5g5n00l0akmkpyfm9w4ry69gj8x2s5vnk03mxx9yypz',
            },
          ],
          'outputs': [
            {
              'address':
                'nexatest:nqtsq5g5n00l0akmkpyfm9w4ry69gj8x2s5vnk03mxx9yypz',
              'satoshis': '100',
              'outType': 1,
            },
          ],
          'gas': '1000',
        },
      },

      signedTx: {
        'txid':
          '52997f8ed905223c35ac3ec271fe44b33553dfac48c1768af1119d0b7c7c5533',
        'rawTx':
          '000100c7b14246446683f377bec1a160364103218fac25cd86eface6e4cab3dffe66f364222103b4aa175890261128b480e0691d7cd2eb8719d0471e19f424ea5ab30b9294826640e7fe2f01a2f77efb17d9075a2365a88c233a6554492a3412533f90b80dd9a0a242194b09ceb7e0e4f571048ad373dc4147e9a733994734e3bb2e05b109319a1affffffff102700000000000002016400000000000000170051149bdff7f6dbb0489d95d519345448e65428c9d9f101c422000000000000170051149bdff7f6dbb0489d95d519345448e65428c9d9f100000000',
        'signature':
          'e7fe2f01a2f77efb17d9075a2365a88c233a6554492a3412533f90b80dd9a0a242194b09ceb7e0e4f571048ad373dc4147e9a733994734e3bb2e05b109319a1a',
        'digest':
          '5dc4c9d3ca760c306b684cede3687e8ac6a70b80f1bf16a460037932280e5f9a',
        'encodedTx': {
          'inputs': [
            {
              'txId':
                'f366fedfb3cae4e6acef86cd25ac8f2103413660a1c1be77f38366444642b1c7',
              'outputIndex': 0,
              'satoshis': '10000',
              'address':
                'nexatest:nqtsq5g5n00l0akmkpyfm9w4ry69gj8x2s5vnk03mxx9yypz',
            },
          ],
          'outputs': [
            {
              'address':
                'nexatest:nqtsq5g5n00l0akmkpyfm9w4ry69gj8x2s5vnk03mxx9yypz',
              'satoshis': '100',
              'outType': 1,
            },
          ],
          'gas': '1000',
        },
      },
    },
  ],
  msgSamples: [],
});

// yarn jest packages/core/src/chains/nexa/CoreChainSoftware.test.ts
describe('NEXA Core tests', () => {
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
    // TODO nexa websocket not working
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
