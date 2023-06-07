import mockCredentials from '../../../../../@tests/mockCredentials';

import type { IUnitTestMockAccount } from '../../../../../@tests/types';
import type { DBNetwork } from '../../../../types/network';

// indexedDB -> networks
const network: DBNetwork = {
  balance2FeeDecimals: 0,
  decimals: 18,
  enabled: true,
  feeDecimals: 18,
  feeSymbol: 'SOL',
  id: 'sol--501',
  impl: 'sol',
  logoURI: 'https://onekey-asset.com/assets/cfx/cfx.png',
  name: 'tsol',
  position: 33,
  rpcURL: 'https://api.devnet.solana.com',
  symbol: 'SOL',
};

const hdAccount1: IUnitTestMockAccount = {
  // indexedDB -> accounts
  account: {
    address: 'E48cosDiQZK1iDSsyUzhvW4WxJeoKuDk5qgcdkmANV4N',
    coinType: '501',
    id: "hd-19--m/44'/501'/0'/0'",
    name: 'SOL #1',
    path: "m/44'/501'/0'/0'",
    pub: 'E48cosDiQZK1iDSsyUzhvW4WxJeoKuDk5qgcdkmANV4N',
    type: 'simple' as any,
  },
  mnemonic: mockCredentials.mnemonic1,
  password: mockCredentials.password,
};

const importedAccount1: IUnitTestMockAccount = {
  account: {
    address: '6XFFoqia4AXM41rCSw6AdCZttKq1USzd5oqQzvFnJ82S',
    coinType: '501',
    id: 'imported--501--6XFFoqia4AXM41rCSw6AdCZttKq1USzd5oqQzvFnJ82S',
    name: 'Account #1',
    path: '',
    pub: '6XFFoqia4AXM41rCSw6AdCZttKq1USzd5oqQzvFnJ82S',
    type: 'simple' as any,
  },
  privateKey:
    '6b4d9dee8a37f4329cbf7db9a137a2ecdc63be8e6caa881ef05b3a3349ef8db9',
  password: mockCredentials.password,
};

const importedAccount2: IUnitTestMockAccount = {
  account: {
    address: '41FJB3z1pkJGXQPrAVrNgNtgcPjBs8UtT4b89Bd7pXZi',
    coinType: '503',
    id: 'imported--503--03560d4451deeef0d1bcc46ff062372400ecf7b6e4e058ef01792f140ce2a97c31',
    name: 'Account #1',
    path: '',
    pub: '41FJB3z1pkJGXQPrAVrNgNtgcPjBs8UtT4b89Bd7pXZi',
    type: 'variant' as any,
  },
  privateKey:
    '8883e769b999072d61958c5a3bb1c760dfa9215cd5c15f8db953db6a16ef7eb35edbac17979edb25cca4abd6558661c7bb0ad2e4fbc9d0cfdd8b2cec031a2ecda128dcdcd1e43979b65c5d07fa450016156eed8b1b12a94da2af51accf758795',
  password: '12345678',
};

const watchingAccount1: IUnitTestMockAccount = {
  account: {
    address: 'Fdy1fLcvr5k52u1XaSyHsfPoyHZzRM6BEp2n7j6jkiea',
    coinType: '501',
    id: 'watching--501--Fdy1fLcvr5k52u1XaSyHsfPoyHZzRM6BEp2n7j6jkiea',
    name: 'Account #1',
    path: '',
    pub: 'Fdy1fLcvr5k52u1XaSyHsfPoyHZzRM6BEp2n7j6jkiea',
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
};
