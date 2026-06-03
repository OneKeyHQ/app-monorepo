/* eslint-disable @typescript-eslint/no-unused-vars */

import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import type { EHardwareUiStateAction } from '@onekeyhq/shared/src/utils/deviceUtils';
import type {
  EFirmwareUpdateTipMessages,
  EHardwareVendor,
  EOneKeyDeviceMode,
  IBleFirmwareUpdateInfo,
  IBootloaderUpdateInfo,
  IDeviceFirmwareType,
  IFirmwareUpdateInfo,
  IFirmwareUpdatesDetectStatus,
} from '@onekeyhq/shared/types/device';

import { EAtomNames } from '../atomNames';
import { globalAtom } from '../utils';

import type { IDeviceType } from '@onekeyfe/hd-core';

export { EHardwareUiStateAction } from '@onekeyhq/shared/src/utils/deviceUtils';
export type IHardwareUiPayload = {
  uiRequestType: string; // EHardwareUiStateAction
  eventType: string;
  // ----------------------------------------------
  deviceType: IDeviceType;
  deviceId: string;
  connectId: string;
  deviceMode: EOneKeyDeviceMode;
  isBootloaderMode?: boolean;
  // request passphrase
  passphraseState?: string; // use passphrase, REQUEST_PASSPHRASE_ON_DEVICE only
  existsAttachPinUser?: boolean; // use attach pin, REQUEST_PASSPHRASE_ON_DEVICE only
  // firmware update tip
  firmwareTipData?: {
    message: EFirmwareUpdateTipMessages | string;
  };
  // firmware update progress
  firmwareProgress?: number;
  firmwareProgressType?: 'transferData' | 'installingFirmware';
  rawPayload: any;
  // request pin type
  requestPinType?: 'PinEntry' | 'AttachPin';
  // service promise for waiting user interaction
  promiseId?: string;
};
export type IHardwareUiState = {
  action: EHardwareUiStateAction;
  connectId: string;
  payload?: IHardwareUiPayload;
};

export enum EFirmwareUpdateSteps {
  init = 'init',
  error = 'error', // error occurred in whole update process, installing phase error will use retry
  checkReleaseError = 'checkReleaseError', // check release error
  showChangeLog = 'showChangeLog',
  showCheckList = 'showCheckList',
  updateStart = 'updateStart', // updateStart
  installing = 'installing', // installingPhase: 1 boot, 2 fw res, 3 ble
  updateDone = 'updateDone', // updateDone
  requestDeviceInBootloaderForWebDevice = 'requestDeviceInBootloaderForWebDevice', // web-usb should requestDevice for bootloader mode device, cause pid was changed
  requestDeviceForSwitchFirmwareWebDevice = 'requestDeviceForSwitchFirmwareWebDevice', // switch firmware need to re-select device.
}
export type IFirmwareUpdateStepInfo =
  | {
      step: EFirmwareUpdateSteps.init;
      payload: undefined;
    }
  | {
      step: EFirmwareUpdateSteps.error;
      payload: {
        error: IOneKeyError;
      };
    }
  | {
      step: EFirmwareUpdateSteps.checkReleaseError;
      payload: {
        error: IOneKeyError;
      };
    }
  | {
      step: EFirmwareUpdateSteps.showChangeLog;
      payload: undefined;
    }
  | {
      step: EFirmwareUpdateSteps.showCheckList;
      payload: undefined;
    }
  | {
      step: EFirmwareUpdateSteps.updateStart;
      payload: {
        startAtTime: number;
      };
    }
  | {
      step: EFirmwareUpdateSteps.installing;
      payload: {
        installingTarget?: {
          totalPhase: IDeviceFirmwareType[];
          currentPhase: IDeviceFirmwareType;
          updateInfo:
            | IBootloaderUpdateInfo
            | IBleFirmwareUpdateInfo
            | IFirmwareUpdateInfo;
        };
      };
    }
  | {
      step: EFirmwareUpdateSteps.updateDone;
      payload?: {
        needOnboarding?: boolean;
      };
    }
  | {
      step: EFirmwareUpdateSteps.requestDeviceInBootloaderForWebDevice;
      payload: undefined;
    }
  | {
      step: EFirmwareUpdateSteps.requestDeviceForSwitchFirmwareWebDevice;
      payload: undefined;
    };

export type IFirmwareUpdateRetry = {
  id: number;
  error: IOneKeyError;
};

// hardware ui state ----------------------------------------------

export const { target: hardwareUiStateAtom, use: useHardwareUiStateAtom } =
  globalAtom<IHardwareUiState | undefined>({
    initialValue: undefined,
    name: EAtomNames.hardwareUiStateAtom,
  });
export const {
  target: hardwareUiStateCompletedAtom,
  use: useHardwareUiStateCompletedAtom,
} = globalAtom<IHardwareUiState | undefined>({
  initialValue: undefined,
  name: EAtomNames.hardwareUiStateCompletedAtom,
});

// third-party hardware ui state -----------------------------------

