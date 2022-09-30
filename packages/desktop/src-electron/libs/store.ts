import Store from 'electron-store';

const store = new Store();

export type LocalStore = {
  getUpdateSettings(): UpdateSettings;
  setUpdateSettings(updateSettings: UpdateSettings): void;
};

export type UpdateSettings = {
  skipVersion: string;
};

export const getUpdateSettings = (): UpdateSettings =>
  store.get('updateSettings', { skipVersion: '' }) as UpdateSettings;

export const setUpdateSettings = (updateSettings: UpdateSettings): void => {
  store.set('updateSettings', updateSettings);
};
