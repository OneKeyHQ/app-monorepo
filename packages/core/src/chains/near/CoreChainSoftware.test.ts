import { baseDecode } from 'borsh';

import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

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
    networkChainCode: 'near',
    chainId: '0',
    networkId: 'near--0',
    networkImpl: 'near',
    isTestnet: false,
  },
  hdAccountTemplate: "m/44'/397'/$$INDEX$$'",
  hdAccounts: [
    {
      address:
        '9cc26ec7b1ca4dbf3c9588534c6e7e2a537fab3f60f1d2d50c0e7a9bce413b73',
      addresses: {},
      path: "m/44'/397'/0'",
      publicKey: 'ed25519:BYvZNc9zUYYyXvTT6AtnazqzRZA6edJ5igz3j7fZ2YHG',
      privateKeyRaw:
        'a8bd77eaa501ab24899fb70d112817fc70f60a52c4e14d6cd29756b11dabb194',
    },
  ],
  txSamples: [
    {
      unsignedTx: {
        payload: {
          nonce: 0,
          blockHash: '13MioQFyijJBe6hnr2MXb8UvgHPaDJbXmxaePoU4a3ut',
        },
        encodedTx:
          'QAAAADljYzI2ZWM3YjFjYTRkYmYzYzk1ODg1MzRjNmU3ZTJhNTM3ZmFiM2Y2MGYxZDJkNTBjMGU3YTliY2U0MTNiNzMAnMJux7HKTb88lYhTTG5+KlN/qz9g8dLVDA56m85BO3MAAAAAAAAAAEAAAAA5Y2MyNmVjN2IxY2E0ZGJmM2M5NTg4NTM0YzZlN2UyYTUzN2ZhYjNmNjBmMWQyZDUwYzBlN2E5YmNlNDEzYjczduRSHu2jCHL0n5sR67vRypCediK0F7BFsIEo+y7ExB8BAAAAAwAAAAAAAAAAAAAAAAAAAAA=',
      },
      signedTx: {
        'txid': '2BTaUCtzDaCgwmurQix2CCPc6879a3M8NwG29HsFkwJr',
        'rawTx':
          'QAAAADljYzI2ZWM3YjFjYTRkYmYzYzk1ODg1MzRjNmU3ZTJhNTM3ZmFiM2Y2MGYxZDJkNTBjMGU3YTliY2U0MTNiNzMAnMJux7HKTb88lYhTTG5+KlN/qz9g8dLVDA56m85BO3MAAAAAAAAAAEAAAAA5Y2MyNmVjN2IxY2E0ZGJmM2M5NTg4NTM0YzZlN2UyYTUzN2ZhYjNmNjBmMWQyZDUwYzBlN2E5YmNlNDEzYjczAJqXMA1yrv8MaRWLyNJHczBTBCkC0cUxXg45VUaFFfsBAAAAAwAAAAAAAAAAAAAAAAAAAAAAsqbocYjs090VEBZtqjbXDNTyveoiEb1WhiyaY+l7P5j3Ft11mfurv8F/npLK09set/crwjjdWN1SPof33TxLDg==',
        'digest':
          '11898bb8a73e4400c2c1562a65d9012bd30023b8b32807ce1dfc7ae0f6c20d7b',
        'signature':
          'b2a6e87188ecd3dd1510166daa36d70cd4f2bdea2211bd56862c9a63e97b3f98f716dd7599fbabbfc17f9e92cad3db1eb7f72bc238dd58dd523e87f7dd3c4b0e',
        'publicKey':
          '9cc26ec7b1ca4dbf3c9588534c6e7e2a537fab3f60f1d2d50c0e7a9bce413b73',
        'encodedTx':
          'QAAAADljYzI2ZWM3YjFjYTRkYmYzYzk1ODg1MzRjNmU3ZTJhNTM3ZmFiM2Y2MGYxZDJkNTBjMGU3YTliY2U0MTNiNzMAnMJux7HKTb88lYhTTG5+KlN/qz9g8dLVDA56m85BO3MAAAAAAAAAAEAAAAA5Y2MyNmVjN2IxY2E0ZGJmM2M5NTg4NTM0YzZlN2UyYTUzN2ZhYjNmNjBmMWQyZDUwYzBlN2E5YmNlNDEzYjczduRSHu2jCHL0n5sR67vRypCediK0F7BFsIEo+y7ExB8BAAAAAwAAAAAAAAAAAAAAAAAAAAA=',
      },
    },
  ],
  msgSamples: [],
});

// yarn jest packages/core/src/chains/near/CoreChainSoftware.test.ts
describe('NEAR Core tests', () => {
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
      publicKeyGetter: ({ account }) =>
        Promise.resolve({
          publicKey: bufferUtils.bytesToHex(
            baseDecode(account.publicKey.split(':')[1]),
          ),
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
  it.skip('signMessage', async () => {
    // const coreApi = new CoreChainHd();
    // coreApi.signMessage
    throw new Error('Method not implemented.');
  });
});
