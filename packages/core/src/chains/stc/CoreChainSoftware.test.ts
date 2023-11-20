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
    networkChainCode: 'stc',
    chainId: '1',
    networkId: 'stc--1',
    networkImpl: 'stc',
    isTestnet: false,
  },
  hdAccountTemplate: "m/44'/101010'/0'/0'/$$INDEX$$'",
  hdAccounts: [
    {
      address: '0x8628bf02d4215f512fd57470bb8e045a',
      addresses: {},
      path: "m/44'/101010'/0'/0'/0'",
      publicKey:
        '607db34228b96dee608badb9ae6d15895a6cdb8ee3450136e794d765e9975d0c',
      privateKeyRaw:
        '3ae9179a51aa73dcca4a7365ef2800cf36bf1bb860d7f0f786a1ea77038556d6',
    },
  ],
  txSamples: [
    {
      encodedTx:
        'AKhoybLLJS1deDJDyjELDNhfkBBX3k4dt4bBfmppjfPVVimhQdFEfDo8AiFcCBCC9VkYWV2r3jkh9n1DAXEhnJPwMmnsrzPU2tzHAKYnwTBaPFbZyQ5TdfhLktRm9RnYgLDqDby5R5LQp2FrFkkMiPWuPT7Za6TFvccnuZ1CZ88HnU5tAyLbX25oCEzsTN9xHxFess7V37H3W97jELbHDsdvc6mhKqdq41oPKhprZYBukt8cLyHdeEbno',
      signedTx: {
        'encodedTx': null,
        'txid':
          '5BDe9KffLU3FoPdGEuT3reDCC534yWCBRHA2spYGV8Gj6x5WwB7zTzed2j9bbdCiBVRyu4VAv4AKuQc3EBe595Hy',
        'rawTx':
          'AdDhKos1GoLn9eCF84oW9+58bPzQat3e+EDtZmQgjRRuYPk2YC7Bbobw3DJo7P/q4cmFFkMy0u48Sx2muC5vcQgBAAECOoqATG/Vw3lW1IE1OGwPM2yQslR+1iMIZFE9i7kpUyMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKj6cxTT+hf+oYJjEI8DMZmZCPL8U5sYFv/1nNJEuVjrAQECAAAMAgAAAAAAAAAAAAAA',
      },
    },
  ],
  msgSamples: [],
});

// yarn jest packages/core/src/chains/stc/CoreChainSoftware.test.ts
describe('STC Core tests', () => {
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

  // TODO make scriptFn seriliazable const { scriptFn, data } = unsignedTx.payload;
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
