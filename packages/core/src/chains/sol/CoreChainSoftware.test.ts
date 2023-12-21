import base58 from 'bs58';

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
    networkChainCode: 'sol',
    chainId: '101',
    networkId: 'sol--101',
    networkImpl: 'sol',
    isTestnet: false,
  },
  hdAccountTemplate: "m/44'/501'/$$INDEX$$'/0'",
  hdAccounts: [
    {
      address: '4wX8yu9YmSe4mv9ZPtTeoF9pe6Ji4ScjuJEffS3sCKZ4',
      addresses: {},
      path: "m/44'/501'/0'/0'",
      publicKey: '4wX8yu9YmSe4mv9ZPtTeoF9pe6Ji4ScjuJEffS3sCKZ4',
      privateKeyRaw:
        'feafaa95d64a1a37f4e4dce7fd2ee764bbc1e8eef627d5aedaceee19f89f76ff',
    },
  ],
  txSamples: [
    {
      encodedTx:
        'AKhoybLLJS1deDJDyjELDNhfkBBX3k4dt4bBfmppjfPVVimhQdFEfDo8AiFcCBCC9VkYWV2r3jkh9n1DAXEhnJPwMmnsrzPU2tzHAKYnwTBaPFbZyQ5TdfhLktRm9RnYgLDqDby5R5LQp2FrFkkMiPWuPT7Za6TFvccnuZ1CZ88HnU5tAyLbX25oCEzsTN9xHxFess7V37H3W97jELbHDsdvc6mhKqdq41oPKhprZYBukt8cLyHdeEbno',
      signedTx: {
        encodedTx: null,
        'txid':
          '5BDe9KffLU3FoPdGEuT3reDCC534yWCBRHA2spYGV8Gj6x5WwB7zTzed2j9bbdCiBVRyu4VAv4AKuQc3EBe595Hy',
        'rawTx':
          'AdDhKos1GoLn9eCF84oW9+58bPzQat3e+EDtZmQgjRRuYPk2YC7Bbobw3DJo7P/q4cmFFkMy0u48Sx2muC5vcQgBAAECOoqATG/Vw3lW1IE1OGwPM2yQslR+1iMIZFE9i7kpUyMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKj6cxTT+hf+oYJjEI8DMZmZCPL8U5sYFv/1nNJEuVjrAQECAAAMAgAAAAAAAAAAAAAA',
      },
    },
  ],
  msgSamples: [],
});

// yarn jest packages/core/src/chains/sol/CoreChainSoftware.test.ts
describe('SOL Core tests', () => {
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
      publicKeyGetter: ({ account }) =>
        Promise.resolve({
          publicKey: bufferUtils.bytesToHex(base58.decode(account.publicKey)),
        }),
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
