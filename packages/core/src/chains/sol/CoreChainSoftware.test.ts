import base58 from 'bs58';

import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import { EMessageTypesSolana } from '@onekeyhq/shared/types/message';

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
    networkChainCode: 'sol',
    chainId: '101',
    networkId: 'sol--101',
    networkImpl: 'sol',
    isTestnet: false,
  },
  hdAccountTemplate: "m/44'/501'/$$INDEX$$'/0'",
  hdAccounts: [
    {
      address: '4wX8yu9YmSe4mv9ZPtTeoF9pe6Ji4ScjuJEffS3sCKZ4',
      addresses: {},
      path: "m/44'/501'/0'/0'",
      publicKey: '4wX8yu9YmSe4mv9ZPtTeoF9pe6Ji4ScjuJEffS3sCKZ4',
      privateKeyRaw:
        'feafaa95d64a1a37f4e4dce7fd2ee764bbc1e8eef627d5aedaceee19f89f76ff',
    },
  ],
  txSamples: [
    {
      encodedTx:
        'AKhoybLLJS1deDJDyjELDNhfkBBX3k4dt4bBfmppjfPVVimhQdFEfDo8AiFcCBCC9VkYWV2r3jkh9n1DAXEhnJPwMmnsrzPU2tzHAKYnwTBaPFbZyQ5TdfhLktRm9RnYgLDqDby5R5LQp2FrFkkMiPWuPT7Za6TFvccnuZ1CZ88HnU5tAyLbX25oCEzsTN9xHxFess7V37H3W97jELbHDsdvc6mhKqdq41oPKhprZYBukt8cLyHdeEbno',
      signedTx: {
        encodedTx: null,
        'txid':
          '5BDe9KffLU3FoPdGEuT3reDCC534yWCBRHA2spYGV8Gj6x5WwB7zTzed2j9bbdCiBVRyu4VAv4AKuQc3EBe595Hy',
        'rawTx':
          'AdDhKos1GoLn9eCF84oW9+58bPzQat3e+EDtZmQgjRRuYPk2YC7Bbobw3DJo7P/q4cmFFkMy0u48Sx2muC5vcQgBAAECOoqATG/Vw3lW1IE1OGwPM2yQslR+1iMIZFE9i7kpUyMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKj6cxTT+hf+oYJjEI8DMZmZCPL8U5sYFv/1nNJEuVjrAQECAAAMAgAAAAAAAAAAAAAA',
      },
    },
  ],
  msgSamples: [],
});

// yarn jest packages/core/src/chains/sol/CoreChainSoftware.test.ts
describe('SOL Core tests', () => {
  it('mnemonic verify', async () => {
    await coreTestsUtils.expectMnemonicValid({
      hdCredential,
    });
  });
  it('getAddressFromPublic', async () => {
    const coreApi = new CoreChainHd();
    await coreTestsUtils.expectGetAddressFromPublicOk({
      coreApi,
      networkInfo,
      hdAccounts,
      publicKeyGetter: ({ account }) =>
        Promise.resolve({
          publicKey: bufferUtils.bytesToHex(base58.decode(account.publicKey)),
        }),
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
  it('signMessage version 1 offchain message', async () => {
    const coreApi = new CoreChainHd();
    const address = hdAccounts[0].address;
    await coreTestsUtils.expectSignMessageOk({
      coreApi,
      networkInfo,
      account: hdAccounts[0],
      hdCredential,
      msgSamples: [
        {
          unsignedMsg: {
            type: EMessageTypesSolana.SIGN_OFFCHAIN_MESSAGE,
            message: 'Sign in to app.example',
            payload: { version: 1, requiredSigners: [address] },
          },
          // Signature over the bytes the spec produces, cross-checked with tweetnacl.
          signedMsg:
            'VzKjTNrysKTQcDaCKBxEamRzgsK8ASg9XiuJqoGuPqvfG5Cz4m1H2cCSHMpM9DwKAmQ8LaovRAae5jNxhjvKGzX',
        },
      ],
    });
  });

  it('signMessage refuses a version 1 message that does not require this account', async () => {
    const coreApi = new CoreChainHd();
    const other = '11111111111111111111111111111112';
    await expect(
      coreApi.signMessage({
        networkInfo,
        password: hdCredential.password,
        credentials: { hd: hdCredential.hdCredentialHex },
        account: hdAccounts[0],
        unsignedMsg: {
          type: EMessageTypesSolana.SIGN_OFFCHAIN_MESSAGE,
          message: 'Sign in to app.example',
          payload: { version: 1, requiredSigners: [other] },
        },
      }),
    ).rejects.toThrow('signer is not one of requiredSigners');
  });
});
