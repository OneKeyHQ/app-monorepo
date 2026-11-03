import { noop } from 'lodash';

import type { IMainMenu } from './types';

export type { IMainMenu, IMainMenuCommand, IMainMenuConfig } from './types';

// Only iPadOS has an app-owned menu bar backed by device-utils; the desktop
// builds its menu in the Electron main process.
const mainMenu: IMainMenu = {
  setConfig: noop,
  addCommandListener: () => noop,
};

export default mainMenu;
