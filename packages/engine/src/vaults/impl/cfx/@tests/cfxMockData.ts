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
  id: 'cfx--1029',
  impl: 'cfx',
  logoURI: 'https://onekey-asset.com/assets/cfx/cfx.png',
  name: 'Conflux',
  position: 33,
  rpcURL: 'https://node.onekey.so/cfx',
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
      'cfx--1029': 'cfx:aape4yvxbtmm5vegfuzg115x8kjt1kc8p6nztvyg66',
    },
  },
  mnemonic: mockCredentials.mnemonic1,
  password: mockCredentials.password,
};

const importedAccount1: IUnitTestMockAccount = {
  // indexedDB -> accounts
  account: {
    address: 'b1c2f16ca9c3b324039dd0881a63ec236f1f339b6220b54ede8347b4b828daa5',
    coinType: '397',
    id: 'imported--397--b1c2f16ca9c3b324039dd0881a63ec236f1f339b6220b54ede8347b4b828daa5',
    name: 'Account #1',
    path: '',
    pub: 'ed25519:Cxua8Jtcu4414fr97m1CHqVt7WWFdkca1pFkdtLefD5n',
    type: 'simple' as any,
  },
  // indexedDB -> credentials
  privateKey:
    '62ec93894623daf9acf2b59d0517612ffe8e96b70cf4fc8a628aca4fbe7ae3779bf24e68e84a05c1cd64adc698687f40226e96cd3d06a42459fd608606c72d9a7674d391774d2f1431c9da242aed55bb6cb87a801fddaa65a74be6e0568dff3d',
  password: mockCredentials.password,
};

const importedAccount2: IUnitTestMockAccount = {
  account: {
    address: '0x1a0e09b453c29ce1cb23f997869ff71c66cf6c7c',
    coinType: '503',
    id: 'imported--503--03107b9fcb2f3207b1b532750298d395c601742e68e9d0f54ab3d7df66c414304a',
    name: 'Account #1',
    path: '',
    pub: '03107b9fcb2f3207b1b532750298d395c601742e68e9d0f54ab3d7df66c414304a',
    type: 'variant' as any,
    addresses: {
      'cfx--1029': 'cfx:aara6crymtbk32snet63tby986sgrx5ptucv9bmpfn',
    },
  },
  privateKey: '62ec93894623daf9acf2b59d0517612f',
  password: mockCredentials.password,
};

const watchingAccount1: IUnitTestMockAccount = {
  account: {
    address: '0x1a0e09b453c29ce1cb23f997869ff71c66cf6c7c',
    addresses: {
      'cfx--1029': 'cfx:aara6crymtbk32snet63tby986sgrx5ptucv9bmpfn',
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
