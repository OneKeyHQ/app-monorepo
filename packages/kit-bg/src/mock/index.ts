/* eslint-disable @typescript-eslint/no-unused-vars */

import { ENetworkStatus, type IServerNetwork } from '@onekeyhq/shared/types';

export function mockIsAccountCompatibleWithNetwork({
  accountId,
  networkId,
}: {
  accountId: string;
  networkId: string;
}) {
  return true;
}

export const mockPresetNetworks: Record<
  'evm' | 'goerli' | 'btc' | 'tbtc',
  IServerNetwork
> = {
  evm: {
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
  },
  goerli: {
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
  },
  btc: {
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
  },
  tbtc: {
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
  },
};

export const mockPresetNetworksList = Object.values(mockPresetNetworks);

export async function mockGetNetwork({ networkId }: { networkId: string }) {
  // TODO use simpleDB save networks
  const network = mockPresetNetworksList.find((n) => n.id === networkId);
  if (!network) {
    throw new Error('network not found');
  }
  return network;
}

export function mockVerifyAddress({ address }: { address: string }) {
  return {
    isValid: true,
    normalizedAddress: address,
  };
}
