import { enabledAccountDynamicNetworkIds } from '@onekeyhq/engine/src/constants';

import { backgroundClass, backgroundMethod } from '../decorators';

import ServiceBase from './ServiceBase';

@backgroundClass()
export default class ServiceBootstrap extends ServiceBase {
  // eslint-disable-next-line
  @backgroundMethod()
  async checkShouldShowNotificationGuide(): Promise<boolean> {
    const { appSelector } = this.backgroundApi;
    const { accountId, pushNotification, guideToPushFirstTime, networkId } =
      appSelector((s) => ({
        accountId: s.general.activeAccountId,
        networkId: s.general.activeNetworkId,
        pushNotification: s.settings.pushNotification,
        guideToPushFirstTime: s.status.guideToPushFirstTime,
      }));
    if (!accountId) {
      return false;
    }
    if (!pushNotification) {
      return false;
    }
    const { pushEnable } = pushNotification;
    if (pushEnable) {
      return false;
    }
    if (guideToPushFirstTime) {
      return false;
    }
    if (!enabledAccountDynamicNetworkIds.includes(networkId || '')) {
      return false;
    }
    return true;
  }
}
