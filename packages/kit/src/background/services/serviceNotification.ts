import {
  AccountDynamicItem,
  AddPriceAlertConfig,
  NotificationType,
  RemovePriceAlertConfig,
  addAccountDynamic,
  addPriceAlertConfig,
  queryAccountDynamic,
  queryPriceAlertList,
  removeAccountDynamic,
  removePriceAlertConfig,
  syncPushNotificationConfig,
} from '@onekeyhq/engine/src/managers/notification';
import { Token } from '@onekeyhq/engine/src/types/token';
import {
  AppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import { backgroundClass, backgroundMethod } from '../decorators';

import ServiceBase from './ServiceBase';

@backgroundClass()
export default class ServiceNotification extends ServiceBase {
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
  async queryPriceAlertList(
    query?: Pick<Token, 'impl' | 'chainId' | 'address'>,
  ) {
    return queryPriceAlertList(query);
  }

  @backgroundMethod()
  async addAccountDynamic(body: Omit<AccountDynamicItem, 'instanceId'>) {
    return addAccountDynamic(body);
  }

  @backgroundMethod()
  async removeAccountDynamic(
    body: Omit<AccountDynamicItem, 'instanceId' | 'name'>,
  ) {
    return removeAccountDynamic(body);
  }

  @backgroundMethod()
  async queryAccountDynamic() {
    return queryAccountDynamic();
  }

  @backgroundMethod()
  emitNotificationStatusChange(content: NotificationType) {
    appEventBus.emit(AppEventBusNames.NotificationStatusChanged, content);
  }
}
