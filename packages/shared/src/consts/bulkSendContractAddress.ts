import { getNetworkIdsMap } from '../config/networkIds';
import { memoFn } from '../utils/cacheUtils';

export const getBulkSendContractAddress = memoFn((): Record<string, string> => {
  const networkIdsMap = getNetworkIdsMap();
  return {
    [networkIdsMap.avalanche]: '0x8bc221e5ebdc356837dc7b435f04dea9e0829f28',
    // Add more network addresses here as they are deployed
    // [networkIdsMap.eth]: '0x...',
    // [networkIdsMap.bsc]: '0x...',
    // [networkIdsMap.polygon]: '0x...',
    // [networkIdsMap.arbitrum]: '0x...',
    // [networkIdsMap.optimism]: '0x...',
    // [networkIdsMap.base]: '0x...',
    // [networkIdsMap.linea]: '0x...',
    // [networkIdsMap.zksyncera]: '0x...',
  };
});
