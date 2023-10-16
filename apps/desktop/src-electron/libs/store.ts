import Store from 'electron-store';

const store = new Store();

export type LocalStore = {
  getUpdateSettings(): UpdateSettings;
  setUpdateSettings(updateSettings: UpdateSettings): void;
  clear(): void;
};

export type UpdateSettings = {
  useTestFeedUrl: boolean;
};

export const getUpdateSettings = (): UpdateSettings =>
  store.get('updateSettings', { useTestFeedUrl: false }) as UpdateSettings;

export const setUpdateSettings = (updateSettings: UpdateSettings): void => {
  store.set('updateSettings', updateSettings);
};

export const clear = () => {
  store.clear();
};
