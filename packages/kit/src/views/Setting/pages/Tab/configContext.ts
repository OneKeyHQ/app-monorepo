import { createContext, useContext } from 'react';

import type { ISettingsConfig } from './config';

export const ConfigContext = createContext<{
  settingsConfig: ISettingsConfig;
}>({
  settingsConfig: [],
});

export const useConfigContext = () => {
  return useContext(ConfigContext);
};
