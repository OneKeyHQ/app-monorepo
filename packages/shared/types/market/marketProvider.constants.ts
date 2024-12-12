import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';

import { getNetworkIdsMap } from '../../src/config/networkIds';

// TODO: This token configuration list should be moved to backend service
const getSwapTokenMap = memoizee(
  (): Record<
    string,
    {
      contractAddress: string;
      symbol: string;
      realContractAddress: string;
    }
  > => {
    const networkIdsMap = getNetworkIdsMap();
    return {
      [networkIdsMap.btc]: {
        contractAddress: '',
        symbol: 'BTC',
        realContractAddress: '',
      },
      [networkIdsMap.eth]: {
        contractAddress: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
        symbol: 'ETH',
        realContractAddress: '',
      },
      [networkIdsMap.sol]: {
        contractAddress: 'So11111111111111111111111111111111111111112',
        symbol: 'SOL',
        realContractAddress: '',
      },
      [networkIdsMap.bsc]: {
        contractAddress: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
        symbol: 'BNB',
        realContractAddress: '',
      },
      [networkIdsMap.polygon]: {
        contractAddress: '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270',
        symbol: 'POL',
        realContractAddress: '',
      },
      [networkIdsMap.avalanche]: {
        contractAddress: '0x0000000000000000000000000000000000000000',
        symbol: 'AVAX',
        realContractAddress: '',
      },
      [networkIdsMap.apt]: {
        contractAddress: '0x1::aptos_coin::AptosCoin',
        symbol: 'APT',
        realContractAddress: '',
      },
      [networkIdsMap.kaspa]: {
        contractAddress: '',
        symbol: 'KAS',
        realContractAddress: '',
      },
      [networkIdsMap.ton]: {
        contractAddress: 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c',
        symbol: 'TON',
        realContractAddress: '',
      },
      [networkIdsMap.sui]: {
        contractAddress: '0x2::sui::SUI',
        symbol: 'SUI',
        realContractAddress: '0x2::sui::SUI',
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
      realContractAddress: item.realContractAddress,
    };
  }
  return undefined;
}
