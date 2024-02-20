import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';

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
  msgSamples,
} = coreTestsFixtures.prepareCoreChainTestsFixtures({
  networkInfo: {
    networkChainCode: 'evm',
    chainId: '1',
    networkId: 'evm--1',
    networkImpl: 'evm',
    isTestnet: false,
  },
  hdAccountTemplate: "m/44'/60'/0'/0/$$INDEX$$",
  hdAccounts: [
    {
      address: '0x1959f5f4979c5cd87d5cb75c678c770515cb5e0e',
      path: "m/44'/60'/0'/0/0",
      publicKey:
        '02bd51e5b1a6e8271e1f87d2464b856790800c6c5fd38acdf1cee73857735fc8a4',
      privateKeyRaw:
        '105434ca932be16664cb5e44e5b006728577dd757440d068e6d15ef52c15a82f',
    },
    {
      address: '0xefc840572b9889de6bf172da76b7fa59b53a0ea0',
      path: "m/44'/60'/0'/0/1",
      publicKey:
        '03a94df05c696300de718a5a55000972733f00072a2abe9824ba7c91dae3b427b8',
      privateKeyRaw:
        'a9fe0d531d6059f699426fb4476352843549b59849d85354b0e00a61de8285fc',
    },
  ],
  txSamples: [
    {
      encodedTx: {
        'chainId': 1,

        'from': '0x1959f5f4979c5cd87d5cb75c678c770515cb5e0e',
        'to': '0x1959f5f4979c5cd87d5cb75c678c770515cb5e0e',
        'value': '0x0',
        'data': '0x',
        'customData': '0x',
        'gas': '0x5208',
        'gasLimit': '0x5208',
        'maxFeePerGas': '0x2afd66d00',
        'maxPriorityFeePerGas': '0x55d4a80',
        'nonce': 2,
      },
      signedTx: {
        encodedTx: null,
        'txid':
          '0xe5c2d7a1a627352e918f3d7c239bba5173e98d11b023536c1bff3f235e874a71',
        'rawTx':
          '0x02f86b010284055d4a808502afd66d00825208941959f5f4979c5cd87d5cb75c678c770515cb5e0e8080c001a007a018ab9176aac61b58aa9876667694e02dacb817d3a5df6b993611078330e2a07bad91b357e89539f823c21aabcfc30bbe0d6e88de1a72fc2fc1c07dfe04feae',
      },
    },
    {
      encodedTx: {
        'chainId': 1,

        'from': '0x1959f5f4979c5cd87d5cb75c678c770515cb5e0e',
        'to': '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        'value': '0x0',
        'data':
          '0xa9059cbb000000000000000000000000efc840572b9889de6bf172da76b7fa59b53a0ea00000000000000000000000000000000000000000000000000000000000000000',
        'customData':
          '0xa9059cbb000000000000000000000000efc840572b9889de6bf172da76b7fa59b53a0ea00000000000000000000000000000000000000000000000000000000000000000',
        'gas': '0xcb32',
        'gasLimit': '0xcb32',
        'maxFeePerGas': '0x1908b1000',
        'maxPriorityFeePerGas': '0x55d4a80',
        'nonce': 2,
      },
      signedTx: {
        encodedTx: null,
        'txid':
          '0x296e582a7ed1437fcede237af47f7b522692d88b64200f97c7549d6b2532dc39',
        'rawTx':
          '0x02f8b0010284055d4a808501908b100082cb3294a0b86991c6218b36c1d19d4a2e9eb0ce3606eb4880b844a9059cbb000000000000000000000000efc840572b9889de6bf172da76b7fa59b53a0ea00000000000000000000000000000000000000000000000000000000000000000c080a0a3bdf7f73020ff452255e7f39c6660942dd3fbc979633a47e9cf28dadc847513a00b064649e8fff4882dbaab0409208d16760da72d3460dadcf3d4b3e29056df1a',
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

// yarn jest packages/core/src/chains/evm/CoreChainSoftware.test.ts
describe('EVM Core tests', () => {
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
  it('signMessage', async () => {
    const coreApi = new CoreChainHd();
    await coreTestsUtils.expectSignMessageOk({
      coreApi,
      networkInfo,
      account: hdAccounts[0],
      hdCredential,
      msgSamples,
    });

    const unsignedMsg = msgSamples[0];
    expect(
      bufferUtils.hexToText(unsignedMsg.unsignedMsg.message, 'utf8'),
    ).toEqual('Example `personal_sign` message');
  });
});
