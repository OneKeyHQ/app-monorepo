import coreTestsUtils from '../../../@tests/coreTestsUtils';
import coreTestsFixtures from '../../../@tests/fixtures/coreTestsFixtures';
import { EAddressEncodings } from '../../types';

import CoreChainHd from './CoreChainHd';
import { IEncodedTxBtc } from './types';

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
          inputs: [
            {
              address:
                'tb1pzutpcaymsyxtmz325ucsjed4evp9mea05tsf32wnkx46vsjrqtrq4d3dmr',
              path: "m/86'/1'/0'/0/0",
              txid: '39cb45de185e5fa1778a171cccb22338dada5d6105c4f843a7542d5a9b79ed90',
              value: '136122',
              vout: 1,
            },
          ],
          outputs: [
            {
              address:
                'tb1pzutpcaymsyxtmz325ucsjed4evp9mea05tsf32wnkx46vsjrqtrq4d3dmr',
              value: '1000',
            },
            {
              address:
                'tb1pzutpcaymsyxtmz325ucsjed4evp9mea05tsf32wnkx46vsjrqtrq4d3dmr',
              value: '134896',
            },
          ],
        } as IEncodedTxBtc,
        // opReturn
      },
      btcExtraInfo: {
        pathToAddresses: {
          "m/86'/1'/0'/0/0": {
            address:
              'tb1pzutpcaymsyxtmz325ucsjed4evp9mea05tsf32wnkx46vsjrqtrq4d3dmr',
            relPath: '0/0',
          },
        },
        inputAddressesEncodings: [EAddressEncodings.P2TR],
        nonWitnessPrevTxs: {},
      },
      signedTx: {
        'psbtHex': undefined,
        'encodedTx': null,
        'txid':
          '17eafe9b6ca10dbdb70f8f37460db13401cccd9cc2bcb4851a31f01799688dd3',
        'rawTx':
          '0200000000010190ed799b5a2d54a743f8c405615ddada3823b2cc1c178a77a15f5e18de45cb390100000000ffffffff02e80300000000000022512017161c749b810cbd8a2aa7310965b5cb025de7afa2e098a9d3b1aba6424302c6f00e02000000000022512017161c749b810cbd8a2aa7310965b5cb025de7afa2e098a9d3b1aba6424302c601402a5758f1759557b6b7a02900339f5ed83984e26a24e22b642f7a3bcd89a13392cf0848d29eb6be2e18e2c040969c37bd44825f8a343db8c530229c0aceecf88200000000',
      },
    },
  ],
  msgSamples: [],
});

// yarn jest packages/core/src/chains/btc/CoreChainSoftware.tbtc.test.ts
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
  it('signTransaction', async () => {
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
