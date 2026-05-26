import { UI_RESPONSE } from '@onekeyfe/hwk-adapter-core';

import type { IAdapterUiResponse } from '@onekeyhq/kit-bg/src/services/ServiceHardware/adapters/types';
import {
  EThirdPartyHardwareUiAction,
  type IThirdPartyHardwareUiState,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { EHardwareVendor } from '@onekeyhq/shared/types/device';

export function buildThirdPartyHardwareUiResponse(
  action: EThirdPartyHardwareUiAction | undefined,
  confirmed: boolean,
  extras?: { tag?: string },
): IAdapterUiResponse | null {
  switch (action) {
    case EThirdPartyHardwareUiAction.requestDeviceNotFound:
      return {
        type: UI_RESPONSE.RECEIVE_DEVICE_CONNECT,
        payload: { confirmed },
      };
    case EThirdPartyHardwareUiAction.requestBtcHighIndexConfirm:
      return {
        type: UI_RESPONSE.RECEIVE_BTC_HIGH_INDEX_CONFIRM,
        payload: { confirmed },
      };
    case EThirdPartyHardwareUiAction.requestTrezorThpPairing:
      // No confirm/deny — the response IS the pairing tag the user typed
      // off the device screen. `confirmed=false` is mapped to cancel.
      if (!confirmed || !extras?.tag) return null;
      return {
        type: UI_RESPONSE.RECEIVE_TREZOR_THP_PAIRING,
        payload: { tag: extras.tag },
      };
    default:
      return null;
  }
}

export async function cancelThirdPartyHardwareUiRequest({
  state,
  uiResponse,
  cancel,
  clearState,
}: {
  state: IThirdPartyHardwareUiState | undefined;
  uiResponse: (params: {
    vendor: EHardwareVendor;
    response: IAdapterUiResponse;
  }) => Promise<void>;
  cancel: (params: { vendor: EHardwareVendor }) => Promise<void>;
  clearState: () => Promise<void>;
}) {
  const vendor = state?.vendor;
  const action = state?.action;
  try {
    if (vendor) {
      const response = buildThirdPartyHardwareUiResponse(action, false);
      if (response) {
        await uiResponse({ vendor, response });
      } else {
        await cancel({ vendor });
      }
    }
  } finally {
    await clearState();
  }
}
