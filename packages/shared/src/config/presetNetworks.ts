/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable spellcheck/spell-checker */
import { memoFn } from '@onekeyhq/shared/src/utils/cacheUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import { ENetworkStatus } from '@onekeyhq/shared/types';

import platformEnv from '../platformEnv';

// dangerNetwork represents a virtual network
export const dangerAllNetworkRepresent: IServerNetwork = {
  'balance2FeeDecimals': 0,
  'chainId': '0',
  'code': '',
  'decimals': 0,
  'id': 'all--0',
  'impl': 'all',
  'isTestnet': false,
  'logoURI': 'https://uni.onekey-asset.com/static/chain/all.png',
  'name': 'All Networks',
  'shortcode': '',
  'shortname': '',
  'symbol': '',
  'feeMeta': {
    'code': '',
    'decimals': 0,
    'symbol': '0',
  },
  'defaultEnabled': true,
  'priceConfigs': [],
  'explorers': [],
  'status': ENetworkStatus.LISTED,
  'createdAt': '2023-05-31T00:29:24.951Z',
  'updatedAt': '2023-05-31T00:29:24.951Z',
};

export const getPresetNetworks = memoFn((): IServerNetwork[] => {
  // shortcode
  const eth: IServerNetwork = {
    'balance2FeeDecimals': 9,
    'chainId': '1',
    'code': 'eth',
    'decimals': 18,
    'extensions': {
      'defaultStableTokens': [
        '0xdac17f958d2ee523a2206206994597c13d831ec7',
        '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        '0x4fabb145d64652a948d72533023f6e7a623c7c53',
        '0x6b175474e89094c44da98b954eedeac495271d0f',
      ],
      'position': 1,
      'providerOptions': {
        'EIP1559Enabled': true,
        'preferMetamask': true,
      },
    },
    'id': 'evm--1',
    'impl': 'evm',
    'isTestnet': false,
    'logoURI': 'https://uni.onekey-asset.com/static/chain/eth.png',
    'name': 'Ethereum',
    'shortcode': 'eth',
    'shortname': 'ETH',
    'symbol': 'ETH',
    'feeMeta': {
      'code': 'eth',
      'decimals': 9,
      'symbol': 'Gwei',
    },
    'defaultEnabled': true,
    'priceConfigs': [
      {
        'channel': 'coingecko',
        'native': 'ethereum',
        'platform': 'ethereum',
      },
      {
        'channel': 'yahoo',
        'native': 'ETH',
      },
    ],
    'explorers': [
      {
        'address': 'https://cn.etherscan.com/address/{address}',
        'block': 'https://cn.etherscan.com/block/{block}',
        'name': 'https://cn.etherscan.com/',
        'transaction': 'https://cn.etherscan.com/tx/{transaction}',
      },
      {
        'address': 'https://etherscan.io/address/{address}',
        'block': 'https://etherscan.io/block/{block}',
        'name': 'https://etherscan.io/',
        'transaction': 'https://etherscan.io/tx/{transaction}',
      },
      {
        'address': 'https://www.oklink.com/eth/address/{address}',
        'block': 'https://www.oklink.com/eth/block/{block}',
        'name': 'https://www.oklink.com/eth/',
        'transaction': 'https://www.oklink.com/eth/tx/{transaction}',
      },
    ],
    'status': ENetworkStatus.LISTED,
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  };

  const sepolia: IServerNetwork = {
    'balance2FeeDecimals': 9,
    'chainId': '11155111',
    'code': 'sepolia',
    'decimals': 18,
    'extensions': {
      'providerOptions': {
        'EIP1559Enabled': true,
        'preferMetamask': true,
      },
    },
    'id': 'evm--11155111',
    'impl': 'evm',
    'isTestnet': true,
    'logoURI':
      'https://uni.onekey-asset.com/static/chain/ethereum-sepolia-testnet.png',
    'name': 'Ethereum Sepolia Testnet',
    'shortcode': 'sepolia',
    'shortname': 'Sepolia',
    'symbol': 'TETH',
    'feeMeta': {
      'code': 'sepolia',
      'decimals': 9,
      'symbol': 'Gwei',
    },
    'defaultEnabled': false,
    'priceConfigs': [],
    'explorers': [
      {
        'address': 'https://sepolia.etherscan.io/address/{address}',
        'block': 'https://sepolia.etherscan.io/block/{block}',
        'name': 'https://sepolia.etherscan.io/',
        'transaction': 'https://sepolia.etherscan.io/tx/{transaction}',
      },
    ],
    'status': ENetworkStatus.LISTED,
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  };

  const btc: IServerNetwork = {
    'balance2FeeDecimals': 0,
    'chainId': '0',
    'code': 'btc',
    'decimals': 8,
    'extensions': {
      'position': 2,
      'providerOptions': {
        'hardwareCoinName': 'btc',
      },
    },
    'id': 'btc--0',
    'impl': 'btc',
    'isTestnet': false,
    'logoURI': 'https://uni.onekey-asset.com/static/chain/btc.png',
    'name': 'Bitcoin',
    'shortcode': 'btc',
    'shortname': 'BTC',
    'symbol': 'BTC',
    'feeMeta': {
      'code': 'btc',
      'decimals': 8,
      'symbol': 'BTC',
    },
    'defaultEnabled': true,
    'priceConfigs': [
      {
        'channel': 'coingecko',
        'native': 'bitcoin',
        'platform': 'ordinals',
      },
    ],
    'explorers': [
      {
        'address': 'https://mempool.space/address/{address}',
        'block': 'https://mempool.space/block/{block}',
        'name': 'https://mempool.space/',
        'transaction': 'https://mempool.space/tx/{transaction}',
      },
    ],
    'status': ENetworkStatus.LISTED,
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  };

  const tbtc: IServerNetwork = {
    'balance2FeeDecimals': 0,
    'chainId': '0',
    'code': 'tbtc',
    'decimals': 8,
    'id': 'tbtc--0',
    'impl': 'tbtc',
    'isTestnet': true,
    'logoURI': 'https://uni.onekey-asset.com/static/chain/bitcoin-testnet.png',
    'name': 'Bitcoin Testnet',
    'shortcode': 'tbtc',
    'shortname': 'TBTC',
    'symbol': 'TBTC',
    'feeMeta': {
      'code': 'tbtc',
      'decimals': 8,
      'symbol': 'TBTC',
    },
    'defaultEnabled': false,
    'priceConfigs': [],
    'explorers': [
      {
        'address': 'https://mempool.space/testnet/address/{address}',
        'block': 'https://mempool.space/testnet/block/{block}',
        'name': 'https://mempool.space/testnet/',
        'transaction': 'https://mempool.space/testnet/tx/{transaction}',
      },
    ],
    'status': ENetworkStatus.LISTED,
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  };

  const sbtc: IServerNetwork = {
    'balance2FeeDecimals': 0,
    'chainId': '0',
    'code': 'sbtc',
    'decimals': 8,
    'id': 'tbtc--1',
    'impl': 'tbtc',
    'isTestnet': true,
    'logoURI': 'https://uni.onekey-asset.com/static/chain/sbtc.png',
    'name': 'Bitcoin Signet',
    'shortcode': 'sbtc',
    'shortname': 'SBTC',
    'symbol': 'SBTC',
    'feeMeta': {
      'code': 'sbtc',
      'decimals': 8,
      'symbol': 'SBTC',
    },
    'defaultEnabled': false,
    'priceConfigs': [],
    'explorers': [
      {
        'address': 'https://mempool.space/signet/address/{address}',
        'block': 'https://mempool.space/signet/block/{block}',
        'name': 'https://mempool.space/signet/',
        'transaction': 'https://mempool.space/signet/tx/{transaction}',
      },
    ],
    'status': ENetworkStatus.LISTED,
    'createdAt': '2024-02-28T00:29:24.951Z',
    'updatedAt': '2024-02-28T00:29:24.951Z',
  };

  const doge: IServerNetwork = {
    'balance2FeeDecimals': 0,
    'chainId': '0',
    'code': 'doge',
    'decimals': 8,
    'id': 'doge--0',
    'impl': 'doge',
    'isTestnet': false,
    'logoURI': 'https://uni.onekey-asset.com/static/chain/doge.png',
    'name': 'Dogecoin',
    'shortcode': 'doge',
    'shortname': 'DOGE',
    'symbol': 'DOGE',
    'feeMeta': {
      'code': 'doge',
      'decimals': 8,
      'symbol': 'DOGE',
    },
    'defaultEnabled': true,
    'priceConfigs': [
      {
        'channel': 'coingecko',
        'native': 'dogecoin',
      },
    ],
    'explorers': [
      {
        'address': 'https://dogeblocks.com/address/{address}',
        'block': 'https://dogeblocks.com/block/{block}',
        'name': 'https://dogeblocks.com/',
        'transaction': 'https://dogeblocks.com/tx/{transaction}',
      },
      {
        'address': 'https://dogechain.info/address/{address}',
        'block': 'https://dogechain.info/block/{block}',
        'name': 'https://dogechain.info/',
        'transaction': 'https://dogechain.info/tx/{transaction}',
      },
    ],
    'status': ENetworkStatus.LISTED,
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  };

  const bch: IServerNetwork = {
    'balance2FeeDecimals': 0,
    'chainId': '0',
    'code': 'bch',
    'decimals': 8,
    'id': 'bch--0',
    'impl': 'bch',
    'isTestnet': false,
    'logoURI': 'https://uni.onekey-asset.com/static/chain/bch.png',
    'name': 'Bitcoin Cash',
    'shortcode': 'bch',
    'shortname': 'BCH',
    'symbol': 'BCH',
    'feeMeta': {
      'code': 'bch',
      'decimals': 8,
      'symbol': 'BCH',
    },
    'defaultEnabled': true,
    'priceConfigs': [
      {
        'channel': 'coingecko',
        'native': 'bitcoin-cash',
      },
    ],
    'explorers': [
      {
        'address': 'https://bchblockexplorer.com/address/{address}',
        'block': 'https://bchblockexplorer.com/block/{block}',
        'name': 'https://bchblockexplorer.com/',
        'transaction': 'https://bchblockexplorer.com/tx/{transaction}',
      },
      {
        'address':
          'https://blockexplorer.one/bitcoin-cash/mainnet/address/{address}',
        'block':
          'https://blockexplorer.one/bitcoin-cash/mainnet/blockHash/{block}',
        'name': 'https://blockexplorer.one/bitcoin-cash/mainnet',
        'transaction':
          'https://blockexplorer.one/bitcoin-cash/mainnet/tx/{transaction}',
      },
    ],
    'status': ENetworkStatus.LISTED,
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  };

  const ltc: IServerNetwork = {
    'balance2FeeDecimals': 0,
    'chainId': '0',
    'code': 'ltc',
    'decimals': 8,
    'id': 'ltc--0',
    'impl': 'ltc',
    'isTestnet': false,
    'logoURI': 'https://uni.onekey-asset.com/static/chain/ltc.png',
    'name': 'Litecoin',
    'shortcode': 'ltc',
    'shortname': 'LTC',
    'symbol': 'LTC',
    'feeMeta': {
      'code': 'ltc',
      'decimals': 8,
      'symbol': 'LTC',
    },
    'defaultEnabled': true,
    'priceConfigs': [
      {
        'channel': 'coingecko',
        'native': 'litecoin',
      },
    ],
    'explorers': [
      {
        'address': 'https://litecoinblockexplorer.net/address/{address}',
        'block': 'https://litecoinblockexplorer.net/block/{block}',
        'name': 'https://litecoinblockexplorer.net/',
        'transaction': 'https://litecoinblockexplorer.net/tx/{transaction}',
      },
      {
        'address':
          'https://blockexplorer.one/litecoin/mainnet/address/{address}',
        'block': 'https://blockexplorer.one/litecoin/mainnet/blockHash/{block}',
        'name': 'https://blockexplorer.one/litecoin/mainnet',
        'transaction':
          'https://blockexplorer.one/litecoin/mainnet/tx/{transaction}',
      },
    ],
    'status': ENetworkStatus.LISTED,
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  };

  const neurai: IServerNetwork = {
    'balance2FeeDecimals': 0,
    'chainId': '0',
    'code': 'neurai',
    'decimals': 8,
    'id': 'neurai--0',
    'impl': 'neurai',
    'isTestnet': false,
    'logoURI': 'https://uni.onekey-asset.com/static/chain/neurai.png',
    'name': 'Neurai',
    'shortcode': 'xna',
    'shortname': 'XNA',
    'symbol': 'XNA',
    'feeMeta': {
      'code': 'xna',
      'decimals': 8,
      'symbol': 'XNA',
    },
    'defaultEnabled': true,
    'priceConfigs': [
      {
        'channel': 'coingecko',
        'native': 'neurai',
      },
    ],
    'explorers': [
      {
        'address': 'https://neuraiexplorer.com/address/{address}',
        'block': 'https://neuraiexplorer.com/block/{block}',
        'name': 'https://neuraiexplorer.com',
        'transaction': 'https://neuraiexplorer.com/tx/{transaction}',
      },
    ],
    'status': ENetworkStatus.LISTED,
    'createdAt': '2024-03-10T00:00:00.001Z',
    'updatedAt': '2024-03-10T00:00:00.001Z',
  };

  const tatom: IServerNetwork = {
    'balance2FeeDecimals': 0,
    'chainId': 'theta-testnet-001',
    'code': 'tatom',
    'decimals': 6,
    'extensions': {
      'providerOptions': {
        'addressPrefix': 'cosmos',
        'curve': 'secp256k1',
        'gasPriceStep': {
          'min': '0',
        },
        'mainCoinDenom': 'uatom',
      },
    },
    'id': 'cosmos--theta-testnet-001',
    'impl': 'cosmos',
    'isTestnet': true,
    'logoURI': 'https://uni.onekey-asset.com/static/chain/cosmos.png',
    'name': 'Cosmos Testnet',
    'shortcode': 'tatom',
    'shortname': 'TCosmos',
    'symbol': 'TATOM',
    'feeMeta': {
      'code': 'tatom',
      'decimals': 6,
      'symbol': 'TATOM',
    },
    'defaultEnabled': false,
    'priceConfigs': [],
    'explorers': [
      {
        'address':
          'https://explorer.theta-testnet.polypore.xyz/accounts/{address}',
        'block': 'https://explorer.theta-testnet.polypore.xyz/blocks/{block}',
        'name': 'https://explorer.theta-testnet.polypore.xyz/',
        'transaction':
          'https://explorer.theta-testnet.polypore.xyz/transactions/{transaction}',
      },
    ],
    'status': ENetworkStatus.LISTED,
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  };

  const cosmoshub: IServerNetwork = {
    'balance2FeeDecimals': 0,
    'chainId': 'cosmoshub-4',
    'code': 'cosmoshub',
    'decimals': 6,
    'extensions': {
      'providerOptions': {
        'addressPrefix': 'cosmos',
        'curve': 'secp256k1',
        'gasPriceStep': {
          'min': '0',
        },
        'mainCoinDenom': 'uatom',
      },
    },
    'id': 'cosmos--cosmoshub-4',
    'impl': 'cosmos',
    'isTestnet': false,
    'logoURI': 'https://uni.onekey-asset.com/static/chain/cosmos.png',
    'name': 'Cosmos',
    'shortcode': 'cosmoshub',
    'shortname': 'Cosmos',
    'symbol': 'ATOM',
    'feeMeta': {
      'code': 'cosmoshub',
      'decimals': 6,
      'symbol': 'ATOM',
    },
    'defaultEnabled': true,
    'priceConfigs': [
      {
        'channel': 'coingecko',
        'native': 'cosmos',
      },
      {
        'channel': 'yahoo',
        'native': 'ATOM',
      },
    ],
    'explorers': [
      {
        'address': 'https://www.mintscan.io/cosmos/account/{address}',
        'block': 'https://www.mintscan.io/cosmos/blocks/{block}',
        'name': 'https://www.mintscan.io/cosmos/',
        'transaction': 'https://www.mintscan.io/cosmos/txs/{transaction}',
      },
    ],
    'status': ENetworkStatus.LISTED,
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  };

  const osmosis: IServerNetwork = {
    'balance2FeeDecimals': 0,
    'chainId': 'osmosis-1',
    'code': 'osmosis',
    'decimals': 6,
    'extensions': {
      'providerOptions': {
        'addressPrefix': 'osmo',
        'curve': 'secp256k1',
        'gasPriceStep': {
          'high': '0.04',
          'low': '0.0025',
          'min': '0.0025',
          'normal': '0.025',
        },
        'mainCoinDenom': 'uosmo',
      },
    },
    'id': 'cosmos--osmosis-1',
    'impl': 'cosmos',
    'isTestnet': false,
    'logoURI': 'https://uni.onekey-asset.com/static/chain/osmosis.png',
    'name': 'Osmosis',
    'shortcode': 'osmosis',
    'shortname': 'Osmosis',
    'symbol': 'OSMO',
    'feeMeta': {
      'code': 'osmosis',
      'decimals': 6,
      'symbol': 'OSMO',
    },
    'defaultEnabled': true,
    'priceConfigs': [
      {
        'channel': 'coingecko',
        'native': 'osmosis',
      },
      {
        'channel': 'yahoo',
        'native': 'OSMO',
      },
    ],
    'explorers': [
      {
        'address': 'https://www.mintscan.io/osmosis/account/{address}',
        'block': 'https://www.mintscan.io/osmosis/blocks/{block}',
        'name': 'https://www.mintscan.io/osmosis/',
        'transaction': 'https://www.mintscan.io/osmosis/txs/{transaction}',
      },
    ],
    'status': ENetworkStatus.LISTED,
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  };

  const akash: IServerNetwork = {
    'balance2FeeDecimals': 0,
    'chainId': 'akashnet-2',
    'code': 'akash',
    'decimals': 6,
    'extensions': {
      'providerOptions': {
        'addressPrefix': 'akash',
        'curve': 'secp256k1',
        'gasPriceStep': {
          'min': '0',
        },
        'mainCoinDenom': 'uakt',
      },
    },
    'id': 'cosmos--akashnet-2',
    'impl': 'cosmos',
    'isTestnet': false,
    'logoURI': 'https://uni.onekey-asset.com/static/chain/akash.png',
    'name': 'Akash',
    'shortcode': 'akash',
    'shortname': 'Akash',
    'symbol': 'AKT',
    'feeMeta': {
      'code': 'akash',
      'decimals': 6,
      'symbol': 'AKT',
    },
    'defaultEnabled': true,
    'priceConfigs': [
      {
        'channel': 'coingecko',
        'native': 'akash-network',
      },
      {
        'channel': 'yahoo',
        'native': 'AKT',
      },
    ],
    'explorers': [
      {
        'address': 'https://www.mintscan.io/akash/account/{address}',
        'block': 'https://www.mintscan.io/akash/blocks/{block}',
        'name': 'https://www.mintscan.io/akash/',
        'transaction': 'https://www.mintscan.io/akash/txs/{transaction}',
      },
    ],
    'status': ENetworkStatus.LISTED,
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  };

  const cryptoorgchain: IServerNetwork = {
    'balance2FeeDecimals': 0,
    'chainId': 'crypto-org-chain-mainnet-1',
    'code': 'cryptoorgchain',
    'decimals': 8,
    'extensions': {
      'providerOptions': {
        'addressPrefix': 'cro',
        'curve': 'secp256k1',
        'mainCoinDenom': 'basecro',
        'gasPriceStep': {
          'high': '0.04',
          'low': '0.025',
          'normal': '0.03',
        },
      },
    },
    'id': 'cosmos--crypto-org-chain-mainnet-1',
    'impl': 'cosmos',
    'isTestnet': false,
    'logoURI': 'https://uni.onekey-asset.com/static/chain/cryptoorg.png',
    'name': 'Crypto.org',
    'shortcode': 'cryptoorgchain',
    'shortname': 'Crypto.org',
    'symbol': 'CRO',
    'feeMeta': {
      'code': 'cryptoorgchain',
      'decimals': 8,
      'symbol': 'CRO',
    },
    'defaultEnabled': true,
    'priceConfigs': [
      {
        'channel': 'coingecko',
        'native': 'crypto-com-chain',
      },
      {
        'channel': 'yahoo',
        'native': 'CRO',
      },
    ],
    'explorers': [
      {
        'address': 'https://www.mintscan.io/crypto-org/account/{address}',
        'block': 'https://www.mintscan.io/crypto-org/blocks/{block}',
        'name': 'https://www.mintscan.io/crypto-org/',
        'transaction': 'https://www.mintscan.io/crypto-org/txs/{transaction}',
      },
    ],
    'status': ENetworkStatus.LISTED,
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  };

  const fetchai: IServerNetwork = {
    'balance2FeeDecimals': 0,
    'chainId': 'fetchhub-4',
    'code': 'fetch',
    'decimals': 18,
    'extensions': {
      'providerOptions': {
        'addressPrefix': 'fetch',
        'curve': 'secp256k1',
        'gasPriceStep': {
          'high': '0.035',
          'low': '0.025',
          'normal': '0.025',
        },
        'mainCoinDenom': 'afet',
      },
    },
    'id': 'cosmos--fetchhub-4',
    'impl': 'cosmos',
    'isTestnet': false,
    'logoURI': 'https://uni.onekey-asset.com/static/chain/fetch.png',
    'name': 'Fetch.ai',
    'shortcode': 'fetch',
    'shortname': 'Fetch.ai',
    'symbol': 'FET',
    'feeMeta': {
      'code': 'fetch',
      'decimals': 18,
      'symbol': 'FET',
    },
    'defaultEnabled': true,
    'priceConfigs': [
      {
        'channel': 'coingecko',
        'native': 'fetch-ai',
      },
    ],
    'explorers': [
      {
        'address': 'https://www.mintscan.io/fetchai/account/{address}',
        'block': 'https://www.mintscan.io/fetchai/blocks/{block}',
        'name': 'https://www.mintscan.io/fetchai/',
        'transaction': 'https://www.mintscan.io/fetchai/txs/{transaction}',
      },
    ],
    'status': ENetworkStatus.LISTED,
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  };

  const juno: IServerNetwork = {
    'balance2FeeDecimals': 0,
    'chainId': 'juno-1',
    'code': 'juno',
    'decimals': 6,
    'extensions': {
      'providerOptions': {
        'addressPrefix': 'juno',
        'curve': 'secp256k1',
        'gasPriceStep': {
          'high': '0.125',
          'low': '0.075',
          'min': '0.075',
          'normal': '0.1',
        },
        'mainCoinDenom': 'ujuno',
      },
    },
    'id': 'cosmos--juno-1',
    'impl': 'cosmos',
    'isTestnet': false,
    'logoURI': 'https://uni.onekey-asset.com/static/chain/juno.png',
    'name': 'Juno',
    'shortcode': 'juno',
    'shortname': 'Juno',
    'symbol': 'JUNO',
    'feeMeta': {
      'code': 'juno',
      'decimals': 6,
      'symbol': 'JUNO',
    },
    'defaultEnabled': true,
    'priceConfigs': [
      {
        'channel': 'coingecko',
        'native': 'juno-network',
      },
    ],
    'explorers': [
      {
        'address': 'https://www.mintscan.io/juno/account/{address}',
        'block': 'https://www.mintscan.io/juno/blocks/{block}',
        'name': 'https://www.mintscan.io/juno/',
        'transaction': 'https://www.mintscan.io/juno/txs/{transaction}',
      },
    ],
    'status': ENetworkStatus.LISTED,
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  };

  const secret: IServerNetwork = {
    'balance2FeeDecimals': 0,
    'chainId': 'secret-4',
    'code': 'secretnetwork',
    'decimals': 6,
    'extensions': {
      'providerOptions': {
        'addressPrefix': 'secret',
        'curve': 'secp256k1',
        'gasPriceStep': {
          'min': '0.0125',
          'high': '0.25',
          'low': '0.0125',
          'normal': '0.1',
        },
        'mainCoinDenom': 'uscrt',
      },
    },
    'id': 'cosmos--secret-4',
    'impl': 'cosmos',
    'isTestnet': false,
    'logoURI': 'https://uni.onekey-asset.com/static/chain/secret.png',
    'name': 'Secret Network',
    'shortcode': 'secretnetwork',
    'shortname': 'Secret Network',
    'symbol': 'SCRT',
    'feeMeta': {
      'code': 'secretnetwork',
      'decimals': 6,
      'symbol': 'SCRT',
    },
    'defaultEnabled': true,
    'priceConfigs': [
      {
        'channel': 'coingecko',
        'native': 'secret',
      },
      {
        'channel': 'yahoo',
        'native': 'SCRT',
      },
    ],
    'explorers': [
      {
        'address': 'https://www.mintscan.io/secret/account/{address}',
        'block': 'https://www.mintscan.io/secret/blocks/{block}',
        'name': 'https://www.mintscan.io/secret/',
        'transaction': 'https://www.mintscan.io/secret/txs/{transaction}',
      },
    ],
    'status': ENetworkStatus.LISTED,
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  };

  const celestia: IServerNetwork = {
    'balance2FeeDecimals': 0,
    'chainId': 'celestia',
    'code': 'celestia',
    'decimals': 6,
    'extensions': {
      'providerOptions': {
        'addressPrefix': 'celestia',
        'curve': 'secp256k1',
        'gasPriceStep': {
          'high': '0.1',
          'low': '0.01',
          'min': '0.002',
          'normal': '0.02',
        },
        'mainCoinDenom': 'utia',
      },
    },
    'id': 'cosmos--celestia',
    'impl': 'cosmos',
    'isTestnet': false,
    'logoURI': 'https://uni.onekey-asset.com/static/chain/celestia.png',
    'name': 'Celestia',
    'shortcode': 'celestia',
    'shortname': 'Celestia',
    'symbol': 'Tia',
    'feeMeta': {
      'code': 'tia',
      'decimals': 6,
      'symbol': 'Tia',
    },
    'defaultEnabled': true,
    'priceConfigs': [
      {
        'channel': 'coingecko',
        'native': 'celestia',
      },
    ],
    'explorers': [
      {
        'address': 'https://www.mintscan.io/celestia/account/{address}',
        'block': 'https://www.mintscan.io/celestia/blocks/{block}',
        'name': 'https://www.mintscan.io/celestia/',
        'transaction': 'https://www.mintscan.io/celestia/txs/{transaction}',
      },
    ],
    'status': ENetworkStatus.LISTED,
    'createdAt': '2023-12-05T00:00:24.951Z',
    'updatedAt': '2023-12-05T00:00:24.951Z',
  };

  const polygon: IServerNetwork = {
    'balance2FeeDecimals': 9,
    'chainId': '137',
    'code': 'polygon',
    'decimals': 18,
    'extensions': {
      'defaultStableTokens': [
        '0xc2132d05d31c914a87c6611c10748aeb04b58e8f',
        '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
        '0x9fb83c0635de2e815fd1c21b3a292277540c2e8d',
        '0x8f3cf7ad23cd3cadbd9735aff958023239c6a063',
      ],
      'position': 5,
      'providerOptions': {
        'EIP1559Enabled': true,
        'preferMetamask': true,
      },
    },
    'id': 'evm--137',
    'impl': 'evm',
    'isTestnet': false,
    'logoURI': 'https://uni.onekey-asset.com/static/chain/polygon.png',
    'name': 'Polygon',
    'shortcode': 'polygon',
    'shortname': 'Polygon',
    'symbol': 'MATIC',
    'feeMeta': {
      'code': 'polygon',
      'decimals': 9,
      'symbol': 'Gwei',
    },
    'defaultEnabled': true,
    'priceConfigs': [
      {
        'channel': 'coingecko',
        'native': 'matic-network',
        'platform': 'polygon-pos',
      },
      {
        'channel': 'yahoo',
        'native': 'MATIC',
      },
    ],
    'explorers': [
      {
        'address': 'https://polygonscan.com/address/{address}',
        'block': 'https://polygonscan.com/block/{block}',
        'name': 'https://polygonscan.com/',
        'transaction': 'https://polygonscan.com/tx/{transaction}',
      },
    ],
    'status': ENetworkStatus.LISTED,
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  };

  const bsc: IServerNetwork = {
    'balance2FeeDecimals': 9,
    'chainId': '56',
    'code': 'bsc',
    'decimals': 18,
    'extensions': {
      'defaultStableTokens': [
        '0x55d398326f99059ff775485246999027b3197955',
        '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
        '0xe9e7cea3dedca5984780bafc599bd69add087d56',
        '0x1af3f329e8be154074d8769d1ffa4ee058b1dbc3',
      ],
      'position': 4,
    },
    'id': 'evm--56',
    'impl': 'evm',
    'isTestnet': false,
    'logoURI': 'https://uni.onekey-asset.com/static/chain/bsc.png',
    'name': 'BNB Smart Chain',
    'shortcode': 'bsc',
    'shortname': 'BSC',
    'symbol': 'BNB',
    'feeMeta': {
      'code': 'bsc',
      'decimals': 9,
      'symbol': 'Gwei',
    },
    'defaultEnabled': true,
    'priceConfigs': [
      {
        'channel': 'coingecko',
        'native': 'binancecoin',
        'platform': 'binance-smart-chain',
      },
      {
        'channel': 'yahoo',
        'native': 'BNB',
      },
    ],
    'explorers': [
      {
        'address': 'https://bscscan.com/address/{address}',
        'block': 'https://bscscan.com/block/{block}',
        'name': 'https://bscscan.com/',
        'transaction': 'https://bscscan.com/tx/{transaction}',
      },
    ],
    'status': ENetworkStatus.LISTED,
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  };

  const ftm: IServerNetwork = {
    'balance2FeeDecimals': 9,
    'chainId': '250',
    'code': 'fantom',
    'decimals': 18,
    'extensions': {
      'defaultStableTokens': [
        '0x049d68029688eabf473097a2fc38ef61633a3c7a',
        '0x04068da6c83afcfa0e13ba15a6696662335d5b75',
        '0x8d11ec38a3eb5e956b052f67da8bdc9bef8abf3e',
      ],
      'position': 6,
    },
    'id': 'evm--250',
    'impl': 'evm',
    'isTestnet': false,
    'logoURI': 'https://uni.onekey-asset.com/static/chain/fantom.png',
    'name': 'Fantom',
    'shortcode': 'fantom',
    'shortname': 'FTM',
    'symbol': 'FTM',
    'feeMeta': {
      'code': 'fantom',
      'decimals': 9,
      'symbol': 'Gwei',
    },
    'defaultEnabled': true,
    'priceConfigs': [
      {
        'channel': 'coingecko',
        'native': 'fantom',
        'platform': 'fantom',
      },
      {
        'channel': 'yahoo',
        'native': 'FTM',
      },
    ],
    'explorers': [
      {
        'address': 'https://ftmscan.com/address/{address}',
        'block': 'https://ftmscan.com/block/{block}',
        'name': 'https://ftmscan.com/',
        'transaction': 'https://ftmscan.com/tx/{transaction}',
      },
    ],
    'status': ENetworkStatus.LISTED,
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  };

  const arb: IServerNetwork = {
    'balance2FeeDecimals': 9,
    'chainId': '42161',
    'code': 'arbitrum',
    'decimals': 18,
    'extensions': {
      'defaultStableTokens': [
        '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9',
        '0xff970a61a04b1ca14834a43f5de4533ebddb5cc8',
        '0xda10009cbd5d07dd0cecc66161fc93d7c9000da1',
      ],
      'position': 7,
    },
    'id': 'evm--42161',
    'impl': 'evm',
    'isTestnet': false,
    'logoURI': 'https://uni.onekey-asset.com/static/chain/arbitrum.png',
    'name': 'Arbitrum',
    'shortcode': 'arbitrum',
    'shortname': 'Arbitrum',
    'symbol': 'ETH',
    'feeMeta': {
      'code': 'arbitrum',
      'decimals': 9,
      'symbol': 'Gwei',
    },
    'defaultEnabled': true,
    'priceConfigs': [
      {
        'channel': 'coingecko',
        'native': 'ethereum',
        'platform': 'arbitrum-one',
      },
      {
        'channel': 'yahoo',
        'native': 'ETH',
      },
    ],
    'explorers': [
      {
        'address': 'https://arbiscan.io/address/{address}',
        'block': 'https://arbiscan.io/block/{block}',
        'name': 'https://arbiscan.io/',
        'transaction': 'https://arbiscan.io/tx/{transaction}',
      },
    ],
    'status': ENetworkStatus.LISTED,
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  };

  const avax: IServerNetwork = {
    'balance2FeeDecimals': 9,
    'chainId': '43114',
    'code': 'avalanche',
    'decimals': 18,
    'extensions': {
      'defaultStableTokens': [
        '0xc7198437980c041c805a1edcba50c1ce5db95118',
        '0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e',
        '0x19860ccb0a68fd4213ab9d8266f7bbf05a8dde98',
        '0xd586e7f844cea2f87f50152665bcbc2c279d8d70',
      ],
      'position': 8,
    },
    'id': 'evm--43114',
    'impl': 'evm',
    'isTestnet': false,
    'logoURI': 'https://uni.onekey-asset.com/static/chain/avalanche.png',
    'name': 'Avalanche',
    'shortcode': 'avalanche',
    'shortname': 'Avalanche',
    'symbol': 'AVAX',
    'feeMeta': {
      'code': 'avalanche',
      'decimals': 9,
      'symbol': 'Gwei',
    },
    'defaultEnabled': true,
    'priceConfigs': [
      {
        'channel': 'coingecko',
        'native': 'avalanche-2',
        'platform': 'avalanche',
      },
      {
        'channel': 'yahoo',
        'native': 'AVAX',
      },
    ],
    'explorers': [
      {
        'address': 'https://cchain.explorer.avax.network/address/{address}',
        'block': 'https://cchain.explorer.avax.network/blocks/{block}',
        'name': 'https://cchain.explorer.avax.network/',
        'transaction': 'https://cchain.explorer.avax.network/tx/{transaction}',
      },
    ],
    'status': ENetworkStatus.LISTED,
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  };

  const heco: IServerNetwork = {
    'balance2FeeDecimals': 9,
    'chainId': '128',
    'code': 'heco',
    'decimals': 18,
    'extensions': {
      'defaultStableTokens': [
        '0xa71edc38d189767582c38a3145b5873052c3e47a',
        '0x0298c2b32eae4da002a15f36fdf7615bea3da047',
      ],
      'position': 9,
    },
    'id': 'evm--128',
    'impl': 'evm',
    'isTestnet': false,
    'logoURI': 'https://uni.onekey-asset.com/static/chain/heco.png',
    'name': 'Huobi ECO Chain',
    'shortcode': 'heco',
    'shortname': 'HECO',
    'symbol': 'HT',
    'feeMeta': {
      'code': 'heco',
      'decimals': 9,
      'symbol': 'Gwei',
    },
    'defaultEnabled': true,
    'priceConfigs': [
      {
        'channel': 'coingecko',
        'native': 'huobi-token',
        'platform': 'huobi-token',
      },
    ],
    'explorers': [
      {
        'address': 'https://hecoinfo.com/address/{address}',
        'block': 'https://hecoinfo.com/block/{block}',
        'name': 'https://hecoinfo.com/',
        'transaction': 'https://hecoinfo.com/tx/{transaction}',
      },
    ],
    'status': ENetworkStatus.LISTED,
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  };

  const okt: IServerNetwork = {
    'balance2FeeDecimals': 9,
    'chainId': '66',
    'code': 'okt',
    'decimals': 18,
    'extensions': {
      'defaultStableTokens': [
        '0x382bb369d343125bfb2117af9c149795c6c65c50',
        '0xc946daf81b08146b1c7a8da2a851ddf2b3eaaf85',
        '0x332730a4f6e03d9c55829435f10360e13cfa41ff',
      ],
      'position': 10,
    },
    'id': 'evm--66',
    'impl': 'evm',
    'isTestnet': false,
    'logoURI': 'https://uni.onekey-asset.com/static/chain/okx-chain.png',
    'name': 'OKX Chain',
    'shortcode': 'okt',
    'shortname': 'OKC',
    'symbol': 'OKT',
    'feeMeta': {
      'code': 'okt',
      'decimals': 9,
      'symbol': 'Gwei',
    },
    'defaultEnabled': true,
    'priceConfigs': [
      {
        'channel': 'coingecko',
        'native': 'oec-token',
        'platform': 'okex-chain',
      },
    ],
    'explorers': [
      {
        'address': 'https://www.oklink.com/okexchain/address/{address}',
        'block': 'https://www.oklink.com/okexchain/block/{block}',
        'name': 'https://www.oklink.com/okexchain/',
        'transaction': 'https://www.oklink.com/okexchain/tx/{transaction}',
      },
    ],
    'status': ENetworkStatus.LISTED,
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  };

  const op: IServerNetwork = {
    'balance2FeeDecimals': 9,
    'chainId': '10',
    'code': 'optimism',
    'decimals': 18,
    'extensions': {
      'defaultStableTokens': [
        '0x94b008aa00579c1307b0ef2c499ad98a8ce58e58',
        '0x7f5c764cbc14f9669b88837ca1490cca17c31607',
        '0xda10009cbd5d07dd0cecc66161fc93d7c9000da1',
      ],
      'position': 11,
      'providerOptions': {
        'contract_gaslimit_multiplier': 1,
      },
    },
    'id': 'evm--10',
    'impl': 'evm',
    'isTestnet': false,
    'logoURI': 'https://uni.onekey-asset.com/static/chain/optimism.png',
    'name': 'Optimism',
    'shortcode': 'optimism',
    'shortname': 'Optimism',
    'symbol': 'ETH',
    'feeMeta': {
      'code': 'optimism',
      'decimals': 9,
      'symbol': 'Gwei',
    },
    'defaultEnabled': true,
    'priceConfigs': [
      {
        'channel': 'coingecko',
        'native': 'ethereum',
        'platform': 'optimistic-ethereum',
      },
      {
        'channel': 'yahoo',
        'native': 'ETH',
      },
    ],
    'explorers': [
      {
        'address': 'https://optimistic.etherscan.io/address/{address}',
        'block': 'https://optimistic.etherscan.io/tx/{block}',
        'name': 'https://optimistic.etherscan.io/',
        'transaction': 'https://optimistic.etherscan.io/tx/{transaction}',
      },
    ],
    'status': ENetworkStatus.LISTED,
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  };

  const xdai: IServerNetwork = {
    'balance2FeeDecimals': 9,
    'chainId': '100',
    'code': 'xdai',
    'decimals': 18,
    'extensions': {
      'defaultStableTokens': [
        '0xddafbb505ad214d7b80b1f830fccc89b60fb7a83',
        '0x3f56e0c36d275367b8c502090edf38289b3dea0d',
      ],
      'position': 12,
    },
    'id': 'evm--100',
    'impl': 'evm',
    'isTestnet': false,
    'logoURI': 'https://uni.onekey-asset.com/static/chain/gno.png',
    'name': 'Gnosis Chain',
    'shortcode': 'xdai',
    'shortname': 'GNO',
    'symbol': 'xDAI',
    'feeMeta': {
      'code': 'xdai',
      'decimals': 9,
      'symbol': 'Gwei',
    },
    'defaultEnabled': true,
    'priceConfigs': [
      {
        'channel': 'coingecko',
        'native': 'xdai',
        'platform': 'xdai',
      },
      {
        'channel': 'yahoo',
        'native': 'DAI1',
      },
    ],
    'explorers': [
      {
        'address': 'https://gnosisscan.io/address/{address}',
        'block': 'https://gnosisscan.io/block/{block}',
        'name': 'https://gnosisscan.io/',
        'transaction': 'https://gnosisscan.io/tx/{transaction}',
      },
    ],
    'status': ENetworkStatus.LISTED,
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  };

  const celo: IServerNetwork = {
    'balance2FeeDecimals': 9,
    'chainId': '42220',
    'code': 'celo',
    'decimals': 18,
    'extensions': {
      'defaultStableTokens': ['0xb9c8f0d3254007ee4b98970b94544e473cd610ec'],
      'position': 16,
    },
    'id': 'evm--42220',
    'impl': 'evm',
    'isTestnet': false,
    'logoURI': 'https://uni.onekey-asset.com/static/chain/celo.png',
    'name': 'Celo',
    'shortcode': 'celo',
    'shortname': 'CELO',
    'symbol': 'CELO',
    'feeMeta': {
      'code': 'celo',
      'decimals': 9,
      'symbol': 'Gwei',
    },
    'defaultEnabled': true,
    'priceConfigs': [
      {
        'channel': 'coingecko',
        'native': 'celo',
        'platform': 'celo',
      },
      {
        'channel': 'yahoo',
        'native': 'CELO',
      },
    ],
    'explorers': [
      {
        'address': 'https://explorer.celo.org/address/{address}',
        'block': 'https://explorer.celo.org/blocks/{block}',
        'name': 'https://explorer.celo.org/',
        'transaction': 'https://explorer.celo.org/tx/{transaction}',
      },
    ],
    'status': ENetworkStatus.LISTED,
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  };

  const base: IServerNetwork = {
    'chainId': '8453',
    'code': 'base',
    'id': 'evm--8453',
    'logoURI': 'https://uni.onekey-asset.com/static/chain/base.png',
    'name': 'Base',
    'shortcode': 'base',
    'shortname': 'Base',
    'feeMeta': {
      'code': 'base',
      'decimals': 9,
      'symbol': 'Gwei',
    },
    'explorers': [
      {
        'address': 'https://basescan.org/address/{address}',
        'block': 'https://basescan.org/block/{block}',
        'name': 'https://basescan.org/',
        'transaction': 'https://basescan.org/tx/{transaction}',
      },
    ],
    'priceConfigs': [
      {
        'channel': 'coingecko',
        'native': 'ethereum',
        'platform': 'ethereum',
      },
    ],
    'symbol': 'ETH',
    'decimals': 18,
    'balance2FeeDecimals': 9,
    'impl': 'evm',
    'isTestnet': false,
    'defaultEnabled': true,
    'status': ENetworkStatus.LISTED,
    'createdAt': '2023-08-10T00:29:24.951Z',
    'updatedAt': '2023-08-10T00:29:24.951Z',
  };

  const aurora: IServerNetwork = {
    'balance2FeeDecimals': 9,
    'chainId': '1313161554',
    'code': 'aurora',
    'decimals': 18,
    'id': 'evm--1313161554',
    'impl': 'evm',
    'isTestnet': false,
    'logoURI': 'https://uni.onekey-asset.com/static/chain/aurora.png',
    'name': 'Aurora',
    'shortcode': 'aurora',
    'shortname': 'Aurora',
    'symbol': 'ETH',
    'feeMeta': {
      'code': 'aurora',
      'decimals': 9,
      'symbol': 'Gwei',
    },
    'defaultEnabled': true,
    'priceConfigs': [
      {
        'channel': 'coingecko',
        'native': 'ethereum',
        'platform': 'aurora',
      },
    ],
    'explorers': [
      {
        'address': 'https://aurorascan.dev/address/{address}',
        'block': 'https://aurorascan.dev/block/{block}',
        'name': 'https://aurorascan.dev/',
        'transaction': 'https://aurorascan.dev/tx/{transaction}',
      },
    ],
    'status': ENetworkStatus.LISTED,
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  };

  const boba: IServerNetwork = {
    'balance2FeeDecimals': 9,
    'chainId': '288',
    'code': 'boba',
    'decimals': 18,
    'id': 'evm--288',
    'impl': 'evm',
    'isTestnet': false,
    'logoURI': 'https://uni.onekey-asset.com/static/chain/boba_1.png',
    'name': 'Boba Network',
    'shortcode': 'boba',
    'shortname': 'Boba',
    'symbol': 'ETH',
    'feeMeta': {
      'code': 'boba',
      'decimals': 9,
      'symbol': 'Gwei',
    },
    'defaultEnabled': true,
    'priceConfigs': [
      {
        'channel': 'coingecko',
        'native': 'ethereum',
        'platform': 'boba',
      },
      {
        'channel': 'yahoo',
        'native': 'ETH',
      },
    ],
    'explorers': [
      {
        'address': 'https://blockexplorer.boba.network/address/{address}',
        'block': 'https://blockexplorer.boba.network/block/{block}',
        'name': 'https://blockexplorer.boba.network/',
        'transaction': 'https://blockexplorer.boba.network/tx/{transaction}',
      },
    ],
    'status': ENetworkStatus.LISTED,
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  };

  const cfxespace: IServerNetwork = {
    'balance2FeeDecimals': 9,
    'chainId': '1030',
    'code': 'cfxespace',
    'decimals': 18,
    'id': 'evm--1030',
    'impl': 'evm',
    'isTestnet': false,
    'logoURI': 'https://uni.onekey-asset.com/static/chain/conflux-espace.png',
    'name': 'Conflux eSpace',
    'shortcode': 'cfxespace',
    'shortname': 'CFXESPACE',
    'symbol': 'CFX',
    'feeMeta': {
      'code': 'cfxespace',
      'decimals': 9,
      'symbol': 'Gwei',
    },
    'defaultEnabled': true,
    'priceConfigs': [],
    'explorers': [
      {
        'address': 'https://evm.confluxscan.net/address/{address}',
        'block': 'https://evm.confluxscan.net/block/{block}',
        'name': 'https://evm.confluxscan.net/',
        'transaction': 'https://evm.confluxscan.net/tx/{transaction}',
      },
    ],
    'status': ENetworkStatus.LISTED,
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  };

  const cronos: IServerNetwork = {
    'balance2FeeDecimals': 9,
    'chainId': '25',
    'code': 'cronos',
    'decimals': 18,
    'extensions': {
      'defaultStableTokens': [
        '0x66e428c3f67a68878562e79a0234c1f83c208770',
        '0xc21223249ca28397b4b6541dffaecc539bff0c59',
        '0x6ab6d61428fde76768d7b45d8bfeec19c6ef91a8',
        '0xf2001b145b43032aaf5ee2884e456ccd805f677d',
        '0x2ae35c8e3d4bd57e8898ff7cd2bbff87166ef8cb',
      ],
    },
    'id': 'evm--25',
    'impl': 'evm',
    'isTestnet': false,
    'logoURI': 'https://uni.onekey-asset.com/static/chain/cronos.png',
    'name': 'Cronos',
    'shortcode': 'cronos',
    'shortname': 'CRO',
    'symbol': 'CRO',
    'feeMeta': {
      'code': 'cronos',
      'decimals': 9,
      'symbol': 'Gwei',
    },
    'defaultEnabled': true,
    'priceConfigs': [
      {
        'channel': 'coingecko',
        'native': 'crypto-com-chain',
        'platform': 'cronos',
      },
      {
        'channel': 'yahoo',
        'native': 'CRO',
      },
    ],
    'explorers': [
      {
        'address': 'https://cronos.crypto.org/explorer/address/{address}',
        'block': 'https://cronos.crypto.org/explorer/block/{block}',
        'name': 'https://cronos.crypto.org/explorer/',
        'transaction': 'https://cronos.crypto.org/explorer/tx/{transaction}',
      },
    ],
    'status': ENetworkStatus.LISTED,
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  };

  const etc = {
    'balance2FeeDecimals': 9,
    'chainId': '61',
    'code': 'etc',
    'decimals': 18,
    'id': 'evm--61',
    'impl': 'evm',
    'isTestnet': false,
    'logoURI': 'https://uni.onekey-asset.com/static/chain/etc.png',
    'name': 'Ethereum Classic',
    'shortcode': 'etc',
    'shortname': 'ETC',
    'symbol': 'ETC',
    'feeMeta': {
      'code': 'etc',
      'decimals': 9,
      'symbol': 'Gwei',
    },
    'defaultEnabled': true,
    'priceConfigs': [
      {
        'channel': 'coingecko',
        'native': 'ethereum-classic ',
      },
    ],
    'explorers': [
      {
        'address': 'https://blockscout.com/etc/mainnet/address/{address}',
        'block': 'https://blockscout.com/etc/mainnet/block/{block}',
        'name': 'https://blockscout.com/etc/mainnet/',
        'transaction': 'https://blockscout.com/etc/mainnet/tx/{transaction}',
      },
    ],
    'status': ENetworkStatus.LISTED,
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  };

  const dis = {
    'balance2FeeDecimals': 9,
    'chainId': '513100',
    'code': 'dis',
    'decimals': 18,
    'extensions': {
      'providerOptions': {
        'EIP1559Enabled': true,
      },
    },
    'id': 'evm--513100',
    'impl': 'evm',
    'isTestnet': false,
    'logoURI': 'https://uni.onekey-asset.com/static/chain/etf.png',
    'name': 'DIS CHAIN',
    'shortcode': 'dis',
    'shortname': 'DIS',
    'symbol': 'DIS',
    'feeMeta': {
      'code': 'dis',
      'decimals': 9,
      'symbol': 'Gwei',
    },
    'priceConfigs': [],
    'defaultEnabled': true,
    'explorers': [
      {
        'address': 'https://scan.dischain.xyz/address/{address}',
        'block': 'https://scan.dischain.xyz/block/{block}',
        'name': 'https://scan.dischain.xyz',
        'transaction': 'https://scan.dischain.xyz/tx/{transaction}',
      },
    ],
    'status': ENetworkStatus.LISTED,
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  };

  const ethw: IServerNetwork = {
    'balance2FeeDecimals': 9,
    'chainId': '10001',
    'code': 'ethw',
    'decimals': 18,
    'extensions': {
      'providerOptions': {
        'EIP1559Enabled': true,
      },
    },
    'id': 'evm--10001',
    'impl': 'evm',
    'isTestnet': false,
    'logoURI': 'https://uni.onekey-asset.com/static/chain/ethw.png',
    'name': 'EthereumPoW',
    'shortcode': 'ethw',
    'shortname': 'ETHW',
    'symbol': 'ETHW',
    'feeMeta': {
      'code': 'ethw',
      'decimals': 9,
      'symbol': 'Gwei',
    },
    'defaultEnabled': true,
    'priceConfigs': [
      {
        'channel': 'coingecko',
        'native': 'ethereum-pow-iou',
      },
    ],
    'explorers': [
      {
        'address': 'https://www.oklink.com/ethw/address/{address}',
        'block': 'https://www.oklink.com/ethw/block/{block}',
        'name': 'https://www.oklink.com/ethw/',
        'transaction': 'https://www.oklink.com/ethw/tx/{transaction}',
      },
    ],
    'status': ENetworkStatus.LISTED,
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  };

  const linea: IServerNetwork = {
    'chainId': '59144',
    'code': 'linea',
    'id': 'evm--59144',
    'logoURI': 'https://uni.onekey-asset.com/static/chain/linea.png',
    'name': 'Linea',
    'shortcode': 'linea',
    'shortname': 'Linea',
    'feeMeta': {
      'code': 'Linea',
      'decimals': 9,
      'symbol': 'Gwei',
    },
    'explorers': [
      {
        'address': 'https://lineascan.build/address/{address}',
        'block': 'https://lineascan.build/block/{block}',
        'name': 'https://lineascan.build/',
        'transaction': 'https://lineascan.build/tx/{transaction}',
      },
    ],
    'priceConfigs': [
      {
        'channel': 'coingecko',
        'native': 'ethereum',
        'platform': 'ethereum',
      },
    ],
    'symbol': 'ETH',
    'decimals': 18,
    'balance2FeeDecimals': 9,
    'impl': 'evm',
    'isTestnet': false,
    'defaultEnabled': true,
    'status': ENetworkStatus.LISTED,
    'createdAt': '2023-08-10T00:29:24.951Z',
    'updatedAt': '2023-08-10T00:29:24.951Z',
  };

  const mnt: IServerNetwork = {
    'chainId': '5000',
    'code': 'mantle',
    'id': 'evm--5000',
    'logoURI': 'https://uni.onekey-asset.com/static/chain/mantle.png',
    'name': 'Mantle',
    'shortcode': 'mantle',
    'shortname': 'Mantle',
    'feeMeta': {
      'code': 'mantle',
      'decimals': 9,
      'symbol': 'Gwei',
    },
    'symbol': 'MNT',
    'priceConfigs': [
      {
        'channel': 'coingecko',
        'native': 'mantle',
      },
    ],
    'explorers': [
      {
        'address': 'https://explorer.mantle.xyz/address/{address}',
        'block': 'https://explorer.mantle.xyz/block/{block}',
        'name': 'https://explorer.mantle.xyz/',
        'transaction': 'https://explorer.mantle.xyz/tx/{transaction}',
      },
    ],
    'decimals': 18,
    'balance2FeeDecimals': 9,
    'impl': 'evm',
    'isTestnet': false,
    'defaultEnabled': true,
    'status': ENetworkStatus.LISTED,
    'createdAt': '2023-08-10T00:29:24.951Z',
    'updatedAt': '2023-08-10T00:29:24.951Z',
  };

  const mvm: IServerNetwork = {
    'balance2FeeDecimals': 9,
    'chainId': '73927',
    'code': 'mvm',
    'decimals': 18,
    'id': 'evm--73927',
    'impl': 'evm',
    'isTestnet': false,
    'logoURI':
      'https://uni.onekey-asset.com/static/chain/mixin-virtual-machine.png',
    'name': 'Mixin Virtual Machine',
    'shortcode': 'mvm',
    'shortname': 'MVM',
    'symbol': 'ETH',
    'feeMeta': {
      'code': 'mvm',
      'decimals': 9,
      'symbol': 'Gwei',
    },
    'defaultEnabled': true,
    'priceConfigs': [],
    'explorers': [
      {
        'address': 'https://scan.mvm.dev/address/{address}',
        'block': 'https://scan.mvm.dev/block/{block}',
        'name': 'https://scan.mvm.dev',
        'transaction': 'https://scan.mvm.dev/tx/{transaction}',
      },
    ],
    'status': ENetworkStatus.LISTED,
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  };

  const fevm: IServerNetwork = {
    'balance2FeeDecimals': 9,
    'chainId': '314',
    'code': 'fevm',
    'decimals': 18,
    'extensions': {
      'providerOptions': {
        'EIP1559Enabled': true,
        'preferMetamask': true,
      },
    },
    'id': 'evm--314',
    'impl': 'evm',
    'isTestnet': false,
    'logoURI': 'https://uni.onekey-asset.com/static/chain/filecoin-fevm.png',
    'name': 'Filecoin FEVM',
    'shortcode': 'fevm',
    'shortname': 'FEVM',
    'symbol': 'FIL',
    'feeMeta': {
      'code': 'fevm',
      'decimals': 9,
      'symbol': 'Gwei',
    },
    'defaultEnabled': true,
    'priceConfigs': [
      {
        'channel': 'coingecko',
        'native': 'filecoin',
      },
    ],
    'explorers': [
      {
        'address': 'https://filfox.info/en/address/{address}',
        'block': 'https://filfox.info/en/block/{block}',
        'name': 'https://filfox.info/en/',
        'transaction': 'https://filfox.info/en/tx/{transaction}',
      },
    ],
    'status': ENetworkStatus.LISTED,
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  };

  const lightning = {
    'balance2FeeDecimals': 0,
    'chainId': '0',
    'code': 'lightning',
    'decimals': 0,
    'extensions': {
      'position': 2,
    },
    'id': 'lightning--0',
    'impl': 'lightning',
    'isTestnet': false,
    'logoURI': 'https://uni.onekey-asset.com/static/chain/lnd.png',
    'name': 'Lightning Network',
    'shortcode': 'lightning',
    'shortname': 'Lightning',
    'symbol': 'sats',
    'feeMeta': {
      'code': 'lightning',
      'decimals': 0,
      'symbol': 'sats',
    },
    'defaultEnabled': true,
    'priceConfigs': [
      {
        'channel': 'coingecko',
        'native': 'bitcoin',
        'platform': 'ordinals',
      },
    ],
    'explorers': [],
    'status': ENetworkStatus.LISTED,
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  };
  const tlightning = {
    'balance2FeeDecimals': 0,
    'chainId': '0',
    'code': 'tlightning',
    'decimals': 0,
    'id': 'tlightning--0',
    'impl': 'tlightning',
    'isTestnet': true,
    'logoURI':
      'https://uni.onekey-asset.com/static/chain/lightning-network-testnet.png',
    'name': 'Lightning Network Testnet',
    'shortcode': 'tlightning',
    'shortname': 'LightningTestnet',
    'symbol': 'sats',
    'feeMeta': {
      'code': 'lightning',
      'decimals': 0,
      'symbol': 'sats',
    },
    'defaultEnabled': false,
    'priceConfigs': [
      {
        'channel': 'coingecko',
        'native': 'bitcoin',
      },
    ],
    'explorers': [],
    'status': ENetworkStatus.LISTED,
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  };

  const algo = {
    'balance2FeeDecimals': 0,
    'chainId': '4160',
    'code': 'algo',
    'decimals': 6,
    'extensions': {
      'position': 15,
    },
    'id': 'algo--4160',
    'impl': 'algo',
    'isTestnet': false,
    'logoURI': 'https://uni.onekey-asset.com/static/chain/algo.png',
    'name': 'Algorand',
    'shortcode': 'algo',
    'shortname': 'ALGO',
    'symbol': 'ALGO',
    'feeMeta': {
      'code': 'algo',
      'decimals': 6,
      'symbol': 'ALGO',
    },
    'defaultEnabled': true,
    'priceConfigs': [
      {
        'channel': 'coingecko',
        'native': 'algorand',
        'platform': 'algorand',
      },
      {
        'channel': 'yahoo',
        'native': 'ALGO',
      },
    ],
    'explorers': [
      {
        'address': 'https://allo.info/account/{address}',
        'block': 'https://allo.info/block/{block}',
        'name': 'https://allo.info',
        'transaction': 'https://allo.info/tx/{transaction}',
      },
    ],
    'status': ENetworkStatus.LISTED,
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  };

  const cardano = {
    'balance2FeeDecimals': 6,
    'chainId': '0',
    'code': 'ada',
    'decimals': 6,
    'id': 'ada--0',
    'impl': 'ada',
    'isTestnet': false,
    'logoURI': 'https://uni.onekey-asset.com/static/chain/ada.png',
    'name': 'Cardano',
    'shortcode': 'ada',
    'shortname': 'Cardano',
    'symbol': 'ADA',
    'feeMeta': {
      'code': 'ada',
      'decimals': 6,
      'symbol': 'ada',
    },
    'defaultEnabled': true,
    'priceConfigs': [
      {
        'channel': 'coingecko',
        'native': 'cardano',
        'platform': 'cardano',
      },
    ],
    'explorers': [
      {
        'address': 'https://cardanoscan.io/address/{address}',
        'block': 'https://cardanoscan.io/block/{block}',
        'name': 'https://cardanoscan.io/',
        'transaction': 'https://cardanoscan.io/transaction/{transaction}',
      },
    ],
    'status': ENetworkStatus.LISTED,
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  };

  const nostr = {
    id: 'nostr--0',
    impl: 'nostr',
    chainId: '0',
    code: 'nostr',
    defaultEnabled: true,
    isTestnet: false,
    priceConfigs: [],
    explorers: [],
    rpcURLs: [],
    feeMeta: {
      symbol: 'nostr',
      decimals: 0,
      code: 'nostr',
    },
    balance2FeeDecimals: 0,
    decimals: 0,
    'status': ENetworkStatus.LISTED,
    name: 'Nostr',
    symbol: 'Nostr',
    shortname: 'Nostr',
    shortcode: 'nostr',
    extensions: {},
    clientApi: {},
    logoURI: 'https://uni.onekey-asset.com/static/chain/nostr.png',
  } as unknown as IServerNetwork;

  const ripple = {
    'balance2FeeDecimals': 6,
    'chainId': '0',
    'code': 'xrp',
    'decimals': 6,
    'id': 'xrp--0',
    'impl': 'xrp',
    'isTestnet': false,
    'logoURI': 'https://uni.onekey-asset.com/static/chain/xrp.png',
    'name': 'Ripple',
    'shortcode': 'xrp',
    'shortname': 'Ripple',
    'symbol': 'XRP',
    'feeMeta': {
      'code': 'xrp',
      'decimals': 6,
      'symbol': 'xrp',
      'native': 'ripple',
    },
    'defaultEnabled': true,
    'priceConfigs': [
      {
        'channel': 'coingecko',
        'native': 'ripple',
      },
    ],
    'explorers': [
      {
        'address': 'https://xrpscan.com/account/{address}',
        'block': 'https://xrpscan.com/ledger/{block}',
        'name': 'https://xrpscan.com/',
        'transaction': 'https://xrpscan.com/tx/{transaction}',
      },
    ],
    'status': ENetworkStatus.LISTED,
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  };

  const tron = {
    'balance2FeeDecimals': 0,
    'chainId': '0x2b6653dc',
    'code': 'trx',
    'decimals': 6,
    'id': 'tron--0x2b6653dc',
    'impl': 'tron',
    'isTestnet': false,
    'logoURI': 'https://uni.onekey-asset.com/static/chain/tron.png',
    'name': 'Tron',
    'shortcode': 'trx',
    'shortname': 'TRX',
    'symbol': 'TRX',
    'feeMeta': {
      'code': 'trx',
      'decimals': 6,
      'symbol': 'TRX',
    },
    'defaultEnabled': true,
    'priceConfigs': [
      {
        'channel': 'coingecko',
        'native': 'tron',
        'platform': 'tron',
      },
    ],
    'explorers': [
      {
        'address': 'https://tronscan.org/#/address/{address}',
        'block': 'https://tronscan.org/#/block/{block}',
        'name': 'https://tronscan.org/',
        'transaction': 'https://tronscan.org/#/transaction/{transaction}',
      },
    ],
    'status': ENetworkStatus.LISTED,
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  };

  const near = {
    'balance2FeeDecimals': 0,
    'chainId': '0',
    'code': 'near',
    'decimals': 24,
    'id': 'near--0',
    'impl': 'near',
    'isTestnet': false,
    'logoURI': 'https://uni.onekey-asset.com/static/chain/near.png',
    'name': 'Near',
    'shortcode': 'near',
    'shortname': 'Near',
    'symbol': 'NEAR',
    'feeMeta': {
      'code': 'near',
      'decimals': 24,
      'symbol': 'NEAR',
    },
    'defaultEnabled': true,
    'priceConfigs': [
      {
        'channel': 'coingecko',
        'native': 'near',
      },
      {
        'channel': 'yahoo',
        'native': 'NEAR',
      },
    ],
    'explorers': [
      {
        'address': 'https://nearblocks.io/address/{address}',
        'block': 'https://nearblocks.io/blocks/{block}',
        'name': 'https://nearblocks.io',
        'transaction': 'https://nearblocks.io/txns/{transaction}',
      },
    ],
    'status': ENetworkStatus.LISTED,
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  };

  const sol = {
    'balance2FeeDecimals': 0,
    'chainId': '101',
    'code': 'sol',
    'decimals': 9,
    'extensions': {
      'defaultStableTokens': [
        'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        'FR87nWEUxVgerFGhZM8Y4AggKGLnaXswr1Pd8wZ4kZcp',
        '9mWRABuz2x6koTPCWiCPM49WUbcrNqGTHBV9T9k7y1o7',
      ],
      'position': 4,
    },
    'id': 'sol--101',
    'impl': 'sol',
    'isTestnet': false,
    'logoURI': 'https://uni.onekey-asset.com/static/chain/sol.png',
    'name': 'Solana',
    'shortcode': 'sol',
    'shortname': 'SOL',
    'symbol': 'SOL',
    'feeMeta': {
      'code': 'sol',
      'decimals': 9,
      'symbol': 'SOL',
    },
    'defaultEnabled': true,
    'priceConfigs': [
      {
        'channel': 'coingecko',
        'native': 'solana',
        'platform': 'solana',
      },
      {
        'channel': 'yahoo',
        'native': 'SOL1',
      },
    ],
    'explorers': [
      {
        'address': 'https://explorer.solana.com/address/{address}',
        'block': 'https://explorer.solana.com/block/{block}',
        'name': 'https://explorer.solana.com/',
        'transaction': 'https://explorer.solana.com/tx/{transaction}',
      },
    ],
    'status': ENetworkStatus.LISTED,
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  };

  const polkadot: IServerNetwork = {
    'balance2FeeDecimals': 10,
    'chainId': 'polkadot',
    'code': 'dot',
    'decimals': 10,
    'extensions': {
      'providerOptions': {
        'addressPrefix': '0',
        'addressRegex': '^1[a-km-zA-HJ-NP-Z1-9]+$',
      },
    },
    'id': 'dot--polkadot',
    'impl': 'dot',
    'isTestnet': false,
    'logoURI': 'https://uni.onekey-asset.com/static/chain/polkadot.png',
    'name': 'Polkadot',
    'shortcode': 'dot',
    'shortname': 'DOT',
    'symbol': 'DOT',
    'feeMeta': {
      'code': 'dot',
      'decimals': 10,
      'symbol': 'DOT',
    },
    'defaultEnabled': true,
    'priceConfigs': [
      {
        'channel': 'coingecko',
        'native': 'polkadot',
      },
    ],
    'explorers': [
      {
        'address': 'https://polkadot.subscan.io/account/{address}',
        'block': 'https://polkadot.subscan.io/block/{block}',
        'name': 'https://polkadot.subscan.io/',
        'transaction': 'https://polkadot.subscan.io/extrinsic/{transaction}',
      },
    ],
    'status': ENetworkStatus.LISTED,
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  };

  const astar: IServerNetwork = {
    'balance2FeeDecimals': 18,
    'chainId': 'astar',
    'code': 'astar',
    'decimals': 18,
    'extensions': {
      'providerOptions': {
        'addressPrefix': '5',
        'addressRegex': '^[a-bV-Z][a-km-zA-HJ-NP-Z1-9]+$',
      },
    },
    'id': 'dot--astar',
    'impl': 'dot',
    'isTestnet': false,
    'logoURI': 'https://uni.onekey-asset.com/static/chain/astar.png',
    'name': 'Astar',
    'shortcode': 'astar',
    'shortname': 'ASTR',
    'symbol': 'ASTR',
    'feeMeta': {
      'code': 'astar',
      'decimals': 18,
      'symbol': '18',
    },
    'defaultEnabled': true,
    'priceConfigs': [
      {
        'channel': 'coingecko',
        'native': 'astar',
      },
    ],
    'explorers': [
      {
        'address': 'https://astar.subscan.io/account/{address}',
        'block': 'https://astar.subscan.io/block/{block}',
        'name': 'https://astar.subscan.io/',
        'transaction': 'https://astar.subscan.io/extrinsic/{transaction}',
      },
    ],
    'status': ENetworkStatus.LISTED,
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  };

  const kusama: IServerNetwork = {
    'balance2FeeDecimals': 12,
    'chainId': 'kusama',
    'code': 'ksm',
    'decimals': 12,
    'extensions': {
      'providerOptions': {
        'addressPrefix': '2',
        'addressRegex': '^[C-HJ][a-km-zA-HJ-NP-Z1-9]+$',
      },
    },
    'id': 'dot--kusama',
    'impl': 'dot',
    'isTestnet': false,
    'logoURI': 'https://uni.onekey-asset.com/static/chain/kusama.png',
    'name': 'Kusama',
    'shortcode': 'ksm',
    'shortname': 'KSM',
    'symbol': 'KSM',
    'feeMeta': {
      'code': 'dot',
      'decimals': 12,
      'symbol': 'KSM',
    },
    'defaultEnabled': true,
    'priceConfigs': [
      {
        'channel': 'coingecko',
        'native': 'kusama',
      },
    ],
    'explorers': [
      {
        'address': 'https://kusama.subscan.io/account/{address}',
        'block': 'https://kusama.subscan.io/block/{block}',
        'name': 'https://kusama.subscan.io/',
        'transaction': 'https://kusama.subscan.io/extrinsic/{transaction}',
      },
    ],
    'status': ENetworkStatus.LISTED,
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  };

  const manta: IServerNetwork = {
    'balance2FeeDecimals': 18,
    'chainId': 'manta',
    'code': 'dot-manta',
    'decimals': 18,
    'extensions': {
      'providerOptions': {
        'addressPrefix': '77',
        'addressRegex': '^df[a-cW-Z][a-km-zA-HJ-NP-Z1-9]+$',
      },
    },
    'id': 'dot--manta',
    'impl': 'dot',
    'isTestnet': false,
    'logoURI': 'https://uni.onekey-asset.com/static/chain/manta-atlantic.png',
    'name': 'Manta Atlantic',
    'shortcode': 'manta',
    'shortname': 'MANTA',
    'symbol': 'MANTA',
    'feeMeta': {
      'code': 'manta',
      'decimals': 18,
      'symbol': 'MANTA',
    },
    'defaultEnabled': true,
    'priceConfigs': [],
    'explorers': [
      {
        'address': 'https://manta.subscan.io/account/{address}',
        'block': 'https://manta.subscan.io/block/{block}',
        'name': 'https://manta.subscan.io/',
        'transaction': 'https://manta.subscan.io/extrinsic/{transaction}',
      },
    ],
    'status': ENetworkStatus.LISTED,
    'createdAt': '2024-01-20T00:30:24.951Z',
    'updatedAt': '2024-01-20T00:30:24.951Z',
  };

  const joystream: IServerNetwork = {
    'balance2FeeDecimals': 10,
    'chainId': 'joystream',
    'code': 'dot-joystream',
    'decimals': 10,
    'extensions': {
      'providerOptions': {
        'addressPrefix': '126',
        'addressRegex': '^j4[R-X][a-km-zA-HJ-NP-Z1-9]+$',
      },
    },
    'id': 'dot--joystream',
    'impl': 'dot',
    'isTestnet': false,
    'logoURI': 'https://uni.onekey-asset.com/static/chain/joystream.png',
    'name': 'Joystream',
    'shortcode': 'joy',
    'shortname': 'JOY',
    'symbol': 'JOY',
    'feeMeta': {
      'code': 'joy',
      'decimals': 10,
      'symbol': 'JOY',
    },
    'defaultEnabled': true,
    'priceConfigs': [
      {
        'channel': 'coingecko',
        'native': 'joystream',
      },
    ],
    'explorers': [
      {
        'address': 'https://joystream.subscan.io/account/{address}',
        'block': 'https://joystream.subscan.io/block/{block}',
        'name': 'https://joystream.subscan.io/',
        'transaction': 'https://joystream.subscan.io/extrinsic/{transaction}',
      },
    ],
    'status': ENetworkStatus.LISTED,
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  };

  const kaspa = {
    'balance2FeeDecimals': 0,
    'chainId': 'kaspa',
    'code': 'kaspa',
    'decimals': 8,
    'id': 'kaspa--kaspa',
    'impl': 'kaspa',
    'isTestnet': false,
    'logoURI': 'https://uni.onekey-asset.com/static/chain/kas.png',
    'name': 'Kaspa',
    'shortcode': 'kaspa',
    'shortname': 'KAS',
    'symbol': 'KAS',
    'feeMeta': {
      'code': 'kaspa',
      'decimals': 8,
      'symbol': 'KAS',
    },
    'defaultEnabled': true,
    'priceConfigs': [
      {
        'channel': 'coingecko',
        'native': 'kaspa',
      },
    ],
    'explorers': [
      {
        'address': 'https://explorer.kaspa.org/addresses/{address}',
        'block': 'https://explorer.kaspa.org/blocks/{block}',
        'name': 'https://explorer.kaspa.org',
        'transaction': 'https://explorer.kaspa.org/txs/{transaction}',
      },
    ],
    'status': ENetworkStatus.LISTED,
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  };

  const cfx = {
    'balance2FeeDecimals': 0,
    'chainId': '1029',
    'code': 'cfx',
    'decimals': 18,
    'extensions': {
      'position': 14,
    },
    'id': 'cfx--1029',
    'impl': 'cfx',
    'isTestnet': false,
    'logoURI': 'https://uni.onekey-asset.com/static/chain/cfx.png',
    'name': 'Conflux',
    'shortcode': 'cfx',
    'shortname': 'CFX',
    'symbol': 'CFX',
    'feeMeta': {
      'code': 'cfx',
      'decimals': 18,
      'symbol': 'CFX',
    },
    'defaultEnabled': true,
    'priceConfigs': [
      {
        'channel': 'coingecko',
        'native': 'conflux',
      },
    ],
    'explorers': [
      {
        'address': 'https://confluxscan.io/address/{address}',
        'block': 'https://confluxscan.io/block/{block}',
        'name': 'https://confluxscan.io/',
        'transaction': 'https://confluxscan.io/transaction/{transaction}',
      },
    ],
    'status': ENetworkStatus.LISTED,
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  };

  const zksyncera = {
    'balance2FeeDecimals': 9,
    'chainId': '324',
    'code': 'zksyncera',
    'decimals': 18,
    'id': 'evm--324',
    'impl': 'evm',
    'isTestnet': false,
    'logoURI':
      'https://uni.onekey-asset.com/static/chain/zksync-era-mainnet.png',
    'name': 'zkSync Era Mainnet',
    'shortcode': 'zksyncera',
    'shortname': 'ZKSYNCERA',
    'symbol': 'ETH',
    'feeMeta': {
      'code': 'zksyncera',
      'decimals': 9,
      'symbol': 'Gwei',
    },
    'defaultEnabled': true,
    'priceConfigs': [],
    'explorers': [
      {
        'address': 'https://explorer.zksync.io/address/{address}',
        'block': 'https://explorer.zksync.io/block/{block}',
        'name': 'https://explorer.zksync.io/',
        'transaction': 'https://explorer.zksync.io/tx/{transaction}',
      },
    ],
    'status': ENetworkStatus.LISTED,
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  };

  const nexa = {
    'balance2FeeDecimals': 0,
    'chainId': '0',
    'code': 'nexa',
    'decimals': 2,
    'id': 'nexa--0',
    'impl': 'nexa',
    'isTestnet': false,
    'logoURI': 'https://uni.onekey-asset.com/static/chain/nexa.png',
    'name': 'Nexa',
    'shortcode': 'nexa',
    'shortname': 'Nexa',
    'symbol': 'NEX',
    'feeMeta': {
      'code': 'nexa',
      'decimals': 2,
      'symbol': 'NEX',
    },
    'defaultEnabled': true,
    'priceConfigs': [],
    'explorers': [
      {
        'address': 'https://explorer.nexa.org/address/{address}',
        'block': 'https://explorer.nexa.org/block-height/{block}',
        'name': 'https://explorer.nexa.org',
        'transaction': 'https://explorer.nexa.org/tx/{transaction}',
      },
    ],
    'status': ENetworkStatus.LISTED,
    'createdAt': '2023-06-19T00:29:24.951Z',
    'updatedAt': '2023-06-19T00:29:24.951Z',
  };

  const nexaTestnet = {
    'balance2FeeDecimals': 0,
    'chainId': 'testnet',
    'code': 'nexatest',
    'decimals': 2,
    'id': 'nexa--testnet',
    'impl': 'nexa',
    'isTestnet': true,
    'logoURI': 'https://uni.onekey-asset.com/static/chain/nexa.png',
    'name': 'Nexa Testnet',
    'shortcode': 'nexatest',
    'shortname': 'NexaTest',
    'symbol': 'TNEX',
    'feeMeta': {
      'code': 'nexatest',
      'decimals': 2,
      'symbol': 'TNEX',
    },
    'defaultEnabled': false,
    'priceConfigs': [],
    'explorers': [
      {
        'address': 'https://testnet-explorer.nexa.org/address/{address}',
        'block': 'https://testnet-explorer.nexa.org/block-height/{block}',
        'name': 'https://testnet-explorer.nexa.org',
        'transaction': 'https://testnet-explorer.nexa.org/tx/{transaction}',
      },
    ],
    'status': ENetworkStatus.LISTED,
    'createdAt': '2023-06-19T00:29:24.951Z',
    'updatedAt': '2023-06-19T00:29:24.951Z',
  };

  const iotex = {
    'balance2FeeDecimals': 9,
    'chainId': '4689',
    'code': 'iotex',
    'decimals': 18,
    'id': 'evm--4689',
    'impl': 'evm',
    'isTestnet': false,
    'logoURI':
      'https://uni.onekey-asset.com/static/logo/IoTeXNetworkMainnet.webp',
    'name': 'IoTeX Network Mainnet',
    'shortcode': 'iotex',
    'shortname': 'iotex',
    'symbol': 'IOTX',
    'feeMeta': {
      'code': 'iotex',
      'decimals': 9,
      'symbol': 'Gwei',
    },
    'defaultEnabled': true,
    'priceConfigs': [
      {
        'channel': 'coingecko',
        'native': 'iotex',
      },
    ],
    'explorers': [
      {
        'address': 'https://iotexscan.io/address/{address}',
        'block': 'https://iotexscan.io/block/{block}',
        'name': 'https://iotexscan.io/',
        'transaction': 'https://iotexscan.io/transaction/{transaction}',
      },
    ],
    'status': ENetworkStatus.LISTED,
    'createdAt': '2024-03-19T00:29:24.951Z',
    'updatedAt': '2024-03-19T00:29:24.951Z',
  };

  const mantapacific = {
    'balance2FeeDecimals': 9,
    'chainId': '169',
    'code': 'mantapacific',
    'decimals': 18,
    'id': 'evm--169',
    'impl': 'evm',
    'isTestnet': false,
    'logoURI':
      'https://uni.onekey-asset.com/static/chain/manta-pacific-mainnet.png',
    'name': 'Manta Pacific Mainnet',
    'shortcode': 'mantapacific',
    'shortname': 'mantapacific',
    'symbol': 'MANTASPACIFIC',
    'feeMeta': {
      'code': 'eth',
      'decimals': 9,
      'symbol': 'ETH',
    },
    'defaultEnabled': true,
    'priceConfigs': [
      {
        'channel': 'coingecko',
        'native': 'ethereum',
      },
    ],
    'explorers': [
      {
        'address': 'https://pacific-explorer.manta.network/address/{address}',
        'block': 'https://pacific-explorer.manta.network/block/{block}',
        'name': 'https://pacific-explorer.manta.network/',
        'transaction':
          'https://pacific-explorer.manta.network/transaction/{transaction}',
      },
    ],
    'status': ENetworkStatus.LISTED,
    'createdAt': '2024-02-05T00:29:24.951Z',
    'updatedAt': '2024-02-05T00:29:24.951Z',
  };

  const blast = {
    'balance2FeeDecimals': 9,
    'chainId': '81457',
    'code': 'blast',
    'decimals': 18,
    'id': 'evm--81457',
    'impl': 'evm',
    'isTestnet': false,
    'logoURI': 'https://uni.onekey-asset.com/static/logo/blast.png',
    'name': 'Blast',
    'shortcode': 'blast',
    'shortname': 'blast',
    'symbol': 'BLAST',
    'feeMeta': {
      'code': 'eth',
      'decimals': 9,
      'symbol': 'ETH',
    },
    'defaultEnabled': true,
    'priceConfigs': [
      {
        'channel': 'coingecko',
        'native': 'ethereum',
      },
    ],
    'explorers': [
      {
        'address': 'https://blastscan.io/address/{address}',
        'block': 'https://blastscan.io/block/{block}',
        'name': 'https://blastscan.io/',
        'transaction': 'https://blastscan.io/tx/{transaction}',
      },
    ],
    'status': ENetworkStatus.LISTED,
    'createdAt': '2024-03-10T00:29:24.951Z',
    'updatedAt': '2024-03-10T00:29:24.951Z',
  };

  const dnx = {
    'balance2FeeDecimals': 0,
    'chainId': '0',
    'code': 'dnx',
    'decimals': 9,
    'id': 'dynex--0',
    'impl': 'dynex',
    'isTestnet': false,
    'logoURI': 'https://uni.onekey-asset.com/static/chain/dynex.png',
    'name': 'Dynex',
    'rpcURLs': [
      {
        'url':
          'https://node-fra-infra-01.dynexcoin.org/rpc/34e68104-238a-43ad-953d-83e9ea76c810',
      },
    ],
    'shortcode': 'dnx',
    'shortname': 'DNX',
    'symbol': 'DNX',
    'feeMeta': {
      'code': 'dnx',
      'decimals': 9,
      'symbol': 'DNX',
    },
    'defaultEnabled': true,
    'priceConfigs': [
      {
        'channel': 'coingecko',
        'native': 'dynex',
      },
    ],
    'explorers': [
      {
        'address': 'https://blockexplorer.dynexcoin.org/?wallet={address}',
        'block': 'https://blockexplorer.dynexcoin.org/?block={block}',
        'name': 'https://blockexplorer.dynexcoin.org',
        'transaction': 'https://blockexplorer.dynexcoin.org/?tx={transaction}',
      },
    ],
    'status': ENetworkStatus.LISTED,
    'createdAt': '2024-04-09T00:00:00.001Z',
    'updatedAt': '2024-04-09T00:00:00.001Z',
  };

  const sui = {
    'balance2FeeDecimals': 0,
    'chainId': 'mainnet',
    'code': 'sui',
    'decimals': 9,
    'id': 'sui--mainnet',
    'impl': 'sui',
    'isTestnet': false,
    'logoURI': 'https://uni.onekey-asset.com/static/chain/sui.png',
    'name': 'SUI',
    'shortcode': 'sui',
    'shortname': 'SUI',
    'symbol': 'SUI',
    'feeMeta': {
      'code': 'sui',
      'decimals': 9,
      'symbol': 'SUI',
    },
    'defaultEnabled': true,
    'priceConfigs': [],
    'explorers': [
      {
        'token': 'https://suiscan.xyz/mainnet/coin/{token}',
        'address': 'https://suiscan.xyz/mainnet/account/{address}',
        'block': 'https://suiscan.xyz/mainnet/checkpoint/{block}',
        'name': 'https://suiscan.xyz/mainnet/home',
        'transaction': 'https://suiscan.xyz/mainnet/tx/{transaction}',
      },
    ],
    'status': ENetworkStatus.LISTED,
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  };

  const fil = {
    'balance2FeeDecimals': 0,
    'chainId': '314',
    'code': 'fil',
    'decimals': 18,
    'id': 'fil--314',
    'impl': 'fil',
    'isTestnet': false,
    'logoURI': 'https://uni.onekey-asset.com/static/chain/fil.png',
    'name': 'Filecoin',
    'shortcode': 'fil',
    'shortname': 'FIL',
    'symbol': 'FIL',
    'feeMeta': {
      'code': 'fil',
      'decimals': 18,
      'symbol': 'FIL',
    },
    'defaultEnabled': true,
    'priceConfigs': [
      {
        'channel': 'coingecko',
        'native': 'filecoin',
      },
    ],
    'explorers': [
      {
        'address': 'https://filscan.io/address/{address}',
        'block': 'https://filscan.io/height/{block}',
        'name': 'https://filscan.io/',
        'transaction': 'https://filscan.io/message/{transaction}',
      },
    ],
    'status': ENetworkStatus.LISTED,
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  };

  const aptos: IServerNetwork = {
    'balance2FeeDecimals': 0,
    'chainId': '1',
    'code': 'apt',
    'decimals': 8,
    'id': 'aptos--1',
    'impl': 'aptos',
    'isTestnet': false,
    'logoURI': 'https://uni.onekey-asset.com/static/chain/apt.png',
    'name': 'Aptos',
    'shortcode': 'apt',
    'shortname': 'APT',
    'symbol': 'APT',
    'feeMeta': {
      'code': 'apt',
      'decimals': 8,
      'symbol': 'APT',
    },
    'defaultEnabled': true,
    'priceConfigs': [
      {
        'channel': 'coingecko',
        'native': 'aptos',
      },
    ],
    'explorers': [
      {
        'address':
          'https://explorer.aptoslabs.com/account/{address}/?network=mainnet',
        'block': 'https://explorer.aptoslabs.com/txn/{block}/?network=mainnet',
        'name': 'https://explorer.aptoslabs.com/?network=mainnet',
        'transaction':
          'https://explorer.aptoslabs.com/txn/{transaction}/?network=mainnet',
      },
    ],
    'status': ENetworkStatus.LISTED,
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  };

  const ckb = {
    'balance2FeeDecimals': 0,
    'chainId': 'nervos',
    'code': 'nervos',
    'decimals': 8,
    'id': 'nervos--mainnet',
    'impl': 'nervos',
    'isTestnet': false,
    'logoURI': 'https://uni.onekey-asset.com/static/chain/nervos.png',
    'name': 'Nervos',
    'shortcode': 'ckb',
    'shortname': 'CKB',
    'symbol': 'CKB',
    'feeMeta': {
      'code': 'ckb',
      'decimals': 8,
      'symbol': 'CKB',
    },
    'defaultEnabled': true,
    'priceConfigs': [
      {
        'channel': 'coingecko',
        'native': 'nervos-network',
      },
    ],
    'explorers': [
      {
        'address': 'https://explorer.nervos.org/address/{address}',
        'block': 'https://explorer.nervos.org/block/{block}',
        'name': 'https://explorer.nervos.org',
        'transaction': 'https://explorer.nervos.org/transaction/{transaction}',
      },
    ],
    'status': ENetworkStatus.LISTED,
    'createdAt': '2024-03-05T00:00:00.002Z',
    'updatedAt': '2024-03-05T00:00:00.002Z',
  };

  const octa = {
    'balance2FeeDecimals': 9,
    'chainId': '800001',
    'code': 'octa',
    'decimals': 18,
    'id': 'evm--800001',
    'impl': 'evm',
    'isTestnet': false,
    'logoURI': 'https://uni.onekey-asset.com/static/chain/octa.webp',
    'name': 'OctaSpace',
    'shortcode': 'octa',
    'shortname': 'octa',
    'symbol': 'OCTA',
    'feeMeta': {
      'code': 'octa',
      'decimals': 9,
      'symbol': 'Gwei',
    },
    'defaultEnabled': true,
    'priceConfigs': [
      {
        'channel': 'coingecko',
        'native': 'octaspace',
      },
    ],
    'explorers': [
      {
        'address': 'https://scan.octa.space/address/{address}',
        'block': 'https://scan.octa.space/block/{block}',
        'name': 'https://scan.octa.space/',
        'transaction': 'https://scan.octa.space/transaction/{transaction}',
      },
    ],
    'status': ENetworkStatus.LISTED,
    'createdAt': '2024-05-24T00:29:24.951Z',
    'updatedAt': '2024-05-24T00:29:24.951Z',
  };

  const polygonZkevm = {
    'balance2FeeDecimals': 9,
    'chainId': '1101',
    'code': 'polygonzkevm',
    'decimals': 18,
    'id': 'evm--1101',
    'impl': 'evm',
    'isTestnet': false,
    'logoURI': 'https://uni.onekey-asset.com/static/chain/polygon-zkevm.png',
    'name': 'Polygon Zkevm',
    'shortcode': 'polygonzkevm',
    'shortname': 'polygonzkevm',
    'symbol': 'ETH',
    'feeMeta': {
      'code': 'polygonzkevm',
      'decimals': 9,
      'symbol': 'Gwei',
    },
    'defaultEnabled': true,
    'priceConfigs': [
      {
        'channel': 'coingecko',
        'native': 'ethereum',
        'platform': 'arbitrum-one',
      },
    ],
    'explorers': [
      {
        'address': 'https://zkevm.polygonscan.com/address/{address}',
        'block': 'https://zkevm.polygonscan.com/block/{block}',
        'name': 'https://zkevm.polygonscan.com/',
        'transaction': 'https://zkevm.polygonscan.com/tx/{transaction}',
      },
    ],
    'status': ENetworkStatus.LISTED,
    'createdAt': '2024-06-07T00:29:24.951Z',
    'updatedAt': '2024-06-07T00:29:24.951Z',
  };

  const chainsOnlyEnabledInDev = [
    tatom, // Cosmos Testnet
    // nexaTestnet,
  ];

  return [
    // btc & btc fork
    btc,
    doge,
    bch,
    ltc,
    neurai,
    tbtc,
    sbtc,
    // evm
    eth,
    sepolia,
    op,
    xdai,
    ethw,
    cfxespace,
    heco,
    aurora,
    polygon,
    cronos,
    ftm,
    boba,
    fevm,
    zksyncera,
    arb,
    celo,
    avax,
    dis,
    bsc,
    etc,
    okt,
    mvm,
    linea,
    base,
    mnt,
    iotex,
    mantapacific,
    blast,
    octa,
    polygonZkevm,
    // cosmos
    celestia,
    secret,
    juno,
    fetchai,
    cryptoorgchain,
    akash,
    osmosis,
    cosmoshub,
    // polkadot
    polkadot,
    astar,
    kusama,
    manta,
    joystream,

    aptos,
    lightning,
    tlightning,
    cardano,
    ripple,
    nostr,
    near,
    tron,
    cfx,
    sol,
    nexa,
    kaspa,
    dnx,
    fil,
    algo,
    sui,
    ckb,
    ...(platformEnv.isDev ? chainsOnlyEnabledInDev : []),
  ];
});
