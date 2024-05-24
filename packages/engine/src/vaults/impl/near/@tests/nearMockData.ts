import mockCredentials from '../../../../../@tests/mockCredentials';

import type { IUnitTestMockAccount } from '../../../../../@tests/types';
import type { DBNetwork } from '../../../../types/network';

// indexedDB -> networks
const network: DBNetwork = {
  balance2FeeDecimals: 0,
  decimals: 24,
  enabled: true,
  feeDecimals: 24,
  feeSymbol: 'NEAR',
  id: 'near--0',
  impl: 'near',
  logoURI: 'https://uni.onekey-asset.com/static/chain/near.png',
  name: 'Near Mainnet',
  position: 33,
  rpcURL: 'https://node.onekey.so/near',
  symbol: 'NEAR',
};

const hdAccount1: IUnitTestMockAccount = {
  // indexedDB -> accounts
  account: {
    address: 'b1c2f16ca9c3b324039dd0881a63ec236f1f339b6220b54ede8347b4b828daa5',
    coinType: '397',
    id: "hd-19--m/44'/397'/0'",
    name: 'NEAR #1',
    path: "m/44'/397'/0'",
    pub: 'ed25519:Cxua8Jtcu4414fr97m1CHqVt7WWFdkca1pFkdtLefD5n',
    type: 'simple' as any,
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
    address: '75fe307718a061f3b371c9777ad194ac485fde853d600a8e802ce748e5012361',
    coinType: '397',
    id: 'imported--397--75fe307718a061f3b371c9777ad194ac485fde853d600a8e802ce748e5012361',
    name: 'Account #1',
    path: '',
    pub: 'ed25519:8wbWQQkeK9NV1qkiQZ95jbj7JNhpeapHafLPw3qsJdqi',
    type: 'simple' as any,
  },
  privateKey: '62ec93894623daf9acf2b59d0517612f',
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
    type: 'simple' as any,
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
    type: 'simple' as any,
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
    type: 'simple' as any,
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
