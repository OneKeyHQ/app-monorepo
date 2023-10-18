/* eslint-disable @typescript-eslint/unbound-method */
import * as BitcoinJS from 'bitcoinjs-lib';
import typeforce from 'typeforce';

import { AddressEncodings } from '../types';

// TODO rename
export interface Network extends BitcoinJS.Network {
  networkChainCode?: string;
  // Extends the network interface to support:
  //   - segwit address version bytes
  segwitVersionBytes?: Partial<
    Record<AddressEncodings, BitcoinJS.Network['bip32']>
  >;
  forkId?: number; // bch
}
export type IBtcForkNetwork = Network;

const btc: IBtcForkNetwork = {
  ...BitcoinJS.networks.bitcoin,
  segwitVersionBytes: {
    [AddressEncodings.P2SH_P2WPKH]: {
      public: 0x049d7cb2,
      private: 0x049d7878,
    },
    [AddressEncodings.P2WPKH]: {
      public: 0x04b24746,
      private: 0x04b2430c,
    },
    [AddressEncodings.P2TR]: {
      public: 0x0488b21e,
      private: 0x0488ade4,
    },
  },
};

const tbtc: IBtcForkNetwork = {
  ...BitcoinJS.networks.testnet,
  segwitVersionBytes: {
    [AddressEncodings.P2SH_P2WPKH]: {
      public: 0x044a5262,
      private: 0x044a4e28,
    },
    [AddressEncodings.P2WPKH]: {
      public: 0x045f1cf6,
      private: 0x045f18bc,
    },
    [AddressEncodings.P2TR]: {
      public: 0x043587cf,
      private: 0x04358394,
    },
  },
};

const rbtc: IBtcForkNetwork = {
  ...BitcoinJS.networks.regtest,
  segwitVersionBytes: {
    [AddressEncodings.P2SH_P2WPKH]: {
      public: 0x044a5262,
      private: 0x044a4e28,
    },
    [AddressEncodings.P2WPKH]: {
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
    [AddressEncodings.P2SH_P2WPKH]: {
      public: 0x01b26ef6,
      private: 0x01b26792,
    },
    [AddressEncodings.P2WPKH]: {
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

const getNetwork = (chainCode: string | undefined): IBtcForkNetwork => {
  if (!chainCode) {
    throw new Error('getBtcForkNetwork ERROR: chainCode is undefined');
  }
  const network = extendedNetworks[chainCode];
  network.networkChainCode = chainCode;
  if (typeof network === 'undefined') {
    throw new Error(`Network not found. chainCode: ${chainCode}`);
  }
  return network;
};

export const getBtcForkNetwork = getNetwork;

const NETWORK_TYPES = {
  bitcoinCash: [bch],
};

export type NetworkTypes = keyof typeof NETWORK_TYPES;
export function isNetworkType(type: NetworkTypes, network?: Network) {
  if (typeof type !== 'string' || !network || !NETWORK_TYPES[type])
    return false;
  try {
    typeforce(
      {
        bip32: {
          public: typeforce.UInt32,
          private: typeforce.UInt32,
        },
        pubKeyHash: typeforce.anyOf(typeforce.UInt8, typeforce.UInt16),
        scriptHash: typeforce.anyOf(typeforce.UInt8, typeforce.UInt16),
      },
      network,
    );
  } catch (e) {
    return false;
  }
  return !!NETWORK_TYPES[type].find(
    (n) =>
      n.bip32.public === network.bip32.public &&
      n.bip32.private === network.bip32.private &&
      ((!n.bech32 && !network.bech32) || n.bech32 === network.bech32) &&
      ((!n.forkId && !network.forkId) || n.forkId === network.forkId) &&
      n.pubKeyHash === network.pubKeyHash &&
      n.scriptHash === network.scriptHash,
  );
}

export { getNetwork };
