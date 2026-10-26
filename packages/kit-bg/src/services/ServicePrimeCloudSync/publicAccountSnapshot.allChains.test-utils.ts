import { encodeAddress } from '@polkadot/util-crypto';
import { payments } from 'bitcoinjs-lib';

import {
  convertBtcForkXpub,
  getBip32FromBase58,
  getBtcForkNetwork,
} from '@onekeyhq/core/src/chains/btc/sdkBtc';
import {
  getConfig,
  pubkeyToAddress,
} from '@onekeyhq/core/src/chains/ckb/sdkCkb';
import { EAddressEncodings } from '@onekeyhq/core/src/types';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { ICloudPublicAccountImpl } from '@onekeyhq/shared/types/prime/publicAccountSnapshot';

import { EDBAccountType } from '../../dbs/local/consts';
import { publicKeyToAddress } from '../../vaults/impls/scdo/utils';

import { PUBLIC_ACCOUNT_TEST_XFP } from './publicAccountSnapshot.test-utils';

import type { IDBAccount, IDBWallet } from '../../dbs/local/types';

export const PUBLIC_ACCOUNT_ALL_CHAIN_IMPLS = [
  'ada',
  'algo',
  'alph',
  'aptos',
  'bch',
  'bfc',
  'btc',
  'cfx',
  'nervos',
  'cosmos',
  'dynex',
  'doge',
  'dot',
  'evm',
  'fil',
  'kaspa',
  'lightning',
  'tlightning',
  'ltc',
  'near',
  'neo',
  'neurai',
  'nexa',
  'nostr',
  'scdo',
  'sol',
  'stellar',
  'sui',
  'tbtc',
  'ton',
  'tron',
  'xrp',
] as const satisfies readonly ICloudPublicAccountImpl[];

export type IPublicAccountAllChainFixture = {
  impl: ICloudPublicAccountImpl;
  kind: 'hd' | 'hardware';
  account: IDBAccount;
  networkId: string;
  expectedVersion: 1 | 2;
  source: string;
};

type IPublicVector = {
  chain: ICloudPublicAccountImpl;
  source: string;
  networkInfo: { networkId: string };
  template: string;
  account: {
    address: string;
    addresses?: Record<string, string>;
    path: string;
    publicKey: string;
    xpub?: string;
  };
};

