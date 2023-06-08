import mockCredentials from '../../../../../@tests/mockCredentials';
import { AccountType } from '../../../../types/account';

import type { IUnitTestMockAccount } from '../../../../../@tests/types';
import type { DBNetwork } from '../../../../types/network';

export const network: DBNetwork = {
  balance2FeeDecimals: 9,
  decimals: 18,
  enabled: true,
  feeDecimals: 9,
  feeSymbol: 'Gwei',
  id: 'evm--5',
  impl: 'evm',
  logoURI: 'https://onekey-asset.com/assets/teth/teth.png',
  name: 'Ethereum Görli (Goerli) Testnet',
  position: 33,
  rpcURL: 'https://rpc.ankr.com/eth_goerli',
  symbol: 'TETH',
};

export const hdAccount1: IUnitTestMockAccount = {
  account: {
    'address': '0xfc2077ca7f403cbeca41b1b0f62d91b5ea631b5e',
    'coinType': '60',
    'id': "hd-19--m/44'/60'/0'/0/0",
    'name': 'EVM #1',
    'path': "m/44'/60'/0'/0/0",
    'pub': '0338f04e283c453f6c5c28f5291f12540ae5e27c2fd1a863f2596d8fbd99d24fde',
    'template': "m/44'/60'/0'/0/$$INDEX$$",
    'type': AccountType.SIMPLE,
  },
  mnemonic: mockCredentials.mnemonic1,
  password: mockCredentials.password,
  accounts: [
    {
      id: "hd-19--m/44'/60'/0'/0/0",
      name: 'EVM #1',
      type: AccountType.SIMPLE,
      path: "m/44'/60'/0'/0/0",
      coinType: '60',
      pub: '0338f04e283c453f6c5c28f5291f12540ae5e27c2fd1a863f2596d8fbd99d24fde',
      address: '0xfc2077ca7f403cbeca41b1b0f62d91b5ea631b5e',
      template: "m/44'/60'/0'/0/$$INDEX$$",
    },
    {
      id: "hd-19--m/44'/60'/0'/0/1",
      name: 'EVM #2',
      type: AccountType.SIMPLE,
      path: "m/44'/60'/0'/0/1",
      coinType: '60',
      pub: '02bc22f00c704b1d75909bec151491599de2ba518b8c816d42f195d4fdc5bdc579',
      address: '0xd1a7451beb6fe0326b4b78e3909310880b781d66',
      template: "m/44'/60'/0'/0/$$INDEX$$",
    },
    {
      id: "hd-19--m/44'/60'/0'/0/2",
      name: 'EVM #3',
      type: AccountType.SIMPLE,
      path: "m/44'/60'/0'/0/2",
      coinType: '60',
      pub: '038749c15b97a5b64b23d728a9942df53ab5bcb5cf2dfb51a2a161bd6f964316af',
      address: '0x578270b5e5b53336bac354756b763b309eca90ef',
      template: "m/44'/60'/0'/0/$$INDEX$$",
    },
    {
      id: "hd-19--m/44'/60'/0'/0/3",
      name: 'EVM #4',
      type: AccountType.SIMPLE,
      path: "m/44'/60'/0'/0/3",
      coinType: '60',
      pub: '03566be773a86db1f0288839a01aa77a1bff846e5cd01d40513129a9c63ae5ec9e',
      address: '0x909f59835a5a120eafe1c60742485b7ff0e305da',
      template: "m/44'/60'/0'/0/$$INDEX$$",
    },
    {
      id: "hd-19--m/44'/60'/0'/0/4",
      name: 'EVM #5',
      type: AccountType.SIMPLE,
      path: "m/44'/60'/0'/0/4",
      coinType: '60',
      pub: '03906d0ca504677d69b9e4d51a24123e2e623f2a87d762df4dc989f74312a2e436',
      address: '0x5711ced5ce6d91ec7af3e5b02ddb47f409d42818',
      template: "m/44'/60'/0'/0/$$INDEX$$",
    },
    {
      id: "hd-19--m/44'/60'/0'/0/5",
      name: 'EVM #6',
      type: AccountType.SIMPLE,
      path: "m/44'/60'/0'/0/5",
      coinType: '60',
      pub: '03b152b9173bda2056ff18e03d9a16f09773962635cae9022c4f4199508ba30b6a',
      address: '0x02db23843db65077e19757af077648f106ae9243',
      template: "m/44'/60'/0'/0/$$INDEX$$",
    },
    {
      id: "hd-19--m/44'/60'/0'/0/6",
      name: 'EVM #7',
      type: AccountType.SIMPLE,
      path: "m/44'/60'/0'/0/6",
      coinType: '60',
      pub: '020e3ee6f4944f2ff17352b5594001b52c521aa511499dffa2180fade119aed069',
      address: '0x543289b0965eba079b277b344dd1c0c2ab47a4ba',
      template: "m/44'/60'/0'/0/$$INDEX$$",
    },
    {
      id: "hd-19--m/44'/60'/0'/0/7",
      name: 'EVM #8',
      type: AccountType.SIMPLE,
      path: "m/44'/60'/0'/0/7",
      coinType: '60',
      pub: '02e0bbb039a1f7e54461971d1d33bb18128f35526d6603d4aeea201f11fd551ec9',
      address: '0x1de55545a139b3bec88301c87ba241323b0e5ae1',
      template: "m/44'/60'/0'/0/$$INDEX$$",
    },
    {
      id: "hd-19--m/44'/60'/0'/0/8",
      name: 'EVM #9',
      type: AccountType.SIMPLE,
      path: "m/44'/60'/0'/0/8",
      coinType: '60',
      pub: '033e811e2fed534105e0df80454ea8435c01f3ce76db5b3ba8a625b535b9181130',
      address: '0xd59fedebba13b004677004b79dec7b60e4913aac',
      template: "m/44'/60'/0'/0/$$INDEX$$",
    },
    {
      id: "hd-19--m/44'/60'/0'/0/9",
      name: 'EVM #10',
      type: AccountType.SIMPLE,
      path: "m/44'/60'/0'/0/9",
      coinType: '60',
      pub: '0394a9f9ca97d3a1e7ad76ab5b42d177eb0a30d17ba8f1509610c1120853590eba',
      address: '0xc4c28c29561ff3d3eb34bcd68a41fce70f8d19b6',
      template: "m/44'/60'/0'/0/$$INDEX$$",
    },
  ],
};

