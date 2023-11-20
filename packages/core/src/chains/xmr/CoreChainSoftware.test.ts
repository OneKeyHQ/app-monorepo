import coreTestsUtils from '../../../@tests/coreTestsUtils';
import coreTestsFixtures from '../../../@tests/fixtures/coreTestsFixtures';
import { EMessageTypesEth } from '../../types';

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
    networkChainCode: 'xmr',
    chainId: '0',
    networkId: 'xmr--0',
    networkImpl: 'xmr',
    isTestnet: false,
  },
  hdAccountTemplate: "m/44'/128'/$$INDEX$$'",
  hdAccounts: [
    {
      address:
        '45vw7EY1nYs66nCedDxS9hYptSP2PnnQwezJ4WmGsNFFKAKXMDWSEspFUKBD6UCivUB5LGW2vXoX8D3DjzhrFuoZSoDcYPN',
      path: "m/44'/128'/0'",
      publicKey: '',
      privateKeyRaw:
        '8b28f5749ec99464d5a9d6527125aa8778ea017dd9e5cffaa567d2f62f2c8cbc',
    },
  ],
  txSamples: [
    {
      encodedTx: '',
      signedTx: {
        encodedTx: null,
        'txid': '',
        'rawTx': ``,
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

// TODO import wasmBinaryFileName from './moneroCore.wasm.bin';
// yarn jest packages/core/src/chains/xmr/CoreChainSoftware.test.ts
describe('XMR Core tests', () => {
  it('mnemonic verify', () => {
    coreTestsUtils.expectMnemonicValid({
      hdCredential,
    });
  });
  // 'Method not implemented, use getAddressFromPrivate instead.',
  it.skip('getAddressFromPublic', async () => {
    const coreApi = new CoreChainHd();
    await coreTestsUtils.expectGetAddressFromPublicOk({
      coreApi,
      networkInfo,
      hdAccounts,
    });
  });
  it.skip('getAddressFromPrivate', async () => {
    const coreApi = new CoreChainHd();
    await coreTestsUtils.expectGetAddressFromPrivateOk({
      coreApi,
      networkInfo,
      hdAccounts,
    });
  });
  it.skip('getAddressesFromHd', async () => {
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

  it.skip('signTransaction', async () => {
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
