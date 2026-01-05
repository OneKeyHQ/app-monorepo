import { getNetworkIdsMap } from '../config/networkIds';

import networkUtils from './networkUtils';

function getBulkSendSupportedEVMNetworkIds() {
  const networkIdsMap = getNetworkIdsMap();
  return [
    networkIdsMap.eth,
    networkIdsMap.bsc,
    networkIdsMap.arbitrum,
    networkIdsMap.polygon,
    networkIdsMap.base,
    networkIdsMap.optimism,
    networkIdsMap.avalanche,
    networkIdsMap.linea,
    networkIdsMap.zksyncera,
  ];
}

function getBulkSendSupportedNetworkIds() {
  const networkIdsMap = getNetworkIdsMap();
  const supportedEVMNetworkIds = getBulkSendSupportedEVMNetworkIds();
  return [...supportedEVMNetworkIds, networkIdsMap.trx];
}

function fixBulkSendSupportedNetworkId({ networkId }: { networkId: string }) {
  const supportedNetworkIds = getBulkSendSupportedNetworkIds();
  if (supportedNetworkIds.includes(networkId)) {
    return networkId;
  }

  if (networkUtils.isEvmNetwork({ networkId })) {
    return getBulkSendSupportedEVMNetworkIds()[0];
  }

  return supportedNetworkIds[0];
}

export default {
  fixBulkSendSupportedNetworkId,
  getBulkSendSupportedEVMNetworkIds,
  getBulkSendSupportedNetworkIds,
};
