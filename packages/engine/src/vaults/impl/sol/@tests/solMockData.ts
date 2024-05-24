import mockCredentials from '../../../../../@tests/mockCredentials';
import { AccountType } from '../../../../types/account';

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
  logoURI: 'https://uni.onekey-asset.com/static/chain/cfx.png',
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
    'type': AccountType.SIMPLE,
  },
  accounts: [
    {
      'id': "hd-19--m/44'/501'/0'/0'",
      'name': 'SOL #1',
      'type': AccountType.SIMPLE,
      'path': "m/44'/501'/0'/0'",
      'coinType': '501',
      'pub': 'E48cosDiQZK1iDSsyUzhvW4WxJeoKuDk5qgcdkmANV4N',
      'address': 'E48cosDiQZK1iDSsyUzhvW4WxJeoKuDk5qgcdkmANV4N',
    },
    {
      'id': "hd-19--m/44'/501'/1'/0'",
      'name': 'SOL #2',
      'type': AccountType.SIMPLE,
      'path': "m/44'/501'/1'/0'",
      'coinType': '501',
      'pub': 'ETjNGPNMYV9cdSWfabNMdMYtFxPziaiavoLuzvJo12qg',
      'address': 'ETjNGPNMYV9cdSWfabNMdMYtFxPziaiavoLuzvJo12qg',
    },
    {
      'id': "hd-19--m/44'/501'/2'/0'",
      'name': 'SOL #3',
      'type': AccountType.SIMPLE,
      'path': "m/44'/501'/2'/0'",
      'coinType': '501',
      'pub': '3EwCPNjUS1xKNbHcbMmo6wAtMA9ZVzwkiLVQ5H3ZvntC',
      'address': '3EwCPNjUS1xKNbHcbMmo6wAtMA9ZVzwkiLVQ5H3ZvntC',
    },
    {
      'id': "hd-19--m/44'/501'/3'/0'",
      'name': 'SOL #4',
      'type': AccountType.SIMPLE,
      'path': "m/44'/501'/3'/0'",
      'coinType': '501',
      'pub': 'wpsZdXo6gFeQUXKFCBvbFKLbYtyrko1M1KHFwCtDRj1',
      'address': 'wpsZdXo6gFeQUXKFCBvbFKLbYtyrko1M1KHFwCtDRj1',
    },
    {
      'id': "hd-19--m/44'/501'/4'/0'",
      'name': 'SOL #5',
      'type': AccountType.SIMPLE,
      'path': "m/44'/501'/4'/0'",
      'coinType': '501',
      'pub': 'F6wmBCXagkZy4nYER1BbspT56MrjzzQhpEoUyLXFd2Jf',
      'address': 'F6wmBCXagkZy4nYER1BbspT56MrjzzQhpEoUyLXFd2Jf',
    },
    {
      'id': "hd-19--m/44'/501'/5'/0'",
      'name': 'SOL #6',
      'type': AccountType.SIMPLE,
      'path': "m/44'/501'/5'/0'",
      'coinType': '501',
      'pub': 'v5PXxVwJbfmFBvEdbHYYYGWuC7PMVyutLG8rcnQaJHf',
      'address': 'v5PXxVwJbfmFBvEdbHYYYGWuC7PMVyutLG8rcnQaJHf',
    },
    {
      'id': "hd-19--m/44'/501'/6'/0'",
      'name': 'SOL #7',
      'type': AccountType.SIMPLE,
      'path': "m/44'/501'/6'/0'",
      'coinType': '501',
      'pub': 'DJqCQkFAipfFKMkCADvTRSvdAGYEAwE8g3MnreWD7UP4',
      'address': 'DJqCQkFAipfFKMkCADvTRSvdAGYEAwE8g3MnreWD7UP4',
    },
    {
      'id': "hd-19--m/44'/501'/7'/0'",
      'name': 'SOL #8',
      'type': AccountType.SIMPLE,
      'path': "m/44'/501'/7'/0'",
      'coinType': '501',
      'pub': 'GEkjftcBFoJp2JntMzEcTERkyKH8CnCBnwMjdbrcgqFb',
      'address': 'GEkjftcBFoJp2JntMzEcTERkyKH8CnCBnwMjdbrcgqFb',
    },
    {
      'id': "hd-19--m/44'/501'/8'/0'",
      'name': 'SOL #9',
      'type': AccountType.SIMPLE,
      'path': "m/44'/501'/8'/0'",
      'coinType': '501',
      'pub': 'AgiRoMS7i7qpHMWV2CEEF65KZujHjj1hhyCA73AAP3EG',
      'address': 'AgiRoMS7i7qpHMWV2CEEF65KZujHjj1hhyCA73AAP3EG',
    },
    {
      'id': "hd-19--m/44'/501'/9'/0'",
      'name': 'SOL #10',
      'type': AccountType.SIMPLE,
      'path': "m/44'/501'/9'/0'",
      'coinType': '501',
      'pub': '7rxWcB43PNuPr8bjSHdKcsXudF6hz7qAwAcgXaKJounw',
      'address': '7rxWcB43PNuPr8bjSHdKcsXudF6hz7qAwAcgXaKJounw',
    },
  ],
  mnemonic: mockCredentials.mnemonic1,
  password: mockCredentials.password,
};

