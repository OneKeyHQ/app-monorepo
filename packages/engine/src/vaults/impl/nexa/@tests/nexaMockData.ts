import mockCredentials from '../../../../../@tests/mockCredentials';
import { AccountType } from '../../../../types/account';

import type { IUnitTestMockAccount } from '../../../../../@tests/types';
import type { DBNetwork } from '../../../../types/network';

// indexedDB -> networks
const network: DBNetwork = {
  balance2FeeDecimals: 0,
  decimals: 2,
  enabled: true,
  feeDecimals: 2,
  feeSymbol: 'NEXA',
  id: 'nexa--testnet',
  impl: 'nexa',
  logoURI: 'https://onekey-asset.com/assets/nexa/nexa.png',
  name: 'Nexa Testnet',
  position: 33,
  rpcURL: 'wss://testnet-explorer.nexa.org:30004',
  symbol: 'NEXA',
};

const hdAccount1: IUnitTestMockAccount = {
  // indexedDB -> accounts
  account: {
    'name': 'NEAR #1',
    'address': 'nexatest:nqtsq5g5llmjhut9fuzst4993zmk62m89rw2gztuvl376dp0',
    'addresses': {
      '0/0': 'nexatest:nqtsq5g5llmjhut9fuzst4993zmk62m89rw2gztuvl376dp0',
    },
    'coinType': '29223',
    'customAddresses': {
      '0/0': 'nexatest:nqtsq5g5llmjhut9fuzst4993zmk62m89rw2gztuvl376dp0',
    },
    'id': "hd-19--m/44'/29223'/0'/0'/0'",
    'path': "m/44'/29223'/0'/0'/0'",
    'template': "m/44'/29223'/0'/0'/$$INDEX$$'",
    'type': AccountType.UTXO,
    'xpub': '',
  },
  mnemonic: mockCredentials.mnemonic1,
  password: mockCredentials.password,
};

const importedAccount1: IUnitTestMockAccount = {
  // indexedDB -> accounts
  account: {
    'address': 'nexatest:nqtsq5g5l7rgf6mrvuhrjke8vsm4ng60q86vdycptqn79epv',
    'coinType': '29223',
    'id': 'imported--29223--nexatest:nqtsq5g5l7rgf6mrvuhrjke8vsm4ng60q86vdycptqn79epv',
    name: 'Account #1',
    path: '',
    pub: '03560d4451deeef0d1bcc46ff062372400ecf7b6e4e058ef01792f140ce2a97c31',
    type: AccountType.SIMPLE,
  },
  // indexedDB -> credentials
  privateKey:
    '6b4d9dee8a37f4329cbf7db9a137a2ecdc63be8e6caa881ef05b3a3349ef8db9',
  password: mockCredentials.password,
};

const importedAccount2: IUnitTestMockAccount = {
  account: {
    'address': 'nexatest:nqtsq5g5l7rgf6mrvuhrjke8vsm4ng60q86vdycptqn79epv',
    'coinType': '29223',
    'id': 'imported--29223--nexatest:nqtsq5g5l7rgf6mrvuhrjke8vsm4ng60q86vdycptqn79epv',
    name: 'Account #1',
    path: '',
    pub: '03560d4451deeef0d1bcc46ff062372400ecf7b6e4e058ef01792f140ce2a97c31',
    type: AccountType.SIMPLE,
  },
  // indexedDB -> credentials
  privateKey:
    '6b4d9dee8a37f4329cbf7db9a137a2ecdc63be8e6caa881ef05b3a3349ef8db9',
  password: mockCredentials.password,
};

const watchingAccount1: IUnitTestMockAccount = {
  account: {
    address: 'ed25519:8wbWQQkeK9NV1qkiQZ95jbj7JNhpeapHafLPw3qsJdqi',
    coinType: '397',
    id: 'external--397--ed25519:8wbWQQkeK9NV1qkiQZ95jbj7JNhpeapHafLPw3qsJdqi',
    name: 'Account #1',
    path: '',
    pub: '',
    type: AccountType.SIMPLE,
  },
  password: '',
};

const watchingAccount2: IUnitTestMockAccount = {
  account: {
    address: 'a-b-c-d-e-f-g-h-i',
    coinType: '397',
    id: 'external--397--a-b-c-d-e-f-g-h-i',
    name: 'Account #1',
    path: '',
    pub: '',
    type: AccountType.SIMPLE,
  },
  password: '',
};

const watchingAccount3: IUnitTestMockAccount = {
  account: {
    address: '7t52o0p34zxf58v2mx8rszraplaapgeqb6xhllv5oy8tt5pzs1pfvpsjhrktg42n',
    coinType: '397',
    id: 'external--397--7t52o0p34zxf58v2mx8rszraplaapgeqb6xhllv5oy8tt5pzs1pfvpsjhrktg42n',
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
};
