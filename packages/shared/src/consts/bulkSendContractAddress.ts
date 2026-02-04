import { getNetworkIdsMap } from '../config/networkIds';
import { memoFn } from '../utils/cacheUtils';

export const getBulkSendContractAddress = memoFn((): Record<string, string> => {
  const networkIdsMap = getNetworkIdsMap();
  return {
    [networkIdsMap.eth]: '0xa973f926c71615bae7648c172016e92ebb35d128',
    [networkIdsMap.avalanche]: '0x8bc221e5ebdc356837dc7b435f04dea9e0829f28',
    [networkIdsMap.bsc]: '0x2857b554dfa0030847d62f0d383e958deca6ce0e',
    [networkIdsMap.arbitrum]: '0xb7da2cb2e7eda63579a14d7d11753085f554e1c4',
    [networkIdsMap.base]: '0x88cb0c6d9f7371df92646657b84d01ba62094f85',
    [networkIdsMap.optimism]: '0x5152e3587f74a922240213575a54cd7e41a6ecab',
    [networkIdsMap.linea]: '0xedfd1f91f564ac4dabe1cb71e759417d908296ea',
    [networkIdsMap.zksyncera]: '0xb4d0bf1fc82d8a94fd5c49c2dd9c37ce261bee70',
    [networkIdsMap.polygon]: '0x1253f1a208be6e0626d4f2c3eb087a220d9c3f26',
    [networkIdsMap.trx]: 'TMV7ef6pv8vPknRN2s9hiikL8U3botSgPy',
  };
});
