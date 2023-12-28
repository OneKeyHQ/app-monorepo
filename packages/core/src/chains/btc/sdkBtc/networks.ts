import { networks } from 'bitcoinjs-lib';

import { EAddressEncodings } from '../../../types';

import type { IBtcForkNetwork } from '../types';

const btc: IBtcForkNetwork = {
  ...networks.bitcoin,
  segwitVersionBytes: {
    [EAddressEncodings.P2SH_P2WPKH]: {
      public: 0x049d7cb2,
      private: 0x049d7878,
    },
    [EAddressEncodings.P2WPKH]: {
      public: 0x04b24746,
      private: 0x04b2430c,
    },
    [EAddressEncodings.P2TR]: {
      public: 0x0488b21e,
      private: 0x0488ade4,
    },
  },
};

const tbtc: IBtcForkNetwork = {
  ...networks.testnet,
  segwitVersionBytes: {
    [EAddressEncodings.P2SH_P2WPKH]: {
      public: 0x044a5262,
      private: 0x044a4e28,
    },
    [EAddressEncodings.P2WPKH]: {
      public: 0x045f1cf6,
      private: 0x045f18bc,
    },
    [EAddressEncodings.P2TR]: {
      public: 0x043587cf,
      private: 0x04358394,
    },
  },
};

const rbtc: IBtcForkNetwork = {
  ...networks.regtest,
  segwitVersionBytes: {
    [EAddressEncodings.P2SH_P2WPKH]: {
      public: 0x044a5262,
      private: 0x044a4e28,
    },
    [EAddressEncodings.P2WPKH]: {
      public: 0x045f1cf6,
      private: 0x045f18bc,
    },
  },
};

const ltc: IBtcForkNetwork = {
  messagePrefix: '\x19Litecoin Signed Message:\n',
  bech32: 'ltc',
  bip32: {
    public: 0x019da462,
    private: 0x019d9cfe,
  },
  segwitVersionBytes: {
    [EAddressEncodings.P2SH_P2WPKH]: {
      public: 0x01b26ef6,
      private: 0x01b26792,
    },
    [EAddressEncodings.P2WPKH]: {
      public: 0x04b24746,
      private: 0x04b2430c,
    },
  },
  pubKeyHash: 0x30,
  scriptHash: 0x32,
  wif: 0xb0,
};

const bch: IBtcForkNetwork = {
  messagePrefix: '\x18Bitcoin Signed Message:\n',
  bech32: '',
  bip32: {
    public: 0x0488b21e,
    private: 0x0488ade4,
  },
  pubKeyHash: 0x00,
  scriptHash: 0x05,
  wif: 0x80,
  forkId: 0x00,
};

const doge: IBtcForkNetwork = {
  messagePrefix: '\x19Dogecoin Signed Message:\n',
  bech32: '',
  bip32: {
    public: 0x02facafd,
    private: 0x02fac398,
  },
  pubKeyHash: 0x1e,
  scriptHash: 0x16,
  wif: 0x9e,
};

const btg: IBtcForkNetwork = {
  messagePrefix: '\x1dBitcoin Gold Signed Message:\n',
  bech32: 'btg',
  bip32: {
    public: 0x0488b21e,
    private: 0x0488ade4,
  },
  pubKeyHash: 0x26,
  scriptHash: 0x17,
  wif: 0x80,
};

const dgb: IBtcForkNetwork = {
  messagePrefix: '\x19DigiByte Signed Message:\n',
  bech32: 'dgb',
  bip32: {
    public: 0x0488b21e,
    private: 0x0488ade4,
  },
  pubKeyHash: 0x1e,
  scriptHash: 0x3f,
  wif: 0xb0,
};

const nmc: IBtcForkNetwork = {
  messagePrefix: '\x19Namecoin Signed Message:\n',
  bech32: '',
  bip32: {
    public: 0x0488b21e,
    private: 0x0488ade4,
  },
  pubKeyHash: 0x34,
  scriptHash: 0x05,
  wif: 0x80,
};

const vtc: IBtcForkNetwork = {
  messagePrefix: '\x19Vertcoin Signed Message:\n',
  bech32: 'vtc',
  bip32: {
    public: 0x0488b21e,
    private: 0x0488ade4,
  },
  pubKeyHash: 0x47,
  scriptHash: 0x05,
  wif: 0x80,
};

const dash: IBtcForkNetwork = {
  messagePrefix: '\x19DarkCoin Signed Message:\n',
  bech32: '',
  bip32: {
    public: 0x02fe52cc,
    private: 0x02fe52f8,
  },
  pubKeyHash: 0x4c,
  scriptHash: 0x10,
  wif: 0xcc,
};

const extendedNetworks: Record<string, IBtcForkNetwork> = {
  btc,
  tbtc,
  rbtc,
  ltc,
  bch,
  doge,
  btg,
  dgb,
  nmc,
  vtc,
  dash,
};

export type IBtcForkExtendedNetworks = keyof typeof extendedNetworks;

export function getBtcForkNetwork(
  chainCode: string | undefined, // btc, tbtc, bch, doge, btg, dgb, nmc, vtc, dash
): IBtcForkNetwork {
  if (!chainCode) {
    throw new Error('getBtcForkNetwork ERROR: chainCode is undefined');
  }
  const network = extendedNetworks[chainCode];
  network.networkChainCode = chainCode;
  if (typeof network === 'undefined') {
    throw new Error(`Network not found. chainCode: ${chainCode}`);
  }
  return network;
}
