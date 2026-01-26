import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';

import { EAtomNames } from '../atomNames';
import { globalAtom } from '../utils';

// ==================== Types ====================

/**
 * Legacy firmware update steps
 * For devices with firmware version below minimum limit
 */
export enum ELegacyFirmwareUpdateSteps {
  // Basic steps
  idle = 'idle',
  preparing = 'preparing',
  error = 'error',

  // Mini specific - manual bootloader mode entry
  waitingBootloaderMode = 'waitingBootloaderMode',

  // Bootloader check and update
  checkingBootloader = 'checkingBootloader',
  updatingBootloader = 'updatingBootloader',

  // Firmware download and install
  downloadingFirmware = 'downloadingFirmware',
  installingFirmware = 'installingFirmware',

  // WebUSB device reselect (bootloader mode PID change)
  requestDeviceReselect = 'requestDeviceReselect',

  // Complete
  done = 'done',
}

export type ILegacyFirmwareUpdateStepInfo =
  | {
      step: ELegacyFirmwareUpdateSteps.idle;
      payload: undefined;
    }
  | {
      step: ELegacyFirmwareUpdateSteps.preparing;
      payload: undefined;
    }
  | {
      step: ELegacyFirmwareUpdateSteps.error;
      payload: {
        error: IOneKeyError | string;
      };
    }
  | {
      step: ELegacyFirmwareUpdateSteps.waitingBootloaderMode;
      payload: {
        deviceType: string;
      };
    }
  | {
      step: ELegacyFirmwareUpdateSteps.checkingBootloader;
      payload: undefined;
    }
  | {
      step: ELegacyFirmwareUpdateSteps.updatingBootloader;
      payload: undefined;
    }
  | {
      step: ELegacyFirmwareUpdateSteps.downloadingFirmware;
      payload: {
        firmwareField?: string;
      };
    }
  | {
      step: ELegacyFirmwareUpdateSteps.installingFirmware;
      payload: {
        phase?: 'firmware' | 'ble';
      };
    }
  | {
      step: ELegacyFirmwareUpdateSteps.requestDeviceReselect;
      payload: undefined;
    }
  | {
      step: ELegacyFirmwareUpdateSteps.done;
      payload?: {
        needOnboarding?: boolean;
      };
    };

export interface ILegacyFirmwareUpdateProgress {
  progress: number; // 0-100
  message?: string;
}

// ==================== Atoms ====================

/**
 * Legacy firmware update step state
 */
export const {
  target: legacyFirmwareUpdateStepAtom,
  use: useLegacyFirmwareUpdateStepAtom,
} = globalAtom<ILegacyFirmwareUpdateStepInfo>({
  initialValue: {
    step: ELegacyFirmwareUpdateSteps.idle,
    payload: undefined,
  },
  name: EAtomNames.legacyFirmwareUpdateStepAtom,
});

/**
 * Legacy firmware update progress
 */
export const {
  target: legacyFirmwareUpdateProgressAtom,
  use: useLegacyFirmwareUpdateProgressAtom,
} = globalAtom<ILegacyFirmwareUpdateProgress>({
  initialValue: {
    progress: 0,
    message: undefined,
  },
  name: EAtomNames.legacyFirmwareUpdateProgressAtom,
});

/**
 * Is legacy firmware update running
 */
export const {
  target: legacyFirmwareUpdateRunningAtom,
  use: useLegacyFirmwareUpdateRunningAtom,
} = globalAtom<boolean>({
  initialValue: false,
  name: EAtomNames.legacyFirmwareUpdateRunningAtom,
});
