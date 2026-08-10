import { createContext, useContext } from 'react';

import type { ISettingsConfig } from './config';

export const ConfigContext = createContext<{
  settingsConfig: ISettingsConfig;
  /**
   * True only under the settings tab navigator's provider. Pane hosts read
   * this to decide whether items promoted to sidebar tabs should hide from
   * their origin pane; standalone hosts (pushed SettingListSubModal pages)
   * stay on the default and keep those items visible.
   */
  insideTabNavigator: boolean;
}>({
  settingsConfig: [],
  insideTabNavigator: false,
});

export const useConfigContext = () => {
  return useContext(ConfigContext);
};
