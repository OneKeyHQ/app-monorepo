import mockCredentials from '../../../../../@tests/mockCredentials';

import type { IUnitTestMockAccount } from '../../../../../@tests/types';
import type { DBNetwork } from '../../../../types/network';

// indexedDB -> networks
export const network: DBNetwork = {
  balance2FeeDecimals: 0,
  decimals: 9,
  enabled: true,
  feeDecimals: 9,
  feeSymbol: 'STC',
  id: 'stc--251',
  impl: 'stc',
  logoURI: 'https://uni.onekey-asset.com/static/chain/tstc.png',
  name: 'Starcoin barnard',
  position: 33,
  rpcURL: 'https://barnard-seed.starcoin.org',
  symbol: 'STC',
};

export const hdAccount1: IUnitTestMockAccount = {
  // indexedDB -> accounts
  account: {
    'address': '0x12c1cef77caf5709cbf7ce2e5e32a173',
    'coinType': '101010',
    'id': "hd-19--m/44'/101010'/0'/0'/0'",
    'name': 'STC #1',
    'path': "m/44'/101010'/0'/0'/0'",
    'pub': '80c33d24a1f92efde244f91044d4359a8be13b5efb7a4b9fb91d696e0e095b31',
    'type': 'simple' as any,
  },
  mnemonic: mockCredentials.mnemonic1,
  password: mockCredentials.password,
};

export const importedAccount1: IUnitTestMockAccount = {
  account: {
    'address': '0xeecffd945ec7071f9aa9b5a1de63128f',
    'coinType': '101010',
    'id': 'imported--101010--16a088a7c385278c0d62750986d7e9f901e6d58e7f00b3b69094eb8edf9d9f2d',
    'name': 'Account #1',
    'path': '',
    'pub': '16a088a7c385278c0d62750986d7e9f901e6d58e7f00b3b69094eb8edf9d9f2d',
    'type': 'simple' as any,
  },
  privateKey:
    '79025d6344a65c606e3a5378c1c850ae8a07dab283ea151dc9df50984b870543',
  password: mockCredentials.password,
};

export const importedAccount2: IUnitTestMockAccount = {
  account: {
    address: '0x0d468b4c5e50b9c2ce70356a02b2b105',
    coinType: '101010',
    id: 'imported--101010--03560d4451deeef0d1bcc46ff062372400ecf7b6e4e058ef01792f140ce2a97c31',
    name: 'Account #1',
    path: '',
    pub: '03560d4451deeef0d1bcc46ff062372400ecf7b6e4e058ef01792f140ce2a97c31',
    type: 'variant' as any,
  },
  privateKey:
    '1d00585ca1cf944ef19378313c452f82b9f027e6717868833ca9187cbe55a715996cd1243e9e02ecff6b26d7d2e94e26865834a991e528a67b2b8d7d3716c1448857aaf78276580b0789fa4c18abd8d1d412f0d764ecfb3134b5282ce7f865ef',
  password: '12345678',
};

export const watchingAccount1: IUnitTestMockAccount = {
  account: {
    'address': '0x0d468b4c5e50b9c2ce70356a02b2b105',
    'coinType': '101010',
    'id': 'external--101010--0x0d468b4c5e50b9c2ce70356a02b2b105',
    'name': 'Account #1',
    'path': '',
    'pub': '',
    'type': 'simple' as any,
  },
  password: '',
};

export const watchingAccount2: IUnitTestMockAccount = {
  account: {
    'address': 'stc1pz0msttr263glh2cytwfn4nhh9ykutusm',
    'coinType': '101010',
    'id': 'external--101010--stc1pz0msttr263glh2cytwfn4nhh9ykutusm',
    'name': 'Account #1',
    'path': '',
    'pub': '',
    'type': 'simple' as any,
  },
  password: '',
};
