import { UI_RESPONSE } from '@onekeyfe/hwk-adapter-core/ui-events';

import type { IAdapterUiResponse } from '@onekeyhq/kit-bg/src/services/ServiceHardware/adapters/types';
import {
  EThirdPartyHardwareUiAction,
  type IThirdPartyHardwareUiState,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { EHardwareVendor } from '@onekeyhq/shared/types/device';

export function createThirdPartyDeviceSelectionDialogCallbacks({
  vendor,
  requestId,
  dialogInstanceRef,
  settledRef,
  uiResponse,
  cancel,
  clearState,
}: {
  vendor: EHardwareVendor;
  requestId?: string;
  dialogInstanceRef: { current: unknown | null };
  settledRef: { current: boolean };
  uiResponse: (params: {
    vendor: EHardwareVendor;
    response: IAdapterUiResponse;
  }) => Promise<void>;
  cancel: (params: { vendor: EHardwareVendor }) => Promise<void>;
  clearState: () => Promise<void>;
}) {
  return {
    onSelected: async (searchTargetId: string) => {
      if (settledRef.current) return;
      settledRef.current = true;
      try {
        await uiResponse({
          vendor,
          response: {
            type: UI_RESPONSE.RECEIVE_SELECT_DEVICE,
            payload: {
              sdkConnectId: searchTargetId,
              ...(requestId ? { requestId } : {}),
            },
          },
        });
      } catch {
        if (requestId) {
          await uiResponse({
            vendor,
            response: {
              type: UI_RESPONSE.RECEIVE_SELECT_DEVICE,
              payload: { requestId, cancelled: true },
            },
          });
        } else await cancel({ vendor });
      } finally {
        await clearState();
      }
    },
    onClose: async () => {
      dialogInstanceRef.current = null;
      try {
        if (!settledRef.current) {
          settledRef.current = true;
          if (requestId) {
            await uiResponse({
              vendor,
              response: {
                type: UI_RESPONSE.RECEIVE_SELECT_DEVICE,
                payload: { requestId, cancelled: true },
              },
            });
          } else await cancel({ vendor });
        }
      } finally {
        await clearState();
      }
    },
  };
}

export function buildThirdPartyHardwareUiResponse(
  action: EThirdPartyHardwareUiAction | undefined,
  confirmed: boolean,
  extras?: {
    tag?: string;
    passphrase?: string;
    passphraseOnDevice?: boolean;
    save?: boolean;
    pin?: string;
    qrResponse?: { urType: string; urData: string };
  },
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
    case EThirdPartyHardwareUiAction.requestTrezorPassphrase:
      if (!confirmed) return null;
      return {
        type: UI_RESPONSE.RECEIVE_PASSPHRASE,
        payload: {
          value: extras?.passphrase ?? '',
          passphraseOnDevice: extras?.passphraseOnDevice === true,
          save: extras?.save === true,
        },
      };
    case EThirdPartyHardwareUiAction.requestTrezorPin:
      // The payload IS the matrix position string the user tapped against the
      // scrambled grid on the device; `confirmed=false` maps to cancel.
      if (!confirmed) return null;
      return {
        type: UI_RESPONSE.RECEIVE_PIN,
        payload: extras?.pin ?? '',
      };
    case EThirdPartyHardwareUiAction.requestKeystoneQrDisplay:
    case EThirdPartyHardwareUiAction.requestKeystoneQrScan:
      // No confirm/deny — the response IS the UR the app scanned off the
      // device's screen. `confirmed=false` (camera/user cancel) drops it.
      if (!confirmed || !extras?.qrResponse) return null;
      return {
        type: UI_RESPONSE.RECEIVE_QR_RESPONSE,
        payload: extras.qrResponse,
      };
    default:
      return null;
  }
}

export async function clearThirdPartyHardwareUiStateIfCurrent({
  expectedState,
  clearInBackground,
}: {
  expectedState: IThirdPartyHardwareUiState | undefined;
  clearInBackground: (params: {
    expectedRequestId: string;
  }) => Promise<boolean>;
}): Promise<boolean> {
  if (!expectedState?.uiRequestId) return false;
  return clearInBackground({ expectedRequestId: expectedState.uiRequestId });
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
