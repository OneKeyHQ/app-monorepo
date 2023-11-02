import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';

import {
  settingsAtom,
  settingsIsLightCNAtom,
  settingsTimeNowAtom,
} from '../states/jotai/atoms';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceApp extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  public async demoJotaiGetSettings() {
    const now = await settingsTimeNowAtom.get();
    const settings = await settingsAtom.get();
    const isLightCN = await settingsIsLightCNAtom.get();
    return {
      now,
      settings,
      isLightCN,
    };
  }

  @backgroundMethod()
  public async demoJotaiUpdateSettings() {
    const now = await settingsTimeNowAtom.set((v) => `${v}: hello world`);
    const settings = await settingsAtom.set((v) => ({
      ...v,
      locale: v.locale !== 'zh-CN' ? 'zh-CN' : 'en-US',
      theme: v.theme !== 'dark' ? 'dark' : 'light',
    }));
    const isLightCN = await settingsIsLightCNAtom.get();
    return {
      now,
      settings,
      isLightCN,
    };
  }
}

export default ServiceApp;
