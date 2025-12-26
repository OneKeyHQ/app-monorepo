import { cloneDeep, debounce, isNumber, merge, uniq, uniqBy } from 'lodash';

import {
  backgroundMethod,
  toastIfError,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { IMPL_EVM } from '@onekeyhq/shared/src/engine/engineConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import perfUtils from '@onekeyhq/shared/src/utils/debug/perfUtils';
import notificationsUtils, {
  NOTIFICATION_ACCOUNT_ACTIVITY_DEFAULT_MAX_ACCOUNT_COUNT,
} from '@onekeyhq/shared/src/utils/notificationsUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import type { IApiClientResponse } from '@onekeyhq/shared/types/endpoint';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import type { IHyperLiquidSignatureRSV } from '@onekeyhq/shared/types/hyperliquid/webview';
import type {
  ENotificationPushTopicTypes,
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
  notificationsDevSettingsPersistAtom,
  notificationsReadedAtom,
  primePersistAtom,
  settingsPersistAtom,
} from '../../states/jotai/atoms';
import ServiceBase from '../ServiceBase';

import NotificationProvider from './NotificationProvider/NotificationProvider';

import type NotificationProviderBase from './NotificationProvider/NotificationProviderBase';
import type {
  IDBAccount,
  IDBDevice,
  IDBIndexedAccount,
  IDBWallet,
} from '../../dbs/local/types';
import type {
  IAccountActivityNotificationSettings,
  ISimpleDbNotificationSettings,
} from '../../dbs/simple/entity/SimpleDbEntityNotificationSettings';
import type { Socket } from 'socket.io-client';

export default class ServiceNotification extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
    appEventBus.on(EAppEventBusNames.AddDBAccountsToWallet, async (params) => {
      const { accounts } = params;
      // clear cache
      await this.clearServerSettingsCache();
      void this.registerClientWithAppendAccounts({
        dbAccounts: accounts, // append
      });
    });
    appEventBus.on(EAppEventBusNames.RenameDBAccounts, (params) => {
      const { accounts } = params;
      void this.registerClientWithAppendAccounts({
        dbAccounts: accounts, // replace
      });
    });
    appEventBus.on(EAppEventBusNames.AccountRemove, () => {
      void this.registerClientWithOverrideAllAccounts();
    });
    appEventBus.on(EAppEventBusNames.WalletRemove, () => {
      void this.registerClientWithOverrideAllAccounts();
    });
    appEventBus.on(EAppEventBusNames.WalletRename, () => {
      void this.registerClientWithOverrideAllAccounts();
    });
    appEventBus.on(EAppEventBusNames.MarketWatchListV2Changed, () => {
      void this.syncWatchlistTokensToServer();
    });
  }

  _notificationProvider: NotificationProviderBase | undefined;

  async getNotificationProvider(): Promise<NotificationProviderBase> {
    if (!this._notificationProvider) {
      const { disabledWebSocket, disabledJPush } =
        await notificationsDevSettingsPersistAtom.get();
      const settings = await settingsPersistAtom.get();

      this._notificationProvider = new NotificationProvider({
        options: {
          instanceId: settings.instanceId,
          disabledWebSocket,
          disabledJPush,
        },
        backgroundApi: this.backgroundApi,
      });
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
      throw new OneKeyLocalError('notification provider not init');
    }
    return this._notificationProvider;
  }

  init() {
    return timerUtils.setTimeoutPromised(() => this.getNotificationProvider());
  }

  pushClient: INotificationPushClient = {};

  @backgroundMethod()
  async getPushClient() {
    return this.pushClient;
  }

  isFirstTimeAllAccountsRegistered = false;

  onPushProviderConnected = async ({
    jpushId,
    socketId,
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
    if (!this.isFirstTimeAllAccountsRegistered) {
      this.isFirstTimeAllAccountsRegistered = true;
      // register when webSocket or jpush established
      void this.registerClientWithOverrideAllAccounts();
    } else {
      void this.updateClientBasicAppInfo();
    }
  };

  onNotificationReceived = async (
    messageInfo: INotificationPushMessageInfo,
  ) => {
    const { showMessagePushSource } =
      await notificationsDevSettingsPersistAtom.get();
    const msgId =
      messageInfo.extras?.params?.msgId || messageInfo.extras?.msgId;
    defaultLogger.notification.common.notificationReceived({
      messageInfo,
      notificationId: msgId,
      topic: messageInfo.extras?.topic,
      title: messageInfo.title,
      content: messageInfo.content,
    });

    void this.ackNotificationMessage({
      msgId,
      action: ENotificationPushMessageAckAction.show,
      remotePushMessageInfo: messageInfo,
    });

    if (messageInfo.pushSource === 'jpush') {
      // jpush will show notification automatically
    }

    // websocket push should show notification by ourselves
    if (messageInfo.pushSource === 'websocket') {
      if (!(await this.isNotificationShowed(msgId))) {
        const prefix = showMessagePushSource ? '[wss:] ' : '';
        // jpush will show notification automatically
        // websocket should show notification by ourselves
        const notificationParams = {
          notificationId: msgId,
          title: prefix + messageInfo.title,
          description: messageInfo.content,
          icon: messageInfo.extras?.image,
          remotePushMessageInfo: messageInfo,
        };
        await this.showNotification(notificationParams);
        if (!platformEnv.isNativeIOS) {
          appEventBus.emit(
            EAppEventBusNames.ShowInAppPushNotification,
            notificationParams,
          );
        }
      }
    }

    this.addShowedNotificationId(msgId);

    await notificationsAtom.set((v) =>
      perfUtils.buildNewValueIfChanged(v, {
        ...v,
        lastReceivedTime: Date.now(),
      }),
    );

    void this.increaseBadgeCountWhenNotificationReceived(messageInfo);
  };

  onNotificationClicked = async ({
    notificationId,
    params,
    webEvent,
    eventSource,
  }: INotificationClickParams) => {
    // Huawei Mate30  HarmonyOS will automatically trigger notificationClick event when App is launched, and notificationId is empty, so it needs to be ignored
    if (!notificationId) {
      return;
    }
    this.addShowedNotificationId(notificationId);

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
    await (await this.getNotificationProvider()).showAndFocusApp();

    await timerUtils.wait(400); // wait for app opened
    await notificationsUtils.navigateToNotificationDetail({
      message: params?.remotePushMessageInfo,
      isFromNotificationClick: true,
      notificationId: notificationId || '',
      notificationAccountId:
        params?.remotePushMessageInfo?.extras?.params?.accountId,
      mode: params?.remotePushMessageInfo?.extras?.mode,
      payload: params?.remotePushMessageInfo?.extras?.payload,
    });

    void this.removeNotification({
      notificationId,
      desktopNotification: webEvent?.target as any,
    });
  };

  onNotificationClosed = async ({
    notificationId,
    params,
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

  showedNotificationIds: string[] = [];

  async isNotificationShowed(
    notificationId: string | undefined,
  ): Promise<boolean> {
    try {
      if (!notificationId) {
        return false;
      }
      if (this.showedNotificationIds.includes(notificationId)) {
        return true;
      }
      const nativeNotifications = await (
        await this.getNotificationProvider()
      ).getNativeNotifications();
      return Boolean(
        nativeNotifications.find(
          (n) => n.notificationId === notificationId && notificationId,
        ),
      );
    } catch (error) {
      console.log('getNativeNotifications error', error);
      return false;
    }
  }

  addShowedNotificationId(notificationId: string | undefined) {
    if (!notificationId) {
      return;
    }
    this.showedNotificationIds.push(notificationId);
    this.showedNotificationIds = uniq(this.showedNotificationIds.slice(-100));
  }

  @backgroundMethod()
  async requestPermission(): Promise<INotificationPermissionDetail> {
    const result = await (
      await this.getNotificationProvider()
    ).requestPermission();
    defaultLogger.notification.common.requestPermission(result);
    return result;
  }

  @backgroundMethod()
  async getPermission(): Promise<INotificationPermissionDetail> {
    const result = await this.getPermissionWithoutLog();
    defaultLogger.notification.common.getPermission(result);
    return result;
  }

  @backgroundMethod()
  async getPermissionWithoutLog(): Promise<INotificationPermissionDetail> {
    const result = await (await this.getNotificationProvider()).getPermission();
    return result;
  }

  @backgroundMethod()
  async openPermissionSettings() {
    return (await this.getNotificationProvider()).openPermissionSettings();
  }

  @backgroundMethod()
  @toastIfError()
  async enableNotificationPermissions() {
    let permission = await this.requestPermission();
    await timerUtils.wait(600);
    if (permission.permission === ENotificationPermission.granted) {
      return permission;
    }

    permission = await this.getPermission();
    if (permission.permission === ENotificationPermission.granted) {
      return permission;
    }

    if (!permission.isSupported) {
      throw new OneKeyLocalError(
        'Notification is not supported on your device',
      );
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
    (await this.getNotificationProvider()).fixShowParams(params);
    const result = await (
      await this.getNotificationProvider()
    ).showNotification(params);
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
    return (await this.getNotificationProvider()).removeNotification(params);
  }

  @backgroundMethod()
  async setBadge(params: INotificationSetBadgeParams) {
    await this.setBadgeDebounced(params);
  }

  setBadgeDebounced = debounce(
    async (params: INotificationSetBadgeParams) => {
      defaultLogger.notification.common.setBadge(params);
      await notificationsAtom.set((v) =>
        perfUtils.buildNewValueIfChanged(v, {
          ...v,
          badge: params.count ?? undefined,
        }),
      );
      await (await this.getNotificationProvider()).setBadge(params);
    },
    600,
    {
      leading: false,
      trailing: true,
    },
  );

  @backgroundMethod()
  async clearBadge() {
    await this.setBadge({ count: null });
    defaultLogger.notification.common.clearBadge();
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

  convertToSyncAccounts = async ({
    dbAccounts,
    notificationWallets,
  }: {
    dbAccounts: IDBAccount[];
    notificationWallets?: IDBWallet[] | undefined;
  }) => {
    if (!notificationWallets) {
      // eslint-disable-next-line no-param-reassign
      notificationWallets = await this.getNotificationWalletsWithAccounts();
    }

    const { supportNetworksFiltered } = await this.getServerSettingsWithCache();

    await this.fixAccountActivityNotificationSettings({ notificationWallets });

    defaultLogger.notification.common.consoleLog('supportNetworksFiltered', {
      supportNetworksFiltered: supportNetworksFiltered.length,
      dbAccounts: dbAccounts.length,
    });

    const syncAccounts: INotificationPushSyncAccount[] = [];

    const notificationSettingsRawData =
      await this.backgroundApi.simpleDb.notificationSettings.getRawData();

    for (const account of dbAccounts) {
      const walletId = accountUtils.getWalletIdFromAccountId({
        accountId: account.id,
      });
      const isEnabled =
        await this.backgroundApi.simpleDb.notificationSettings.isAccountActivityEnabled(
          {
            notificationSettingsRawData,
            walletId,
            accountId: account.id,
            indexedAccountId: account.indexedAccountId,
          },
        );
      if (isEnabled) {
        const networks = supportNetworksFiltered.filter(
          (item) =>
            item.impl === account.impl ||
            item.networkId === account.createAtNetwork,
        );
        for (const network of networks) {
          let networkAccount: INetworkAccount | undefined;
          try {
            networkAccount = await this.backgroundApi.serviceAccount.getAccount(
              {
                accountId: account.id,
                networkId: network.networkId,
                dbAccount: account,
              },
            );
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

            const walletName = this.getNotificationWalletName({
              notificationWallets,
              walletId,
            });

            const acc: INotificationPushSyncAccount = {
              networkId,
              networkImpl,
              accountAddress: networkAccount.addressDetail.displayAddress,
              accountId: networkAccount.id,
              accountName: walletName
                ? `${walletName} / ${networkAccount.name}`
                : networkAccount.name,
            };
            syncAccounts.push(acc);
          }
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
    let dbAccounts: IDBAccount[] = [];

    const result = await this.backgroundApi.serviceAccount.getAllAccounts({
      ids: accountIds,
      filterRemoved: true,
    });
    dbAccounts = result.accounts;

    const notificationWallets = await this.getNotificationWalletsWithAccounts({
      allIndexedAccounts: result.allIndexedAccounts,
      allWallets: result.allWallets,
      allDevices: result.allDevices,
    });

    // accountIds is undefined means sync all accounts
    if (!accountIds) {
      void this.backgroundApi.serviceAppCleanup.cleanup({
        accountsRemoved: result.accountsRemoved,
        indexedAccountsRemoved: result.indexedAccountsRemoved,
      });
    }

    const { syncAccounts } = await this.convertToSyncAccounts({
      dbAccounts,
      notificationWallets,
    });

    return {
      syncAccounts,
    };
  }

  appendAccountsCache: IDBAccount[] = [];

  _registerClientWithAppendAccountsByCache = debounce(
    async () => {
      const { syncAccounts } = await this.convertToSyncAccounts({
        dbAccounts: [...this.appendAccountsCache],
      });
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
  async updateClientBasicAppInfo() {
    // update client basic app info: locale, currencyInfo, hideValue
    await this.registerClient({
      client: this.pushClient,
      syncMethod: ENotificationPushSyncMethod.append,
      syncAccounts: [],
    });
  }

  private async _registerClientWithOverrideAllAccountsCore() {
    console.log('registerClientWithOverrideAllAccountsCore');
    await timerUtils.setTimeoutPromised(async () => {
      await this.registerClientWithSyncAccounts({
        syncMethod: ENotificationPushSyncMethod.override,
      });
      await notificationsAtom.set((v) =>
        perfUtils.buildNewValueIfChanged(v, {
          ...v,
          lastRegisterTime: Date.now(),
        }),
      );
    });
  }

  @backgroundMethod()
  registerClientWithOverrideAllAccounts() {
    return this._registerClientWithOverrideAllAccountsDebounced();
  }

  @backgroundMethod()
  registerClientWithOverrideAllAccountsImmediate() {
    return this._registerClientWithOverrideAllAccountsCore();
  }

  @backgroundMethod()
  async getNotificationWalletsWithAccounts({
    allIndexedAccounts,
    allWallets,
    allDevices,
  }: {
    allIndexedAccounts?: IDBIndexedAccount[] | undefined;
    allWallets?: IDBWallet[] | undefined;
    allDevices?: IDBDevice[] | undefined;
  } = {}) {
    const result = await this.backgroundApi.serviceAccount.getWallets({
      nestedHiddenWallets: true,
      ignoreEmptySingletonWalletAccounts: true,
      includingAccounts: true,
      allIndexedAccounts,
      allWallets,
      allDevices,
    });
    return result.wallets;
  }

  getNotificationWalletName({
    notificationWallets,
    walletId,
  }: {
    notificationWallets: IDBWallet[];
    walletId: string;
  }) {
    for (const wallet of notificationWallets) {
      if (wallet.id === walletId) {
        return wallet.name;
      }
      if (wallet.hiddenWallets) {
        for (const hiddenWallet of wallet.hiddenWallets) {
          if (hiddenWallet.id === walletId) {
            return hiddenWallet.name;
          }
        }
      }
    }
    return '';
  }

  @backgroundMethod()
  async fixAccountActivityNotificationSettings({
    notificationWallets,
  }: {
    notificationWallets?: IDBWallet[] | undefined;
  } = {}) {
    if (!notificationWallets) {
      // eslint-disable-next-line no-param-reassign
      notificationWallets = await this.getNotificationWalletsWithAccounts();
    }

    const maxAccountCount =
      (await notificationsAtom.get()).maxAccountCount ??
      NOTIFICATION_ACCOUNT_ACTIVITY_DEFAULT_MAX_ACCOUNT_COUNT;

    const isPrime = await primePersistAtom.get();
    const isPrimeActive = isPrime?.primeSubscription?.isActive;

    const settings =
      await this.backgroundApi.simpleDb.notificationSettings.getRawData();

    const originalAccountActivity = cloneDeep(settings?.accountActivity ?? {});
    const currentAccountActivity = cloneDeep(settings?.accountActivity ?? {});
    if (
      isPrimeActive &&
      settings?.primeBackupAccountActivity &&
      maxAccountCount > NOTIFICATION_ACCOUNT_ACTIVITY_DEFAULT_MAX_ACCOUNT_COUNT
    ) {
      // merge oldAccountActivity with settings?.primeBackupAccountActivity
      // Logic: either value being true results in true, only when both are false does the result become false
      Object.entries(settings.primeBackupAccountActivity).forEach(
        ([walletId, primeWalletData]) => {
          if (primeWalletData) {
            const originalWalletData:
              | {
                  enabled: boolean | undefined;
                  accounts: {
                    [accountId: string]: {
                      enabled: boolean | undefined;
                    };
                  };
                }
              | undefined = originalAccountActivity[walletId];

            // Merge wallet enabled: true if either is true
            const mergedWalletEnabled = Boolean(
              primeWalletData.enabled || originalWalletData?.enabled,
            );

            currentAccountActivity[walletId] = {
              enabled: mergedWalletEnabled,
              accounts: {
                ...originalWalletData?.accounts,
              },
            };

            // Merge accounts
            if (primeWalletData.accounts) {
              Object.entries(primeWalletData.accounts).forEach(
                ([accountId, primeAccountData]) => {
                  if (primeAccountData) {
                    const originalAccountData:
                      | {
                          enabled: boolean | undefined;
                        }
                      | undefined = originalWalletData?.accounts?.[accountId];

                    // Merge account enabled: true if either is true
                    const mergedAccountEnabled = Boolean(
                      primeAccountData.enabled || originalAccountData?.enabled,
                    );

                    currentAccountActivity[walletId].accounts[accountId] = {
                      enabled: mergedAccountEnabled,
                    };
                  }
                },
              );
            }
          }
        },
      );
    }

    const accountActivity = await this.rebuildAccountActivity({
      notificationWallets,
      maxAccountCount,
      originalAccountActivity,
      currentAccountActivity,
      settings,
    });
    await this.saveAccountActivityNotificationSettings(accountActivity);
  }

  async rebuildAccountActivity({
    notificationWallets,
    maxAccountCount,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    originalAccountActivity,
    currentAccountActivity,
    settings,
  }: {
    notificationWallets: IDBWallet[];
    maxAccountCount: number;
    originalAccountActivity: IAccountActivityNotificationSettings;
    currentAccountActivity: IAccountActivityNotificationSettings;
    settings: ISimpleDbNotificationSettings | null | undefined;
  }) {
    const accountActivity: IAccountActivityNotificationSettings = {};

    const currentEnabledAccountCount =
      await this.backgroundApi.simpleDb.notificationSettings.getEnabledAccountCount();

    let totalEnabledCount = 0;
    const isInit = !settings?.accountActivity;
    const updateWalletAccountActivity = ({
      wallet,
      skipDisabledAccounts,
      oldAccountActivity,
    }: {
      wallet: IDBWallet;
      skipDisabledAccounts?: boolean;
      oldAccountActivity: IAccountActivityNotificationSettings;
    }) => {
      accountActivity[wallet.id] = oldAccountActivity?.[wallet.id] || {
        enabled: false,
        accounts: {},
      };
      accountActivity[wallet.id].accounts =
        accountActivity[wallet.id].accounts || {};
      let enabledCountInWallet = 0;
      const disableAccount = (account: IDBAccount | IDBIndexedAccount) => {
        if (skipDisabledAccounts) {
          return;
        }
        accountActivity[wallet.id].accounts[account.id] = {
          enabled: false,
        };
      };
      const enableAccount = (account: IDBAccount | IDBIndexedAccount) => {
        if (totalEnabledCount < maxAccountCount) {
          accountActivity[wallet.id].accounts[account.id] = {
            enabled: true,
          };
          totalEnabledCount += 1;
          enabledCountInWallet += 1;
          accountActivity[wallet.id].enabled = true;
        } else {
          disableAccount(account);
        }
      };

      for (const account of wallet.dbAccounts ||
        wallet.dbIndexedAccounts ||
        []) {
        if (isInit) {
          enableAccount(account);
        } else {
          const isWalletEnabled =
            oldAccountActivity?.[wallet.id]?.enabled === true ||
            oldAccountActivity?.[wallet.id]?.enabled === undefined;
          const isAccountEnabledUndefined =
            oldAccountActivity?.[wallet.id]?.accounts?.[account.id]?.enabled ===
            undefined;
          const isAccountEnabled =
            oldAccountActivity?.[wallet.id]?.accounts?.[account.id]?.enabled ===
              true || isAccountEnabledUndefined;

          if (isWalletEnabled && isAccountEnabled) {
            if (
              isAccountEnabledUndefined &&
              currentEnabledAccountCount >= maxAccountCount
            ) {
              disableAccount(account);
            } else {
              enableAccount(account);
            }
          } else {
            disableAccount(account);
          }
        }
      }
      if (accountActivity?.[wallet.id]?.enabled === undefined) {
        const newEnabled = enabledCountInWallet > 0;
        if (!newEnabled) {
          if (!skipDisabledAccounts) {
            accountActivity[wallet.id].enabled = false;
          }
        } else {
          accountActivity[wallet.id].enabled = true;
        }
      }
      if (enabledCountInWallet === 0 && !skipDisabledAccounts) {
        accountActivity[wallet.id].enabled = false;
      }
    };
    for (const wallet of notificationWallets) {
      // TODO only update enabled=true accounts
      // updateWalletAccountActivity(wallet, originalAccountActivity);
      // for (const hiddenWallet of wallet.hiddenWallets || []) {
      //   updateWalletAccountActivity(hiddenWallet, originalAccountActivity);
      // }

      updateWalletAccountActivity({
        wallet,
        oldAccountActivity: currentAccountActivity,
      });
      for (const hiddenWallet of wallet.hiddenWallets || []) {
        updateWalletAccountActivity({
          wallet: hiddenWallet,
          oldAccountActivity: currentAccountActivity,
        });
      }
    }

    return accountActivity;
  }

  @backgroundMethod()
  async saveAccountActivityNotificationSettings(
    accountActivity: IAccountActivityNotificationSettings | undefined,
  ) {
    await this.backgroundApi.simpleDb.notificationSettings.saveAccountActivityNotificationSettings(
      accountActivity,
    );
    await notificationsAtom.set((v) =>
      perfUtils.buildNewValueIfChanged(v, {
        ...v,
        lastSettingsUpdateTime: Date.now(),
      }),
    );
  }

  _registerClientWithOverrideAllAccountsDebounced = debounce(
    async () => {
      await this._registerClientWithOverrideAllAccountsCore();
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
    void (await this.getNotificationProvider()).clearNotificationCache();
    await this.registerClientWithOverrideAllAccounts();
    await this._syncWatchlistTokensToServerCore();
  }

  @backgroundMethod()
  async syncWatchlistTokensToServer() {
    return this._syncWatchlistTokensToServerDebounced();
  }

  private _syncWatchlistTokensToServerDebounced = debounce(
    async () => {
      await this._syncWatchlistTokensToServerCore();
    },
    5000,
    {
      leading: false,
      trailing: true,
    },
  );

  private async _syncWatchlistTokensToServerCore() {
    const tokens =
      await this.backgroundApi.serviceMarketV2.buildWatchlistTokensForNotification();

    defaultLogger.notification.common.consoleLog(
      'syncWatchlistTokensToServer',
      { tokenCount: tokens.length },
    );

    const client = await this.getClient(EServiceEndpointEnum.Notification);
    await client.post('/notification/v1/watchlist/tokens', {
      tokens,
    });
  }

  @backgroundMethod()
  async registerClient(params: INotificationPushRegisterParams) {
    try {
      const settings = await settingsPersistAtom.get();
      defaultLogger.notification.common.registerClient(
        params,
        null,
        settings.instanceId,
      );
      const client = await this.getClient(EServiceEndpointEnum.Notification);
      const result = await client.post<
        IApiClientResponse<{
          badges: number;
          created: number;
          removed: number;
        }>
      >('/notification/v1/account/register', params);
      defaultLogger.notification.common.registerClient(
        params,
        result.data,
        settings.instanceId,
      );

      const badge = result?.data?.data?.badges;
      if (isNumber(badge)) {
        void this.setBadge({ count: badge });
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return result.data;
    } catch (error) {
      await notificationsAtom.set((v) =>
        perfUtils.buildNewValueIfChanged(v, {
          ...v,
          lastRegisterTime: undefined,
        }),
      );
      throw error;
    }
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
    let isWebSocketAckSuccess = false;
    let ackRes: any;
    const webSocketProvider = (await this.getNotificationProvider())
      ?.webSocketProvider;
    if (webSocketProvider) {
      isWebSocketAckSuccess = await webSocketProvider?.ackMessage(params);
    }

    if (!isWebSocketAckSuccess && params.msgId) {
      const client = await this.getClient(EServiceEndpointEnum.Notification);
      const res = await client.post('/notification/v1/message/ack', {
        msgId: params.msgId,
        action: params.action,
      });
      ackRes = res.data;
    }

    defaultLogger.notification.common.ackNotificationMessage(
      params,
      ackRes,
      isWebSocketAckSuccess ? 'webSocket' : 'http',
    );

    if (
      params.msgId &&
      params.action === ENotificationPushMessageAckAction.readed
    ) {
      // readed action may change badge, should refresh badge from server
      void this.refreshBadgeFromServer();
      await notificationsReadedAtom.set((v) => ({
        ...v,
        [params.msgId as string]: true,
      }));
    }
  }

  async saveMaxAccountCount({
    serverSettings,
  }: {
    serverSettings: INotificationPushSettings;
  }) {
    const oldMaxAccountCount = (await notificationsAtom.get())?.maxAccountCount;

    // serverSettings.maxAccount = 30;

    // eslint-disable-next-line prefer-const
    let maxAccountCount =
      serverSettings.maxAccount ??
      NOTIFICATION_ACCOUNT_ACTIVITY_DEFAULT_MAX_ACCOUNT_COUNT;

    const primeUserInfo = await primePersistAtom.get();
    if (primeUserInfo?.primeSubscription?.isActive) {
      // debugger;
      // maxAccountCount = Math.max(maxAccountCount, 100);
    }

    await notificationsAtom.set((v) =>
      perfUtils.buildNewValueIfChanged(v, {
        ...v,
        maxAccountCount,
      }),
    );

    if ((maxAccountCount ?? 0) < (oldMaxAccountCount ?? 0)) {
      await this.backgroundApi.simpleDb.notificationSettings.backupPrimeAccountActivityNotificationSettings();
    }

    console.log('saveMaxAccountCount', {
      oldMaxAccountCount,
      maxAccountCount,
    });
  }

  @backgroundMethod()
  async clearServerSettingsCache() {
    await this.getServerSettingsWithCache.clear();
  }

  // TODO clear cache if prime expired, onekeyID logout
  getServerSettingsWithCache = memoizee(
    async () => {
      const serverSettings = await this.fetchServerNotificationSettings();

      let supportNetworks:
        | {
            networkId: string;
            impl: string;
            chainId: string;
          }[]
        | undefined;
      if (serverSettings.supportedNetworks) {
        supportNetworks = serverSettings.supportedNetworks;
      } else {
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

        supportNetworks = result?.data?.data ?? [];
      }

      await this.saveMaxAccountCount({ serverSettings });

      const supportNetworksFiltered = uniqBy(supportNetworks, (item) => {
        if (item.impl === IMPL_EVM) {
          return item.impl;
        }
        return item.networkId;
      });
      return { supportNetworksFiltered, serverSettings };
    },
    {
      maxAge: timerUtils.getTimeDurationMs({
        hour: 1,
      }),
    },
  );

  @backgroundMethod()
  @toastIfError()
  async fetchMessageList(
    topicTypes?: ENotificationPushTopicTypes[] | undefined,
  ): Promise<INotificationPushMessageListItem[]> {
    const client = await this.getClient(EServiceEndpointEnum.Notification);
    const result = await client.post<
      IApiClientResponse<INotificationPushMessageListItem[]>
    >('/notification/v1/message/list', topicTypes ? { topicTypes } : undefined);
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

    setTimeout(() => {
      void this.clearBadge();
    });
    // await timerUtils.wait(5000);
    return result?.data?.data;
  }

  @backgroundMethod()
  async refreshBadgeFromServer() {
    await this.refreshBadgeFromServerDebounced();
  }

  refreshBadgeFromServerDebounced = debounce(
    async () => {
      const client = await this.getClient(EServiceEndpointEnum.Notification);
      const result = await client.get<IApiClientResponse<number>>(
        '/notification/v1/message/badges',
      );
      const badge = result?.data?.data;
      if (isNumber(badge)) {
        await this.setBadge({ count: badge });
      }
    },
    600,
    {
      leading: false,
      trailing: true,
    },
  );

  @backgroundMethod()
  @toastIfError()
  async fetchServerNotificationSettings() {
    const client = await this.getClient(EServiceEndpointEnum.Notification);
    const result = await client.post<
      IApiClientResponse<INotificationPushSettings>
    >('/notification/v1/config/query');
    return result?.data?.data;
  }

  @backgroundMethod()
  async fetchServerNotificationSettingsWithCache(): Promise<INotificationPushSettings> {
    const { serverSettings } = await this.getServerSettingsWithCache();
    return serverSettings;
  }

  updateNotificationSettingsAbortController: AbortController | undefined;

  @backgroundMethod()
  @toastIfError()
  async updateServerNotificationSettings(params: INotificationPushSettings) {
    this.updateNotificationSettingsAbortController?.abort();

    this.updateNotificationSettingsAbortController = new AbortController();
    const client = await this.getClient(EServiceEndpointEnum.Notification);
    const result = await client.post<
      IApiClientResponse<INotificationPushSettings>
    >('/notification/v1/config/update', params, {
      signal: this.updateNotificationSettingsAbortController.signal,
    });
    if (result?.data?.data?.pushEnabled) {
      void this.registerClientWithOverrideAllAccounts();
    }
    await this.clearServerSettingsCache();
    await notificationsAtom.set((v) =>
      perfUtils.buildNewValueIfChanged(v, {
        ...v,
        lastSettingsUpdateTime: Date.now(),
      }),
    );
    return result?.data?.data;
  }

  @backgroundMethod()
  async blockNotificationForTxId({
    networkId,
    tx,
  }: {
    networkId: string;
    tx: string;
  }) {
    if (platformEnv.isExtension) {
      return;
    }
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

  @backgroundMethod()
  async notifyHyperliquidAccountBind({
    signerAddress,
    action,
    nonce,
    signature,
    accountId,
    accountName,
  }: {
    signerAddress: string;
    action: {
      type: string;
      signatureChainId: string;
      hyperliquidChain: string;
      agentAddress: string;
      agentName: string;
      nonce: number;
    };
    nonce: number;
    signature: IHyperLiquidSignatureRSV;
    accountId?: string;
    accountName?: string;
  }) {
    if (!signerAddress) {
      return;
    }
    const client = await this.getClient(EServiceEndpointEnum.Notification);
    await client.post('/notification/v1/hyperliquid-account/bind', {
      signerAddress,
      action,
      nonce,
      signature,
      accountId,
      accountName,
    });
  }

  @backgroundMethod()
  async pingWebSocket(params: any) {
    const notificationProvider = await this.getNotificationProvider();
    if (notificationProvider?.webSocketProvider) {
      return notificationProvider.webSocketProvider.ping(params);
    }
    throw new OneKeyLocalError('WebSocket provider not found');
  }
}
