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
    networkChainCode: 'algo',
    chainId: '4160',
    networkId: 'algo--4160',
    networkImpl: 'algo',
    isTestnet: false,
  },
  hdAccountTemplate: "m/44'/283'/0'/0'/$$INDEX$$'",
  hdAccounts: [
    {
      address: 'MDHU6RJPZUTSGZGMA3GRW52G3AITTDYRNC7POVQQZHH5ARU6EEXPNHO5FI',
      path: "m/44'/283'/0'/0'/0'",
      publicKey:
        '60cf4f452fcd272364cc06cd1b7746d811398f1168bef75610c9cfd0469e212e',
      privateKeyRaw:
        '509ce94feb7f24a0f5b359f3435fdd3f1e9d38c47732a41b3503b68d01e8aaed',
    },
  ],
  txSamples: [
    {
      encodedTx:
        'iKNmZWXNA+iiZnbOAfRQPKNnZW6sbWFpbm5ldC12MS4womdoxCDAYcTY/B293tLXYEvkVo4/bQQZh6w3veS2ILWrOSSK36Jsds4B9FQko3JjdsQgYM9PRS/NJyNkzAbNG3dG2BE5jxFovvdWEMnP0EaeIS6jc25kxCBgz09FL80nI2TMBs0bd0bYETmPEWi+91YQyc/QRp4hLqR0eXBlo3BheQ==',
      signedTx: {
        'encodedTx': null,
        'txid': 'RXWEB2KZVNQDSIJUU34KWBPEIUTVUPFT3DQ7NMMFXZJIOXN2NE3A',
        'rawTx':
          'gqNzaWfEQO2iFonQmKSoDnysbfOmcZA/CAlKBk7KP7QC2AhXwWvXxlk9Vz/G0tN2J8ghvuPL/oBJEKIHdTgdjGEQ9tUglQOjdHhuiKNmZWXNA+iiZnbOAfRQPKNnZW6sbWFpbm5ldC12MS4womdoxCDAYcTY/B293tLXYEvkVo4/bQQZh6w3veS2ILWrOSSK36Jsds4B9FQko3JjdsQgYM9PRS/NJyNkzAbNG3dG2BE5jxFovvdWEMnP0EaeIS6jc25kxCBgz09FL80nI2TMBs0bd0bYETmPEWi+91YQyc/QRp4hLqR0eXBlo3BheQ==',
      },
    },
  ],
  msgSamples: [],
});

// yarn jest packages/core/src/chains/algo/CoreChainSoftware.test.ts
describe('ALGO Core tests', () => {
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
