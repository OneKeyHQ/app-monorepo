import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { ISwapNetwork } from '@onekeyhq/shared/types/swap/types';
import {
  ESwapCrossChainStatus,
  ESwapExtraStatus,
  ESwapTxHistoryStatus,
} from '@onekeyhq/shared/types/swap/types';

import type { ColorValue } from 'react-native';

export function validateAmountInputInfiniteDecimal(text: string) {
  // 修改后的正则，支持输入过程中的状态：
  const regex = /^$|^0$|^0\.$|^0\.\d*$|^[1-9]\d*$|^[1-9]\d*\.$|^[1-9]\d*\.\d*$/;
  return regex.test(text);
}

export function truncateDecimalPlaces(str?: string, decimal?: number) {
  if (!str || Number.isNaN(str) || !decimal) {
    return null;
  }
  const parts = str.split('.');
  if (parts.length === 2 && parts[1].length > decimal) {
    parts[1] = parts[1].substring(0, decimal);
    return parts.join('.');
  }
  return str;
}

export function truncateMiddle(
  str?: string,
  prefixLength = 4,
  suffixLength = 4,
  separator = '...',
): string {
  if (!str || str.length <= prefixLength + suffixLength) {
    return str || '';
  }

  const prefix = str.substring(0, prefixLength);
  const suffix = str.substring(str.length - suffixLength);

  return `${prefix}${separator}${suffix}`;
}

export function moveNetworkToFirst(arr: ISwapNetwork[], networkId: string) {
  const networks = [...arr];
  const index = networks.findIndex((item) => item.networkId === networkId);
  if (index !== -1) {
    const item = networks.splice(index, 1)[0];
    networks.splice(0, 0, item);
  }
  return networks;
}

export function getSwapHistoryStatusTextProps(
  status: ESwapTxHistoryStatus,
  extraStatus?: ESwapExtraStatus,
): {
  key: ETranslations;
  color: ColorValue;
} {
  if (extraStatus === ESwapExtraStatus.HOLD) {
    return {
      key: ETranslations.swap_ch_status_hold,
      color: '$textCaution',
    };
  }
  if (status === ESwapTxHistoryStatus.PENDING) {
    return {
      key: ETranslations.swap_history_status_pending,
      color: '$textCaution',
    };
  }

  if (status === ESwapTxHistoryStatus.SUCCESS) {
    return {
      key: ETranslations.swap_history_status_success,
      color: '$textSuccess',
    };
  }

  if (status === ESwapTxHistoryStatus.PARTIALLY_FILLED) {
    return {
      key: ETranslations.Limit_order_history_status_partially_filled,
      color: '$textSuccess',
    };
  }

  if (status === ESwapTxHistoryStatus.CANCELING) {
    return {
      key: ETranslations.swap_history_status_cancelling,
      color: '$textCaution',
    };
  }

  if (status === ESwapTxHistoryStatus.CANCELED) {
    return {
      key: ETranslations.swap_history_status_canceled,
      color: '$textCaution',
    };
  }

  return {
    key: ETranslations.swap_history_status_failed,
    color: '$textCritical',
  };
}

export function getSwapCrossChainStatusTextProps(
  crossChainStatus: ESwapCrossChainStatus,
): {
  key: ETranslations;
  color: ColorValue;
} {
  switch (crossChainStatus) {
    case ESwapCrossChainStatus.FROM_PENDING:
      return {
        key: ETranslations.swap_history_detail_badge_from_pending,
        color: '$textCaution',
      };
    case ESwapCrossChainStatus.FROM_SUCCESS:
      return {
        key: ETranslations.swap_history_detail_badge_from_success,
        color: '$textSuccess',
      };
    case ESwapCrossChainStatus.TO_SUCCESS:
      return {
        key: ETranslations.swap_history_detail_badge_to_success,
        color: '$textSuccess',
      };
    case ESwapCrossChainStatus.TO_PENDING:
      return {
        key: ETranslations.swap_history_detail_badge_to_pending,
        color: '$textCaution',
      };
    case ESwapCrossChainStatus.TO_FAILED:
      return {
        key: ETranslations.swap_history_detail_badge_to_failed,
        color: '$textCritical',
      };
    case ESwapCrossChainStatus.FROM_FAILED:
      return {
        key: ETranslations.swap_history_detail_badge_from_failed,
        color: '$textCritical',
      };
    case ESwapCrossChainStatus.BRIDGE_FAILED:
      return {
        key: ETranslations.swap_history_detail_badge_bridge_failed,
        color: '$textCritical',
      };
    case ESwapCrossChainStatus.BRIDGE_PENDING:
      return {
        key: ETranslations.swap_history_detail_badge_bridge_pending,
        color: '$textCaution',
      };
    case ESwapCrossChainStatus.BRIDGE_SUCCESS:
      return {
        key: ETranslations.swap_history_detail_badge_bridge_success,
        color: '$textSuccess',
      };
    case ESwapCrossChainStatus.EXPIRED:
      return {
        key: ETranslations.swap_history_detail_badge_expired,
        color: '$textCritical',
      };
    case ESwapCrossChainStatus.PROVIDER_ERROR:
      return {
        key: ETranslations.swap_history_detail_badge_provider_error,
        color: '$textCritical',
      };
    case ESwapCrossChainStatus.REFUNDED:
      return {
        key: ETranslations.swap_history_detail_badge_refunded,
        color: '$textSuccess',
      };
    case ESwapCrossChainStatus.REFUND_FAILED:
      return {
        key: ETranslations.swap_history_detail_badge_refund_failed,
        color: '$textCritical',
      };
    case ESwapCrossChainStatus.REFUNDING:
      return {
        key: ETranslations.swap_history_detail_badge_refunding,
        color: '$textCaution',
      };
    default:
      return {
        key: ETranslations.swap_history_status_pending,
        color: '$textCaution',
      };
  }
}