// Public fields copied from the Core golden tests named by each source. These
// independent format vectors are not claimed to share one mnemonic or wallet.
const corePublicVectors: IPublicVector[] = [
  {
    'chain': 'btc',
    'source': 'packages/core/src/chains/btc/CoreChainSoftware.test.ts',
    'networkInfo': {
      'networkId': 'btc--0',
    },
    'template': "m/49'/0'/$$INDEX$$'/0/0",
    'account': {
      'address': '386yQdFWfbAuEUa1ctbZo9Lgacj3PhXs9R',
      'addresses': {
        '0/0': '386yQdFWfbAuEUa1ctbZo9Lgacj3PhXs9R',
      },
      'path': "m/49'/0'/0'",
      'publicKey':
        '03098891dd952dd6f6bde1489761d0befbfa31815e9c0e64058d12b83de852a18c',
      'xpub':
        'ypub6WoTEgqafv3Zx3Nk8zyMnYvK7ckrMy942G3mWzBpDSPJm8yXAUShZ31cH4jGQgUcbD8F1tY34nxrxxJi1ZAZAqFjacpdBmLGDVjpgxbEGKk',
    },
  },
  {
    'chain': 'sol',
    'source': 'packages/core/src/chains/sol/CoreChainSoftware.test.ts',
    'networkInfo': {
      'networkId': 'sol--101',
    },
    'template': "m/44'/501'/$$INDEX$$'/0'",
    'account': {
      'address': '4wX8yu9YmSe4mv9ZPtTeoF9pe6Ji4ScjuJEffS3sCKZ4',
      'addresses': {},
      'path': "m/44'/501'/0'/0'",
      'publicKey': '4wX8yu9YmSe4mv9ZPtTeoF9pe6Ji4ScjuJEffS3sCKZ4',
    },
  },
  {
    'chain': 'evm',
    'source': 'packages/core/src/chains/evm/CoreChainSoftware.test.ts',
    'networkInfo': {
      'networkId': 'evm--1',
    },
    'template': "m/44'/60'/0'/0/$$INDEX$$",
    'account': {
      'address': '0x1959f5f4979c5cd87d5cb75c678c770515cb5e0e',
      'path': "m/44'/60'/0'/0/0",
      'publicKey':
        '02bd51e5b1a6e8271e1f87d2464b856790800c6c5fd38acdf1cee73857735fc8a4',
    },
  },
  {
    'chain': 'tbtc',
    'source': 'packages/core/src/chains/btc/CoreChainSoftware.tbtc.test.ts',
    'networkInfo': {
      'networkId': 'tbtc--0',
    },
    'template': "m/86'/1'/$$INDEX$$'/0/0",
    'account': {
      'address':
        'tb1pzutpcaymsyxtmz325ucsjed4evp9mea05tsf32wnkx46vsjrqtrq4d3dmr',
      'addresses': {
        '0/0': 'tb1pzutpcaymsyxtmz325ucsjed4evp9mea05tsf32wnkx46vsjrqtrq4d3dmr',
      },
      'path': "m/86'/1'/0'",
      'publicKey':
        '03afd8a231856550c5bcdb6aec16da37b082c72f9e1196940db5a6504e9f328af6',
      'xpub':
        'tpubDDTvhBUGrta8vHYvED7NVpRB64nP9n4v8zScbV1yyi3Rc7fwH9o5qsWbyhv9JjwCPfzhJHJCsLppzRyFp2W4VFy4kssk5SkFf6gRK6NmDZV',
    },
  },
  {
    'chain': 'ltc',
    'source': 'packages/core/src/chains/ltc/CoreChainSoftware.test.ts',
    'networkInfo': {
      'networkId': 'ltc--0',
    },
    'template': "m/49'/2'/$$INDEX$$'/0/0",
    'account': {
      'address': 'MCtPFWzDadmSdGAJXnrE4KpcHTuMpqn14m',
      'addresses': {
        '0/0': 'MCtPFWzDadmSdGAJXnrE4KpcHTuMpqn14m',
      },
      'path': "m/49'/2'/0'",
      'publicKey':
        '039987a37562a942b11dd5401fc66688e61789469379435fdd5f7760ece8e4ff53',
      'xpub':
        'Mtub2s6aTFt6zXFfse1eGz7ktsUQALH8Pd58ZBieNJi6c5tX5bzSpQsyhXun9tCH7mZSC4o9sy7gUt1aRx4rg9WVBWgFPWyy8QPiaqNj89FMAZ2',
    },
  },
  {
    'chain': 'doge',
    'source': 'packages/core/src/chains/doge/CoreChainSoftware.test.ts',
    'networkInfo': {
      'networkId': 'doge--0',
    },
    'template': "m/44'/3'/$$INDEX$$'/0/0",
    'account': {
      'address': 'DTdKu8YgcxoXyjFCDtCeKimaZzsK27rcwT',
      'addresses': {
        '0/0': 'DTdKu8YgcxoXyjFCDtCeKimaZzsK27rcwT',
      },
      'path': "m/44'/3'/0'",
      'publicKey':
        '028df5c5ff4af74130220bc00d3ec5a6c08a587f7bf9038be679e47980a63ff871',
      'xpub':
        'dgub8sn8hvpMJJouWJh3GyJKLDmDfuRvAZLtHdJZXH78UnAau3ohH1SM7oeEWejBsWcDxuYWSojzAzxv6sf8aHrU6Z9isjRQ4sgTGWTVfw2KF87',
    },
  },
  {
    'chain': 'bch',
    'source': 'packages/core/src/chains/bch/CoreChainSoftware.test.ts',
    'networkInfo': {
      'networkId': 'bch--0',
    },
    'template': "m/44'/145'/$$INDEX$$'/0/0",
    'account': {
      'address': 'bitcoincash:qpj2p3ykvwktp9uvx5dpkq3uv3zqd5n67qcjtlynnp',
      'addresses': {
        '0/0': 'bitcoincash:qpj2p3ykvwktp9uvx5dpkq3uv3zqd5n67qcjtlynnp',
      },
      'path': "m/44'/145'/0'",
      'publicKey':
        '023342708de6a3557949806aa20f4a2d37e4e3e8a3314ebc211e0ef99b98234763',
      'xpub':
        'xpub6CsXcwbJS7Go9ZmTiQjZF6dG6mhmTBEoKzxymQUwMsynCXEKAMXrzh8oym3vehjorx16T7mGuqCRKkZ84Zfc7PKuKVkBcCLn46VZCUXPWTH',
    },
  },
  {
    'chain': 'nexa',
    'source': 'packages/core/src/chains/nexa/CoreChainSoftware.test.ts',
    'networkInfo': {
      'networkId': 'nexa--testnet',
    },
    'template': "m/44'/29223'/$$INDEX$$'/0/0",
    'account': {
      'address':
        '03b4aa175890261128b480e0691d7cd2eb8719d0471e19f424ea5ab30b92948266',
      'addresses': {
        'nexa--testnet':
          'nexatest:nqtsq5g5n00l0akmkpyfm9w4ry69gj8x2s5vnk03mxx9yypz',
      },
      'path': "m/44'/29223'/0'",
      'publicKey':
        '03b4aa175890261128b480e0691d7cd2eb8719d0471e19f424ea5ab30b92948266',
    },
  },
  {
    'chain': 'kaspa',
    'source': 'packages/core/src/chains/kaspa/CoreChainSoftware.test.ts',
    'networkInfo': {
      'networkId': 'kaspa--kaspa',
    },
    'template': "m/44'/111111'/0'/0/$$INDEX$$",
    'account': {
      'address':
        'kaspa:qz6ey0j433zey0txecm7e4as4q44jnafqxtclxj5xfl3559lft0p78rdmumy9',
      'addresses': {},
      'path': "m/44'/111111'/0'/0/0",
      'publicKey':
        '02075486d05cea119d15af20cee6763d685ac68df5954c4c8bec190270d83e5ec3',
    },
  },
  {
    'chain': 'algo',
    'source': 'packages/core/src/chains/algo/CoreChainSoftware.test.ts',
    'networkInfo': {
      'networkId': 'algo--4160',
    },
    'template': "m/44'/283'/0'/0'/$$INDEX$$'",
    'account': {
      'address': 'MDHU6RJPZUTSGZGMA3GRW52G3AITTDYRNC7POVQQZHH5ARU6EEXPNHO5FI',
      'path': "m/44'/283'/0'/0'/0'",
      'publicKey':
        '60cf4f452fcd272364cc06cd1b7746d811398f1168bef75610c9cfd0469e212e',
    },
  },
  {
    'chain': 'near',
    'source': 'packages/core/src/chains/near/CoreChainSoftware.test.ts',
    'networkInfo': {
      'networkId': 'near--0',
    },
    'template': "m/44'/397'/$$INDEX$$'",
    'account': {
      'address':
        '9cc26ec7b1ca4dbf3c9588534c6e7e2a537fab3f60f1d2d50c0e7a9bce413b73',
      'addresses': {},
      'path': "m/44'/397'/0'",
      'publicKey': 'ed25519:BYvZNc9zUYYyXvTT6AtnazqzRZA6edJ5igz3j7fZ2YHG',
    },
  },
  {
    'chain': 'xrp',
    'source': 'packages/core/src/chains/xrp/CoreChainSoftware.test.ts',
    'networkInfo': {
      'networkId': 'xrp--0',
    },
    'template': "m/44'/144'/$$INDEX$$'/0/0",
    'account': {
      'address': 'rp8oYAfF2ypEDJvJgiwh47weiWZbpqsjBR',
      'path': "m/44'/144'/0'/0/0",
      'publicKey':
        '02A2440A2831F0F7E3879628246223F6E595A44D90BF10622917A57444832CF622',
    },
  },
  {
    'chain': 'tron',
    'source': 'packages/core/src/chains/tron/CoreChainSoftware.test.ts',
    'networkInfo': {
      'networkId': 'tron--0x2b6653dc',
    },
    'template': "m/44'/195'/0'/0/$$INDEX$$",
    'account': {
      'address': 'TNsC5fdh1ZfbTZpMjbiXZifseoxKRgNrqb',
      'path': "m/44'/195'/0'/0/0",
      'publicKey':
        '025414abc40dbcb07c2204e04a34261090851bb28e1616ba77212d3d270d4b4761',
    },
  },
  {
    'chain': 'cosmos',
    'source': 'packages/core/src/chains/cosmos/CoreChainSoftware.test.ts',
    'networkInfo': {
      'networkId': 'cosmos--cosmoshub-4',
    },
    'template': "m/44'/118'/0'/0/$$INDEX$$",
    'account': {
      'address': '',
      'addresses': {
        'cosmos--cosmoshub-4': 'cosmos1kl0dn0rtwk46h9zcmazyyrruta290crh7wt6qp',
      },
      'path': "m/44'/118'/0'/0/0",
      'publicKey':
        '03352ac3058d7f088ae0791044874279340a63d1b7c10fb395db5a48cb9488b744',
    },
  },
  {
    'chain': 'dot',
    'source': 'packages/core/src/chains/dot/CoreChainSoftware.test.ts',
    'networkInfo': {
      'networkId': 'dot--polkadot',
    },
    'template': "m/44'/354'/$$INDEX$$'/0'/0'",
    'account': {
      'address': '',
      'addresses': {},
      'path': "m/44'/354'/0'/0'/0'",
      'publicKey':
        '3665284cd84d9de003dac3389ac1d61b60039fe95f8b9de603dcc0ea4ecdec64',
    },
  },
  {
    'chain': 'fil',
    'source': 'packages/core/src/chains/fil/CoreChainSoftware.test.ts',
    'networkInfo': {
      'networkId': 'fil--314',
    },
    'template': "m/44'/461'/0'/0/$$INDEX$$",
    'account': {
      'address': 'f1frgkdjp35l3tolawlodk32qnwipzuy5iirkc6by',
      'addresses': {
        'fil--314': 'f1frgkdjp35l3tolawlodk32qnwipzuy5iirkc6by',
      },
      'path': "m/44'/461'/0'/0/0",
      'publicKey':
        '04638c02212becc981df1a1393dd9bce3a5f42ed5b3294889fa9da6d4ea967ea7804fec8b4a8b91fef6e4e7035916d9f3ec046cfae410ee7be9fb1f10229175fb4',
    },
  },
  {
    'chain': 'cfx',
    'source': 'packages/core/src/chains/cfx/CoreChainSoftware.test.ts',
    'networkInfo': {
      'networkId': 'cfx--1029',
    },
    'template': "m/44'/503'/0'/0/$$INDEX$$",
    'account': {
      'address': '0x1a8348d02ae925bb86e4a4ac031ec42c28a4b5dc',
      'addresses': {
        'cfx--1029': 'cfx:aarjgwgufnywns6g6wwm2a282u0cvkfz5uekxw2hsm',
      },
      'path': "m/44'/503'/0'/0/0",
      'publicKey':
        '02474b4c1b1f3830fc0c161badc1b90ef06513593c67adaaab53e1140ca94cb652',
    },
  },
  {
    'chain': 'ada',
    'source': 'packages/core/src/chains/ada/CoreChainSoftware.test.ts',
    'networkInfo': {
      'networkId': 'ada--0',
    },
    'template': "m/1852'/1815'/$$INDEX$$'/0/0",
    'account': {
      'address':
        'addr1qylrq4h2xvj7x49shr65uxrsgkfmpq65la8lpvmxn06gprl6td4s5g30erqzfhnrx8faqtuxl8ruc4a75rxx99twr7fs8l7684',
      'addresses': {
        '0/0':
          'addr1qylrq4h2xvj7x49shr65uxrsgkfmpq65la8lpvmxn06gprl6td4s5g30erqzfhnrx8faqtuxl8ruc4a75rxx99twr7fs8l7684',
        '2/0': 'stake1u8a9k6c2yghu3spyme3nr57s97r0n37v27l2pnrzj4hplycqusrgq',
      },
      'path': "m/1852'/1815'/0'",
      'publicKey': '',
    },
  },
  {
    'chain': 'sui',
    'source': 'packages/core/src/chains/sui/CoreChainSoftware.test.ts',
    'networkInfo': {
      'networkId': 'sui--mainnet',
    },
    'template': "m/44'/784'/$$INDEX$$'/0'/0'",
    'account': {
      'address':
        '0xff7461b8d07b4633e24b4bacb86dc74224a3a903662974c0a9d06254101081c5',
      'path': "m/44'/784'/0'/0'/0'",
      'publicKey':
        '2292f77c31cc7e6d3c0b97636387e66c6fb0aceb579de99f8cf3be19ea86a418',
    },
  },
  {
    'chain': 'aptos',
    'source': 'packages/core/src/chains/aptos/CoreChainSoftware.test.ts',
    'networkInfo': {
      'networkId': 'aptos--1',
    },
    'template': "m/44'/637'/$$INDEX$$'/0'/0'",
    'account': {
      'address':
        '0xede225b4c713e12fee5a33397834d332e7d49773e06dc9860d35c30e6a479ed6',
      'path': "m/44'/637'/0'/0'/0'",
      'publicKey':
        '99b4709ae159e666615bdb5e0f0eb1f3738c7815c9a0c2173a824856859f1ea4',
    },
  },
];

