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
    networkChainCode: 'sui',
    chainId: 'mainnet',
    networkId: 'sui--mainnet',
    networkImpl: 'sui',
    isTestnet: false,
  },
  hdAccountTemplate: "m/44'/784'/$$INDEX$$'/0'/0'",
  hdAccounts: [
    {
      address:
        '0xff7461b8d07b4633e24b4bacb86dc74224a3a903662974c0a9d06254101081c5',
      path: "m/44'/784'/0'/0'/0'",
      publicKey:
        '2292f77c31cc7e6d3c0b97636387e66c6fb0aceb579de99f8cf3be19ea86a418',
      privateKeyRaw:
        '9f7154673c9237b84f7442967c5e56da999cfcb55d4b445be5b34896e284619f',
    },
  ],
  txSamples: [
    {
      unsignedTx: {
        rawTxUnsigned:
          '0000010020ff7461b8d07b4633e24b4bacb86dc74224a3a903662974c0a9d06254101081c501010100010000ff7461b8d07b4633e24b4bacb86dc74224a3a903662974c0a9d06254101081c500ff7461b8d07b4633e24b4bacb86dc74224a3a903662974c0a9d06254101081c5ee02000000000000c0f625000000000000',
        'inputs': [
          {
            value: {} as any,
            'address':
              'ff7461b8d07b4633e24b4bacb86dc74224a3a903662974c0a9d06254101081c5',
            'publicKey':
              '2292f77c31cc7e6d3c0b97636387e66c6fb0aceb579de99f8cf3be19ea86a418',
          },
        ],
        'outputs': [],
        payload: {},
        'encodedTx': {
          rawTx:
            '{"version":1,"gasConfig":{"payment":[]},"inputs":[{"kind":"Input","value":"0xff7461b8d07b4633e24b4bacb86dc74224a3a903662974c0a9d06254101081c5","index":0,"type":"pure"}],"transactions":[{"kind":"TransferObjects","objects":[{"kind":"GasCoin"}],"address":{"kind":"Input","value":"0xff7461b8d07b4633e24b4bacb86dc74224a3a903662974c0a9d06254101081c5","index":0,"type":"pure"}}]}',
        },
      },
      signedTx: {
        'encodedTx': null,
        'txid': '',
        'publicKey':
          '0x2292f77c31cc7e6d3c0b97636387e66c6fb0aceb579de99f8cf3be19ea86a418',
        'signature':
          'ANxM4qGsjCk9/T5b+3ugVQPMgLzd21FASKFPeZt1WY+8tnd/ihdrhEaJkV552InCh4yt8yjvn0tGJF34G34LwAYikvd8Mcx+bTwLl2Njh+Zsb7Cs61ed6Z+M874Z6oakGA==',
        'signatureScheme': 'ed25519',
        'rawTx':
          'AAABACD/dGG40HtGM+JLS6y4bcdCJKOpA2YpdMCp0GJUEBCBxQEBAQABAAD/dGG40HtGM+JLS6y4bcdCJKOpA2YpdMCp0GJUEBCBxQD/dGG40HtGM+JLS6y4bcdCJKOpA2YpdMCp0GJUEBCBxe4CAAAAAAAAwPYlAAAAAAAA',
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

// yarn jest packages/core/src/chains/sui/CoreChainSoftware.test.ts
describe('SUI Core tests', () => {
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
