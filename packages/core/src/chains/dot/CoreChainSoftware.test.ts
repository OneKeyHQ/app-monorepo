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
    networkChainCode: 'dot',
    chainId: '0',
    networkId: 'dot--polkadot',
    networkImpl: 'dot',
    isTestnet: false,
  },
  hdAccountTemplate: "m/44'/354'/$$INDEX$$'/0'/0'",
  hdAccounts: [
    {
      // TODO use accountIdToAddress generate DOT real address
      address: '',
      addresses: {
        // eslint-disable-next-line spellcheck/spell-checker
        // 12EKdsrFTWA3oZoEzoB4ZNh64VrkuLjFKDnxFpEJZx4JF2Y6
      },
      path: "m/44'/354'/0'/0'/0'",
      publicKey:
        '3665284cd84d9de003dac3389ac1d61b60039fe95f8b9de603dcc0ea4ecdec64',
      privateKeyRaw:
        '9800ef8f1df3e31aa14874f00a3a21c064e3d24d75b718c4b4c5ddc483661757',
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

// yarn jest packages/core/src/chains/dot/CoreChainSoftware.test.ts
describe('DOT Core tests', () => {
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
