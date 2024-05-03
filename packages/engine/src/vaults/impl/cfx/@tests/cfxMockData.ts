import mockCredentials from '../../../../../@tests/mockCredentials';

import type { IUnitTestMockAccount } from '../../../../../@tests/types';
import type { DBNetwork } from '../../../../types/network';

// indexedDB -> networks
const network: DBNetwork = {
  balance2FeeDecimals: 0,
  decimals: 18,
  enabled: true,
  feeDecimals: 18,
  feeSymbol: 'CFX',
  id: 'cfx--1',
  impl: 'cfx',
  logoURI: 'https://uni.onekey-asset.com/static/chain/cfx.png',
  name: 'Conflux',
  position: 33,
  rpcURL: 'https://test.confluxrpc.com',
  symbol: 'CFX',
};

const hdAccount1: IUnitTestMockAccount = {
  // indexedDB -> accounts
  account: {
    address: '0x184d52330bd4adc4862c2a6bdf73f250fba45e67',
    coinType: '503',
    id: "hd-19--m/44'/503'/0'/0/0",
    name: 'CFX #1',
    path: "m/44'/503'/0'/0/0",
    pub: '03b03e87ca0c131f33f78d1e6757c2932a88b317858ff99ac48fdd425f7f473159',
    type: 'variant' as any,
    addresses: {
      'cfx--1': 'cfxtest:aape4yvxbtmm5vegfuzg115x8kjt1kc8p6b86bwp20',
    },
  },
  mnemonic: mockCredentials.mnemonic1,
  password: mockCredentials.password,
};

const importedAccount1: IUnitTestMockAccount = {
  account: {
    address: '0x13f705ac6ad451fbab045b933acef7298b88092f',
    coinType: '503',
    id: 'imported--503--03560d4451deeef0d1bcc46ff062372400ecf7b6e4e058ef01792f140ce2a97c31',
    name: 'Account #1',
    path: '',
    pub: '03560d4451deeef0d1bcc46ff062372400ecf7b6e4e058ef01792f140ce2a97c31',
    type: 'variant' as any,
    addresses: {
      'cfx--1': 'cfxtest:aak9sbrprnmfd87navr3gs0s86y21cakf686z1t5z0',
    },
  },
  privateKey:
    '6b4d9dee8a37f4329cbf7db9a137a2ecdc63be8e6caa881ef05b3a3349ef8db9',
  password: mockCredentials.password,
};

const importedAccount2: IUnitTestMockAccount = {
  account: {
    address: '0x13f705ac6ad451fbab045b933acef7298b88092f',
    coinType: '503',
    id: 'imported--503--03560d4451deeef0d1bcc46ff062372400ecf7b6e4e058ef01792f140ce2a97c31',
    name: 'Account #1',
    path: '',
    pub: '03560d4451deeef0d1bcc46ff062372400ecf7b6e4e058ef01792f140ce2a97c31',
    type: 'variant' as any,
    addresses: {
      'cfx--1': 'cfxtest:aak9sbrprnmfd87navr3gs0s86y21cakf686z1t5z0',
    },
  },
  privateKey:
    'd8bc093ae2c5759da83340455ef06b0c4231dbc4a6899c4970f923e33b8a666c75529a7352d8c5b8aa5cc4f44d34c72bbb4a9a3c81ce2af765a751ed002181636831d36c7166e733769eb69349a5de4c3e73bafbc6808d81c45500b30b7c6847',
  password: '12345678',
};

const watchingAccount1: IUnitTestMockAccount = {
  account: {
    address: '0x1a0e09b453c29ce1cb23f997869ff71c66cf6c7c',
    addresses: {
      'cfx--1': 'cfxtest:aara6crymtbk32snet63tby986sgrx5ptuj4pvpgbb',
    },
    coinType: '503',
    id: 'external--503--0x1a0e09b453c29ce1cb23f997869ff71c66cf6c7c',
    name: 'Account #1',
    path: '',
    pub: '',
    type: 'variant' as any,
  },
  password: '',
};

export default {
  network,
  hdAccount1,
  importedAccount1,
  importedAccount2,
  watchingAccount1,
};
