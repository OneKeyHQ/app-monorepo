import coreTestsUtils from '../../../@tests/coreTestsUtils';
import coreTestsFixtures from '../../../@tests/fixtures/coreTestsFixtures';
import { EAddressEncodings } from '../../types';

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
    networkChainCode: 'ltc',
    chainId: '0',
    networkId: 'ltc--0',
    networkImpl: 'ltc',
    isTestnet: false,
  },
  hdAccountTemplate: "m/49'/2'/$$INDEX$$'/0/0",
  hdAccounts: [
    {
      address: 'MCtPFWzDadmSdGAJXnrE4KpcHTuMpqn14m',
      addresses: { '0/0': 'MCtPFWzDadmSdGAJXnrE4KpcHTuMpqn14m' },
      path: "m/49'/2'/0'",
      relPaths: ['0/0'],
      xpub: 'Mtub2s6aTFt6zXFfse1eGz7ktsUQALH8Pd58ZBieNJi6c5tX5bzSpQsyhXun9tCH7mZSC4o9sy7gUt1aRx4rg9WVBWgFPWyy8QPiaqNj89FMAZ2',
      xpvtRaw:
        '01b2679203187951b380000000456b2937f22c5c8eb9747668a0102644275b7dba5e98333dbd9fef345d79988e00fee33ff0ee7e073d27f1ff09e6e5944ae7b99edbeefd9fe04f4bf85f7fafa8bb',
      publicKey:
        '039987a37562a942b11dd5401fc66688e61789469379435fdd5f7760ece8e4ff53',
      privateKeyRaw:
        '43939708c16241e47781724f04c2e95c48fa857bcc61b54b7c70be1418251c0f',
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

// yarn jest packages/core/src/chains/ltc/CoreChainSoftware.test.ts
describe('LTC Core tests', () => {
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
      addressEncoding: EAddressEncodings.P2SH_P2WPKH,
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
    // TODO LTC tx mock
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
