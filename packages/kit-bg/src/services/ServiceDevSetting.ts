import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';

import { devSettingsPersistAtom } from '../states/jotai/atoms/devSettings';

import ServiceBase from './ServiceBase';

import type { IDevSettingsKeys } from '../states/jotai/atoms/devSettings';

@backgroundClass()
class ServiceDevSetting extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  public async switchDevMode(isOpen: boolean) {
    await devSettingsPersistAtom.set((prev) => ({
      enabled: isOpen,
      settings: isOpen ? prev.settings : {},
    }));
  }

  @backgroundMethod()
  public async updateDevSetting(name: IDevSettingsKeys, value: any) {
    await devSettingsPersistAtom.set((prev) => ({
      enabled: true,
      settings: {
        ...prev.settings,
        [name]: value,
      },
    }));
  }
}

export default ServiceDevSetting;
