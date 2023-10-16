import { createContext, useContext } from 'react';

import type { DeviceScreenSize } from '../device';

export const ContextDeviceScreenSize =
  createContext<DeviceScreenSize>('NORMAL');

const useProviderDeviceScreenSize = () => useContext(ContextDeviceScreenSize);
export default useProviderDeviceScreenSize;
