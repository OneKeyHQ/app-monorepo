import { createContext, useContext } from 'react';

import type { ISettingsConfig } from './config';

export const ConfigContext = createContext<{
  settingsConfig: ISettingsConfig;
  /**
   * True only under the settings tab navigator's provider. Used for
   * analytics source (sidebar vs category page).
   */
  insideTabNavigator: boolean;
}>({
  settingsConfig: [],
  insideTabNavigator: false,
});

export const useConfigContext = () => {
  return useContext(ConfigContext);
};
