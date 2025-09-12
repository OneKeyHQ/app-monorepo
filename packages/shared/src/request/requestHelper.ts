import type {
  IDevSettingsPersistAtom,
  ISettingsPersistAtom,
  ISettingsValuePersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

class RequestHelper {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  checkIsOneKeyDomain: (url: string) => Promise<boolean> = async (url) => {
    // TODO: OK-35681
    if (url.includes('api.revenuecat.com')) {
      return Promise.resolve(false);
    }
    throw new OneKeyLocalError('Not implemented, please call overrideMethods');
  };

  getDevSettingsPersistAtom: () => Promise<IDevSettingsPersistAtom> =
    async () => {
      throw new OneKeyLocalError(
        'Not implemented, please call overrideMethods',
      );
    };

  getSettingsPersistAtom: () => Promise<ISettingsPersistAtom> = async () => {
    throw new OneKeyLocalError('Not implemented, please call overrideMethods');
  };

  getSettingsValuePersistAtom: () => Promise<ISettingsValuePersistAtom> =
    async () => {
      throw new OneKeyLocalError(
        'Not implemented, please call overrideMethods',
      );
    };

  overrideMethods(methods: {
    checkIsOneKeyDomain: (url: string) => Promise<boolean>;
    getDevSettingsPersistAtom: () => Promise<IDevSettingsPersistAtom>;
    getSettingsPersistAtom: () => Promise<ISettingsPersistAtom>;
    getSettingsValuePersistAtom: () => Promise<ISettingsValuePersistAtom>;
  }) {
    this.checkIsOneKeyDomain = methods.checkIsOneKeyDomain;
    this.getDevSettingsPersistAtom = methods.getDevSettingsPersistAtom;
    this.getSettingsPersistAtom = methods.getSettingsPersistAtom;
    this.getSettingsValuePersistAtom = methods.getSettingsValuePersistAtom;
  }
}

export default new RequestHelper();
