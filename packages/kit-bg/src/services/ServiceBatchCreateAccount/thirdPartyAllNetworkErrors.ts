import { HardwareErrorCode as ThirdPartyHwErrorCode } from '@onekeyfe/hwk-adapter-core';

import { THIRD_PARTY_HW_INSTALL_APP_USER_CANCEL_CODE } from '@onekeyhq/shared/src/errors/errors/thirdPartyHardwareErrors';

import type { IHwAllNetworkPrepareAccountsItem } from '../../vaults/types';

export function normalizeAllNetworkInstallCancelErrors(
  items: IHwAllNetworkPrepareAccountsItem[],
) {
  if (items.length <= 1 || !items.some((item) => item.success)) {
    return items;
  }

  return items.map((item) => {
    if (
      item.success ||
      Number(item.payload?.code) !== ThirdPartyHwErrorCode.UserAborted
    ) {
      return item;
    }

    return {
      ...item,
      payload: item.payload
        ? {
            ...item.payload,
            code: THIRD_PARTY_HW_INSTALL_APP_USER_CANCEL_CODE,
          }
        : item.payload,
    };
  });
}
