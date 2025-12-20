import type { EHardwareTransportType } from '@onekeyhq/shared/types';

import { EAtomNames } from '../atomNames';
import { globalAtom } from '../utils';

export type IDesktopBluetoothAtom = {
  isRequestedPermission: boolean;
};

export const { target: desktopBluetoothAtom, use: useDesktopBluetoothAtom } =
  globalAtom<IDesktopBluetoothAtom>({
    persist: true,
    name: EAtomNames.desktopBluetoothAtom,
    initialValue: {
      isRequestedPermission: false,
    },
  });

export type IHardwareForceTransportAtom = {
  forceTransportType?: EHardwareTransportType;
  /**
   * Used to identify which operation is forcing the transport type
   * This helps with cleanup and debugging
   */
  operationId?: string;
};

export const {
  target: hardwareForceTransportAtom,
  use: useHardwareForceTransportAtom,
} = globalAtom<IHardwareForceTransportAtom>({
  persist: false, // Don't persist since this is temporary state
  name: EAtomNames.hardwareForceTransportAtom,
  initialValue: {
    forceTransportType: undefined,
    operationId: undefined,
  },
});
