import {
  AddPriceAlertConfig,
  NotificationType,
  RemovePriceAlertConfig,
  addAccountDynamic,
  addPriceAlertConfig,
  queryAccountDynamic,
  queryPriceAlertList,
  removeAccountDynamic,
  removePriceAlertConfig,
  syncLocalEnabledAccounts,
  syncPushNotificationConfig,
} from '@onekeyhq/engine/src/managers/notification';
import {
  AppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { backgroundClass, backgroundMethod } from '../decorators';

import ServiceBase, { IServiceBaseProps } from './ServiceBase';

@backgroundClass()
export default class ServiceNotification extends ServiceBase {
  constructor(props: IServiceBaseProps) {
    super(props);
    if (!platformEnv.isNative) {
      return;
    }
    setInterval(() => {
      this.syncLocalEnabledAccounts();
    }, 5 * 60 * 1000);
  }

  @backgroundMethod()
  async syncPushNotificationConfig(type: 'reset' | 'normal' = 'normal') {
    return syncPushNotificationConfig(type);
  }

  @backgroundMethod()
  async addPriceAlertConfig(body: AddPriceAlertConfig) {
    return addPriceAlertConfig(body);
  }

  @backgroundMethod()
  async removePriceAlertConfig(body: RemovePriceAlertConfig) {
    return removePriceAlertConfig(body);
  }

  @backgroundMethod()
  async queryPriceAlertList(...args: Parameters<typeof queryPriceAlertList>) {
    return queryPriceAlertList(...args);
  }

  @backgroundMethod()
  async addAccountDynamic(...args: Parameters<typeof addAccountDynamic>) {
    return addAccountDynamic(...args);
  }

  @backgroundMethod()
  async removeAccountDynamic(...args: Parameters<typeof removeAccountDynamic>) {
    return removeAccountDynamic(...args);
  }

  @backgroundMethod()
  async queryAccountDynamic() {
    return queryAccountDynamic();
  }

  @backgroundMethod()
  async syncLocalEnabledAccounts() {
    const { serviceAccount } = this.backgroundApi;
    const wallets = await serviceAccount.initWallets();
    const enabledAccounts = await this.queryAccountDynamic();

    const localEnabledAccounts = enabledAccounts
      .filter((a) =>
        wallets
          .map((w) => w.accounts)
          .flat()
          .find((account) => account === a.accountId),
      )
      .map((a) => a.address);

    await syncLocalEnabledAccounts(localEnabledAccounts);
  }

  @backgroundMethod()
  emitNotificationStatusChange(content: NotificationType) {
    appEventBus.emit(AppEventBusNames.NotificationStatusChanged, content);
  }
}
