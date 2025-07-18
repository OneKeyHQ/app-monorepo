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
