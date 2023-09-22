import { createContext, useContext } from 'react';

import type { DeviceScreenSize } from '../device';
import type { ThemeVariant } from '../theme';

export type ContextValue = {
  themeVariant: ThemeVariant;
  deviceScreenSize: DeviceScreenSize;
  reduxReady?: boolean;
};

export const Context = createContext<ContextValue>({} as ContextValue);

const useProviderValue = () => useContext(Context);
export default useProviderValue;
