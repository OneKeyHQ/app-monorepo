import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';

import { getNetworkIdsMap } from '../../src/config/networkIds';

const getSwapTokenMap = memoizee(
  (): Record<
    string,
    {
      contractAddress: string;
      symbol: string;
    }
  > => {
    const networkIdsMap = getNetworkIdsMap();
    return {
      [networkIdsMap.btc]: {
        contractAddress: '',
        symbol: 'BTC',
      },
      [networkIdsMap.eth]: {
        contractAddress: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
        symbol: 'ETH',
      },
      [networkIdsMap.sol]: {
        contractAddress: 'So11111111111111111111111111111111111111112',
        symbol: 'SOL',
      },
      [networkIdsMap.bsc]: {
        contractAddress: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
        symbol: 'BNB',
      },
      [networkIdsMap.polygon]: {
        contractAddress: '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270',
        symbol: 'POL',
      },
      [networkIdsMap.avalanche]: {
        contractAddress: '0x0000000000000000000000000000000000000000',
        symbol: 'AVAX',
      },
      [networkIdsMap.apt]: {
        contractAddress: '0x1::aptos_coin::AptosCoin',
        symbol: 'APT',
      },
      [networkIdsMap.kaspa]: {
        contractAddress: '',
        symbol: 'KAS',
      },
      [networkIdsMap.ton]: {
        contractAddress: 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c',
        symbol: 'TON',
      },
      [networkIdsMap.sui]: {
        contractAddress: '0x2::sui::SUI',
        symbol: 'SUI',
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
      tokenSymbol.toUpperCase() === item.symbol &&
      item.contractAddress === contractAddress;
    return {
      isNative,
    };
  }
  return undefined;
}
