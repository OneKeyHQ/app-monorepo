import coreTestsUtils from '../../../@tests/coreTestsUtils';
import coreTestsFixtures from '../../../@tests/fixtures/coreTestsFixtures';
import { EMessageTypesAptos } from '@onekeyhq/shared/types/message';

import CoreChainHd from './CoreChainHd';

const {
  hdCredential,
  // password,
  networkInfo,
  hdAccountTemplate,
  hdAccounts,
  txSamples,
  msgSamples,
} = coreTestsFixtures.prepareCoreChainTestsFixtures({
  networkInfo: {
    networkChainCode: 'aptos',
    chainId: '1',
    networkId: 'aptos--1',
    networkImpl: 'aptos',
    isTestnet: false,
  },
  hdAccountTemplate: "m/44'/637'/$$INDEX$$'/0'/0'",
  hdAccounts: [
    {
      address:
        '0xede225b4c713e12fee5a33397834d332e7d49773e06dc9860d35c30e6a479ed6',
      path: "m/44'/637'/0'/0'/0'",
      publicKey:
        '99b4709ae159e666615bdb5e0f0eb1f3738c7815c9a0c2173a824856859f1ea4',
      privateKeyRaw:
        '890c0f8ac6794dde7159241cab1d60cf76f492657fe7bc1b9115bcc00a675eb2',
    },
  ],
  txSamples: [
    {
      unsignedTx: {
        inputs: [
          {
            address:
              '0xede225b4c713e12fee5a33397834d332e7d49773e06dc9860d35c30e6a479ed6',
            publicKey:
              '99b4709ae159e666615bdb5e0f0eb1f3738c7815c9a0c2173a824856859f1ea4',
            value: {} as any,
          },
        ],
        outputs: [],
        payload: {},
        encodedTx: '',
        rawTxUnsigned:
          'ede225b4c713e12fee5a33397834d332e7d49773e06dc9860d35c30e6a479ed600000000000000000200000000000000000000000000000000000000000000000000000000000000010d6170746f735f6163636f756e74087472616e73666572000220ede225b4c713e12fee5a33397834d332e7d49773e06dc9860d35c30e6a479ed60800e1f505000000000a000000000000006400000000000000b15627650000000002',
      },
      signedTx: {
        'encodedTx': null,
        'txid': '',
        'rawTx':
          'ede225b4c713e12fee5a33397834d332e7d49773e06dc9860d35c30e6a479ed600000000000000000200000000000000000000000000000000000000000000000000000000000000010d6170746f735f6163636f756e74087472616e73666572000220ede225b4c713e12fee5a33397834d332e7d49773e06dc9860d35c30e6a479ed60800e1f505000000000a000000000000006400000000000000b15627650000000002002099b4709ae159e666615bdb5e0f0eb1f3738c7815c9a0c2173a824856859f1ea44020e5d9f7029a7a292208288bf0c33fb42ff3d3755f5a3da7c279aa75c9ee131b9b3d5bc36e4e0165baa0947b93a9b52e0ccce1c2dc203f16a5fb3688ab5e1e07',
      },
    },
  ],
  msgSamples: [
    {
      unsignedMsg: {
        type: EMessageTypesAptos.SIGN_MESSAGE,
        message: JSON.stringify({
          'message': 'This is a sample message',
          'nonce': 12345,
          'fullMessage':
            'APTOS\napplication: dapp-example.onekeytest.com\nchainId: 1\nmessage: This is a sample message\nnonce: 12345',
          'application': 'dapp-example.onekeytest.com',
          'chainId': 1,
        }),
      },
      signedMsg:
        '0x9a2c04c32cfefa10c9416ce6274c015bb606473a3d67a7563354312d7a460f3046eb18b2919bae1deeb1afff178f8096396f6bc470c1c5d025cd7785449c2500',
    },
  ],
});

// yarn jest packages/core/src/chains/apt/CoreChainSoftware.test.ts
describe('APT Core tests', () => {
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
  it('signMessage', async () => {
    const coreApi = new CoreChainHd();
    await coreTestsUtils.expectSignMessageOk({
      coreApi,
      networkInfo,
      account: hdAccounts[0],
      hdCredential,
      msgSamples,
    });
  });
});