export const hdAccount2: IUnitTestMockAccount = {
  account: {
    'address': '0xfc2077ca7f403cbeca41b1b0f62d91b5ea631b5e',
    'coinType': '60',
    'id': "hd-19--m/44'/60'/0'/0/0--LedgerLive",
    'name': 'Ledger Live #1',
    'path': "m/44'/60'/0'/0/0",
    'pub': '0338f04e283c453f6c5c28f5291f12540ae5e27c2fd1a863f2596d8fbd99d24fde',
    'template': "m/44'/60'/$$INDEX$$'/0/0",
    'type': AccountType.SIMPLE,
  },
  mnemonic: mockCredentials.mnemonic1,
  password: mockCredentials.password,
  accounts: [
    {
      'address': '0xfc2077ca7f403cbeca41b1b0f62d91b5ea631b5e',
      'coinType': '60',
      'id': "hd-19--m/44'/60'/0'/0/0--LedgerLive",
      'name': 'Ledger Live #1',
      'path': "m/44'/60'/0'/0/0",
      'pub':
        '0338f04e283c453f6c5c28f5291f12540ae5e27c2fd1a863f2596d8fbd99d24fde',
      'template': "m/44'/60'/$$INDEX$$'/0/0",
      'type': AccountType.SIMPLE,
    },
    {
      'address': '0x9176a747ba67c1d7f80aadc930180b4183afb5c4',
      'coinType': '60',
      'id': "hd-19--m/44'/60'/1'/0/0--LedgerLive",
      'name': 'Ledger Live #2',
      'path': "m/44'/60'/1'/0/0",
      'pub':
        '02119826418d539aafb3a327c8f27b3ff326b5c36f0dbfcbf9ad0a03afbd20dc7a',
      'template': "m/44'/60'/$$INDEX$$'/0/0",
      'type': AccountType.SIMPLE,
    },
    {
      'address': '0x32a8b066c5dbd37147766491a32a612d313fda25',
      'coinType': '60',
      'id': "hd-19--m/44'/60'/2'/0/0--LedgerLive",
      'name': 'Ledger Live #3',
      'path': "m/44'/60'/2'/0/0",
      'pub':
        '0387d4f1d1cc1a34fd997d99005e36105a6e8d2d760a98621254f848186d62a482',
      'template': "m/44'/60'/$$INDEX$$'/0/0",
      'type': AccountType.SIMPLE,
    },
    {
      'address': '0x0d3dd54079957d13bb9218c09368e1da6064cfef',
      'coinType': '60',
      'id': "hd-19--m/44'/60'/3'/0/0--LedgerLive",
      'name': 'Ledger Live #4',
      'path': "m/44'/60'/3'/0/0",
      'pub':
        '02a1757b0ac6d5ee8eed1dd81e12e4031a8e9edd46aa0916aa3a49b25108ba60af',
      'template': "m/44'/60'/$$INDEX$$'/0/0",
      'type': AccountType.SIMPLE,
    },
    {
      'address': '0x5ec3a2eedfbeeba725c9d68d70dd58cada93a17c',
      'coinType': '60',
      'id': "hd-19--m/44'/60'/4'/0/0--LedgerLive",
      'name': 'Ledger Live #5',
      'path': "m/44'/60'/4'/0/0",
      'pub':
        '02de3d80f92195d828e46181194219f3b1e4c32c97a70a570790f27fb76f8163eb',
      'template': "m/44'/60'/$$INDEX$$'/0/0",
      'type': AccountType.SIMPLE,
    },
    {
      'address': '0x0cc70b3e3a9f4f768987a1b90636e2829eb90477',
      'coinType': '60',
      'id': "hd-19--m/44'/60'/5'/0/0--LedgerLive",
      'name': 'Ledger Live #6',
      'path': "m/44'/60'/5'/0/0",
      'pub':
        '02f4fb86894560af8c77e80c91b6942d4056e40b4ab88e31b7bb93575def0d3d18',
      'template': "m/44'/60'/$$INDEX$$'/0/0",
      'type': AccountType.SIMPLE,
    },
    {
      'address': '0xa1414c391446f708b8c4698d3a08a2f0dc47388d',
      'coinType': '60',
      'id': "hd-19--m/44'/60'/6'/0/0--LedgerLive",
      'name': 'Ledger Live #7',
      'path': "m/44'/60'/6'/0/0",
      'pub':
        '0286db11e6378a29d2435d036c1f97b2b7945090dd4e46a8bbd2ab4c18ff075e0c',
      'template': "m/44'/60'/$$INDEX$$'/0/0",
      'type': AccountType.SIMPLE,
    },
    {
      'address': '0x0f457cb374944cb059069725ca991f975dd9a917',
      'coinType': '60',
      'id': "hd-19--m/44'/60'/7'/0/0--LedgerLive",
      'name': 'Ledger Live #8',
      'path': "m/44'/60'/7'/0/0",
      'pub':
        '024d43493c4c79ad73d8fb8193bf55ad8a0778aef5148fb0f84c5c553c66b21b58',
      'template': "m/44'/60'/$$INDEX$$'/0/0",
      'type': AccountType.SIMPLE,
    },
    {
      'address': '0x78b3a676abb02a8f4c49cda75848796cad51e976',
      'coinType': '60',
      'id': "hd-19--m/44'/60'/8'/0/0--LedgerLive",
      'name': 'Ledger Live #9',
      'path': "m/44'/60'/8'/0/0",
      'pub':
        '02b137a5afca750d775980de81a9774a2e00a714ae70e18c4e1f8c0a22c4f153b0',
      'template': "m/44'/60'/$$INDEX$$'/0/0",
      'type': AccountType.SIMPLE,
    },
    {
      'address': '0xd362d7aac811e371a320affa7812daf80a6ca22f',
      'coinType': '60',
      'id': "hd-19--m/44'/60'/9'/0/0--LedgerLive",
      'name': 'Ledger Live #10',
      'path': "m/44'/60'/9'/0/0",
      'pub':
        '034e2212a05f0eacd02800286756a87a87881820dd0e67c592199266f16bc414e3',
      'template': "m/44'/60'/$$INDEX$$'/0/0",
      'type': AccountType.SIMPLE,
    },
  ],
};

