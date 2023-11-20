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
    networkChainCode: 'cosmos',
    chainId: '4',
    networkId: 'cosmos--cosmoshub-4',
    networkImpl: 'cosmos',
    isTestnet: false,
    addressPrefix: 'cosmos',
  },
  hdAccountTemplate: "m/44'/118'/0'/0/$$INDEX$$",
  hdAccounts: [
    {
      address: 'b7ded9bc6b75abab9458df44420c7c5f5457e077',
      addresses: {
        'cosmos--cosmoshub-4': 'cosmos1kl0dn0rtwk46h9zcmazyyrruta290crh7wt6qp',
      },
      path: "m/44'/118'/0'/0/0",
      publicKey:
        '03352ac3058d7f088ae0791044874279340a63d1b7c10fb395db5a48cb9488b744',
      privateKeyRaw:
        'a7bb0633b951bbbb2ae43f15ac3e57fa0c83e2b6a45fccb5aa6dc5642d9d031a',
    },
  ],
  txSamples: [
    {
      unsignedTx: {
        inputs: [
          {
            address: 'b7ded9bc6b75abab9458df44420c7c5f5457e077',
            publicKey:
              '03352ac3058d7f088ae0791044874279340a63d1b7c10fb395db5a48cb9488b744',
            value: {} as any,
          },
        ],
        outputs: [],
        payload: {},
        encodedTx: {
          'signDoc': {
            'chain_id': 'cosmoshub-4',
            'account_number': '1878610',
            'sequence': '0',
            'fee': {
              'amount': [{ 'denom': 'uatom', 'amount': '2394' }],
              'gas': '95752',
            },
            'msgs': [
              {
                'type': 'cosmos-sdk/MsgSend',
                'value': {
                  'from_address':
                    'cosmos1kl0dn0rtwk46h9zcmazyyrruta290crh7wt6qp',
                  'to_address': 'cosmos1kl0dn0rtwk46h9zcmazyyrruta290crh7wt6qp',
                  'amount': [{ 'amount': '10000', 'denom': 'uatom' }],
                },
              },
            ],
            'memo': '',
          },
          'mode': 'amino',
          'msg': {
            'aminoMsgs': [
              {
                'type': 'cosmos-sdk/MsgSend',
                'value': {
                  'from_address':
                    'cosmos1kl0dn0rtwk46h9zcmazyyrruta290crh7wt6qp',
                  'to_address': 'cosmos1kl0dn0rtwk46h9zcmazyyrruta290crh7wt6qp',
                  'amount': [{ 'amount': '10000', 'denom': 'uatom' }],
                },
              },
            ],
            'protoMsgs': [
              {
                'typeUrl': '/cosmos.bank.v1beta1.MsgSend',
                'value':
                  '0a2d636f736d6f73316b6c30646e307274776b343668397a636d617a79797272757461323930637268377774367170122d636f736d6f73316b6c30646e307274776b343668397a636d617a797972727574613239306372683777743671701a0e0a057561746f6d12053130303030',
              },
            ],
          },
        } as any,
      },
      signedTx: {
        'encodedTx': null,
        'txid': '',
        'rawTx':
          'CpEBCo4BChwvY29zbW9zLmJhbmsudjFiZXRhMS5Nc2dTZW5kEm4KLWNvc21vczFrbDBkbjBydHdrNDZoOXpjbWF6eXlycnV0YTI5MGNyaDd3dDZxcBItY29zbW9zMWtsMGRuMHJ0d2s0Nmg5emNtYXp5eXJydXRhMjkwY3JoN3d0NnFwGg4KBXVhdG9tEgUxMDAwMBJlCk4KRgofL2Nvc21vcy5jcnlwdG8uc2VjcDI1NmsxLlB1YktleRIjCiEDNSrDBY1/CIrgeRBEh0J5NApj0bfBD7OV21pIy5SIt0QSBAoCCH8SEwoNCgV1YXRvbRIEMjM5NBCI7AUaQOYpQZZf8Mx6ABGNmQUnTWx9C9Vj4ZMHhAnr2e84kHh6Q4/GnEE4cEi2A4E1/3ow5NgvkZDD1iCA+O/2V6L+FzQ=',
      },
    },
  ],
  msgSamples: [],
});

// yarn jest packages/core/src/chains/cosmos/CoreChainSoftware.test.ts
describe('COSMOS Core tests', () => {
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
  });
  it.skip('signMessage', async () => {
    // const coreApi = new CoreChainHd();
    // coreApi.signMessage
    throw new Error('Method not implemented.');
  });
});
