import { EBulkSendMode } from '../../types/bulkSend';
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

function getBulkSendModeLabel(bulkSendMode: EBulkSendMode) {
  switch (bulkSendMode) {
    case EBulkSendMode.OneToMany:
      return 'One to Many';
    case EBulkSendMode.ManyToOne:
      return 'Many to One';
    case EBulkSendMode.ManyToMany:
      return 'Many to Many';
    default:
      return 'Unknown';
  }
}

export default {
  fixBulkSendSupportedNetworkId,
  getBulkSendSupportedEVMNetworkIds,
  getBulkSendSupportedNetworkIds,
  getBulkSendModeLabel,
};
