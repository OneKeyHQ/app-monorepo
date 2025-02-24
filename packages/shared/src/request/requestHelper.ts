import type {
  ISettingsPersistAtom,
  ISettingsValuePersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';

const requestHelper: {
  checkIsOneKeyDomain: (url: string) => Promise<boolean>;
  getSettingsPersistAtom(): Promise<ISettingsPersistAtom>;
  getSettingsValuePersistAtom(): Promise<ISettingsValuePersistAtom>;
} = {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  checkIsOneKeyDomain(url: string) {
    // TODO: OK-35681
    if (url.includes('api.revenuecat.com')) {
      return Promise.resolve(false);
    }
    throw new Error('Not implemented');
  },
  getSettingsPersistAtom(): Promise<ISettingsPersistAtom> {
    throw new Error('Not implemented');
  },
  getSettingsValuePersistAtom(): Promise<ISettingsValuePersistAtom> {
    throw new Error('Not implemented');
  },
};

export default requestHelper;