// SDK-calculated public vectors: RFC8032 public points, the SEC1 generator, and
// the P-256 generator. No secret scalar, mnemonic or signing operation is used.
const sdkPublicVectors = {
  'cardano': {
    'xpub':
      'd75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a0000000000000000000000000000000000000000000000000000000000000000',
    'address':
      'addr1q8vueuqv0xnrhgdxkhl00y4w0qahjx3n27wulm78dqqz40xw2j3cc3m78kufw74pnqufxkm37k496elvftmyh7depvss77kt3f',
    'stake': 'stake1u889fguvgalrmwyh02seswyntdclt2javlky4ajtlxuskggg2uelu',
  },
  'stellar': {
    'pub': 'd75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a',
    'address': 'GDLVVGABQKYQVN6VJP7NHSLEA45A5YLS6PNKMIZFV4BBU2HXA5IRVHUR',
  },
  'ton': {
    'pub': 'd75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a',
    'address': 'UQDNrJfJFisuFBrURjgosqcO_fh2K5foNWPzUr7PkC6Ipteq',
  },
  'neo': {
    'pub': '036b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296',
    'address': 'NVHt5YtAnadMwntAVAJLUy36M2nLYKHUeK',
  },
  'nostr': {
    'pub': '79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
    'address':
      'npub10xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqpkge6d',
  },
  'dynex': {
    'address':
      'XwoVJ88vVG42nynHrHGoR52D7KNvFUZ416syNR6abrvaEZoA84oQj4NPyWEDPVJZkvNCWK59FmrEoSBXGNVzu4W71spSa99BP',
    'spend': 'd75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a',
    'view': '3d4017c3e843895a92b70aa74d1b7ebc9c982ccf2ec4968cc0cd55f12af4660c',
  },
  'alph': {
    'pub': '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
    'address': '13nr2XuF1VYfEgBLsXBQFrZcfzNvACP8cDz5CdAwk6BUz',
  },
  'bfc': {
    'pub': 'd75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a',
    'address':
      'BFC304af458e90e97c841685b8cbbc59b909f3e2cf150df590ada4c81452c29737d198d',
  },
};

