import { EBulkSendMode } from '../../types/bulkSend';
import { getNetworkIdsMap } from '../config/networkIds';
import { ETranslations } from '../locale';
import { appLocale } from '../locale/appLocale';

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
      return appLocale.intl.formatMessage({
        id: ETranslations.wallet_bulk_send_mode_one_to_many,
      });
    case EBulkSendMode.ManyToOne:
      return appLocale.intl.formatMessage({
        id: ETranslations.wallet_bulk_send_mode_many_to_one,
      });
    case EBulkSendMode.ManyToMany:
      return appLocale.intl.formatMessage({
        id: ETranslations.wallet_bulk_send_mode_many_to_many,
      });
    default:
      return appLocale.intl.formatMessage({
        id: ETranslations.wallet_bulk_send_mode_unknown,
      });
  }
}

export default {
  fixBulkSendSupportedNetworkId,
  getBulkSendSupportedEVMNetworkIds,
  getBulkSendSupportedNetworkIds,
  getBulkSendModeLabel,
};