export const importedAccount1: IUnitTestMockAccount = {
  // indexedDB -> accounts
  account: {
    'address': '0x41936e4dd7a1d71b44c094cc50d6c2666c01433c',
    'coinType': '60',
    'id': 'imported--60--029b2f771038c531bf031e7d2f27a0b02a629fc088ae62c4aca5aed54d777c0f5b',
    name: 'Account #1',
    path: '',
    pub: '029b2f771038c531bf031e7d2f27a0b02a629fc088ae62c4aca5aed54d777c0f5b',
    type: AccountType.SIMPLE,
  },
  // indexedDB -> credentials
  privateKey:
    'bde05768439a67fab113309a7f3edc7a2b8e63f13424165510c571ea0c130e04',
  password: mockCredentials.password,
  accounts: [],
};

export const importedAccount2: IUnitTestMockAccount = {
  account: {
    address: '0x41936e4Dd7a1d71B44c094cc50D6C2666c01433C',
    coinType: '60',
    id: '',
    name: 'Account #1',
    path: '',
    pub: '',
    type: AccountType.SIMPLE,
  },
  privateKey:
    'cbe3b10bb20fc08e0c8bd36b19113a4f15e7e21ce8055c9de4c78c5f9079536e4b118149f518b532629215d1fbf67f4150476441d9c0c6ac933b98ecf5595d0a1fab496780ab529da46918c2c0a9b2a65c9f46efd1ae9d7719713f90e400df0d',
  password: '12345678',
};

export const watchingAccount1: IUnitTestMockAccount = {
  account: {
    'address': '0x41936e4dd7a1d71b44c094cc50d6c2666c01433c',
    'coinType': '60',
    'id': 'external--60--0x41936e4dd7a1d71b44c094cc50d6c2666c01433c',
    name: 'Account #1',
    path: '',
    pub: '',
    type: AccountType.SIMPLE,
  },
  password: '',
};
