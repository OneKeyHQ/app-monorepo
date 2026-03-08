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
  let isSupported = false;
  let fixedNetworkId = networkId;
  const supportedNetworkIds = getBulkSendSupportedNetworkIds();
  if (supportedNetworkIds.includes(networkId)) {
    isSupported = true;
    return {
      fixedNetworkId,
      isSupported,
    };
  }

  if (networkUtils.isEvmNetwork({ networkId })) {
    fixedNetworkId = getBulkSendSupportedEVMNetworkIds()[0];
  } else {
    fixedNetworkId = supportedNetworkIds[0];
  }

  return {
    fixedNetworkId,
    isSupported,
  };
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
