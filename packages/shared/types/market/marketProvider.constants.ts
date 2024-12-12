import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';

import { getNetworkIdsMap } from '../../src/config/networkIds';

const getSwapTokenMap = memoizee(
  (): Record<
    string,
    {
      contractAddress: string;
      default: {
        contractAddress: string;
        networkId: string;
        name: string;
        symbol: string;
        decimals: number;
        isNative: boolean;
        networkLogoURI?: string;
      };
    }
  > => {
    const networkIdsMap = getNetworkIdsMap();
    return {
      [networkIdsMap.btc]: {
        contractAddress: '',
        default: {
          'contractAddress': '',
          'networkId': 'btc--0',
          'name': 'Bitcoin',
          'symbol': 'BTC',
          'decimals': 8,
          'isNative': true,
        },
      },
      [networkIdsMap.eth]: {
        contractAddress: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
        default: {
          'networkId': 'evm--1',
          'contractAddress': '',
          'name': 'Ethereum',
          'symbol': 'ETH',
          'decimals': 18,
          'isNative': true,
          'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/eth.png',
        },
      },
      [networkIdsMap.sol]: {
        contractAddress: 'So11111111111111111111111111111111111111112',
        default: {
          'networkId': 'sol--101',
          'contractAddress': '',
          'name': 'Solana',
          'symbol': 'SOL',
          'decimals': 9,
          'isNative': true,
        },
      },
      [networkIdsMap.bsc]: {
        contractAddress: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
        default: {
          'networkId': 'evm--56',
          'contractAddress': '',
          'name': 'BNB',
          'symbol': 'BNB',
          'decimals': 18,
          'isNative': true,
        },
      },
      [networkIdsMap.polygon]: {
        contractAddress: '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270',
        default: {
          'contractAddress': '',
          'networkId': 'evm--137',
          'name': 'Polygon',
          'symbol': 'POL',
          'decimals': 18,
          'isNative': true,
        },
      },
      [networkIdsMap.apt]: {
        contractAddress: '0x1::aptos_coin::AptosCoin',
        default: {
          'contractAddress': '',
          'networkId': 'aptos--1',
          'name': 'Aptos Coin',
          'symbol': 'APT',
          'decimals': 8,
          'isNative': true,
        },
      },
    };
  },
);

export const getNetworkIdBySymbol = memoizee((symbol: string) => {
  const networkIdsMap = getNetworkIdsMap();
  switch (symbol) {
    case 'btc':
      return networkIdsMap.btc;
    default:
      return undefined;
  }
});

export function getImportFromToken({
  networkId,
  tokenSymbol,
  contractAddress,
}: {
  networkId: string;
  tokenSymbol: string;
  contractAddress: string;
}) {
  const map = getSwapTokenMap();
  const item = map[networkId];
  if (item) {
    const isNative =
      tokenSymbol.toUpperCase() === item.default.symbol &&
      item.contractAddress === contractAddress;
    return {
      isNative,
      importFromToken: isNative ? item.target : item.default,
    };
  }
  return undefined;
}
