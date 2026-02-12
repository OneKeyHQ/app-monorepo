/**
 * Bulk send contract addresses (non-upgradeable).
 * Redeployment required for updates, which changes addresses.
 * CAUTION: Modifications require approval before merging.
 */
import { getNetworkIdsMap } from '../config/networkIds';
import { memoFn } from '../utils/cacheUtils';

export const getBulkSendContractAddress = memoFn((): Record<string, string> => {
  const networkIdsMap = getNetworkIdsMap();
  return {
    [networkIdsMap.eth]: '0x0BD5E65B518a9E8227356AB2c9BF2d43A130755e',
    [networkIdsMap.avalanche]: '0x965ed50B833fe7A7eA0F4f4Ad5264e5bCB1758e5',
    [networkIdsMap.bsc]: '0xEc144b480ffa3D400E0FF12bf6d72c7cE9b64c43',
    [networkIdsMap.arbitrum]: '0xC3143A2593dC4f0d625Ea641e2e8eFB23D12803a',
    [networkIdsMap.base]: '0x8C263284c2ed73Fdd931aCd9f19aa9e328D09d81',
    [networkIdsMap.optimism]: '0x9E99A92ccf2D2a1A479285a626aFA36e9314e76a',
    [networkIdsMap.linea]: '0xab9cd487d1eC452fc7911511CF014A129Dc50CEC',
    [networkIdsMap.zksyncera]: '0xedfd1f91f564Ac4dABe1cB71E759417D908296Ea',
    [networkIdsMap.polygon]: '0x85D0a436A0dA732530E40428a6Eea8ABB9874fDF',
    [networkIdsMap.trx]: 'TESTqS24yjoT4XeWcCyM3WwXCLUMXpsd1Y',
  };
});
