import mockCredentials from '../../../../../@tests/mockCredentials';
import { AccountType } from '../../../../types/account';

import type { IUnitTestMockAccount } from '../../../../../@tests/types';
import type { DBNetwork } from '../../../../types/network';

// indexedDB -> networks
const network: DBNetwork = {
  balance2FeeDecimals: 0,
  decimals: 6,
  enabled: true,
  feeDecimals: 6,
  feeSymbol: 'STX',
  id: 'stacks--testnet',
  impl: 'stacks',
  logoURI: 'https://assets.stacks.co/Logos/Stacks%20Logo%20png.png',
  name: 'Stacks Testnet',
  position: 33,
  rpcURL: 'wss://api.testnet.hiro.so',
  symbol: 'STX',
};

const hdAccount1: IUnitTestMockAccount = {
  // indexedDB -> accounts
  account: {
    'name': 'Stacks #1',
    'address':
      '02e3027885ce1ed1d21300158ce8f60649e280e2a8f746e9cea6858a3331021d8a',
    'addresses': {
      'nexa--testnet':
        '02e3027885ce1ed1d21300158ce8f60649e280e2a8f746e9cea6858a3331021d8a',
    },
    'xpub': '',
    'coinType': '5757',
    'id': "hd-19--m/44'/5757'/0'",
    'path': "m/44'/5757'/0'/0/0",
    'template': "m/44'/5757'/0'/0/$$INDEX$$",
    'type': AccountType.UTXO,
  },
  mnemonic: mockCredentials.mnemonic1,
  password: mockCredentials.password,
};

const importedAccount1: IUnitTestMockAccount = {
  // indexedDB -> accounts
  account: {
    'address':
      '03560d4451deeef0d1bcc46ff062372400ecf7b6e4e058ef01792f140ce2a97c31',
    'addresses': {
      'stacks--testnet':
        '03560d4451deeef0d1bcc46ff062372400ecf7b6e4e058ef01792f140ce2a97c31',
    },
    'coinType': '5757',
    'id': 'imported--5757--03560d4451deeef0d1bcc46ff062372400ecf7b6e4e058ef01792f140ce2a97c31',
    name: 'Account #1',
    path: '',
    xpub: '',
    type: AccountType.SIMPLE,
  },
  // indexedDB -> credentials
  privateKey:
    '6b4d9dee8a37f4329cbf7db9a137a2ecdc63be8e6caa881ef05b3a3349ef8db9',
  password: mockCredentials.password,
};

const importedAccount2: IUnitTestMockAccount = {
  account: {
    'address':
      '03560d4451deeef0d1bcc46ff062372400ecf7b6e4e058ef01792f140ce2a97c31',
    'addresses': {
      'stacks--testnet':
        '03560d4451deeef0d1bcc46ff062372400ecf7b6e4e058ef01792f140ce2a97c31',
    },
    'coinType': '5757',
    'id': 'imported--5757--03560d4451deeef0d1bcc46ff062372400ecf7b6e4e058ef01792f140ce2a97c31',
    name: 'Account #1',
    path: '',
    xpub: '',
    type: AccountType.SIMPLE,
  },
  // indexedDB -> credentials
  privateKey:
    'b848990d04878c4bbdcb671f45ed02807bcb4b200bfab2d636cb088e921b483fb01e7b872377c5b6dd582f0ca5d16ae5e4565163607df61ec5b5c96cbde8f4bb892865e079c0c4d64f29e5ba8b6a8d80317c1c7a97cf476a7459d24aa80d2a0f',
  password: '12345678',
};

const watchingAccount1: IUnitTestMockAccount = {
  account: {
    address: 'stackstest:nqtsq5g5s9cd8fsl9d9a7jhsuzsw7u9exztnnz8n9un89t0k',
    'coinType': '5757',
    'id': 'external--5757--stackstest:nqtsq5g5s9cd8fsl9d9a7jhsuzsw7u9exztnnz8n9un89t0k',
    name: 'Account #1',
    path: '',
    pub: '',
    type: AccountType.SIMPLE,
  },
  password: '',
};

const watchingAccount2: IUnitTestMockAccount = {
  account: {
    address: 'stackstest:fmza0ttf3pnv5zpg8e2q8lr3t2cesrrv9xdk395r5g5qsqtn',
    coinType: '5757',
    id: 'external--397--ed25519:8wbWQQkeK9NV1qkiQZ95jbj7JNhpeapHafLPw3qsJdqi',
    name: 'Account #1',
    path: '',
    pub: '',
    type: AccountType.SIMPLE,
  },
  password: '',
};

const watchingAccount3: IUnitTestMockAccount = {
  account: {
    address:
      '03560d4451deeef0d1bcc46ff062372400ecf7b6e4e058ef01792f140ce2a97c31',
    coinType: '5757',
    id: 'external--5757--03560d4451deeef0d1bcc46ff062372400ecf7b6e4e058ef01792f140ce2a97c31',
    name: 'Account #1',
    path: '',
    pub: '',
    type: AccountType.SIMPLE,
  },
  password: '',
};

const watchingAccount4: IUnitTestMockAccount = {
  account: {
    address: 'stacks:nqtsq5g50frur0vav60gupjlrr8cta8vyqufu7p98vx97c66',
    coinType: '5757',
    id: 'external--5757--03560d4451deeef0d1bcc46ff062372400ecf7b6e4e058ef01792f140ce2a97c31',
    name: 'Account #1',
    path: '',
    pub: '',
    type: AccountType.SIMPLE,
  },
  password: '',
};

export default {
  network,
  hdAccount1,
  importedAccount1,
  importedAccount2,
  watchingAccount1,
  watchingAccount2,
  watchingAccount3,
  watchingAccount4,
};
