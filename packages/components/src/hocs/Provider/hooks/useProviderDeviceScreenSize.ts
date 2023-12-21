import { createContext, useContext } from 'react';

import type { IDeviceScreenSize } from '../device';

export const ContextDeviceScreenSize =
  createContext<IDeviceScreenSize>('NORMAL');

const useProviderDeviceScreenSize = () => useContext(ContextDeviceScreenSize);
export default useProviderDeviceScreenSize;
