/* eslint-disable @typescript-eslint/no-unused-vars */

import type { IAirGapUrJson } from '@onekeyhq/qr-wallet-sdk';
import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';
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
import type {
  IDeviceStageAuthChecklistItem,
  IDeviceStageAuthFailureReasonValue,
  IDeviceStageConfirmContent,
  IDeviceStageConfirmDetail,
  IDeviceStageErrorI18n,
  IDeviceStageErrorReasonValue,
  IDeviceStageStepValue,
} from '@onekeyhq/shared/types/deviceStage';
import type { EHardwareUiStateAction } from '@onekeyhq/shared/types/hardwareUi';

import { EAtomNames } from '../atomNames';
import { globalAtom } from '../utils';

import type { IDeviceType } from '@onekeyfe/hd-core';

export { EHardwareUiStateAction } from '@onekeyhq/shared/types/hardwareUi';
export type IHardwareUiResponseCorrelation = {
  interactionId: string;
  deviceId: string;
};

export type IFirmwareTransferMetrics = {
  transferredBytes?: number;
  totalBytes?: number;
  rateBytesPerSecond?: number;
  elapsedMs?: number;
};

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
  passphraseState?: string; // Wallet identity used to verify a passphrase recovery request.
  existsAttachPinUser?: boolean; // Show the existing Attach PIN entry during wallet selection.
  deviceOnly?: boolean;
  source?: 'wallet-session-coordinator';
  reason?: 'open-wallet' | 'session-recovery';
  expectedPassphraseState?: string;
  uiResponseCorrelation?: IHardwareUiResponseCorrelation;
  // firmware update tip
  firmwareTipData?: {
    message: EFirmwareUpdateTipMessages | string;
  };
  // firmware update progress
  firmwareProgress?: number;
  firmwareProgressType?: 'transferData' | 'installingFirmware';
  firmwareInstallTargetId?: number;
  firmwareInstallPhase?: 'prepare' | 'install' | 'verify';
  firmwareInstallPhaseProgress?: number;
  firmwareTransferMetrics?: IFirmwareTransferMetrics;
  // generic device data transfer progress
  deviceProgress?: {
    progress?: number;
    transferredBytes?: number;
    totalBytes?: number;
    rateBytesPerSecond?: number;
    elapsedMs?: number;
  };
  rawPayload: any;
  // request pin type
  requestPinType?: 'PinEntry' | 'AttachPin';
  // The stage's enterPin card may offer "Prefer to enter PIN in app?"
  // (OK-61489). Set only on the button-device on-device-entry route when
  // the opt-in would actually take: a stored device record to write, app
  // entry supported by firmware, and a plain (non attach-PIN) request.
  pinSwitchToAppAvailable?: boolean;
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
        isDownloadingArtifacts?: boolean;
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

// device stage (OK-59934) ----------------------------------------

/**
 * The DeviceStage driver's single source of truth. One burst = one stage
 * entrance/exit: the burst scope in ServiceHardwareUI owns every write, and
 * the DeviceStageContainer renders purely from it. `step: 'off'` is the only
 * state that plays the exit animation.
 */
export type IDeviceStageState = {
  /** Monotonic id; a new burst resets the container's close-grant policy. */
  burstId: number;
  step: IDeviceStageStepValue;
  connectId?: string;
  deviceType?: IDeviceType;
  deviceName?: string;
  /** Third-party track: dresses the stage for Trezor / Ledger. */
  vendor?: EHardwareVendor;
  /** SDK model code (T3W1 / nanoX …) → the capsule's real product shot. */
  vendorModel?: string;
  vendorModelName?: string;
  /** The original third-party action — the container builds UI responses
   * from it without reverse-mapping steps. */
  thirdPartyAction?: EThirdPartyHardwareUiAction;
  /** Install steps: coin app name, real SDK progress (0–100), batch queue. */
  appName?: string;
  installProgress?: number;
  installQueue?: string[];
  installActiveIndex?: number;
  btcHighIndexPath?: string;
  btcHighIndexAccountIndex?: number;
  /** Authenticity flow: the per-component checklist and what ended it. */
  authChecklist?: IDeviceStageAuthChecklistItem[];
  authFailureReason?: IDeviceStageAuthFailureReasonValue;
  /** Fallback failure detail (v6.5.0 dialog parity): the real error
   * message stands in for the generic unknown title and the code rides
   * as a suffix. Display-ready strings — the runner resolves ids. */
  authFailureMessage?: string;
  authFailureCode?: string;
  errorReason?: IDeviceStageErrorReasonValue;
  /**
   * The failure's own words, for the outcomes no reason claims. The
   * legacy toast spoke them and the stage suppresses that toast, so
   * without this the specific message is lost and the card falls back
   * to "Something went wrong". Used as a fallback when no translation
   * is available in the UI runtime.
   */
  errorMessage?: string;
  errorI18n?: IDeviceStageErrorI18n;
  /** Inline retry line for the active input panel (wrong PIN etc.). */
  inputError?: string;
  passphraseMode?: 'create' | 'verify';
  /** Air-gap track (doc §4.6): the request UR the showQr card presents,
   * animated by the panel itself. Carried across showQr ⇄ scanQr — the
   * way back re-presents the same code — and cleared everywhere else. */
  qrValueUr?: IAirGapUrJson;
  /** The air-gap session's tag: the viewfinder echoes it back with the
   * completed scan, and a submit whose tag no longer matches the live
   * session is dropped — a stale frame must never answer a newer
   * request. The servicePromise id itself never leaves bg. */
  qrSessionId?: number;
  confirmDetails?: IDeviceStageConfirmDetail[];
  confirmMessage?: string;
  confirmDescription?: string;
  confirmDescriptionDanger?: boolean;
  confirmCount?: IDeviceStageConfirmContent['count'];
  /** The originating hardware UI payload — carries uiResponseCorrelation
   * the container needs when answering PIN/passphrase requests. */
  payload?: IHardwareUiPayload;
};

