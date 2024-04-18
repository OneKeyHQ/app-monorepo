import { FAKE_ALL_NETWORK, FAKE_NOSTR_NETWORK } from './fakeNetwork';

import type { IServerNetwork } from '../../types';

const serverPresetNetworks = [
  {
    'balance2FeeDecimals': 6,
    'chainId': '0',
    'code': 'ada',
    'decimals': 6,
    'id': 'ada--0',
    'impl': 'ada',
    'isTestnet': false,
    'logoURI': 'https://onekey-asset.com/assets/ada/ada.png',
    'name': 'Cardano',
    'rpcURLs': [
      {
        'url': 'https://node.onekey.so/ada',
      },
    ],
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
    'status': 'LISTED',
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  },
  {
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
    'logoURI': 'https://onekey-asset.com/assets/algo/algo.png',
    'name': 'Algorand',
    'rpcURLs': [
      {
        'indexer': 'https://algosigner.api.purestake.io/mainnet/indexer',
        'url': 'https://algosigner.api.purestake.io/mainnet/algod',
      },
      {
        'indexer': 'https://algosigner.api.purestake.io/mainnet/indexer',
        'url': 'https://node.onekey.so/algo',
      },
    ],
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
        'address': 'https://algoexplorer.io/address/{address}',
        'block': 'https://algoexplorer.io/block/{block}',
        'name': 'https://algoexplorer.io/',
        'transaction': 'https://algoexplorer.io/tx/{transaction}',
      },
    ],
    'status': 'LISTED',
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  },
  {
    'balance2FeeDecimals': 0,
    'chainId': '1',
    'code': 'talgo',
    'decimals': 6,
    'id': 'algo--1',
    'impl': 'algo',
    'isTestnet': true,
    'logoURI': 'https://onekey-asset.com/assets/talgo/talgo.png',
    'name': 'Algorand Testnet',
    'rpcURLs': [
      {
        'indexer': 'https://algosigner.api.purestake.io/testnet/indexer',
        'url': 'https://algosigner.api.purestake.io/testnet/algod',
      },
    ],
    'shortcode': 'talgo',
    'shortname': 'TALGO',
    'symbol': 'TALGO',
    'feeMeta': {
      'code': 'talgo',
      'decimals': 6,
      'symbol': 'TALGO',
    },
    'defaultEnabled': false,
    'priceConfigs': [],
    'explorers': [
      {
        'address': 'https://testnet.algoexplorer.io/address/{address}',
        'block': 'https://testnet.algoexplorer.io/block/{block}',
        'name': 'https://testnet.algoexplorer.io/',
        'transaction': 'https://testnet.algoexplorer.io/tx/{transaction}',
      },
    ],
    'status': 'LISTED',
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  },
  {
    'balance2FeeDecimals': 0,
    'chainId': '1',
    'code': 'apt',
    'decimals': 8,
    'id': 'aptos--1',
    'impl': 'aptos',
    'isTestnet': false,
    'logoURI': 'https://onekey-asset.com/assets/apt/apt.png',
    'name': 'Aptos',
    'rpcURLs': [
      {
        'url': 'https://fullnode.mainnet.aptoslabs.com',
      },
      {
        'url': 'https://mainnet.aptoslabs.com',
      },
      {
        'url': 'https://fullnode.mainnet.martianwallet.xyz',
      },
      {
        'url': 'https://rpc.mainnet.aptos.fernlabs.xyz',
      },
      {
        'url': 'https://node.onekey.so/apt',
      },
    ],
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
    'status': 'LISTED',
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  },
  {
    'balance2FeeDecimals': 0,
    'chainId': '2',
    'code': 'tapt',
    'decimals': 8,
    'id': 'aptos--2',
    'impl': 'aptos',
    'isTestnet': true,
    'logoURI': 'https://onekey-asset.com/assets/tapt/tapt.png',
    'name': 'Aptos Testnet',
    'rpcURLs': [
      {
        'url': 'https://testnet.aptoslabs.com',
      },
    ],
    'shortcode': 'tapt',
    'shortname': 'TAPT',
    'symbol': 'TAPT',
    'feeMeta': {
      'code': 'tapt',
      'decimals': 8,
      'symbol': 'TAPT',
    },
    'defaultEnabled': false,
    'priceConfigs': [],
    'explorers': [
      {
        'address':
          'https://explorer.aptoslabs.com/account/{address}/?network=testnet',
        'block': 'https://explorer.aptoslabs.com/txn/{block}/?network=testnet',
        'name': 'https://explorer.aptoslabs.com/?network=testnet',
        'transaction':
          'https://explorer.aptoslabs.com/txn/{transaction}/?network=testnet',
      },
    ],
    'status': 'LISTED',
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  },
  {
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
    'status': 'LISTED',
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  },
  {
    'balance2FeeDecimals': 0,
    'chainId': '0',
    'code': 'btc',
    'decimals': 8,
    'extensions': {
      'position': 1,
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
    'status': 'LISTED',
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  },
  {
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
    'logoURI': 'https://onekey-asset.com/assets/cfx/cfx.png',
    'name': 'Conflux',
    'rpcURLs': [
      {
        'url': 'https://main.confluxrpc.com',
      },
      {
        'url': 'https://node.onekey.so/cfx',
      },
    ],
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
    'status': 'LISTED',
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  },
  {
    'balance2FeeDecimals': 0,
    'chainId': '1',
    'code': 'tcfx',
    'decimals': 18,
    'id': 'cfx--1',
    'impl': 'cfx',
    'isTestnet': true,
    'logoURI': 'https://onekey-asset.com/assets/tcfx/tcfx.png',
    'name': 'Conflux Testnet',
    'rpcURLs': [
      {
        'url': 'https://test.confluxrpc.com',
      },
    ],
    'shortcode': 'tcfx',
    'shortname': 'TCFX',
    'symbol': 'TCFX',
    'feeMeta': {
      'code': 'tcfx',
      'decimals': 18,
      'symbol': 'TCFX',
    },
    'defaultEnabled': false,
    'priceConfigs': [],
    'explorers': [
      {
        'address': 'https://testnet.confluxscan.io/address/{address}',
        'block': 'https://testnet.confluxscan.io/block/{block}',
        'name': 'https://testnet.confluxscan.io/',
        'transaction':
          'https://testnet.confluxscan.io/transaction/{transaction}',
      },
    ],
    'status': 'LISTED',
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  },
  {
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
    'logoURI': 'https://onekey-asset.com/assets/akash/akash.png',
    'name': 'Akash',
    'rpcURLs': [
      {
        'url': 'https://lcd-akash.keplr.app/',
      },
      {
        'url': 'https://api.akash.forbole.com',
      },
      {
        'url': 'https://rest-akash.ecostake.com',
      },
      {
        'url': 'https://node.onekey.so/akash',
      },
    ],
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
    'status': 'LISTED',
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  },
  {
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
    'status': 'LISTED',
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  },
  {
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
    'logoURI': 'https://onekey-asset.com/assets/cryptoorg/cryptoorg.png',
    'name': 'Crypto.org',
    'rpcURLs': [
      {
        'url': 'https://api-cryptoorgchain-ia.cosmosia.notional.ventures',
      },
      {
        'url': 'https://rest-cryptoorgchain.ecostake.com/',
      },
      {
        'url': 'https://lcd-crypto-org.keplr.app/',
      },
      {
        'url': 'https://rest-cryptoorgchain.ecostake.com',
      },
      {
        'url': 'https://node.onekey.so/crypto',
      },
    ],
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
    'status': 'LISTED',
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  },
  {
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
    'logoURI': 'https://onekey-asset.com/assets/fetch/fetch.png',
    'name': 'Fetch.ai',
    'rpcURLs': [
      {
        'url': 'https://lcd-fetchhub.keplr.app',
      },
      {
        'url': 'https://rest-fetchhub.fetch.ai',
      },
      {
        'url': 'https://api-fetchhub-ia.cosmosia.notional.ventures',
      },
      {
        'url': 'https://fetch-api.polkachu.com',
      },
      {
        'url': 'https://node.onekey.so/fetch',
      },
    ],
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
    'status': 'LISTED',
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  },
  {
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
    'logoURI': 'https://onekey-asset.com/assets/juno/juno.png',
    'name': 'Juno',
    'rpcURLs': [
      {
        'url': 'https://lcd-juno.keplr.app',
      },
      {
        'url': 'https://lcd-juno.itastakers.com',
      },
      {
        'url': 'https://api.juno.chaintools.tech',
      },
      {
        'url': 'https://api.juno.silknodes.io',
      },
      {
        'url': 'https://node.onekey.so/juno',
      },
    ],
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
    'status': 'LISTED',
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  },
  {
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
    'status': 'LISTED',
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  },
  {
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
    'logoURI': 'https://onekey-asset.com/assets/celestia/celestia.png',
    'name': 'Celestia',
    'rpcURLs': [
      {
        'url': 'https://lcd-celestia.keplr.app/',
      },
      {
        'url': 'https://public-celestia-lcd.numia.xyz',
      },
      {
        'url': 'https://celestia-rest.publicnode.com',
      },
      {
        'url': 'https://api.celestia.nodestake.top',
      },
    ],
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
    'status': 'LISTED',
    'createdAt': '2023-12-05T00:00:24.951Z',
    'updatedAt': '2023-12-05T00:00:24.951Z',
  },
  {
    'balance2FeeDecimals': 0,
    'chainId': 'phoenix-1',
    'code': 'terra',
    'decimals': 6,
    'extensions': {
      'providerOptions': {
        'addressPrefix': 'terra',
        'curve': 'secp256k1',
        'gasPriceStep': {
          'high': '0.15',
          'low': '0.0125',
          'normal': '0.015',
        },
        'mainCoinDenom': 'uluna',
      },
    },
    'id': 'cosmos--phoenix-1',
    'impl': 'cosmos',
    'isTestnet': false,
    'logoURI': 'https://onekey-asset.com/assets/terra2/terra2.png',
    'name': 'Terra',
    'rpcURLs': [
      {
        'url': 'https://phoenix-lcd.terra.dev',
      },
    ],
    'shortcode': 'terra',
    'shortname': 'Terra',
    'symbol': 'LUNA',
    'feeMeta': {
      'code': 'luna',
      'decimals': 6,
      'symbol': 'LUNA',
    },
    'defaultEnabled': false,
    'priceConfigs': [
      {
        'channel': 'coingecko',
        'native': 'terra-luna-2',
      },
    ],
    'explorers': [
      {
        'address': 'https://finder.terra.money/mainnet/address/{address}',
        'block': 'https://finder.terra.money/mainnet/blocks/{block}',
        'name': 'http://finder.terra.money/',
        'transaction': 'https://finder.terra.money/mainnet/tx/{transaction}',
      },
    ],
    'status': 'TRASH',
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  },
  {
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
    'logoURI': 'https://onekey-asset.com/assets/secret/secret.png',
    'name': 'Secret Network',
    'rpcURLs': [
      {
        'url': 'https://lcd-secret.keplr.app/',
      },
      {
        'url': 'https://api.scrt.network/',
      },
      {
        'url': 'https://secret-api.lavenderfive.com/',
      },
      {
        'url': 'https://api.secret.forbole.com/',
      },
      {
        'url': 'https://node.onekey.so/secret',
      },
    ],
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
    'status': 'LISTED',
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  },
  {
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
    'status': 'LISTED',
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  },
  {
    'balance2FeeDecimals': 0,
    'chainId': 'bbn-test-3',
    'code': 'babylontestnet',
    'decimals': 6,
    'extensions': {
      'providerOptions': {
        'addressPrefix': 'bbn',
        'curve': 'secp256k1',
        'gasPriceStep': {
          'min': '0.007',
          'high': '0.01',
          'low': '0.007',
          'normal': '0.007',
        },
        'mainCoinDenom': 'ubbn',
      },
    },
    'id': 'cosmos--bbn-test-3',
    'impl': 'cosmos',
    'isTestnet': true,
    'logoURI':
      'https://onekey-asset.com/assets/babylontestnet/babylontestnet.png',
    'name': 'Babylon Testnet',
    'rpcURLs': [
      {
        'url': 'https://lcd.testnet3.babylonchain.io',
      },
    ],
    'shortcode': 'tbbn',
    'shortname': 'TBBN',
    'symbol': 'TBBN',
    'feeMeta': {
      'code': 'tbbn',
      'decimals': 6,
      'symbol': 'TBBN',
    },
    'defaultEnabled': false,
    'priceConfigs': [],
    'explorers': [
      {
        'address': 'https://babylon.explorers.guru/account/{address}',
        'block': 'https://babylon.explorers.guru/block/{block}',
        'name': 'https://babylon.explorers.guru/',
        'transaction':
          'https://babylon.explorers.guru/transaction/{transaction}',
      },
    ],
    'status': 'LISTED',
    'createdAt': '2024-02-28T01:00:00.000Z',
    'updatedAt': '2024-02-28T01:00:00.000Z',
  },
  {
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
    'status': 'LISTED',
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  },
  {
    'balance2FeeDecimals': 18,
    'chainId': 'astar',
    'code': 'astar',
    'decimals': 18,
    'extensions': {
      'providerOptions': {
        'addressPrefix': 5,
        'addressRegex': '^[a-bV-Z][a-km-zA-HJ-NP-Z1-9]+$',
      },
    },
    'id': 'dot--astar',
    'impl': 'dot',
    'isTestnet': false,
    'logoURI': 'https://onekey-asset.com/assets/astar/astar.png',
    'name': 'Astar',
    'rpcURLs': [
      {
        'url': 'wss://rpc.astar.network',
      },
      {
        'url': 'wss://1rpc.io/astr',
      },
      {
        'url': 'https://1rpc.io/astr',
      },
      {
        'url': 'wss://astar.api.onfinality.io/public-ws',
      },
      {
        'url': 'https://astar.api.onfinality.io/public',
      },
      {
        'url': 'wss://astar-rpc.dwellir.com',
      },
    ],
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
    'status': 'LISTED',
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  },
  {
    'balance2FeeDecimals': 12,
    'chainId': 'kusama',
    'code': 'ksm',
    'decimals': 12,
    'extensions': {
      'providerOptions': {
        'addressPrefix': 2,
        'addressRegex': '^[C-HJ][a-km-zA-HJ-NP-Z1-9]+$',
      },
    },
    'id': 'dot--kusama',
    'impl': 'dot',
    'isTestnet': false,
    'logoURI': 'https://onekey-asset.com/assets/kusama/kusama.png',
    'name': 'Kusama',
    'rpcURLs': [
      {
        'url': 'wss://kusama-rpc.polkadot.io',
      },
      {
        'url': 'wss://1rpc.io/ksm',
      },
      {
        'url': 'wss://rpc.dotters.network/kusama',
      },
      {
        'url': 'wss://kusama.api.onfinality.io/public-ws',
      },
      {
        'url': 'https://kusama-rpc.polkadot.io',
      },
      {
        'url': 'https://kusama-node.prod.gke.papers.tech',
      },
    ],
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
    'status': 'LISTED',
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  },
  {
    'balance2FeeDecimals': 10,
    'chainId': 'polkadot',
    'code': 'dot',
    'decimals': 10,
    'extensions': {
      'providerOptions': {
        'addressPrefix': 0,
        'addressRegex': '^1[a-km-zA-HJ-NP-Z1-9]+$',
      },
    },
    'id': 'dot--polkadot',
    'impl': 'dot',
    'isTestnet': false,
    'logoURI': 'https://onekey-asset.com/assets/polkadot/polkadot.png',
    'name': 'Polkadot',
    'rpcURLs': [
      {
        'url': 'wss://rpc.polkadot.io',
      },
      {
        'url': 'wss://1rpc.io/dot',
      },
      {
        'url': 'wss://rpc.dotters.network/polkadot',
      },
      {
        'url': 'wss://polkadot.api.onfinality.io/public-ws',
      },
      {
        'url': 'https://rpc.polkadot.io',
      },
    ],
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
    'status': 'LISTED',
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  },
  {
    'balance2FeeDecimals': 12,
    'chainId': 'westend',
    'code': 'wnd',
    'decimals': 12,
    'extensions': {
      'providerOptions': {
        'addressPrefix': 42,
        'addressRegex': '^5[a-km-zA-HJ-NP-Z1-9]+$',
      },
    },
    'id': 'dot--westend',
    'impl': 'dot',
    'isTestnet': true,
    'logoURI': 'https://onekey-asset.com/assets/polkadot/polkadot.png',
    'name': 'Polkadot Westend',
    'rpcURLs': [
      {
        'url': 'wss://westend-rpc.polkadot.io',
      },
      {
        'url': 'wss://rpc.dotters.network/westend',
      },
      {
        'url': 'https://westend-rpc.polkadot.io',
      },
    ],
    'shortcode': 'wnd',
    'shortname': 'WND',
    'symbol': 'WND',
    'feeMeta': {
      'code': 'wnd',
      'decimals': 12,
      'symbol': 'WND',
    },
    'defaultEnabled': false,
    'priceConfigs': [],
    'explorers': [
      {
        'address': 'https://westend.subscan.io/account/{address}',
        'block': 'https://westend.subscan.io/block/{block}',
        'name': 'https://westend.subscan.io/',
        'transaction': 'https://westend.subscan.io/extrinsic/{transaction}',
      },
    ],
    'status': 'LISTED',
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  },
  {
    'balance2FeeDecimals': 18,
    'chainId': 'manta',
    'code': 'dot-manta',
    'decimals': 18,
    'extensions': {
      'providerOptions': {
        'addressPrefix': 77,
        'addressRegex': '^df[a-cW-Z][a-km-zA-HJ-NP-Z1-9]+$',
      },
    },
    'id': 'dot--manta',
    'impl': 'dot',
    'isTestnet': false,
    'logoURI': 'https://onekey-asset.com/assets/manta/manta.png',
    'name': 'Manta Atlantic',
    'rpcURLs': [
      {
        'url': 'wss://ws.manta.systems',
      },
    ],
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
    'status': 'LISTED',
    'createdAt': '2024-01-20T00:30:24.951Z',
    'updatedAt': '2024-01-20T00:30:24.951Z',
  },
  {
    'balance2FeeDecimals': 10,
    'chainId': 'joystream',
    'code': 'dot-joystream',
    'decimals': 10,
    'extensions': {
      'providerOptions': {
        'addressPrefix': 126,
        'addressRegex': '^j4[R-X][a-km-zA-HJ-NP-Z1-9]+$',
      },
    },
    'id': 'dot--joystream',
    'impl': 'dot',
    'isTestnet': false,
    'logoURI': 'https://onekey-asset.com/assets/joystream/joystream.png',
    'name': 'Joystream',
    'rpcURLs': [
      {
        'url': 'wss://rpc.joystream.org',
      },
    ],
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
    'status': 'LISTED',
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  },
  {
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
      'position': 3,
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
    'status': 'LISTED',
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  },
  {
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
    'status': 'LISTED',
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  },
  {
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
    'status': 'LISTED',
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  },
  {
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
    'status': 'LISTED',
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  },
  {
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
    'status': 'LISTED',
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  },
  {
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
    'status': 'LISTED',
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  },
  {
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
    'status': 'LISTED',
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  },
  {
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
    'status': 'LISTED',
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  },
  {
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
    'status': 'LISTED',
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  },
  {
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
    'status': 'LISTED',
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  },
  {
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
    'status': 'LISTED',
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  },
  {
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
    'status': 'LISTED',
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  },
  {
    'balance2FeeDecimals': 9,
    'chainId': '324',
    'code': 'zksyncera',
    'decimals': 18,
    'id': 'evm--324',
    'impl': 'evm',
    'isTestnet': false,
    'logoURI': 'https://onekey-asset.com/assets/zksyncera/zksyncera.png',
    'name': 'zkSync Era Mainnet',
    'rpcURLs': [
      {
        'url': 'https://zksync2-mainnet.zksync.io',
      },
      {
        'url': 'https://1rpc.io/zksync2-era',
      },
    ],
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
    'status': 'LISTED',
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  },
  {
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
    'status': 'LISTED',
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  },
  {
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
    'status': 'LISTED',
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  },
  {
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
    'status': 'LISTED',
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  },
  {
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
    'status': 'LISTED',
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  },
  {
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
    'status': 'LISTED',
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  },
  {
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
    'status': 'LISTED',
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  },
  {
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
    'status': 'LISTED',
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  },
  {
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
    'status': 'LISTED',
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  },
  {
    'balance2FeeDecimals': 9,
    'chainId': '256',
    'code': 'theco',
    'decimals': 18,
    'id': 'evm--256',
    'impl': 'evm',
    'isTestnet': true,
    'logoURI': 'https://onekey-asset.com/assets/theco/theco.png',
    'name': 'Huobi ECO Chain Testnet',
    'rpcURLs': [
      {
        'url': 'https://http-testnet.hecochain.com',
      },
    ],
    'shortcode': 'theco',
    'shortname': 'THECO',
    'symbol': 'THT',
    'feeMeta': {
      'code': 'theco',
      'decimals': 9,
      'symbol': 'Gwei',
    },
    'defaultEnabled': false,
    'priceConfigs': [],
    'explorers': [
      {
        'address': 'https://testnet.hecoinfo.com/address/{address}',
        'block': 'https://testnet.hecoinfo.com/block/{block}',
        'name': 'https://testnet.hecoinfo.com/',
        'transaction': 'https://testnet.hecoinfo.com/tx/{transaction}',
      },
    ],
    'status': 'LISTED',
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  },
  {
    'balance2FeeDecimals': 9,
    'chainId': '28',
    'code': 'tboba',
    'decimals': 18,
    'id': 'evm--28',
    'impl': 'evm',
    'isTestnet': true,
    'logoURI': 'https://onekey-asset.com/assets/boba/boba.png',
    'name': 'Boba Network Rinkeby Testnet',
    'rpcURLs': [
      {
        'url': 'https://rinkeby.boba.network',
      },
    ],
    'shortcode': 'tboba',
    'shortname': 'TBoba',
    'symbol': 'ETH',
    'feeMeta': {
      'code': 'tboba',
      'decimals': 9,
      'symbol': 'Gwei',
    },
    'defaultEnabled': false,
    'priceConfigs': [],
    'explorers': [
      {
        'address':
          'https://blockexplorer.rinkeby.boba.network/address/{address}',
        'block': 'https://blockexplorer.rinkeby.boba.network/block/{block}',
        'name': 'https://blockexplorer.rinkeby.boba.network/',
        'transaction':
          'https://blockexplorer.rinkeby.boba.network/tx/{transaction}',
      },
    ],
    'status': 'LISTED',
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  },
  {
    'balance2FeeDecimals': 9,
    'chainId': '421611',
    'code': 'tarbitrum',
    'decimals': 18,
    'id': 'evm--421611',
    'impl': 'evm',
    'isTestnet': true,
    'logoURI': 'https://onekey-asset.com/assets/tarbitrum/tarbitrum.png',
    'name': 'Arbitrum Rinkeby',
    'rpcURLs': [
      {
        'url': 'https://rinkeby.arbitrum.io/rpc',
      },
    ],
    'shortcode': 'tarbitrum',
    'shortname': 'TArbitrum',
    'symbol': 'TETH',
    'feeMeta': {
      'code': 'tarbitrum',
      'decimals': 9,
      'symbol': 'Gwei',
    },
    'defaultEnabled': false,
    'priceConfigs': [],
    'explorers': [
      {
        'address': 'https://rinkeby-explorer.arbitrum.io/address/{address}',
        'block': 'https://rinkeby-explorer.arbitrum.io/block/{block}',
        'name': 'https://rinkeby-explorer.arbitrum.io/',
        'transaction': 'https://rinkeby-explorer.arbitrum.io/tx/{transaction}',
      },
    ],
    'status': 'LISTED',
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  },
  {
    'balance2FeeDecimals': 9,
    'chainId': '421613',
    'code': 'tarbitrum-goerli',
    'decimals': 18,
    'id': 'evm--421613',
    'impl': 'evm',
    'isTestnet': true,
    'logoURI': 'https://onekey-asset.com/assets/tarbitrum/tarbitrum.png',
    'name': 'Arbitrum Goerli',
    'rpcURLs': [
      {
        'url': 'https://goerli-rollup.arbitrum.io/rpc',
      },
      {
        'url': 'https://endpoints.omniatech.io/v1/arbitrum/goerli/public',
      },
      {
        'url': 'https://arbitrum-goerli.public.blastapi.io',
      },
    ],
    'shortcode': 'tarbitrum-goerli',
    'shortname': 'TArbitrumGoerli',
    'symbol': 'TETH',
    'feeMeta': {
      'code': 'tarbitrum-goerli',
      'decimals': 9,
      'symbol': 'Gwei',
    },
    'defaultEnabled': false,
    'priceConfigs': [],
    'explorers': [
      {
        'address': 'https://goerli.arbiscan.io/address/{address}',
        'block': 'https://goerli.arbiscan.io/block/{block}',
        'name': 'https://goerli.arbiscan.io/',
        'transaction': 'https://goerli.arbiscan.io/tx/{transaction}',
      },
    ],
    'status': 'LISTED',
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  },
  {
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
    'status': 'LISTED',
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  },
  {
    'balance2FeeDecimals': 9,
    'chainId': '534353',
    'code': 'tscroll',
    'decimals': 18,
    'id': 'evm--534353',
    'impl': 'evm',
    'isTestnet': true,
    'logoURI': 'https://onekey-asset.com/assets/tscroll/tscroll.png',
    'name': 'Scroll Alpha Testnet',
    'rpcURLs': [
      {
        'url': 'https://alpha-rpc.scroll.io/l2',
      },
    ],
    'shortcode': 'tscroll',
    'shortname': 'TSCROLL',
    'symbol': 'ETH',
    'feeMeta': {
      'code': 'tscroll',
      'decimals': 9,
      'symbol': 'Gwei',
    },
    'defaultEnabled': false,
    'priceConfigs': [],
    'explorers': [
      {
        'address': 'https://blockscout.scroll.io/address/{address}',
        'block': 'https://blockscout.scroll.io/block/{block}',
        'name': 'https://blockscout.scroll.io/',
        'transaction': 'https://blockscout.scroll.io/tx/{transaction}',
      },
    ],
    'status': 'LISTED',
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  },
  {
    'balance2FeeDecimals': 9,
    'chainId': '65',
    'code': 'tokt',
    'decimals': 18,
    'id': 'evm--65',
    'impl': 'evm',
    'isTestnet': true,
    'logoURI': 'https://onekey-asset.com/assets/tokt/tokt.png',
    'name': 'OKX Chain Testnet',
    'rpcURLs': [
      {
        'url': 'https://exchaintestrpc.okex.org',
      },
    ],
    'shortcode': 'tokt',
    'shortname': 'TOKC',
    'symbol': 'TOKT',
    'feeMeta': {
      'code': 'tokt',
      'decimals': 9,
      'symbol': 'Gwei',
    },
    'defaultEnabled': false,
    'priceConfigs': [],
    'explorers': [
      {
        'address': 'https://www.oklink.com/okexchain-test/address/{address}',
        'block': 'https://www.oklink.com/okexchain-test/block/{block}',
        'name': 'https://www.oklink.com/okexchain-test/',
        'transaction': 'https://www.oklink.com/okexchain-test/tx/{transaction}',
      },
    ],
    'status': 'LISTED',
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  },
  {
    'balance2FeeDecimals': 9,
    'chainId': '69',
    'code': 'toptimism',
    'decimals': 18,
    'extensions': {
      'providerOptions': {
        'contract_gaslimit_multiplier': 1,
      },
    },
    'id': 'evm--69',
    'impl': 'evm',
    'isTestnet': true,
    'logoURI': 'https://onekey-asset.com/assets/toptimism/toptimism.png',
    'name': 'Optimistic Kovan Testnet',
    'rpcURLs': [
      {
        'url': 'https://kovan.optimism.io',
      },
    ],
    'shortcode': 'toptimism',
    'shortname': 'TOptimism',
    'symbol': 'TETH',
    'feeMeta': {
      'code': 'toptimism',
      'decimals': 9,
      'symbol': 'Gwei',
    },
    'defaultEnabled': false,
    'priceConfigs': [],
    'explorers': [
      {
        'address': 'https://kovan-optimistic.etherscan.io/address/{address}',
        'block': 'https://kovan-optimistic.etherscan.io/tx/{block}',
        'name': 'https://kovan-optimistic.etherscan.io/',
        'transaction': 'https://kovan-optimistic.etherscan.io/tx/{transaction}',
      },
    ],
    'status': 'LISTED',
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  },
  {
    'balance2FeeDecimals': 9,
    'chainId': '80001',
    'code': 'tpolygon',
    'decimals': 18,
    'extensions': {
      'providerOptions': {
        'EIP1559Enabled': true,
        'preferMetamask': true,
      },
    },
    'id': 'evm--80001',
    'impl': 'evm',
    'isTestnet': true,
    'logoURI': 'https://onekey-asset.com/assets/tpolygon/tpolygon.png',
    'name': 'Polygon Mumbai Testnet',
    'rpcURLs': [
      {
        'url': 'https://rpc-mumbai.matic.today',
      },
      {
        'url': 'https://rpc-mumbai.maticvigil.com',
      },
      {
        'url': 'https://matic-mumbai.chainstacklabs.com',
      },
      {
        'url': 'https://matic-testnet-archive-rpc.bwarelabs.com',
      },
    ],
    'shortcode': 'tpolygon',
    'shortname': 'TPolygon',
    'symbol': 'tMATIC',
    'feeMeta': {
      'code': 'tpolygon',
      'decimals': 9,
      'symbol': 'Gwei',
    },
    'defaultEnabled': false,
    'priceConfigs': [],
    'explorers': [
      {
        'address': 'https://mumbai.polygonscan.com/address/{address}',
        'block': 'https://mumbai.polygonscan.com/block/{block}',
        'name': 'https://mumbai.polygonscan.com/',
        'transaction': 'https://mumbai.polygonscan.com/tx/{transaction}',
      },
    ],
    'status': 'LISTED',
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  },
  {
    'balance2FeeDecimals': 9,
    'chainId': '97',
    'code': 'tbsc',
    'decimals': 18,
    'id': 'evm--97',
    'impl': 'evm',
    'isTestnet': true,
    'logoURI': 'https://onekey-asset.com/assets/tbsc/tbsc.png',
    'name': 'Binance Smart Chain Testnet',
    'rpcURLs': [
      {
        'url': 'https://data-seed-prebsc-1-s1.binance.org:8545',
      },
    ],
    'shortcode': 'tbsc',
    'shortname': 'TBSC',
    'symbol': 'TBNB',
    'feeMeta': {
      'code': 'tbsc',
      'decimals': 9,
      'symbol': 'Gwei',
    },
    'defaultEnabled': false,
    'priceConfigs': [],
    'explorers': [
      {
        'address': 'https://testnet.bscscan.com/address/{address}',
        'block': 'https://testnet.bscscan.com/block/{block}',
        'name': 'https://testnet.bscscan.com/',
        'transaction': 'https://testnet.bscscan.com/tx/{transaction}',
      },
    ],
    'status': 'LISTED',
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  },
  {
    'balance2FeeDecimals': 0,
    'chainId': '314',
    'code': 'fil',
    'decimals': 18,
    'id': 'fil--314',
    'impl': 'fil',
    'isTestnet': false,
    'logoURI': 'https://onekey-asset.com/assets/fil/fil.png',
    'name': 'Filecoin',
    'rpcURLs': [
      {
        'url': 'https://node.onekey.so/fil',
      },
      {
        'url': 'https://api.node.glif.io/rpc/v0',
      },
    ],
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
        'address': 'https://filscan.io/address/general?address={address}',
        'block': 'https://filscan.io/tipset/chain?hash={block}',
        'name': 'https://filscan.io/',
        'transaction':
          'https://filscan.io/tipset/message-detail?cid={transaction}',
      },
    ],
    'status': 'LISTED',
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  },
  {
    'balance2FeeDecimals': 0,
    'chainId': '314159',
    'code': 'tfil',
    'decimals': 18,
    'id': 'fil--314159',
    'impl': 'fil',
    'isTestnet': true,
    'logoURI': 'https://onekey-asset.com/assets/fil/fil.png',
    'name': 'Filecoin Calibration Testnet',
    'rpcURLs': [
      {
        'url': 'https://api.calibration.node.glif.io/rpc/v0',
      },
    ],
    'shortcode': 'tfil',
    'shortname': 'TFIL',
    'symbol': 'TFIL',
    'feeMeta': {
      'code': 'tfil',
      'decimals': 18,
      'symbol': 'TFIL',
    },
    'defaultEnabled': false,
    'priceConfigs': [],
    'explorers': [
      {
        'address':
          'https://calibration.filscan.io/address/general?address={address}',
        'block': 'https://calibration.filscan.io/tipset/chain?hash={block}',
        'name': 'https://calibration.filscan.io/',
        'transaction':
          'https://calibration.filscan.io/tipset/message-detail?cid={transaction}',
      },
    ],
    'status': 'LISTED',
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  },
  {
    'balance2FeeDecimals': 0,
    'chainId': 'kaspa',
    'code': 'kaspa',
    'decimals': 8,
    'id': 'kaspa--kaspa',
    'impl': 'kaspa',
    'isTestnet': false,
    'logoURI': 'https://onekey-asset.com/assets/kaspa/kas.png',
    'name': 'Kaspa',
    'rpcURLs': [
      {
        'url': 'https://api.kaspa.org',
      },
    ],
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
    'status': 'LISTED',
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  },
  {
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
    'status': 'LISTED',
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  },
  {
    'balance2FeeDecimals': 0,
    'chainId': '0',
    'code': 'near',
    'decimals': 24,
    'id': 'near--0',
    'impl': 'near',
    'isTestnet': false,
    'logoURI': 'https://onekey-asset.com/assets/near/near.png',
    'name': 'Near',
    'rpcURLs': [
      {
        'indexer': 'https://helper.mainnet.near.org',
        'url': 'https://rpc.mainnet.near.org',
      },
      {
        'indexer': 'https://helper.mainnet.near.org',
        'url': 'https://node.onekey.so/near',
      },
      {
        'indexer': 'https://helper.mainnet.near.org',
        'url': 'https://1rpc.io/near',
      },
    ],
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
        'address': 'https://explorer.mainnet.near.org/accounts/{address}',
        'block': 'https://explorer.mainnet.near.org/blocks/{block}',
        'name': 'https://explorer.mainnet.near.org/',
        'transaction':
          'https://explorer.mainnet.near.org/transactions/{transaction}',
      },
    ],
    'status': 'LISTED',
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  },
  {
    'balance2FeeDecimals': 0,
    'chainId': '1',
    'code': 'tnear',
    'decimals': 24,
    'id': 'near--1',
    'impl': 'near',
    'isTestnet': true,
    'logoURI': 'https://onekey-asset.com/assets/near/near.png',
    'name': 'Near Testnet',
    'rpcURLs': [
      {
        'indexer': 'https://helper.testnet.near.org',
        'url': 'https://rpc.testnet.near.org',
      },
    ],
    'shortcode': 'tnear',
    'shortname': 'Near Testnet',
    'symbol': 'TNEAR',
    'feeMeta': {
      'code': 'tnear',
      'decimals': 24,
      'symbol': 'TNEAR',
    },
    'defaultEnabled': true,
    'priceConfigs': [],
    'explorers': [
      {
        'address': 'https://explorer.testnet.near.org/accounts/{address}',
        'block': 'https://explorer.testnet.near.org/blocks/{block}',
        'name': 'https://explorer.testnet.near.org/',
        'transaction':
          'https://explorer.testnet.near.org/transactions/{transaction}',
      },
    ],
    'status': 'LISTED',
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  },
  {
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
    'logoURI': 'https://onekey-asset.com/assets/sol/sol.png',
    'name': 'Solana',
    'rpcURLs': [
      {
        'url': 'https://solana-mainnet.phantom.tech/',
      },
      {
        'url': 'https://solana-api.projectserum.com/',
      },
      {
        'url': 'https://node.onekey.so/sol',
      },
    ],
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
    'status': 'LISTED',
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  },
  {
    'balance2FeeDecimals': 0,
    'chainId': '103',
    'code': 'tsol',
    'decimals': 9,
    'id': 'sol--103',
    'impl': 'sol',
    'isTestnet': true,
    'logoURI': 'https://onekey-asset.com/assets/tsol/tsol.png',
    'name': 'Solana Devnet',
    'rpcURLs': [
      {
        'url': 'https://api.devnet.solana.com',
      },
    ],
    'shortcode': 'tsol',
    'shortname': 'TSOL',
    'symbol': 'TSOL',
    'feeMeta': {
      'code': 'tsol',
      'decimals': 9,
      'symbol': 'TSOL',
    },
    'defaultEnabled': false,
    'priceConfigs': [],
    'explorers': [
      {
        'address':
          'https://explorer.solana.com/address/{address}?cluster=devnet',
        'block': 'https://explorer.solana.com/block/{block}?cluster=devnet',
        'name': 'https://explorer.solana.com/',
        'transaction':
          'https://explorer.solana.com/tx/{transaction}?cluster=devnet',
      },
    ],
    'status': 'LISTED',
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  },
  {
    'balance2FeeDecimals': 0,
    'chainId': '1',
    'code': 'stc',
    'decimals': 9,
    'extensions': {
      'position': 13,
    },
    'id': 'stc--1',
    'impl': 'stc',
    'isTestnet': false,
    'logoURI': 'https://onekey-asset.com/assets/stc/stc.png',
    'name': 'Starcoin',
    'rpcURLs': [
      {
        'url': 'https://main-seed.starcoin.org',
      },
      {
        'url': 'https://node.onekey.so/stc',
      },
    ],
    'shortcode': 'stc',
    'shortname': 'STC',
    'symbol': 'STC',
    'feeMeta': {
      'code': 'stc',
      'decimals': 9,
      'symbol': 'STC',
    },
    'defaultEnabled': true,
    'priceConfigs': [
      {
        'channel': 'coingecko',
        'native': 'starcoin',
      },
    ],
    'explorers': [
      {
        'address': 'https://stcscan.io/main/address/{address}',
        'block': 'https://stcscan.io/main/blocks/height/{block}',
        'name': 'https://stcscan.io/',
        'transaction':
          'https://stcscan.io/main/transactions/detail/{transaction}',
      },
    ],
    'status': 'LISTED',
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  },
  {
    'balance2FeeDecimals': 0,
    'chainId': '251',
    'code': 'tstc',
    'decimals': 9,
    'id': 'stc--251',
    'impl': 'stc',
    'isTestnet': true,
    'logoURI': 'https://onekey-asset.com/assets/tstc/tstc.png',
    'name': 'Starcoin barnard',
    'rpcURLs': [
      {
        'url': 'https://barnard-seed.starcoin.org',
      },
    ],
    'shortcode': 'tstc',
    'shortname': 'TSTC',
    'symbol': 'TSTC',
    'feeMeta': {
      'code': 'tstc',
      'decimals': 9,
      'symbol': 'TSTC',
    },
    'defaultEnabled': false,
    'priceConfigs': [],
    'explorers': [
      {
        'address': 'https://stcscan.io/barnard/address/{address}',
        'block': 'https://stcscan.io/barnard/blocks/height/{block}',
        'name': 'https://stcscan.io/',
        'transaction':
          'https://stcscan.io/barnard/transactions/detail/{transaction}',
      },
    ],
    'status': 'LISTED',
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  },
  {
    'balance2FeeDecimals': 0,
    'chainId': 'mainnet',
    'code': 'sui',
    'decimals': 9,
    'id': 'sui--mainnet',
    'impl': 'sui',
    'isTestnet': false,
    'logoURI': 'https://onekey-asset.com/assets/sui/sui.png',
    'name': 'SUI',
    'rpcURLs': [
      {
        'url': 'https://node.onekey.so/sui',
      },
      {
        'url': 'https://wallet-rpc.mainnet.sui.io/',
      },
      {
        'url': 'https://fullnode.mainnet.sui.io',
      },
      {
        'url': 'https://1rpc.io/sui',
      },
    ],
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
        'address':
          'https://explorer.sui.io/addresses/{address}/?network=mainnet',
        'block': 'https://explorer.sui.io/objects/{block}/?network=mainnet',
        'name': 'https://explorer.sui.io?network=mainnet',
        'transaction':
          'https://explorer.sui.io/transactions/{transaction}/?network=mainnet',
      },
    ],
    'status': 'LISTED',
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  },
  {
    'balance2FeeDecimals': 0,
    'chainId': '8888883',
    'code': 'tsui',
    'decimals': 9,
    'id': 'sui--8888883',
    'impl': 'sui',
    'isTestnet': true,
    'logoURI': 'https://onekey-asset.com/assets/sui/sui.png',
    'name': 'SUI TestNet',
    'rpcURLs': [
      {
        'url': 'https://wallet-rpc.testnet.sui.io',
      },
      {
        'url': 'https://fullnode.testnet.sui.io',
      },
    ],
    'shortcode': 'tsui',
    'shortname': 'TSUI',
    'symbol': 'TSUI',
    'feeMeta': {
      'code': 'tsui',
      'decimals': 9,
      'symbol': 'TSUI',
    },
    'defaultEnabled': false,
    'priceConfigs': [],
    'explorers': [
      {
        'address':
          'https://explorer.sui.io/addresses/{address}/?network=testnet',
        'block': 'https://explorer.sui.io/objects/{block}/?network=testnet',
        'name': 'https://explorer.sui.io?network=testnet',
        'transaction':
          'https://explorer.sui.io/transactions/{transaction}/?network=testnet',
      },
    ],
    'status': 'LISTED',
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  },
  {
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
    'status': 'LISTED',
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  },
  {
    'balance2FeeDecimals': 0,
    'chainId': '0',
    'code': 'sbtc',
    'decimals': 8,
    'id': 'tbtc--1',
    'impl': 'tbtc',
    'isTestnet': true,
    'logoURI': 'https://onekey-asset.com/assets/sbtc/sbtc.png',
    'name': 'Bitcoin Signet',
    'rpcURLs': [
      {
        'url': 'https://node.onekey.so/sbtc',
      },
    ],
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
    'status': 'LISTED',
    'createdAt': '2024-02-28T00:29:24.951Z',
    'updatedAt': '2024-02-28T00:29:24.951Z',
  },
  {
    'balance2FeeDecimals': 0,
    'chainId': '0x2b6653dc',
    'clientApi': {
      'tronscan': 'https://apilist.tronscanapi.com',
    },
    'code': 'trx',
    'decimals': 6,
    'id': 'tron--0x2b6653dc',
    'impl': 'tron',
    'isTestnet': false,
    'logoURI': 'https://onekey-asset.com/assets/trx/trx.png',
    'name': 'Tron',
    'rpcURLs': [
      {
        'url': 'https://tron-mainnet.token.im',
      },
      {
        'url': 'https://node.onekey.so/trx',
      },
    ],
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
    'status': 'LISTED',
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  },
  {
    'balance2FeeDecimals': 0,
    'chainId': '0x94a9059e',
    'clientApi': {
      'tronscan': 'https://shastapi.tronscan.org',
    },
    'code': 'ttrx',
    'decimals': 6,
    'id': 'tron--0x94a9059e',
    'impl': 'tron',
    'isTestnet': true,
    'logoURI': 'https://onekey-asset.com/assets/ttrx/ttrx.png',
    'name': 'Tron Shasta Testnet',
    'rpcURLs': [
      {
        'url': 'https://api.shasta.trongrid.io',
      },
    ],
    'shortcode': 'ttrx',
    'shortname': 'TTRX',
    'symbol': 'TTRX',
    'feeMeta': {
      'code': 'ttrx',
      'decimals': 6,
      'symbol': 'TTRX',
    },
    'defaultEnabled': false,
    'priceConfigs': [],
    'explorers': [
      {
        'address': 'https://shasta.tronscan.org/#/address/{address}',
        'block': 'https://shasta.tronscan.org/#/block/{block}',
        'name': 'https://shasta.tronscan.org/',
        'transaction':
          'https://shasta.tronscan.org/#/transaction/{transaction}',
      },
    ],
    'status': 'LISTED',
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  },
  {
    'balance2FeeDecimals': 12,
    'chainId': '0',
    'clientApi': {
      'mymonero': 'https://node.onekey.so/mymonero',
    },
    'code': 'xmr',
    'decimals': 12,
    'id': 'xmr--0',
    'impl': 'xmr',
    'isTestnet': false,
    'logoURI': 'https://common.onekey-asset.com/chain/monero.png',
    'name': 'Monero',
    'rpcURLs': [
      {
        'url': 'https://node.onekey.so/xmr',
      },
    ],
    'shortcode': 'xmr',
    'shortname': 'XMR',
    'symbol': 'XMR',
    'feeMeta': {
      'code': 'xmr',
      'decimals': 12,
      'symbol': 'xmr',
    },
    'defaultEnabled': true,
    'priceConfigs': [
      {
        'channel': 'coingecko',
        'native': 'monero',
      },
    ],
    'explorers': [
      {
        'address': 'https://www.exploremonero.com/',
        'block': 'https://www.exploremonero.com/block/{block}',
        'name': 'https://www.exploremonero.com/',
        'transaction':
          'https://www.exploremonero.com/transaction/{transaction}',
      },
    ],
    'status': 'LISTED',
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  },
  {
    'balance2FeeDecimals': 6,
    'chainId': '0',
    'code': 'xrp',
    'decimals': 6,
    'id': 'xrp--0',
    'impl': 'xrp',
    'isTestnet': false,
    'logoURI': 'https://common.onekey-asset.com/chain/xrp.png',
    'name': 'Ripple',
    'rpcURLs': [
      {
        'url': 'wss://s1.ripple.com',
      },
      {
        'url': 'wss://s2.ripple.com',
      },
      {
        'url': 'wss://s-east.ripple.com',
      },
      {
        'url': 'wss://xrplcluster.com',
      },
      {
        'url': 'wss://xrpl.ws',
      },
    ],
    'shortcode': 'xrp',
    'shortname': 'Ripple',
    'symbol': 'XRP',
    'feeMeta': {
      'code': 'xrp',
      'decimals': 6,
      'symbol': 'xrp',
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
    'status': 'LISTED',
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  },
  {
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
    'logoURI': 'https://onekey-asset.com/assets/lnd/lnd.png',
    'name': 'Lightning Network',
    'rpcURLs': [
      {
        'url': 'https://node.onekey.so/btc',
      },
      {
        'url': 'https://1rpc.io/btc',
      },
    ],
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
    'status': 'LISTED',
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  },
  {
    'balance2FeeDecimals': 0,
    'chainId': '0',
    'code': 'tlightning',
    'decimals': 0,
    'id': 'tlightning--0',
    'impl': 'tlightning',
    'isTestnet': true,
    'logoURI': 'https://onekey-asset.com/assets/lnd/lnd.png',
    'name': 'Lightning Network Testnet',
    'rpcURLs': [],
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
    'status': 'LISTED',
    'createdAt': '2023-05-31T00:29:24.951Z',
    'updatedAt': '2023-05-31T00:29:24.951Z',
  },
  {
    'balance2FeeDecimals': 9,
    'chainId': '51178',
    'code': 'topsideprealpha',
    'decimals': 18,
    'id': 'evm--51178',
    'impl': 'evm',
    'isTestnet': true,
    'logoURI':
      'https://onekey-asset.com/assets/topsideprealpha/topsideprealpha.png',
    'name': 'Opside Testnet Pre-Alpha Network',
    'rpcURLs': [
      {
        'url': 'https://pre-alpha-us-http-geth.opside.network',
      },
    ],
    'shortcode': 'topsideprealpha',
    'shortname': 'TOpsidePreAlpha',
    'symbol': 'IDE',
    'feeMeta': {
      'code': 'topsideprealpha',
      'decimals': 9,
      'symbol': 'Gwei',
    },
    'defaultEnabled': false,
    'priceConfigs': [],
    'explorers': [
      {
        'address': 'https://pre-alpha.opside.info/address/{address}',
        'block': 'https://pre-alpha.opside.info/block/{block}',
        'name': 'https://pre-alpha.opside.info/',
        'transaction': 'https://pre-alpha.opside.info/tx/{transaction}',
      },
    ],
    'status': 'LISTED',
    'createdAt': '2023-06-14T00:29:24.951Z',
    'updatedAt': '2023-06-14T00:29:24.951Z',
  },
  {
    'balance2FeeDecimals': 0,
    'chainId': '0',
    'code': 'nexa',
    'decimals': 2,
    'id': 'nexa--0',
    'impl': 'nexa',
    'isTestnet': false,
    'logoURI': 'https://onekey-asset.com/assets/nexa/nexa.png',
    'name': 'Nexa',
    'rpcURLs': [
      {
        'url': 'wss://electrum.nexa.org:20004',
      },
    ],
    'shortcode': 'nexa',
    'shortname': 'Nexa',
    'symbol': 'NEX',
    'feeMeta': {
      'code': 'nexa',
      'decimals': 2,
      'symbol': 'nexa',
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
    'status': 'LISTED',
    'createdAt': '2023-06-19T00:29:24.951Z',
    'updatedAt': '2023-06-19T00:29:24.951Z',
  },
  {
    'balance2FeeDecimals': 0,
    'chainId': 'testnet',
    'code': 'nexatest',
    'decimals': 2,
    'id': 'nexa--testnet',
    'impl': 'nexa',
    'isTestnet': true,
    'logoURI': 'https://onekey-asset.com/assets/nexa/nexa.png',
    'name': 'Nexa Testnet',
    'rpcURLs': [
      {
        'url': 'wss://testnet-explorer.nexa.org:30004/nexa_ws',
      },
    ],
    'shortcode': 'nexatest',
    'shortname': 'NexaTest',
    'symbol': 'TNEX',
    'feeMeta': {
      'code': 'nexatest',
      'decimals': 2,
      'symbol': 'NEXATEST',
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
    'status': 'LISTED',
    'createdAt': '2023-06-19T00:29:24.951Z',
    'updatedAt': '2023-06-19T00:29:24.951Z',
  },
  {
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
    'status': 'LISTED',
    'createdAt': '2023-08-10T00:29:24.951Z',
    'updatedAt': '2023-08-10T00:29:24.951Z',
  },
  {
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
    'status': 'LISTED',
    'createdAt': '2023-08-10T00:29:24.951Z',
    'updatedAt': '2023-08-10T00:29:24.951Z',
  },
  {
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
    'status': 'LISTED',
    'createdAt': '2023-08-10T00:29:24.951Z',
    'updatedAt': '2023-08-10T00:29:24.951Z',
  },
  {
    'balance2FeeDecimals': 0,
    'chainId': 'nervos',
    'code': 'nervos',
    'decimals': 8,
    'id': 'nervos--mainnet',
    'impl': 'nervos',
    'isTestnet': false,
    'logoURI': 'https://onekey-asset.com/assets/nervos/nervos.png',
    'name': 'Nervos',
    'rpcURLs': [
      {
        'url': 'https://mainnet.ckb.dev/rpc',
      },
    ],
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
    'extensions': {
      'providerOptions': {
        'indexer': [
          {
            'rpcUrl': 'https://mainnet.ckb.dev/rpc',
            'indexerUrl': 'https://mainnet.ckb.dev/indexer',
          },
        ],
      },
    },
    'explorers': [
      {
        'address': 'https://explorer.nervos.org/address/{address}',
        'block': 'https://explorer.nervos.org/block/{block}',
        'name': 'https://explorer.nervos.org',
        'transaction': 'https://explorer.nervos.org/transaction/{transaction}',
      },
    ],
    'status': 'LISTED',
    'createdAt': '2024-03-05T00:00:00.002Z',
    'updatedAt': '2024-03-05T00:00:00.002Z',
  },
  {
    'balance2FeeDecimals': 0,
    'chainId': 'nervos-test',
    'code': 'nervos-test',
    'decimals': 8,
    'id': 'nervos--testnet',
    'impl': 'nervos',
    'isTestnet': true,
    'logoURI': 'https://onekey-asset.com/assets/nervos/nervos.png',
    'name': 'Nervos Testnet',
    'rpcURLs': [
      {
        'url': 'https://testnet.ckb.dev/rpc',
      },
    ],
    'shortcode': 'tckb',
    'shortname': 'TCKB',
    'symbol': 'TCKB',
    'feeMeta': {
      'code': 'tckb',
      'decimals': 8,
      'symbol': 'TCKB',
    },
    'defaultEnabled': true,
    'priceConfigs': [
      {
        'channel': 'coingecko',
        'native': 'nervos-network',
      },
    ],
    'extensions': {
      'providerOptions': {
        'indexer': [
          {
            'rpcUrl': 'https://testnet.ckb.dev/rpc',
            'indexerUrl': 'https://testnet.ckb.dev/indexer',
          },
        ],
      },
    },
    'explorers': [
      {
        'address': 'https://pudge.explorer.nervos.org/address/{address}',
        'block': 'https://pudge.explorer.nervos.org/block/{block}',
        'name': 'https://pudge.explorer.nervos.org',
        'transaction':
          'https://pudge.explorer.nervos.org/transaction/{transaction}',
      },
    ],
    'status': 'LISTED',
    'createdAt': '2024-03-05T00:00:00.004Z',
    'updatedAt': '2024-03-05T00:00:00.004Z',
  },
  {
    'balance2FeeDecimals': 0,
    'chainId': '0',
    'code': 'neurai',
    'decimals': 8,
    'id': 'neurai--0',
    'impl': 'neurai',
    'isTestnet': false,
    'logoURI': 'https://onekey-asset.com/assets/neurai/neurai.png',
    'name': 'Neurai',
    'rpcURLs': [
      {
        'url': 'https://blockbook-new-01.neurai.org/',
      },
    ],
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
    'status': 'LISTED',
    'createdAt': '2024-03-10T00:00:00.001Z',
    'updatedAt': '2024-03-10T00:00:00.001Z',
  },
] as unknown as IServerNetwork[];

serverPresetNetworks.unshift(FAKE_ALL_NETWORK);
serverPresetNetworks.push(FAKE_NOSTR_NETWORK);

export { serverPresetNetworks };

export const OnekeyNetworkUpdatedAt = 1685492989977;
