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
  logoURI: 'https://onekey-asset.com/assets/cfx/cfx.png',
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
    address: '0x16bcf8f7e2cdbc3e0d19e149e5be60a15c831b62',
    coinType: '503',
    id: 'imported--503--02b09ef8687881bece5d5f61791683c09def2f8a4887ef9179f4a0ac52b961d2a8',
    name: 'Account #1',
    path: '',
    pub: '02b09ef8687881bece5d5f61791683c09def2f8a4887ef9179f4a0ac52b961d2a8',
    type: 'variant' as any,
    addresses: {
      'cfx--1': 'cfxtest:aann38h16ng52turdhuyx3r8pcuz3a25pjzksumht8',
    },
  },
  privateKey: '62ec93894623daf9acf2b59d0517612f62ec93894623daf9acf2b59d0517612f',
  password: mockCredentials.password,
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
  watchingAccount1,
};
