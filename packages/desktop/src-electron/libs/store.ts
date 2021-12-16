/* eslint-disable no-undef */
import Store from 'electron-store';

import { getInitialWindowSize } from './screen';

// https:// electronjs.org/docs/api/app#appgetpathname
const store = new Store<LocalStore>();

export const getWinBounds = (): WinBounds => {
  const { width, height } = getInitialWindowSize();
  const winBounds = store.get('winBounds', { width, height });
  return winBounds;
};

export const setWinBounds = (winBounds: WinBounds): void => {
  if (winBounds.width > 0 && winBounds.height > 0) {
    store.set('winBounds', winBounds);
  }
};

export const getUpdateSettings = (): UpdateSettings =>
  store.get('updateSettings', { skipVersion: '' });

export const setUpdateSettings = (updateSettings: UpdateSettings): void => {
  store.set('updateSettings', updateSettings);
};