const COINS: Record<ICloudPublicAccountImpl, string> = {
  ada: '1815',
  algo: '283',
  alph: '1234',
  aptos: '637',
  bch: '145',
  bfc: '728',
  btc: '0',
  cfx: '503',
  nervos: '309',
  cosmos: '118',
  dynex: '29538',
  doge: '3',
  dot: '354',
  evm: '60',
  fil: '461',
  kaspa: '111111',
  lightning: '81297820149147',
  tlightning: '81297820149140',
  ltc: '2',
  near: '397',
  neo: '888',
  neurai: '1900',
  nexa: '29223',
  nostr: '1237',
  scdo: '541',
  sol: '501',
  stellar: '148',
  sui: '784',
  tbtc: '1',
  ton: '607',
  tron: '195',
  xrp: '144',
};
const UTXO = new Set<ICloudPublicAccountImpl>([
  'ada',
  'btc',
  'tbtc',
  'ltc',
  'doge',
  'bch',
  'nexa',
  'neurai',
  'dynex',
]);
const VARIANT = new Set<ICloudPublicAccountImpl>([
  'cosmos',
  'dot',
  'fil',
  'cfx',
]);

export function publicAccountAllChainWallet(
  kind: IPublicAccountAllChainFixture['kind'],
  id = kind === 'hd' ? 'hd-public-source' : 'hw-public-source',
): IDBWallet {
  return {
    id,
    type: kind === 'hd' ? 'hd' : 'hw',
    xfp: PUBLIC_ACCOUNT_TEST_XFP,
    name: 'Independent public test vectors',
    backuped: true,
    walletNo: 1,
    nextIds: {},
    accounts: [],
  };
}

