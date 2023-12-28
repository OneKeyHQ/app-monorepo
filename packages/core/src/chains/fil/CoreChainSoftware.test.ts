import { compressPublicKey } from '@onekeyhq/core/src/secret';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

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
    networkChainCode: 'fil',
    chainId: '314',
    networkId: 'fil--314',
    networkImpl: 'fil',
    isTestnet: false,
  },
  hdAccountTemplate: "m/44'/461'/0'/0/$$INDEX$$",
  hdAccounts: [
    {
      address: 'f1frgkdjp35l3tolawlodk32qnwipzuy5iirkc6by',
      addresses: {
        'fil--314': 'f1frgkdjp35l3tolawlodk32qnwipzuy5iirkc6by',
      },
      path: "m/44'/461'/0'/0/0",
      publicKey:
        '04638c02212becc981df1a1393dd9bce3a5f42ed5b3294889fa9da6d4ea967ea7804fec8b4a8b91fef6e4e7035916d9f3ec046cfae410ee7be9fb1f10229175fb4',
      privateKeyRaw:
        'dc14e60956a745b439f5061fda64b42d8df150629a3455182629289cda86e87b',
    },
  ],
  txSamples: [
    {
      unsignedTx: {
        encodedTx: '',
        rawTxUnsigned:
          '0504003665284cd84d9de003dac3389ac1d61b60039fe95f8b9de603dcc0ea4ecdec640065020000d62400001800000091b171bb158e2d3848fa23a9f1c25182fb8e20313b2c1eb49219da7a70ce90c3adb6a2726a6b98028731ef0c8a348880f377ec034eabb3a8aad7e04b49969ac9',
      },
      signedTx: {
        'encodedTx': null,
        txid: '',
        rawTx: '',
        signature:
          '0x007806aea9f31e5b2317a3cb4266ff0e206b15a959fa4da2d861d9d26e134b279cf591ca099e3711c62df36f34d81ee69f08b20e764cf336b0d67a7f2b21580a09',
      },
    },
  ],
  msgSamples: [],
});

// wasm module
// yarn jest packages/core/src/chains/fil/CoreChainSoftware.test.ts
describe('FIL Core tests', () => {
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
      publicKeyGetter(params) {
        const {
          account: { publicKey },
        } = params;
        return Promise.resolve({
          publicKey: bufferUtils.bytesToHex(
            compressPublicKey('secp256k1', bufferUtils.toBuffer(publicKey)),
          ),
        });
      },
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

  // TODO: jest NOT support import() at:  @zondax/izari-filecoin import('@ipld/dag-cbor')
  it.skip('signTransaction', async () => {
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
