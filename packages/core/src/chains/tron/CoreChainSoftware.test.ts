import coreTestsUtils from '../../../@tests/coreTestsUtils';
import coreTestsFixtures from '../../../@tests/fixtures/coreTestsFixtures';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';

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
    networkChainCode: 'tron',
    chainId: '0',
    networkId: 'tron--0x2b6653dc',
    networkImpl: 'tron',
    isTestnet: false,
  },
  hdAccountTemplate: "m/44'/195'/0'/0/$$INDEX$$",
  hdAccounts: [
    {
      address: 'TNsC5fdh1ZfbTZpMjbiXZifseoxKRgNrqb',
      path: "m/44'/195'/0'/0/0",
      publicKey:
        '025414abc40dbcb07c2204e04a34261090851bb28e1616ba77212d3d270d4b4761',
      privateKeyRaw:
        '435e5da99714e2806ea1b0b93db43d4e74ecaab786d7f1a55a155b855542b907',
    },
  ],
  txSamples: [
    {
      encodedTx: {
        'visible': false,
        'txID':
          'fe9e81633ce99ef11814b3b836fb2ac8e841ab45fe4e7d68422c2a6b6be7f3c2',
        'raw_data': {
          'contract': [
            {
              'parameter': {
                'value': {
                  'amount': 100000,
                  'owner_address': '418d765ef87acee24ad4ff6f5e755f36c1ee557424',
                  'to_address': '419e9113cb852004f53b25d8d565b6a1c8c310fb61',
                },
                // @ts-ignore
                'type_url': 'type.googleapis.com/protocol.TransferContract',
              },
              'type': 'TransferContract',
            },
          ],
          'ref_block_bytes': '0a95',
          'ref_block_hash': '81a16498bf36d557',
          'expiration': 1697179737000,
          'timestamp': 1697179677393,
        },
        'raw_data_hex':
          '0a020a95220881a16498bf36d55740a8b7aebeb2315a67080112630a2d747970652e676f6f676c65617069732e636f6d2f70726f746f636f6c2e5472616e73666572436f6e747261637412320a15418d765ef87acee24ad4ff6f5e755f36c1ee5574241215419e9113cb852004f53b25d8d565b6a1c8c310fb6118a08d0670d1e5aabeb231',
      },
      signedTx: {
        'encodedTx': null,
        'txid':
          'fe9e81633ce99ef11814b3b836fb2ac8e841ab45fe4e7d68422c2a6b6be7f3c2',
        'rawTx': `{"visible":false,"txID":"fe9e81633ce99ef11814b3b836fb2ac8e841ab45fe4e7d68422c2a6b6be7f3c2","raw_data":{"contract":[{"parameter":{"value":{"amount":100000,"owner_address":"418d765ef87acee24ad4ff6f5e755f36c1ee557424","to_address":"419e9113cb852004f53b25d8d565b6a1c8c310fb61"},"type_url":"type.googleapis.com/protocol.TransferContract"},"type":"TransferContract"}],"ref_block_bytes":"0a95","ref_block_hash":"81a16498bf36d557","expiration":1697179737000,"timestamp":1697179677393},"raw_data_hex":"0a020a95220881a16498bf36d55740a8b7aebeb2315a67080112630a2d747970652e676f6f676c65617069732e636f6d2f70726f746f636f6c2e5472616e73666572436f6e747261637412320a15418d765ef87acee24ad4ff6f5e755f36c1ee5574241215419e9113cb852004f53b25d8d565b6a1c8c310fb6118a08d0670d1e5aabeb231","signature":["091e696dbf120ff0bd235d10681bd2a4040ba47c5135269643b962dd4a2b2285297097962c9feb1204b2f5f4855e517df2b6f96fde14783730b19212937205bb01"]}`,
      },
    },
  ],
  msgSamples: [
    {
      unsignedMsg: {
        type: EMessageTypesEth.PERSONAL_SIGN,
        message:
          '0x4578616d706c652060706572736f6e616c5f7369676e60206d657373616765',
      },
      signedMsg:
        '0xeb1610361c143bc8a80b296b6759477e3420909bcee38487cf8bbe75aff92edc76b35f7a2820a5a2668415803162d408dcbd6c3bd961d6cd09f38a0f33dc479c1c',
    },
  ],
});

// yarn jest packages/core/src/chains/tron/CoreChainSoftware.test.ts
describe('TRON Core tests', () => {
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
    // TODO not working
    // const spy = jest.spyOn(coreApi, 'signTransaction');
    // expect(spy).toHaveBeenCalled();
  });
  it.skip('signMessage', async () => {
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
