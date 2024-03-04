import { memoFn } from '@onekeyhq/shared/src/utils/cacheUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import { ENetworkStatus } from '@onekeyhq/shared/types';

export const NETWORK_ID_ETC = 'evm--61';

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

  return [eth, goerli, btc, tbtc, tatom, cosmoshub, osmosis, polygon];
});
