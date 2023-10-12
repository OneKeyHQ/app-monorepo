import { createContext, useContext } from 'react';

import type { DeviceScreenSize } from '../device';

export type ContextDeviceScreenSizeValue = {
  deviceScreenSize: DeviceScreenSize;
};

export const ContextDeviceScreenSize =
  createContext<ContextDeviceScreenSizeValue>(
    {} as ContextDeviceScreenSizeValue,
  );

const useProviderDeviceScreenSize = () => useContext(ContextDeviceScreenSize);
export default useProviderDeviceScreenSize;