export enum EThirdPartyHardwareUiAction {
  // Blocking requests — UI waits for user response.
  // SDK found no device; ask the user to make it available and retry.
  requestDeviceNotFound = 'request-ledger-device-not-found',
  // Ledger BTC requires explicit user approval before using index >= 100.
  requestBtcHighIndexConfirm = 'request-ledger-btc-high-index-confirm',
  // Non-blocking notifications — UI shows status.
  openApp = 'ui-event-ledger-open-app',
  confirmOnDevice = 'ui-event-ledger-confirm-on-device',
  searching = 'ui-event-ledger-searching',
  connecting = 'ui-event-ledger-connecting',
  processing = 'ui-event-ledger-processing',
  done = 'ui-event-ledger-done',
  // Toast only; DMK keeps polling until the device is unlocked.
  unlockDevice = 'ui-event-ledger-unlock-device',
  error = 'ui-event-ledger-error',
}

/** Actions shown as a passive toast (user acts on the physical device, not in the app). */
const TOAST_ACTIONS = new Set<string>([
  EThirdPartyHardwareUiAction.confirmOnDevice,
  EThirdPartyHardwareUiAction.openApp,
  EThirdPartyHardwareUiAction.searching,
  EThirdPartyHardwareUiAction.unlockDevice,
]);

/** Is this a non-interactive notification that should show as a Toast (not Dialog)? */
export function isThirdPartyToastAction(action: string | undefined): boolean {
  return !!action && TOAST_ACTIONS.has(action);
}

/** Is this a "confirm on device" action specifically? (used by ReceiveToken for address display) */
export function isThirdPartyConfirmOnDevice(
  action: string | undefined,
): boolean {
  return action === EThirdPartyHardwareUiAction.confirmOnDevice;
}

export type IThirdPartyHardwareUiState = {
  action: EThirdPartyHardwareUiAction;
  vendor: EHardwareVendor;
  payload?: {
    message?: string;
    chain?: string;
    /** SDK request reason used for UI copy. */
    reason?: string;
    /** BIP-44 path that triggered the request (e.g. requestBtcHighIndexConfirm). */
    path?: string;
    /** Account index parsed from the path (e.g. requestBtcHighIndexConfirm). */
    accountIndex?: number;
  };
};

export const {
  target: thirdPartyHardwareUiStateAtom,
  use: useThirdPartyHardwareUiStateAtom,
} = globalAtom<IThirdPartyHardwareUiState | undefined>({
  initialValue: undefined,
  name: EAtomNames.thirdPartyHardwareUiStateAtom,
});

// Dedicated state for the in-flight app-install dialog (autoInstallApp).
// Kept separate from the single-slot ui-state atom so the install dialog
// (shown imperatively, like the BLE permission dialog) coexists with device
// prompt toasts without fighting for the slot. `progress` undefined = still
// awaiting the user's install confirmation; a number (0..1) = installing.
export type IThirdPartyAppInstallState = {
  vendor: EHardwareVendor;
  appName: string;
  progress?: number;
};

export const {
  target: thirdPartyAppInstallAtom,
  use: useThirdPartyAppInstallAtom,
} = globalAtom<IThirdPartyAppInstallState | undefined>({
  initialValue: undefined,
  name: EAtomNames.thirdPartyAppInstallAtom,
});

// firmware update ----------------------------------------------

export const {
  target: firmwareUpdatesDetectStatusPersistAtom,
  use: useFirmwareUpdatesDetectStatusPersistAtom,
} = globalAtom<IFirmwareUpdatesDetectStatus | undefined>({
  initialValue: undefined,
  name: EAtomNames.firmwareUpdatesDetectStatusPersistAtom,
  persist: true,
});

export const {
  target: firmwareUpdateRetryAtom,
  use: useFirmwareUpdateRetryAtom,
} = globalAtom<IFirmwareUpdateRetry | undefined>({
  initialValue: undefined,
  name: EAtomNames.firmwareUpdateRetryAtom,
});

export const {
  target: firmwareUpdateStepInfoAtom,
  use: useFirmwareUpdateStepInfoAtom,
} = globalAtom<IFirmwareUpdateStepInfo>({
  initialValue: {
    step: EFirmwareUpdateSteps.init,
    payload: undefined,
  },
  name: EAtomNames.firmwareUpdateStepInfoAtom,
});

export const {
  target: firmwareUpdateWorkflowRunningAtom,
  use: useFirmwareUpdateWorkflowRunningAtom,
} = globalAtom<boolean>({
  initialValue: false,
  name: EAtomNames.firmwareUpdateWorkflowRunningAtom,
});

export const {
  target: firmwareUpdateResultVerifyAtom,
  use: useFirmwareUpdateResultVerifyAtom,
} = globalAtom<
  | {
      finalBleVersion: string;
      finalFirmwareVersion: string;
      finalBootloaderVersion: string;
    }
  | undefined
>({
  initialValue: undefined,
  name: EAtomNames.firmwareUpdateResultVerifyAtom,
});

// hardware xfp generate ----------------------------------------------
export type IHardwareWalletXfpStatus = {
  [walletId: string]: {
    xfpMissing: boolean;
  };
};
export const {
  target: hardwareWalletXfpStatusAtom,
  use: useHardwareWalletXfpStatusAtom,
} = globalAtom<IHardwareWalletXfpStatus>({
  initialValue: {},
  name: EAtomNames.hardwareWalletXfpStatusAtom,
});
