import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';

import { routeAtom } from '../states/jotai/atoms/route';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceRoute extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  public async getCurrentTab() {
    const { currentTab } = await routeAtom.get();
    return currentTab;
  }

  @backgroundMethod()
  public async updateHomeTab(currentTab: string) {
    await routeAtom.set({
      currentTab,
    });
  }
}

export default ServiceRoute;
