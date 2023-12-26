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
    networkChainCode: 'tbtc',
    chainId: '0',
    networkId: 'tbtc--0',
    networkImpl: 'tbtc',
    isTestnet: false,
  },
  hdAccountTemplate: "m/86'/1'/$$INDEX$$'/0/0",
  hdAccounts: [
    {
      address: 'tb1pzutpcaymsyxtmz325ucsjed4evp9mea05tsf32wnkx46vsjrqtrq4d3dmr',
      addresses: {
        '0/0': 'tb1pzutpcaymsyxtmz325ucsjed4evp9mea05tsf32wnkx46vsjrqtrq4d3dmr',
      },
      path: "m/86'/1'/0'",
      relPaths: ['0/0'],
      xpub: 'tpubDDTvhBUGrta8vHYvED7NVpRB64nP9n4v8zScbV1yyi3Rc7fwH9o5qsWbyhv9JjwCPfzhJHJCsLppzRyFp2W4VFy4kssk5SkFf6gRK6NmDZV',
      xpvtRaw:
        '0435839403c3eead31800000001c87e07493cb492ed74196dcd8e10c45c636b012bdcef82fd2ebfe617ade7a4300ceb67d363bbddfe1d5c625840cdee8fc6ff521faead360673c5f2720ea1c1e0f',
      publicKey:
        '03afd8a231856550c5bcdb6aec16da37b082c72f9e1196940db5a6504e9f328af6',
      privateKeyRaw:
        'a2e4e08007d3af5951b0a9cb30c683134b0641e14f5898a177ffbd00e2cbd3a4',
    },
  ],
  txSamples: [
    {
      unsignedTx: {
        encodedTx: {
          inputs: [],
          outputs: [],
        },
        // opReturn
      },
      signedTx: {
        'encodedTx': null,
        'txid': '',
        'rawTx': '',
      },
    },
  ],
  msgSamples: [],
});

// yarn jest packages/core/src/chains/btc/CoreChainSoftware.test.ts
describe('BTC Core tests', () => {
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
      addressEncoding: EAddressEncodings.P2TR, // taproot address
    });
  });
  it('getAddressFromPrivate', async () => {
    const coreApi = new CoreChainHd();
    await coreTestsUtils.expectGetAddressFromPrivateOk({
      coreApi,
      networkInfo,
      hdAccounts,
      addressEncoding: EAddressEncodings.P2TR, // taproot address
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
      addressEncoding: EAddressEncodings.P2TR, // taproot address
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
    // TODO BTC tx mock
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
