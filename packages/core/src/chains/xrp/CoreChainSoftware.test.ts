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
    networkChainCode: 'xrp',
    chainId: '0',
    networkId: 'xrp--0',
    networkImpl: 'xrp',
    isTestnet: false,
  },
  hdAccountTemplate: "m/44'/144'/$$INDEX$$'/0/0",
  hdAccounts: [
    {
      address: 'rp8oYAfF2ypEDJvJgiwh47weiWZbpqsjBR',
      path: "m/44'/144'/0'/0/0",
      publicKey:
        '02A2440A2831F0F7E3879628246223F6E595A44D90BF10622917A57444832CF622',
      privateKeyRaw:
        '1e7b7d22a9420bde9cec19f60332103de7c178bd3a8e149d79e03a20c2f48203',
    },
  ],
  txSamples: [
    {
      encodedTx: {
        'TransactionType': 'Payment',
        'Account': 'rp8oYAfF2ypEDJvJgiwh47weiWZbpqsjBR',
        'Amount': '10000',
        'Destination': 'rKmyYKs9gyKV93PYFa6tdPUW5tNg1NsK2B',
        'LastLedgerSequence': 83184401,
        'Flags': 0,
        'Sequence': 83184307,
        'Fee': '12',
      },
      signedTx: {
        'encodedTx': null,
        'txid':
          'BF618968B811CB92DD148F27A35410CB0C460262ADC9FAA1069AD2FAC86F713C',
        'rawTx':
          '12000022000000002404F54AB3201B04F54B1161400000000000271068400000000000000C732102A2440A2831F0F7E3879628246223F6E595A44D90BF10622917A57444832CF6227446304402205E3B36AA3107D28046DE079BDC9F787CDFD7E94C1919D5406A9AC1D2133D3EB702200A4FD0FB5E2CB9C9245C60B161401E0C3302BAE6CD859D52D14070B122538A04811413A1B3D8907D7652C80A3A6C89E57B43C0624E0F8314CDF3C37587DE252F85A6FA6A4428940751D22CB5',
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

// yarn jest packages/core/src/chains/xrp/CoreChainSoftware.test.ts
describe('XRP Core tests', () => {
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