function fixture({
  impl,
  kind = 'hd',
  networkId,
  template,
  path,
  address,
  pub,
  source,
  xpub,
  relPath,
  addresses,
  idSuffix,
}: {
  impl: ICloudPublicAccountImpl;
  kind?: IPublicAccountAllChainFixture['kind'];
  networkId: string;
  template: string;
  path: string;
  address: string;
  pub: string;
  source: string;
  xpub?: string;
  relPath?: string;
  addresses?: Record<string, string>;
  idSuffix?: string;
}): IPublicAccountAllChainFixture {
  let type = EDBAccountType.SIMPLE;
  if (UTXO.has(impl)) type = EDBAccountType.UTXO;
  else if (VARIANT.has(impl)) type = EDBAccountType.VARIANT;
  const wallet = publicAccountAllChainWallet(kind);
  const account = {
    id: accountUtils.buildHDAccountId({
      walletId: wallet.id,
      path,
      idSuffix,
      isUtxo: type === EDBAccountType.UTXO,
    }),
    indexedAccountId: accountUtils.buildIndexedAccountId({
      walletId: wallet.id,
      index: 0,
    }),
    name: `Public ${impl}`,
    impl,
    type,
    coinType: COINS[impl],
    path,
    pathIndex: 0,
    template,
    address,
    pub,
    createAtNetwork: networkId,
    networks: [networkId],
    ...(xpub !== undefined ? { xpub } : {}),
    ...(relPath !== undefined ? { relPath } : {}),
    ...(addresses !== undefined ? { addresses } : {}),
  } satisfies IDBAccount;
  return {
    impl,
    kind,
    networkId,
    source,
    account,
    expectedVersion: ['btc', 'evm'].includes(impl) ? 1 : 2,
  };
}

