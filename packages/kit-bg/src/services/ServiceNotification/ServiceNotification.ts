import { debounce, isNumber, merge, uniqBy } from 'lodash';
import { InteractionManager } from 'react-native';

import {
  backgroundMethod,
  toastIfError,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { IMPL_EVM } from '@onekeyhq/shared/src/engine/engineConsts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import notificationsUtils from '@onekeyhq/shared/src/utils/notificationsUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import type { IApiClientResponse } from '@onekeyhq/shared/types/endpoint';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import type {
  INotificationClickParams,
  INotificationPermissionDetail,
  INotificationPushClient,
  INotificationPushMessageAckParams,
  INotificationPushMessageInfo,
  INotificationPushMessageListItem,
  INotificationPushRegisterParams,
  INotificationPushSettings,
  INotificationPushSyncAccount,
  INotificationRemoveParams,
  INotificationSetBadgeParams,
  INotificationShowParams,
  INotificationShowResult,
} from '@onekeyhq/shared/types/notification';
import {
  ENotificationPermission,
  ENotificationPushMessageAckAction,
  ENotificationPushSyncMethod,
  EPushProviderEventNames,
} from '@onekeyhq/shared/types/notification';

import {
  notificationsAtom,
  notificationsReadedAtom,
} from '../../states/jotai/atoms';
import ServiceBase from '../ServiceBase';

import NotificationProvider from './NotificationProvider/NotificationProvider';

import type NotificationProviderBase from './NotificationProvider/NotificationProviderBase';
import type { IDBAccount } from '../../dbs/local/types';
import type { Socket } from 'socket.io-client';

export default class ServiceNotification extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
    appEventBus.on(EAppEventBusNames.AddDBAccountsToWallet, (params) => {
      const { accounts } = params;
      void this.registerClientWithAppendAccounts({
        dbAccounts: accounts,
      });
    });
    appEventBus.on(EAppEventBusNames.RenameDBAccounts, (params) => {
      const { accounts } = params;
      void this.registerClientWithAppendAccounts({
        dbAccounts: accounts,
      });
    });
    appEventBus.on(EAppEventBusNames.AccountRemove, () => {
      void this.registerClientWithOverrideAllAccounts();
    });
    appEventBus.on(EAppEventBusNames.WalletRemove, () => {
      void this.registerClientWithOverrideAllAccounts();
    });
  }

  _notificationProvider: NotificationProviderBase | undefined;

  get notificationProvider(): NotificationProviderBase {
    if (!this._notificationProvider) {
      // TODO init and use shared eventEmitter here
      this._notificationProvider = new NotificationProvider();
      this._notificationProvider.eventEmitter.on(
        EPushProviderEventNames.ws_connected,
        this.onPushProviderConnected,
      );
      this._notificationProvider.eventEmitter.on(
        EPushProviderEventNames.jpush_connected,
        this.onPushProviderConnected,
      );
      this._notificationProvider.eventEmitter.on(
        EPushProviderEventNames.notification_received,
        this.onNotificationReceived,
      );
      this._notificationProvider.eventEmitter.on(
        EPushProviderEventNames.notification_clicked,
        this.onNotificationClicked,
      );
      this._notificationProvider.eventEmitter.on(
        EPushProviderEventNames.notification_closed,
        this.onNotificationClosed,
      );
      defaultLogger.notification.common.notificationInitOk();
    }
    if (!this._notificationProvider) {
      throw new Error('notification provider not init');
    }
    return this._notificationProvider;
  }

  init() {
    return InteractionManager.runAfterInteractions(
      () => this.notificationProvider,
    );
  }

  pushClient: INotificationPushClient = {};

  onPushProviderConnected = async ({
    jpushId,
    socketId,
    socket,
  }: {
    jpushId?: string;
    socketId?: string;
    socket?: Socket | null;
  }) => {
    this.pushClient = merge(this.pushClient, {
      jpushId,
      socketId,
    });
    defaultLogger.notification.common.pushProviderConnected(this.pushClient);
    return this.registerClientWithOverrideAllAccounts();
  };

  onNotificationReceived = async (
    messageInfo: INotificationPushMessageInfo,
  ) => {
    defaultLogger.notification.common.notificationReceived({
      notificationId: messageInfo.extras?.msgId,
      topic: messageInfo.extras?.topic,
      title: messageInfo.title,
      content: messageInfo.content,
    });

    void this.ackNotificationMessage({
      msgId: messageInfo.extras?.msgId,
      action: ENotificationPushMessageAckAction.show,
      remotePushMessageInfo: messageInfo,
    });

    if (messageInfo.pushSource === 'websocket') {
      // jpush will show notification automatically
      // websocket should show notification by ourselves
      await this.showNotification({
        notificationId: messageInfo.extras?.msgId,
        title: messageInfo.title,
        description: messageInfo.content,
        icon: messageInfo.extras?.image,
        remotePushMessageInfo: messageInfo,
      });
    }

    await notificationsAtom.set((v) => ({
      ...v,
      lastReceivedTime: Date.now(),
    }));

    void this.increaseBadgeCountWhenNotificationReceived(messageInfo);
  };

  onNotificationClicked = async ({
    notificationId,
    params,
    webEvent,
    eventSource,
  }: INotificationClickParams) => {
    defaultLogger.notification.common.notificationClicked({
      eventSource,
      notificationId,
      title: params?.title,
      content: params?.description,
      params,
    });

    void this.ackNotificationMessage({
      msgId: notificationId,
      action: ENotificationPushMessageAckAction.clicked,
      remotePushMessageInfo: params?.remotePushMessageInfo,
    });
    // native may trigger twice? jpush and local notification click handler
    // 在这里可以添加点击通知后的处理逻辑
    // 例如，打开一个新窗口或执行其他操作
    await this.notificationProvider.showAndFocusApp();

    await timerUtils.wait(400); // wait for app opened
    await notificationsUtils.navigateToNotificationDetail({
      message: params?.remotePushMessageInfo,
      isFromNotificationClick: true,
      notificationId: notificationId || '',
    });

    void this.removeNotification({
      notificationId,
      desktopNotification: webEvent?.target as any,
    });
  };

  onNotificationClosed = async ({
    notificationId,
    params,
    webEvent,
  }: {
    notificationId: string | undefined;
    params: INotificationShowParams | undefined;
    webEvent?: Event;
  }) => {
    defaultLogger.notification.common.notificationClosed({
      notificationId,
      title: params?.title,
      content: params?.description,
    });
  };

  isColdStartByNotificationDone = false;

  @backgroundMethod()
  async handleColdStartByNotification(params: INotificationClickParams) {
    if (this.isColdStartByNotificationDone) {
      return;
    }
    const r = await this.onNotificationClicked({
      ...params,
      eventSource: 'coldStartByNotification',
    });
    this.isColdStartByNotificationDone = true;
    return r;
  }

  @backgroundMethod()
  async requestPermission(): Promise<INotificationPermissionDetail> {
    const result = await this.notificationProvider.requestPermission();
    defaultLogger.notification.common.requestPermission(result);
    return result;
  }

  @backgroundMethod()
  async getPermission(): Promise<INotificationPermissionDetail> {
    const result = await this.notificationProvider.getPermission();
    defaultLogger.notification.common.getPermission(result);
    return result;
  }

  @backgroundMethod()
  openPermissionSettings() {
    return this.notificationProvider.openPermissionSettings();
  }

  @backgroundMethod()
  @toastIfError()
  async enableNotificationPermissions() {
    let permission = await this.requestPermission();
    if (permission.permission === ENotificationPermission.granted) {
      return permission;
    }

    permission = await this.getPermission();
    if (permission.permission === ENotificationPermission.granted) {
      return permission;
    }

    if (!permission.isSupported) {
      throw new Error('Notification is not supported on your device');
    }

    // TODO desktop linux,windows support
    // TODO desktop mas,standalone prod support
    await this.openPermissionSettings();
    return this.getPermission();
  }

  desktopNotificationCache: {
    [notificationId: string]: Notification;
  } = {};

  clearDesktopNotificationCacheTimer: ReturnType<typeof setTimeout> | undefined;

  @backgroundMethod()
  async showNotification(
    params: INotificationShowParams,
  ): Promise<INotificationShowResult> {
    this.notificationProvider.fixShowParams(params);
    const result = await this.notificationProvider.showNotification(params);
    // delete non-serializable field
    if (result && result?.desktopNotification && result?.notificationId) {
      this.desktopNotificationCache[result.notificationId] =
        result.desktopNotification;
      delete result?.desktopNotification;
      clearTimeout(this.clearDesktopNotificationCacheTimer);
      this.clearDesktopNotificationCacheTimer = setTimeout(() => {
        this.desktopNotificationCache = {};
      }, timerUtils.getTimeDurationMs({ minute: 3 }));
    }
    return result;
  }

  @backgroundMethod()
  async removeNotification(params: INotificationRemoveParams) {
    if (params.notificationId) {
      params.desktopNotification =
        params.desktopNotification ||
        this.desktopNotificationCache[params.notificationId];
    }
    return this.notificationProvider.removeNotification(params);
  }

  @backgroundMethod()
  async setBadge(params: INotificationSetBadgeParams) {
    defaultLogger.notification.common.setBadge(params);
    await notificationsAtom.set((v) => ({
      ...v,
      badge: params.count ?? undefined,
    }));
    return this.notificationProvider.setBadge(params);
  }

  @backgroundMethod()
  async clearBadge() {
    await notificationsAtom.set((v) => ({ ...v, badge: undefined }));
    return this.notificationProvider.clearBadge();
  }

  // only call this method when app start
  @backgroundMethod()
  async clearBadgeWhenAppStart() {
    // clear badge on app start is disabled currently,
    // because NotificationMessageCenter will handle badge clear
    // return this.clearBadge();
  }

  @backgroundMethod()
  async increaseLocalBadgeCount() {
    const { badge } = await notificationsAtom.get();
    const newBadgeCount = (badge || 0) + 1;
    await this.setBadge({ count: newBadgeCount });
  }

  @backgroundMethod()
  async increaseBadgeCountWhenNotificationReceived(
    messageInfo: INotificationPushMessageInfo,
  ) {
    let shouldSyncBadgeFromServer = false;
    if (messageInfo.badge) {
      const badgeNum = parseInt(messageInfo.badge, 10);
      if (!Number.isNaN(badgeNum)) {
        shouldSyncBadgeFromServer = true;
        setTimeout(() => {
          void this.setBadge({ count: badgeNum });
        }, 0);
      }
    }

    if (!shouldSyncBadgeFromServer) {
      void this.increaseLocalBadgeCount();
    }
  }

  convertToSyncAccounts = async (dbAccounts: IDBAccount[]) => {
    const supportNetworksFiltered = await this.getSupportedNetworks();

    defaultLogger.notification.common.consoleLog('supportNetworksFiltered', {
      supportNetworksFiltered: supportNetworksFiltered.length,
      dbAccounts: dbAccounts.length,
    });

    const syncAccounts: INotificationPushSyncAccount[] = [];
    for (const account of dbAccounts) {
      const networks = supportNetworksFiltered.filter(
        (item) =>
          item.impl === account.impl ||
          item.networkId === account.createAtNetwork,
      );
      for (const network of networks) {
        let networkAccount: INetworkAccount | undefined;
        try {
          networkAccount = await this.backgroundApi.serviceAccount.getAccount({
            accountId: account.id,
            networkId: network.networkId,
          });
        } catch (error) {
          //
        }
        if (networkAccount?.addressDetail?.displayAddress) {
          let networkId: string | undefined = network.networkId;
          let networkImpl: string | undefined;
          if (network.impl === IMPL_EVM) {
            networkImpl = IMPL_EVM;
            networkId = undefined;
          }
          const acc: INotificationPushSyncAccount = {
            networkId,
            networkImpl,
            accountAddress: networkAccount.addressDetail.displayAddress,
            accountId: networkAccount.id,
            accountName: networkAccount.name,
          };
          syncAccounts.push(acc);
        }
      }
    }

    defaultLogger.notification.common.consoleLog('convertToSyncAccounts', {
      syncAccounts: syncAccounts.length,
      supportNetworksFiltered: supportNetworksFiltered.length,
    });
    return { syncAccounts, supportNetworksFiltered };
  };

  @backgroundMethod()
  async buildSyncAccounts({ accountIds }: { accountIds?: string[] }): Promise<{
    syncAccounts: INotificationPushSyncAccount[];
  }> {
    const { accounts } = await this.backgroundApi.serviceAccount.getAllAccounts(
      {
        ids: accountIds,
      },
    );

    const { syncAccounts } = await this.convertToSyncAccounts(accounts);

    return {
      syncAccounts,
    };
  }

  appendAccountsCache: IDBAccount[] = [];

  _registerClientWithAppendAccountsByCache = debounce(
    async () => {
      const { syncAccounts } = await this.convertToSyncAccounts([
        ...this.appendAccountsCache,
      ]);
      this.appendAccountsCache = [];
      await this.registerClient({
        client: this.pushClient,
        syncMethod: ENotificationPushSyncMethod.append,
        syncAccounts,
      });
    },
    5000,
    {
      leading: false,
      trailing: true,
    },
  );

  @backgroundMethod()
  async registerClientWithAppendAccounts({
    dbAccounts,
  }: {
    dbAccounts: IDBAccount[];
  }) {
    this.appendAccountsCache = [...this.appendAccountsCache, ...dbAccounts];
    return this._registerClientWithAppendAccountsByCache();
  }

  @backgroundMethod()
  registerClientWithOverrideAllAccounts() {
    return this._registerClientWithOverrideAllAccountsDebounced();
  }

  _registerClientWithOverrideAllAccountsDebounced = debounce(
    async () => {
      await InteractionManager.runAfterInteractions(async () => {
        await this.registerClientWithSyncAccounts({
          syncMethod: ENotificationPushSyncMethod.override,
        });
        await notificationsAtom.set((v) => ({
          ...v,
          lastRegisterTime: Date.now(),
        }));
      });
    },
    5000,
    {
      leading: false,
      trailing: true,
    },
  );

  @backgroundMethod()
  async registerClientWithSyncAccounts(params: {
    syncMethod: ENotificationPushSyncMethod;
    syncAccountIds?: string[];
  }) {
    const { syncMethod, syncAccountIds } = params;
    let syncAccounts: INotificationPushSyncAccount[] = [];

    if (
      syncMethod === ENotificationPushSyncMethod.override ||
      syncAccountIds?.length
    ) {
      ({ syncAccounts } = await this.buildSyncAccounts({
        accountIds:
          syncMethod === ENotificationPushSyncMethod.override
            ? undefined
            : syncAccountIds || [],
      }));
      defaultLogger.notification.common.consoleLog(
        'registerClientWithSyncAccounts - buildSyncAccounts result',
        syncAccounts.length,
      );
    }

    return this.registerClient({
      client: this.pushClient,
      syncMethod,
      syncAccounts,
    });
  }

  @backgroundMethod()
  async registerClientDaily() {
    const { lastRegisterTime } = await notificationsAtom.get();
    if (
      lastRegisterTime &&
      Date.now() - lastRegisterTime <
        timerUtils.getTimeDurationMs({
          hour: 24,
        })
    ) {
      return;
    }
    void this.notificationProvider.clearNotificationCache();
    return this.registerClientWithOverrideAllAccounts();
  }

  @backgroundMethod()
  async registerClient(params: INotificationPushRegisterParams) {
    defaultLogger.notification.common.registerClient(params, null);
    const client = await this.getClient(EServiceEndpointEnum.Notification);
    const result = await client.post<
      IApiClientResponse<{
        badges: number;
        created: number;
        removed: number;
      }>
    >('/notification/v1/account/register', params);
    // TODO return badge count
    defaultLogger.notification.common.registerClient(params, result.data);

    const badge = result?.data?.data?.badges;
    if (isNumber(badge)) {
      void this.setBadge({ count: badge });
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return result.data;
  }

  @backgroundMethod()
  async unregisterClient() {
    const client = await this.getClient(EServiceEndpointEnum.Notification);
    await client.post('/notification/v1/account/unregister', {
      client: this.pushClient,
    });
  }

  @backgroundMethod()
  async ackNotificationMessage(params: INotificationPushMessageAckParams) {
    let isWsAckSuccess = false;
    if (this.notificationProvider?.webSocketProvider) {
      try {
        const res =
          await this.notificationProvider.webSocketProvider.ackMessage(params);
        if (res) {
          isWsAckSuccess = true;
        }
      } catch (error) {
        defaultLogger.notification.common.consoleLog(
          'ackNotificationMessage error',
          error,
        );
      }
    }

    if (!isWsAckSuccess) {
      const client = await this.getClient(EServiceEndpointEnum.Notification);
      await client.post('/notification/v1/message/ack', {
        msgId: params.msgId,
        action: params.action,
      });
    }

    defaultLogger.notification.common.ackMessage(params, null);
    void this.refreshBadgeFromServer();
    if (
      params.msgId &&
      params.action === ENotificationPushMessageAckAction.readed
    ) {
      await notificationsReadedAtom.set((v) => ({
        ...v,
        [params.msgId as string]: true,
      }));
    }
  }

  getSupportedNetworks = memoizee(
    async () => {
      // /notification/v1/config/supported-networks
      const client = await this.getClient(EServiceEndpointEnum.Notification);
      const result = await client.get<
        IApiClientResponse<
          {
            networkId: string;
            impl: string;
            chainId: string;
          }[]
        >
      >('/notification/v1/config/supported-networks');

      const supportNetworks = result?.data?.data ?? [];
      const supportNetworksFiltered = uniqBy(supportNetworks, (item) => {
        if (item.impl === IMPL_EVM) {
          return item.impl;
        }
        return item.networkId;
      });
      return supportNetworksFiltered;
    },
    {
      maxAge: timerUtils.getTimeDurationMs({
        hour: 1,
      }),
    },
  );

  @backgroundMethod()
  @toastIfError()
  async fetchMessageList(): Promise<INotificationPushMessageListItem[]> {
    const client = await this.getClient(EServiceEndpointEnum.Notification);
    const result = await client.post<
      IApiClientResponse<INotificationPushMessageListItem[]>
    >('/notification/v1/message/list');
    // TODO return badge count
    return result?.data?.data || [];
  }

  @backgroundMethod()
  @toastIfError()
  async markNotificationReadAll() {
    const client = await this.getClient(EServiceEndpointEnum.Notification);
    const result = await client.post<
      IApiClientResponse<{
        updated: number;
      }>
    >('/notification/v1/message/read-all');
    if (result?.data?.data?.updated > 0) {
      await this.clearBadge();
    }
    // await timerUtils.wait(5000);
    return result?.data?.data;
  }

  @backgroundMethod()
  async refreshBadgeFromServer() {
    const client = await this.getClient(EServiceEndpointEnum.Notification);
    const result = await client.get<IApiClientResponse<number>>(
      '/notification/v1/message/badges',
    );
    const badge = result?.data?.data;
    if (isNumber(badge)) {
      await this.setBadge({ count: badge });
    }
  }

  @backgroundMethod()
  @toastIfError()
  async fetchNotificationSettings() {
    const client = await this.getClient(EServiceEndpointEnum.Notification);
    const result = await client.post<
      IApiClientResponse<INotificationPushSettings>
    >('/notification/v1/config/query');
    return result?.data?.data;
  }

  @backgroundMethod()
  @toastIfError()
  async updateNotificationSettings(
    params: INotificationPushSettings,
  ): Promise<boolean> {
    const client = await this.getClient(EServiceEndpointEnum.Notification);
    await client.post('/notification/v1/config/update', params);
    return true;
  }

  @backgroundMethod()
  async blockNotificationForTxId({
    networkId,
    tx,
  }: {
    networkId: string;
    tx: string;
  }) {
    const client = await this.getClient(EServiceEndpointEnum.Notification);
    const params = {
      networkId,
      tx,
    };
    await client.post<IApiClientResponse<INotificationPushSettings>>(
      '/notification/v1/message/block-tx',
      params,
    );
  }
}