const hdAccount2: IUnitTestMockAccount = {
  // indexedDB -> accounts
  account: {
    address: 'E48cosDiQZK1iDSsyUzhvW4WxJeoKuDk5qgcdkmANV4N',
    coinType: '501',
    id: "hd-19--m/44'/501'/0'/0'",
    name: 'SOL #1',
    path: "m/44'/501'/0'/0'",
    pub: 'E48cosDiQZK1iDSsyUzhvW4WxJeoKuDk5qgcdkmANV4N',
    'type': AccountType.SIMPLE,
  },
  accounts: [
    {
      'id': "hd-19--m/44'/501'/0'",
      'name': 'Ledger Live #1',
      'type': AccountType.SIMPLE,
      'path': "m/44'/501'/0'",
      'coinType': '501',
      'pub': '9krGZ6MVHufqrKiGvaCbevTGdBFLZWb6u75QPDXvVWmj',
      'address': '9krGZ6MVHufqrKiGvaCbevTGdBFLZWb6u75QPDXvVWmj',
    },
    {
      'id': "hd-19--m/44'/501'/1'",
      'name': 'Ledger Live #2',
      'type': AccountType.SIMPLE,
      'path': "m/44'/501'/1'",
      'coinType': '501',
      'pub': '6v4TwtNBLJyXGaAKjwzFYAnVdgBVSRQZLyKv8jjHDi9T',
      'address': '6v4TwtNBLJyXGaAKjwzFYAnVdgBVSRQZLyKv8jjHDi9T',
    },
    {
      'id': "hd-19--m/44'/501'/2'",
      'name': 'Ledger Live #3',
      'type': AccountType.SIMPLE,
      'path': "m/44'/501'/2'",
      'coinType': '501',
      'pub': '83sJhRq4rT5ysf6Q6ULtJAD5tdqGdidQeRE8ofghVoZe',
      'address': '83sJhRq4rT5ysf6Q6ULtJAD5tdqGdidQeRE8ofghVoZe',
    },
    {
      'id': "hd-19--m/44'/501'/3'",
      'name': 'Ledger Live #4',
      'type': AccountType.SIMPLE,
      'path': "m/44'/501'/3'",
      'coinType': '501',
      'pub': '7yUxrusKzXdUZjmEqCCPqxtrWCmwJ4EpXzxez56hhc5s',
      'address': '7yUxrusKzXdUZjmEqCCPqxtrWCmwJ4EpXzxez56hhc5s',
    },
    {
      'id': "hd-19--m/44'/501'/4'",
      'name': 'Ledger Live #5',
      'type': AccountType.SIMPLE,
      'path': "m/44'/501'/4'",
      'coinType': '501',
      'pub': 'HZK7FK8y5ENaPLVAHbKFfVUEjthDNygxoKDmswCWK9VT',
      'address': 'HZK7FK8y5ENaPLVAHbKFfVUEjthDNygxoKDmswCWK9VT',
    },
    {
      'id': "hd-19--m/44'/501'/5'",
      'name': 'Ledger Live #6',
      'type': AccountType.SIMPLE,
      'path': "m/44'/501'/5'",
      'coinType': '501',
      'pub': '4jf8jfrmz4NxUvSULhak48u2bc1HAfKm6ynqRmVsUcTW',
      'address': '4jf8jfrmz4NxUvSULhak48u2bc1HAfKm6ynqRmVsUcTW',
    },
    {
      'id': "hd-19--m/44'/501'/6'",
      'name': 'Ledger Live #7',
      'type': AccountType.SIMPLE,
      'path': "m/44'/501'/6'",
      'coinType': '501',
      'pub': 'AFHbbGFNg1xPaWVwPF4DQSY6UJTnW3jVi92jP2iUChae',
      'address': 'AFHbbGFNg1xPaWVwPF4DQSY6UJTnW3jVi92jP2iUChae',
    },
    {
      'id': "hd-19--m/44'/501'/7'",
      'name': 'Ledger Live #8',
      'type': AccountType.SIMPLE,
      'path': "m/44'/501'/7'",
      'coinType': '501',
      'pub': '62XQHgZDrG8Y3rUMZkQQJ1h2DRxcy5isBVQMfBeRZkWu',
      'address': '62XQHgZDrG8Y3rUMZkQQJ1h2DRxcy5isBVQMfBeRZkWu',
    },
    {
      'id': "hd-19--m/44'/501'/8'",
      'name': 'Ledger Live #9',
      'type': AccountType.SIMPLE,
      'path': "m/44'/501'/8'",
      'coinType': '501',
      'pub': 'Dm8z5zhUm82ZV3YYLdvjpwb5XNrruBUBCuTiAknfgDWD',
      'address': 'Dm8z5zhUm82ZV3YYLdvjpwb5XNrruBUBCuTiAknfgDWD',
    },
    {
      'id': "hd-19--m/44'/501'/9'",
      'name': 'Ledger Live #10',
      'type': AccountType.SIMPLE,
      'path': "m/44'/501'/9'",
      'coinType': '501',
      'pub': 'ENiJ5GvT6x3VQ5589jH9Uj95MpxY2pGb8LH1YJUYUKjF',
      'address': 'ENiJ5GvT6x3VQ5589jH9Uj95MpxY2pGb8LH1YJUYUKjF',
    },
  ],
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
    'type': AccountType.SIMPLE,
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
    'type': AccountType.SIMPLE,
  },
  password: '',
};

export default {
  network,
  hdAccount1,
  hdAccount2,
  importedAccount1,
  importedAccount2,
  watchingAccount1,
};