/** Builds local account shapes using public data only; never calls hardware. */
export async function publicAccountAllChainFixtures(): Promise<
  IPublicAccountAllChainFixture[]
> {
  const result = corePublicVectors.map((vector) => {
    const impl = vector.chain;
    let address = vector.account.address;
    let pub = vector.account.publicKey;
    let addresses = vector.account.addresses;
    let xpub = vector.account.xpub;
    if (VARIANT.has(impl)) address = '';
    if (impl === 'dot')
      addresses = {
        [vector.networkInfo.networkId]: encodeAddress(
          Buffer.from(pub, 'hex'),
          0,
        ),
      };
    if (impl === 'ada') {
      address = sdkPublicVectors.cardano.address;
      pub = '';
      xpub = sdkPublicVectors.cardano.xpub;
      addresses = { '0/0': address, '2/0': sdkPublicVectors.cardano.stake };
    }
    return fixture({
      impl,
      networkId: vector.networkInfo.networkId,
      template: vector.template,
      path: vector.account.path,
      address,
      pub,
      source:
        impl === 'ada'
          ? '@emurgo/cardano-serialization-lib public child derivation (RFC8032 public point)'
          : vector.source,
      ...(UTXO.has(impl)
        ? { xpub: xpub ?? '', relPath: '0/0', addresses }
        : {}),
      ...(VARIANT.has(impl) ? { addresses } : {}),
    });
  });
  const secp = sdkPublicVectors.alph.pub;
  const generated = [
    {
      impl: 'bfc',
      networkId: 'bfc--mainnet',
      template: "m/44'/728'/$$INDEX$$'/0'/0'",
      path: "m/44'/728'/0'/0'/0'",
      ...sdkPublicVectors.bfc,
      source: '@benfen/bfc.js Ed25519PublicKey public address encoding',
    },
    {
      impl: 'stellar',
      networkId: 'stellar--mainnet',
      template: "m/44'/148'/$$INDEX$$'",
      path: "m/44'/148'/0'",
      ...sdkPublicVectors.stellar,
      source: '@stellar/stellar-base StrKey.encodeEd25519PublicKey',
    },
    {
      impl: 'ton',
      networkId: 'ton--mainnet',
      template: "m/44'/607'/$$INDEX$$'",
      path: "m/44'/607'/0'",
      ...sdkPublicVectors.ton,
      idSuffix: EAddressEncodings.TON_V4R2,
      source: 'tonweb Wallets.v4R2 public address derivation',
    },
    {
      impl: 'nostr',
      networkId: 'nostr--0',
      template: "m/44'/1237'/$$INDEX$$'/0/0",
      path: "m/44'/1237'/0'/0/0",
      ...sdkPublicVectors.nostr,
      source: 'bech32 npub encoding of SEC1 x-only public point',
    },
    {
      impl: 'neo',
      kind: 'hardware',
      networkId: 'neo--3',
      template: "m/44'/888'/0'/0/$$INDEX$$",
      path: "m/44'/888'/0'/0/0",
      ...sdkPublicVectors.neo,
      source: '@cityofzion/neon-core wallet public address derivation',
    },
    {
      impl: 'alph',
      kind: 'hardware',
      networkId: 'alph--mainnet',
      template: "m/44'/1234'/$$INDEX$$'",
      path: "m/44'/1234'/0'",
      ...sdkPublicVectors.alph,
      relPath: '0/0',
      source: '@alephium/web3 addressFromPublicKey',
    },
    {
      impl: 'scdo',
      kind: 'hardware',
      networkId: 'scdo--net1',
      template: "m/44'/541'/$$INDEX$$'/0/0",
      path: "m/44'/541'/0'/0/0",
      address: publicKeyToAddress(Buffer.from(secp, 'hex')),
      pub: '',
      source:
        'existing SCdo publicKeyToAddress; historical hardware address-only shape',
    },
    {
      impl: 'nervos',
      networkId: 'nervos--mainnet',
      template: "m/44'/309'/0'/0/$$INDEX$$",
      path: "m/44'/309'/0'/0/0",
      address: pubkeyToAddress(`0x${secp}`, { config: getConfig('mainnet') }),
      pub: secp,
      source: 'existing sdkCkb.pubkeyToAddress SEC1 public point',
    },
    {
      impl: 'dynex',
      kind: 'hardware',
      networkId: 'dynex--0',
      template: "m/44'/29538'/0'/0'/$$INDEX$$'",
      path: "m/44'/29538'/0'/0'/0'",
      address: sdkPublicVectors.dynex.address,
      pub: '',
      relPath: '',
      addresses: {},
      source:
        'CryptoNote standard prefix185; RFC8032 public spend/view points and checksum',
    },
  ] satisfies Array<Parameters<typeof fixture>[0]>;
  result.push(
    ...generated.map((item) =>
      fixture({
        ...item,
        ...(item.impl === 'scdo' ? { addresses: { '0/0': item.address } } : {}),
      }),
    ),
  );

  const btc = corePublicVectors.find((item) => item.chain === 'btc');
  const tbtc = corePublicVectors.find((item) => item.chain === 'tbtc');
  if (!btc?.account.xpub || !tbtc?.account.xpub) return result;
  const xnaNetwork = getBtcForkNetwork('xna');
  const xnaXpub = convertBtcForkXpub({
    btcForkNetwork: xnaNetwork,
    xpub: btc.account.xpub,
    addressEncoding: EAddressEncodings.P2PKH,
  });
  const xnaChild = getBip32FromBase58({
    network: xnaNetwork,
    key: xnaXpub,
  }).derivePath('0/0');
  const xnaAddress =
    payments.p2pkh({ network: xnaNetwork, pubkey: xnaChild.publicKey })
      .address ?? '';
  result.push(
    fixture({
      impl: 'neurai',
      networkId: 'neurai--0',
      template: "m/44'/1900'/$$INDEX$$'/0/0",
      path: "m/44'/1900'/0'",
      address: xnaAddress,
      pub: xnaChild.publicKey.toString('hex'),
      xpub: xnaXpub,
      relPath: '0/0',
      addresses: { '0/0': xnaAddress },
      source:
        'public BIP32 child of existing Core xpub, Neurai P2PKH network encoding',
    }),
  );
  for (const [impl, vector, code] of [
    ['lightning', btc, 'btc'],
    ['tlightning', tbtc, 'tbtc'],
  ] as const) {
    const network = getBtcForkNetwork(code);
    const xpub = convertBtcForkXpub({
      btcForkNetwork: network,
      xpub: vector.account.xpub ?? '',
      addressEncoding: EAddressEncodings.P2PKH,
    });
    const child = getBip32FromBase58({ network, key: xpub }).derivePath('0/0');
    const address =
      payments.p2wpkh({ network, pubkey: child.publicKey }).address ?? '';
    const coin = COINS[impl];
    result.push(
      fixture({
        impl,
        kind: 'hardware',
        networkId: `${impl}--0`,
        template: `m/44'/${coin}'/$$INDEX$$'/0/0`,
        path: `m/44'/${coin}'/0'`,
        address,
        pub: xpub,
        relPath: '0/0',
        addresses: { '0/0': address },
        source:
          'existing hardware Lightning public xpub shape; Core public xpub child P2WPKH',
      }),
    );
  }
  return result.toSorted((a, b) => a.impl.localeCompare(b.impl));
}