export const { target: deviceStageAtom, use: useDeviceStageAtom } = globalAtom<
  IDeviceStageState | undefined
>({
  initialValue: undefined,
  name: EAtomNames.deviceStageAtom,
});

// third-party hardware ui state -----------------------------------

export enum EThirdPartyHardwareUiAction {
  // Blocking requests — UI waits for user response.
  // SDK found no device; ask the user to make it available and retry.
  requestDeviceNotFound = 'request-ledger-device-not-found',
  // Ledger BTC requires explicit user approval before using index >= 100.
  requestBtcHighIndexConfirm = 'request-ledger-btc-high-index-confirm',
  // Trezor THP: device showed a pairing code, host needs to input it.
  // Different from confirmOnDevice (passive toast) because the user types
  // back into the app, not just acts on hardware.
  requestTrezorThpPairing = 'request-trezor-thp-pairing',
  // Trezor hidden wallet: host must collect passphrase or request on-device
  // entry. Standard-wallet calls keep using auto-empty passphrase.
  requestTrezorPassphrase = 'request-trezor-passphrase',
  // Trezor old button devices: host collects the PIN as a matrix position
  // string (touchscreen devices enter on-device via REQUEST_BUTTON instead).
  requestTrezorPin = 'request-trezor-pin',
  // Trezor transport fallback: USB is unavailable and this DB device has not
  // yet learned its BLE connectId. UI scans BLE candidates, binds the matching
  // device_id, then resolves the waiting hardware call.
  requestTrezorBleBinding = 'request-trezor-ble-binding',
  // Non-blocking notifications — UI shows status.
  openApp = 'ui-event-ledger-open-app',
  confirmOnDevice = 'ui-event-ledger-confirm-on-device',
  searching = 'ui-event-ledger-searching',
  connecting = 'ui-event-ledger-connecting',
  processing = 'ui-event-ledger-processing',
  done = 'ui-event-ledger-done',
  // Toast only — "device locked". Shared by Ledger (DMK polling) and Trezor THP.
  unlockDevice = 'ui-event-ledger-unlock-device',
  error = 'ui-event-ledger-error',
}

/** Actions shown as a passive toast (user acts on the physical device, not in the app). */
const TOAST_ACTIONS = new Set<string>([
  EThirdPartyHardwareUiAction.confirmOnDevice,
  EThirdPartyHardwareUiAction.openApp,
  EThirdPartyHardwareUiAction.searching,
  EThirdPartyHardwareUiAction.connecting,
  EThirdPartyHardwareUiAction.processing,
  EThirdPartyHardwareUiAction.done,
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
    /** Trezor request: connect id of the device asking for user input. */
    connectId?: string;
    /** Trezor THP pairing: pairing methods the device offered (CodeEntry/QrCode/NFC/SkipPairing). */
    availableMethods?: number[];
    /** Trezor THP pairing: method we picked (the host always selects pairingMethods[0]). */
    selectedMethod?: number;
    /** Trezor THP pairing: optional NFC payload — hex-encoded when method is NFC. */
    nfcData?: string;
    /** Trezor passphrase: expected hidden wallet identity in verify mode. */
    passphraseState?: string;
    /** Trezor BLE binding: USB-side connect id of the DB device. */
    usbConnectId?: string;
    /** Trezor BLE binding: stable device_id read from Trezor features. */
    featuresDeviceId?: string;
    /** Trezor BLE binding: servicePromise id resolved with the fallback connectId. */
    promiseId?: number;
    /** Trezor BLE binding mode. */
    trezorBleBindingMode?: 'manual-binding' | 'auto-fallback';
  };
};

export const {
  target: thirdPartyHardwareUiStateAtom,
  use: useThirdPartyHardwareUiStateAtom,
} = globalAtom<IThirdPartyHardwareUiState | undefined>({
  initialValue: undefined,
  name: EAtomNames.thirdPartyHardwareUiStateAtom,
});

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

export type IThirdPartyBatchInstallState = {
  queue: string[];
  currentIndex: number;
};

export const {
  target: thirdPartyBatchInstallAtom,
  use: useThirdPartyBatchInstallAtom,
} = globalAtom<IThirdPartyBatchInstallState | undefined>({
  initialValue: undefined,
  name: EAtomNames.thirdPartyBatchInstallAtom,
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
