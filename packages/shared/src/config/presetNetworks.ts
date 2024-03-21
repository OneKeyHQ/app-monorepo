/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable spellcheck/spell-checker */
import { memoFn } from '@onekeyhq/shared/src/utils/cacheUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import { ENetworkStatus } from '@onekeyhq/shared/types';

import platformEnv from '../platformEnv';

// export const NETWORK_ID_ETC = 'evm--61'; // move to networkIds

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
    'logoURI': 'https://onekey-asset.com/assets/eth/eth.png',
    'name': 'Ethereum',
    'rpcURLs': [
      {
        'url': 'https://node.onekey.so/eth',
      },
      {
        'url': 'https://mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
      },
      {
        'url': 'https://cloudflare-eth.com',
      },
      {
        'url': 'https://rpc.ankr.com/eth',
      },
      {
        'url': 'https://rpc.flashbots.net',
      },
      {
        'url':
          'https://eth-mainnet.alchemyapi.io/v2/QKMdAyFAARxN-dEm_USOu8-u0klcBuTO',
      },
      {
        'url':
          'https://eth-mainnet.gateway.pokt.network/v1/lb/611156b4a585a20035148406',
      },
      {
        'url': 'https://api.mycryptoapi.com/eth',
      },
      {
        'url':
          'https://eth-mainnet.gateway.pokt.network/v1/5f3453978e354ab992c4da79',
      },
      {
        'url': 'https://eth.public-rpc.com',
      },
      {
        'url': 'https://main-light.eth.linkpool.io',
      },
      {
        'url': 'https://mainnet-eth.compound.finance',
      },
      {
        'url': 'https://eth626892d.jccdex.cn',
      },
      {
        'url': 'https://1rpc.io/eth',
      },
      {
        'url': 'https://onekey-eth.rpc.blxrbdn.com',
      },
    ],
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

  const goerli: IServerNetwork = {
    'balance2FeeDecimals': 9,
    'chainId': '5',
    'code': 'goerli',
    'decimals': 18,
    'extensions': {
      'providerOptions': {
        'EIP1559Enabled': true,
        'preferMetamask': true,
      },
    },
    'id': 'evm--5',
    'impl': 'evm',
    'isTestnet': true,
    'logoURI': 'https://onekey-asset.com/assets/teth/teth.png',
    'name': 'Ethereum Görli (Goerli) Testnet',
    'rpcURLs': [
      {
        'url': 'https://rpc.ankr.com/eth_goerli',
      },
      {
        'url': 'https://goerli.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
      },
      {
        'url': 'https://eth-goerli.public.blastapi.io',
      },
    ],
    'shortcode': 'goerli',
    'shortname': 'Görli',
    'symbol': 'TETH',
    'feeMeta': {
      'code': 'goerli',
      'decimals': 9,
      'symbol': 'Gwei',
    },
    'defaultEnabled': false,
    'priceConfigs': [],
    'explorers': [
      {
        'address': 'https://goerli.etherscan.io/address/{address}',
        'block': 'https://goerli.etherscan.io/block/{block}',
        'name': 'https://goerli.etherscan.io/',
        'transaction': 'https://goerli.etherscan.io/tx/{transaction}',
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
    'logoURI': 'https://onekey-asset.com/assets/btc/btc.png',
    'name': 'Bitcoin',
    'rpcURLs': [
      {
        'url': 'https://node.onekey.so/btc',
      },
      {
        'url': 'https://1rpc.io/btc',
      },
    ],
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
    'logoURI': 'https://onekey-asset.com/assets/tbtc/tbtc.png',
    'name': 'Bitcoin Testnet',
    'rpcURLs': [
      {
        'url': 'https://node.onekey.so/tbtc',
      },
    ],
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

  const doge: IServerNetwork = {
    'balance2FeeDecimals': 0,
    'chainId': '0',
    'code': 'doge',
    'decimals': 8,
    'id': 'doge--0',
    'impl': 'doge',
    'isTestnet': false,
    'logoURI': 'https://onekey-asset.com/assets/doge/doge.png',
    'name': 'Dogecoin',
    'rpcURLs': [
      {
        'url': 'https://fiat.onekeycn.com/book/doge',
      },
      {
        'url': 'https://node.onekey.so/doge',
      },
    ],
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
    'logoURI': 'https://common.onekey-asset.com/chain/bch.png',
    'name': 'Bitcoin Cash',
    'rpcURLs': [
      {
        'url': 'https://fiat.onekeycn.com/book/bch',
      },
      {
        'url': 'https://node.onekey.so/bch',
      },
    ],
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
    'logoURI': 'https://common.onekey-asset.com/chain/ltc.png',
    'name': 'Litecoin',
    'rpcURLs': [
      {
        'url': 'https://fiat.onekeycn.com/book/ltc',
      },
      {
        'url': 'https://node.onekey.so/ltc',
      },
    ],
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
    'logoURI': 'https://onekey-asset.com/assets/cosmos/cosmos.png',
    'name': 'Cosmos Testnet',
    'rpcURLs': [
      {
        'url': 'https://rest.sentry-01.theta-testnet.polypore.xyz',
      },
      {
        'url': 'https://rest.sentry-02.theta-testnet.polypore.xyz',
      },
    ],
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
    'logoURI': 'https://onekey-asset.com/assets/cosmos/cosmos.png',
    'name': 'Cosmos',
    'rpcURLs': [
      {
        'url': 'https://lcd-cosmoshub.keplr.app',
      },
      {
        'url': 'https://cosmos-lcd.quickapi.com',
      },
      {
        'url': 'https://lcd-cosmoshub.blockapsis.com',
      },
      {
        'url': 'https://node.onekey.so/cosmos',
      },
    ],
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
    'logoURI': 'https://onekey-asset.com/assets/osmosis/osmosis.png',
    'name': 'Osmosis',
    'rpcURLs': [
      {
        'url': 'https://lcd-osmosis.keplr.app/',
      },
      {
        'url': 'https://lcd-osmosis.blockapsis.com/',
      },
      {
        'url': 'https://lcd.osmosis.zone',
      },
      {
        'url': 'https://osmosis-lcd.quickapi.com',
      },
      {
        'url': 'https://node.onekey.so/osmosis',
      },
    ],
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
    'logoURI': 'https://onekey-asset.com/assets/polygon/polygon.png',
    'name': 'Polygon',
    'rpcURLs': [
      {
        'url': 'https://polygon-rpc.com',
      },
      {
        'url': 'https://rpc-mainnet.matic.network',
      },
      {
        'url': 'https://rpc-mainnet.maticvigil.com',
      },
      {
        'url': 'https://rpc-mainnet.matic.quiknode.pro',
      },
      {
        'url': 'https://matic-mainnet.chainstacklabs.com',
      },
      {
        'url': 'https://matic-mainnet-full-rpc.bwarelabs.com',
      },
      {
        'url': 'https://matic-mainnet-archive-rpc.bwarelabs.com',
      },
      {
        'url': 'https://node.onekey.so/polygon',
      },
      {
        'url': 'https://1rpc.io/matic',
      },
      {
        'url': 'https://onekey-polygon.rpc.blxrbdn.com',
      },
    ],
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
    'logoURI': 'https://onekey-asset.com/assets/bsc/bsc.png',
    'name': 'BNB Smart Chain',
    'rpcURLs': [
      {
        'url': 'https://bsc-dataseed1.ninicoin.io',
      },
      {
        'url': 'https://bsc-dataseed2.ninicoin.io',
      },
      {
        'url': 'https://bsc-dataseed3.ninicoin.io',
      },
      {
        'url': 'https://bsc-dataseed4.ninicoin.io',
      },
      {
        'url': 'https://bsc-dataseed.binance.org',
      },
      {
        'url': 'https://bsc-dataseed1.binance.org',
      },
      {
        'url': 'https://bsc-dataseed2.binance.org',
      },
      {
        'url': 'https://bsc-dataseed3.binance.org',
      },
      {
        'url': 'https://bsc-dataseed4.binance.org',
      },
      {
        'url': 'https://bsc-dataseed1.defibit.io',
      },
      {
        'url': 'https://bsc-dataseed2.defibit.io',
      },
      {
        'url': 'https://bsc-dataseed3.defibit.io',
      },
      {
        'url': 'https://bsc-dataseed4.defibit.io',
      },
      {
        'url': 'https://binance.ankr.com',
      },
      {
        'url': 'https://binance.nodereal.io',
      },
      {
        'url': 'https://rpc-bsc.bnb48.club/',
      },
      {
        'url': 'https://bscrpc.com',
      },
      {
        'url': 'https://node.onekey.so/bsc',
      },
      {
        'url': 'https://1rpc.io/bnb',
      },
      {
        'url': 'https://onekey-bnb.rpc.blxrbdn.com',
      },
    ],
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
    'logoURI': 'https://onekey-asset.com/assets/fantom/fantom.png',
    'name': 'Fantom',
    'rpcURLs': [
      {
        'url': 'https://rpc.ftm.tools',
      },
      {
        'url': 'https://rpc.fantom.network',
      },
      {
        'url': 'https://rpcapi.fantom.network',
      },
      {
        'url': 'https://rpc2.fantom.network',
      },
      {
        'url': 'https://rpc3.fantom.network',
      },
      {
        'url': 'https://rpc.ankr.com/fantom',
      },
      {
        'url': 'https://node.onekey.so/fantom',
      },
      {
        'url': 'https://1rpc.io/ftm',
      },
    ],
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
    'logoURI': 'https://onekey-asset.com/assets/arbitrum/arbitrum.png',
    'name': 'Arbitrum',
    'rpcURLs': [
      {
        'url': 'https://arb1.arbitrum.io/rpc',
      },
      {
        'url': 'https://rpc.ankr.com/arbitrum',
      },
      {
        'url': 'https://node.onekey.so/arbitrum',
      },
      {
        'url': 'https://1rpc.io/arb',
      },
    ],
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
    'logoURI': 'https://onekey-asset.com/assets/avalanche/avalanche.png',
    'name': 'Avalanche',
    'rpcURLs': [
      {
        'url': 'https://api.avax.network/ext/bc/C/rpc',
      },
      {
        'url': 'https://rpc.ankr.com/avalanche',
      },
      {
        'url': 'https://node.onekey.so/avalanche',
      },
      {
        'url': 'https://1rpc.io/avax/c',
      },
    ],
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
    'logoURI': 'https://onekey-asset.com/assets/heco/heco.png',
    'name': 'Huobi ECO Chain',
    'rpcURLs': [
      {
        'url': 'https://http-mainnet.hecochain.com',
      },
      {
        'url': 'https://http-mainnet-node.defibox.com',
      },
      {
        'url': 'https://node.onekey.so/heco',
      },
    ],
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
    'logoURI': 'https://onekey-asset.com/assets/okt/okt.png',
    'name': 'OKX Chain',
    'rpcURLs': [
      {
        'url': 'https://exchainrpc.okex.org',
      },
      {
        'url': 'https://node.onekey.so/okt',
      },
    ],
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
    'logoURI': 'https://onekey-asset.com/assets/optimism/optimism.png',
    'name': 'Optimism',
    'rpcURLs': [
      {
        'url': 'https://mainnet.optimism.io',
      },
      {
        'url': 'https://node.onekey.so/optimism',
      },
      {
        'url': 'https://1rpc.io/op',
      },
    ],
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
    'logoURI': 'https://onekey-asset.com/assets/xdai/gno.png',
    'name': 'Gnosis Chain',
    'rpcURLs': [
      {
        'url': 'https://rpc.gnosischain.com',
      },
      {
        'url': 'https://gnosis-mainnet.public.blastapi.io',
      },
      {
        'url': 'https://rpc.ankr.com/gnosis',
      },
      {
        'url': 'https://xdai-rpc.gateway.pokt.network',
      },
      {
        'url': 'https://gnosischain-rpc.gateway.pokt.network',
      },
      {
        'url': 'https://node.onekey.so/xdai',
      },
    ],
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
    'logoURI': 'https://onekey-asset.com/assets/celo/celo.png',
    'name': 'Celo',
    'rpcURLs': [
      {
        'url': 'https://rpc.ankr.com/celo',
      },
      {
        'url': 'https://forno.celo.org',
      },
      {
        'url': 'https://node.onekey.so/celo',
      },
      {
        'url': 'https://1rpc.io/celo',
      },
    ],
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
    'logoURI': 'https://onekey-asset.com/assets/base/base.png',
    'name': 'Base',
    'rpcURLs': [
      {
        'url': 'https://mainnet.base.org',
      },
      {
        'url': 'https://base.meowrpc.com',
      },
      {
        'url': 'https://1rpc.io/base',
      },
      {
        'url': 'https://base.blockpi.network/v1/rpc/public',
      },
    ],
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
    'logoURI': 'https://onekey-asset.com/assets/aurora/aurora.png',
    'name': 'Aurora',
    'rpcURLs': [
      {
        'url': 'https://mainnet.aurora.dev',
      },
      {
        'url': 'https://node.onekey.so/aurora',
      },
      {
        'url': 'https://1rpc.io/aurora',
      },
    ],
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
    'logoURI': 'https://onekey-asset.com/assets/boba/boba_1.png',
    'name': 'Boba Network',
    'rpcURLs': [
      {
        'url': 'https://mainnet.boba.network',
      },
      {
        'url': 'https://lightning-replica.boba.network',
      },
      {
        'url':
          'https://boba-mainnet.gateway.pokt.network/v1/lb/623ad21b20354900396fed7f',
      },
      {
        'url': 'https://node.onekey.so/boba',
      },
    ],
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
    'logoURI': 'https://onekey-asset.com/assets/cfx/cfx.png',
    'name': 'Conflux eSpace',
    'rpcURLs': [
      {
        'url': 'https://evm.confluxrpc.com',
      },
      {
        'url': 'https://conflux-espace-public.unifra.io',
      },
    ],
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
    'logoURI': 'https://onekey-asset.com/assets/cronos/cronos.png',
    'name': 'Cronos',
    'rpcURLs': [
      {
        'url': 'https://mmf-rpc.xstaking.sg',
      },
      {
        'url': 'https://cronosrpc-1.xstaking.sg',
      },
      {
        'url': 'https://cronosrpc-2.xstaking.sg',
      },
      {
        'url': 'https://gateway.nebkas.ro/',
      },
      {
        'url': 'https://rpc.nebkas.ro/',
      },
      {
        'url': 'https://rpc.vvs.finance',
      },
      {
        'url': 'https://node.onekey.so/cronos',
      },
    ],
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
    'logoURI': 'https://onekey-asset.com/assets/etc/etc.png',
    'name': 'Ethereum Classic',
    'rpcURLs': [
      {
        'url': 'https://www.ethercluster.com/etc',
      },
      {
        'url': 'https://node.onekey.so/etc',
      },
    ],
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

  const etf = {
    'balance2FeeDecimals': 9,
    'chainId': '513100',
    'code': 'etf',
    'decimals': 18,
    'extensions': {
      'providerOptions': {
        'EIP1559Enabled': true,
      },
    },
    'id': 'evm--513100',
    'impl': 'evm',
    'isTestnet': false,
    'logoURI': 'https://onekey-asset.com/assets/etf/etf.png',
    'name': 'Ethereum Fair',
    'rpcURLs': [
      {
        'url': 'https://rpc.etherfair.org',
      },
      {
        'url': 'https://node.onekey.so/etf',
      },
    ],
    'shortcode': 'etf',
    'shortname': 'ETHF',
    'symbol': 'ETHF',
    'feeMeta': {
      'code': 'etf',
      'decimals': 9,
      'symbol': 'Gwei',
    },
    'defaultEnabled': true,
    'priceConfigs': [
      {
        'channel': 'coingecko',
        'native': 'ethereumfair',
      },
    ],
    'explorers': [
      {
        'address': 'https://explorer.etherfair.org/address/{address}',
        'block': 'https://explorer.etherfair.org/block/{block}',
        'name': 'https://explorer.etherfair.org',
        'transaction': 'https://explorer.etherfair.org/tx/{transaction}',
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
    'logoURI': 'https://onekey-asset.com/assets/ethw/ethw.png',
    'name': 'EthereumPoW',
    'rpcURLs': [
      {
        'url': 'https://mainnet.ethereumpow.org',
      },
      {
        'url': 'https://node.onekey.so/ethw',
      },
    ],
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
    'logoURI': 'https://onekey-asset.com/assets/linea/linea.png',
    'name': 'Linea',
    'rpcURLs': [
      {
        'url': 'https://rpc.linea.build',
      },
      {
        'url': 'https://linea.blockpi.network/v1/rpc/public',
      },
    ],
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
    'logoURI': 'https://onekey-asset.com/assets/mantle/mantle.png',
    'name': 'Mantle',
    'rpcURLs': [
      {
        'url': 'https://rpc.mantle.xyz',
      },
      {
        'url': 'https://mantle-mainnet.public.blastapi.io',
      },
      {
        'url': 'https://mantle.publicnode.com',
      },
    ],
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
    'logoURI': 'https://onekey-asset.com/assets/mvn/mvm.png',
    'name': 'Mixin Virtual Machine',
    'rpcURLs': [
      {
        'url': 'https://geth.mvm.dev',
      },
      {
        'url': 'https://node.onekey.so/mvm',
      },
    ],
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
    'logoURI': 'https://onekey-asset.com/assets/fil/fil.png',
    'name': 'Filecoin FEVM',
    'rpcURLs': [
      {
        'url': 'https://node.onekey.so/fevm',
      },
      {
        'url': 'https://rpc.ankr.com/filecoin',
      },
      {
        'url': 'https://api.node.glif.io',
      },
    ],
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

  const chainsOnlyEnabledInDev = [osmosis, cosmoshub, tatom];

  return [
    btc,
    doge,
    bch,
    ltc,
    tbtc,
    eth,
    goerli,
    base,
    bsc,
    op,
    arb,
    avax,
    polygon,
    ...(platformEnv.isDev ? chainsOnlyEnabledInDev : []),
  ];
});
