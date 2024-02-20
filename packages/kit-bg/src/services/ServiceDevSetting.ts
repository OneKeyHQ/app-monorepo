import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';

import { devSettingsPersistAtom } from '../states/jotai/atoms/devSettings';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceDevSetting extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  public async switchDevMode(isOpen: boolean) {
    await devSettingsPersistAtom.set((prev) => ({
      enabled: isOpen,
      settings: isOpen ? prev.settings : [],
    }));
  }
}

export default ServiceDevSetting;
