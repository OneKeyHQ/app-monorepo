import type {
  ISettingsPersistAtom,
  ISettingsValuePersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';

const requestHelper: {
  checkIsOneKeyDomain: (url: string) => Promise<boolean>;
  getSettingsPersistAtom(): Promise<ISettingsPersistAtom>;
  getSettingsValuePersistAtom(): Promise<ISettingsValuePersistAtom>;
} = {
  // @ts-expect-error
  checkIsOneKeyDomain(url: string) {
    // TODO: @zuozhuo
    // throw new Error('Not implemented');
  },
  getSettingsPersistAtom(): Promise<ISettingsPersistAtom> {
    throw new Error('Not implemented');
  },
  getSettingsValuePersistAtom(): Promise<ISettingsValuePersistAtom> {
    throw new Error('Not implemented');
  },
};

export default requestHelper;
