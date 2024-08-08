import { networks } from 'bitcoinjs-lib';

import { EAddressEncodings } from '../../../types';

import type { IBtcForkNetwork } from '../types';

const btc: IBtcForkNetwork = {
  ...networks.bitcoin,
  segwitVersionBytes: {
    // [EAddressEncodings.P2PKH]: networks.bitcoin.bip32,
    [EAddressEncodings.P2SH_P2WPKH]: {
      public: 0x04_9d_7c_b2,
      private: 0x04_9d_78_78,
    },
    [EAddressEncodings.P2WPKH]: {
      public: 0x04_b2_47_46,
      private: 0x04_b2_43_0c,
    },
    [EAddressEncodings.P2TR]: {
      public: 0x04_88_b2_1e,
      private: 0x04_88_ad_e4,
    },
  },
};

const tbtc: IBtcForkNetwork = {
  ...networks.testnet,
  segwitVersionBytes: {
    // [EAddressEncodings.P2PKH]: networks.testnet.bip32,
    [EAddressEncodings.P2SH_P2WPKH]: {
      public: 0x04_4a_52_62,
      private: 0x04_4a_4e_28,
    },
    [EAddressEncodings.P2WPKH]: {
      public: 0x04_5f_1c_f6,
      private: 0x04_5f_18_bc,
    },
    [EAddressEncodings.P2TR]: {
      public: 0x04_35_87_cf,
      private: 0x04_35_83_94,
    },
  },
};

const rbtc: IBtcForkNetwork = {
  ...networks.regtest,
  segwitVersionBytes: {
    // [EAddressEncodings.P2PKH]: networks.regtest.bip32,
    [EAddressEncodings.P2SH_P2WPKH]: {
      public: 0x04_4a_52_62,
      private: 0x04_4a_4e_28,
    },
    [EAddressEncodings.P2WPKH]: {
      public: 0x04_5f_1c_f6,
      private: 0x04_5f_18_bc,
    },
  },
};

const bch: IBtcForkNetwork = {
  messagePrefix: '\x18Bitcoin Signed Message:\n',
  bech32: '',
  bip32: {
    public: 0x04_88_b2_1e,
    private: 0x04_88_ad_e4,
  },
  pubKeyHash: 0x00,
  scriptHash: 0x05,
  wif: 0x80,
  forkId: 0x00,
  maximumFeeRate: 10_000, // bch
};

const doge: IBtcForkNetwork = {
  messagePrefix: '\x19Dogecoin Signed Message:\n',
  bech32: '',
  bip32: {
    public: 0x02_fa_ca_fd,
    private: 0x02_fa_c3_98,
  },
  pubKeyHash: 0x1e,
  scriptHash: 0x16,
  wif: 0x9e,
  maximumFeeRate: 1_000_000, // doge
};

const ltc: IBtcForkNetwork = {
  messagePrefix: '\x19Litecoin Signed Message:\n',
  bech32: 'ltc',
  // TODO getVersionBytesByAddressEncoding
  // EAddressEncodings.P2PKH read .bip32, others read .segwitVersionBytes
  bip32: {
    public: 0x01_9d_a4_62,
    private: 0x01_9d_9c_fe,
  },
  segwitVersionBytes: {
    [EAddressEncodings.P2SH_P2WPKH]: {
      public: 0x01_b2_6e_f6,
      private: 0x01_b2_67_92,
    },
    [EAddressEncodings.P2WPKH]: {
      public: 0x04_b2_47_46,
      private: 0x04_b2_43_0c,
    },
  },
  pubKeyHash: 0x30,
  scriptHash: 0x32,
  wif: 0xb0,
};

const btg: IBtcForkNetwork = {
  messagePrefix: '\x1dBitcoin Gold Signed Message:\n',
  bech32: 'btg',
  bip32: {
    public: 0x04_88_b2_1e,
    private: 0x04_88_ad_e4,
  },
  pubKeyHash: 0x26,
  scriptHash: 0x17,
  wif: 0x80,
};

const dgb: IBtcForkNetwork = {
  messagePrefix: '\x19DigiByte Signed Message:\n',
  bech32: 'dgb',
  bip32: {
    public: 0x04_88_b2_1e,
    private: 0x04_88_ad_e4,
  },
  pubKeyHash: 0x1e,
  scriptHash: 0x3f,
  wif: 0xb0,
};

const nmc: IBtcForkNetwork = {
  messagePrefix: '\x19Namecoin Signed Message:\n',
  bech32: '',
  bip32: {
    public: 0x04_88_b2_1e,
    private: 0x04_88_ad_e4,
  },
  pubKeyHash: 0x34,
  scriptHash: 0x05,
  wif: 0x80,
};

const vtc: IBtcForkNetwork = {
  messagePrefix: '\x19Vertcoin Signed Message:\n',
  bech32: 'vtc',
  bip32: {
    public: 0x04_88_b2_1e,
    private: 0x04_88_ad_e4,
  },
  pubKeyHash: 0x47,
  scriptHash: 0x05,
  wif: 0x80,
};

const dash: IBtcForkNetwork = {
  messagePrefix: '\x19DarkCoin Signed Message:\n',
  bech32: '',
  bip32: {
    public: 0x02_fe_52_cc,
    private: 0x02_fe_52_f8,
  },
  pubKeyHash: 0x4c,
  scriptHash: 0x10,
  wif: 0xcc,
};

const neurai: IBtcForkNetwork = {
  messagePrefix: '\x19Neurai Signed Message:\n',
  bech32: '',
  bip32: {
    private: 0x04_88_ad_e4,
    public: 0x04_88_b2_1e,
  },
  pubKeyHash: 0x35,
  scriptHash: 0x75,
  wif: 0x80,
  maximumFeeRate: 1_000_000, // neurai
};

const extendedNetworks: Record<string, IBtcForkNetwork> = {
  btc,
  tbtc, // testnet
  rbtc, // regtest
  sbtc: tbtc, // signet
  ltc,
  bch,
  doge,
  neurai,
  btg,
  dgb,
  nmc,
  vtc,
  dash,
};

export type IBtcForkExtendedNetworks = keyof typeof extendedNetworks;

export function getBtcForkNetwork(
  // presetNetworks.code
  chainCode: string | undefined, // btc, tbtc, bch, doge, btg, dgb, nmc, vtc, dash
): IBtcForkNetwork {
  if (!chainCode) {
    throw new Error('getBtcForkNetwork ERROR: chainCode is undefined');
  }
  const network = extendedNetworks[chainCode];
  if (typeof network === 'undefined' || !network) {
    throw new Error(`Network not found. chainCode: ${chainCode}`);
  }

  network.networkChainCode = chainCode;
  return network;
}
