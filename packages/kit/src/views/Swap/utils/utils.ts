import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { ISwapNetwork } from '@onekeyhq/shared/types/swap/types';
import { ESwapTxHistoryStatus } from '@onekeyhq/shared/types/swap/types';

import type { ColorValue } from 'react-native';

export function validateAmountInput(text: string, decimal?: number) {
  const regex = new RegExp(
    `^$|^0(\\.\\d{0,${decimal ?? 6}})?$|^[1-9]\\d*(\\.\\d{0,${
      decimal ?? 6
    }})?$|^[1-9]\\d*\\.$|^0\\.$`,
  );
  if (!regex.test(text)) {
    return false;
  }
  return true;
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

export function moveNetworkToFirst(arr: ISwapNetwork[], networkId: string) {
  const networks = [...arr];
  const index = networks.findIndex((item) => item.networkId === networkId);
  if (index !== -1) {
    const item = networks.splice(index, 1)[0];
    networks.splice(0, 0, item);
  }
  return networks;
}

export function getSwapHistoryStatusTextProps(status: ESwapTxHistoryStatus): {
  key: ETranslations;
  color: ColorValue;
} {
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

  if (status === ESwapTxHistoryStatus.DISCARD) {
    return {
      key: ETranslations.swap_history_status_discard,
      color: '$textCritical',
    };
  }

  return {
    key: ETranslations.swap_history_status_failed,
    color: '$textCritical',
  };
}
