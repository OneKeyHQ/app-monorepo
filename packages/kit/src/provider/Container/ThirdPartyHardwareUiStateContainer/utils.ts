import { UI_RESPONSE } from '@onekeyfe/hwk-adapter-core/ui-events';

import type { IAdapterUiResponse } from '@onekeyhq/kit-bg/src/services/ServiceHardware/adapters/types';
import {
  EThirdPartyHardwareUiAction,
  type IThirdPartyHardwareUiState,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { EHardwareVendor } from '@onekeyhq/shared/types/device';

export function createTrezorBleBindingDialogCallbacks({
  promiseId,
  dialogInstanceRef,
  settledRef,
  resolveCallback,
  clearState,
}: {
  promiseId: number;
  dialogInstanceRef: { current: unknown | null };
  settledRef: { current: boolean };
  resolveCallback: (params: {
    id: number;
    data: string | null;
  }) => Promise<void>;
  clearState: () => Promise<void>;
}) {
  return {
    onBound: (connectId: string) => {
      settledRef.current = true;
      void resolveCallback({
        id: promiseId,
        data: connectId,
      });
      void clearState();
    },
    onClose: async () => {
      dialogInstanceRef.current = null;
      if (!settledRef.current) {
        await resolveCallback({
          id: promiseId,
          data: null,
        });
      }
      await clearState();
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
    default:
      return null;
  }
}

export async function clearThirdPartyHardwareUiStateIfCurrent({
  expectedState,
  getState,
  setState,
}: {
  expectedState: IThirdPartyHardwareUiState | undefined;
  getState: () =>
    | IThirdPartyHardwareUiState
    | undefined
    | Promise<IThirdPartyHardwareUiState | undefined>;
  setState: (state: IThirdPartyHardwareUiState | undefined) => Promise<void>;
}): Promise<boolean> {
  const currentState = await getState();
  if (currentState !== expectedState) {
    return false;
  }
  await setState(undefined);
  return true;
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
