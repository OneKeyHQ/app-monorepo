/* eslint-disable @typescript-eslint/unbound-method */
import JPush from 'jpush-react-native';
import { pick } from 'lodash';
import { Dimensions } from 'react-native';

import { SCREEN_SIZE } from '@onekeyhq/components/src/Provider/device';
import { SocketEvents } from '@onekeyhq/engine/src/constants';
import {
  AddPriceAlertConfig,
  NotificationExtra,
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
  EVMDecodedItem,
  EVMDecodedTxType,
} from '@onekeyhq/engine/src/vaults/impl/evm/decoder/types';
import logo from '@onekeyhq/kit/assets/logo.png';
import { getAppNavigation } from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { getTimeDurationMs, wait } from '@onekeyhq/kit/src/utils/helper';
import {
  AppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import { initJpush } from '@onekeyhq/shared/src/notification';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { HomeRoutes, RootRoutes, TabRoutes } from '../../routes/routesEnum';
import { setPushNotificationConfig } from '../../store/reducers/settings';
import { setHomeTabName } from '../../store/reducers/status';
import { WalletHomeTabEnum } from '../../views/Wallet/type';
import { backgroundClass, backgroundMethod, bindThis } from '../decorators';

import ServiceBase from './ServiceBase';

@backgroundClass()
export default class ServiceNotification extends ServiceBase {
  private interval?: ReturnType<typeof setInterval>;

  @backgroundMethod()
  async init(launchNotification?: NotificationExtra) {
    try {
      await this.backgroundApi.serviceApp.waitForAppInited({
        logName: 'ServiceNotification',
      });
    } catch (error) {
      debugLogger.notification.error(error);
    }
    this.clear();
    this.interval = setInterval(
      () => {
        this.syncLocalEnabledAccounts();
      },
      getTimeDurationMs({
        minute: 5,
      }),
    );

    if (platformEnv.isNative) {
      initJpush();
      debugLogger.notification.info(`init jpush`);
      JPush.addConnectEventListener(this.handleConnectStateChangeCallback);
      // @ts-ignore
      JPush.addNotificationListener(this.handleNotificationCallback);
      // @ts-ignore
      JPush.addLocalNotificationListener(this.handleNotificationCallback);
      this.clearBadge();
    }
    if (platformEnv.isRuntimeBrowser) {
      try {
        await this.backgroundApi.serviceSocket.initSocket();
        this.registerNotificationCallback();
      } catch (e) {
        debugLogger.notification.error(`init socket failed`, e);
      }
    }
    this.syncLocalEnabledAccounts();
    this.syncPushNotificationConfig();

    if (platformEnv.isNativeIOS && launchNotification) {
      const {
        _j_msgid: messageID = '',
        aps: { title = '', body: content = '' } = {},
      } = launchNotification || {};
      debugLogger.notification.info('launchNotification: ', launchNotification);
      this.handleNotificationCallback({
        title,
        content,
        messageID,
        notificationEventType: 'notificationOpened',
        extras: launchNotification,
      });
    }
  }

  @bindThis()
  @backgroundMethod()
  clear() {
    if (this.interval) {
      clearInterval(this.interval);
    }
    if (platformEnv.isNative) {
      JPush.removeListener(this.handleNotificationCallback);
      JPush.removeListener(this.handleNotificationCallback);
      JPush.removeListener(this.handleConnectStateChangeCallback);
    }
    if (platformEnv.isRuntimeBrowser) {
      this.backgroundApi.serviceSocket.clear();
    }
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

  @backgroundMethod()
  clearBadge() {
    debugLogger.notification.debug('clearBadge');
    if (platformEnv.isNative) {
      JPush.setBadge({
        badge: 0,
        appBadge: 0,
      });
    }
  }

  @bindThis()
  @backgroundMethod()
  handleConnectStateChangeCallback(result: { connectEnable: boolean }) {
    debugLogger.notification.debug('JPUSH.addConnectEventListener', result);
    if (!result.connectEnable) {
      return;
    }
    JPush.getRegistrationID(this.handleRegistrationIdCallback.bind(this));
  }

  @backgroundMethod()
  handleRegistrationIdCallback(res: { registerID: string }) {
    debugLogger.notification.debug('JPUSH.getRegistrationID', res);
    const { dispatch } = this.backgroundApi;
    dispatch(
      setPushNotificationConfig({
        registrationId: res.registerID,
      }),
    );
    this.syncPushNotificationConfig();
  }

  @backgroundMethod()
  async switchToTokenDetailScreen(params: NotificationExtra['params']) {
    const navigation = getAppNavigation();
    const width = await this.getWindowWidthInBackground();
    const isVertical = width < SCREEN_SIZE.MEDIUM;
    const { appSelector, serviceApp } = this.backgroundApi;
    const { activeAccountId: accountId, activeNetworkId: networkId } =
      appSelector((s) => s.general);
    const filter = params.tokenId
      ? undefined
      : (i: EVMDecodedItem) => i.txType === EVMDecodedTxType.NATIVE_TRANSFER;

    const isToMarketDetail = !!params?.coingeckoId;

    const routerParams = isToMarketDetail
      ? { marketTokenId: params.coingeckoId }
      : {
          accountId,
          networkId: params.networkId || networkId,
          tokenId: params.tokenId || '',
          historyFilter: filter,
        };

    const detailScreenName = isToMarketDetail
      ? HomeRoutes.MarketDetail
      : HomeRoutes.ScreenTokenDetail;

    const tabScreenName = isToMarketDetail ? TabRoutes.Market : TabRoutes.Home;

    let expandRoutes = [
      RootRoutes.Root,
      HomeRoutes.InitialTab,
      RootRoutes.Tab,
      tabScreenName,
      detailScreenName,
    ];
    let navigationRoutes: any = {
      screen: HomeRoutes.InitialTab,
      params: {
        screen: RootRoutes.Tab,
        params: {
          screen: tabScreenName,
          params: {
            screen: detailScreenName,
            params: routerParams,
          },
        },
      },
    };
    if (isVertical) {
      expandRoutes = [RootRoutes.Root, detailScreenName];
      navigationRoutes = {
        screen: detailScreenName,
        params: routerParams,
      };
    }
    if (platformEnv.isExtension) {
      serviceApp.openExtensionExpandTab({
        routes: expandRoutes,
        params: routerParams,
      });
    } else {
      navigation?.navigate(RootRoutes.Root, navigationRoutes);
    }
  }

  @backgroundMethod()
  async switchToScreen({ screen, params }: NotificationExtra) {
    const navigation = global.$navigationRef.current;
    const { dispatch, serviceApp } = this.backgroundApi;
    if (!platformEnv.isExtension) {
      const tabScreenName = params?.coingeckoId
        ? TabRoutes.Market
        : TabRoutes.Home;
      if (navigation?.canGoBack()) {
        navigation?.goBack();
      }
      navigation?.navigate(RootRoutes.Tab, {
        screen: tabScreenName,
      });
      await wait(600);
    }
    switch (screen) {
      case HomeRoutes.ScreenTokenDetail:
        this.switchToTokenDetailScreen(params);
        break;
      case HomeRoutes.InitialTab:
        dispatch(setHomeTabName(WalletHomeTabEnum.History));
        if (platformEnv.isExtension) {
          serviceApp.openExtensionExpandTab({
            routes: [RootRoutes.Tab, TabRoutes.Home],
          });
        }
        break;
      default:
        break;
    }
  }

  @bindThis()
  @backgroundMethod()
  async handleNotificationCallback(result: NotificationType) {
    debugLogger.notification.info('notification', result);
    this.emitNotificationStatusChange(result);
    const { appSelector, serviceAccount, serviceNetwork } = this.backgroundApi;
    const { activeAccountId: accountId, activeNetworkId: networkId } =
      appSelector((s) => s.general);
    if (!accountId || !networkId) {
      return;
    }
    if (
      result?.notificationEventType !== 'notificationOpened' ||
      !result.extras
    ) {
      return;
    }
    if (platformEnv.isDesktop) {
      const { desktopApi } = window;
      desktopApi?.restore?.();
    }
    // focus browser tab
    if (platformEnv.isWeb) {
      window?.focus?.();
    }
    const extras = result?.extras as {
      screen: NotificationExtra['screen'];
      params: string;
    };
    if (!extras.screen) {
      return;
    }
    let params: NotificationExtra['params'] = {};
    try {
      params = platformEnv.isNativeAndroid
        ? JSON.parse(extras.params)
        : extras.params;
      if (params.accountId) {
        await serviceAccount.changeActiveAccountByAccountId(params.accountId);
      }
      if (params.networkId) {
        await serviceNetwork.changeActiveNetwork(params.networkId);
      }
    } catch (error) {
      debugLogger.notification.error(
        `Jpush parse params error`,
        error instanceof Error ? error.message : error,
      );
    }
    this.switchToScreen({
      screen: extras.screen,
      params,
    });
  }

  @backgroundMethod()
  getWindowWidthInBackground(): Promise<number> {
    if (platformEnv.isExtensionBackground) {
      return new Promise((resolve) => {
        chrome.windows.getCurrent((w) => {
          resolve(w.width || 0);
        });
      });
    }
    return Promise.resolve(Dimensions.get('window').width);
  }

  @backgroundMethod()
  registerNotificationCallback() {
    // native use jpush notification
    if (!platformEnv.isRuntimeBrowser) {
      return;
    }
    if (!('Notification' in window)) {
      debugLogger.notification.error(
        'This browser does not support desktop notification',
      );
      return;
    }
    const { serviceSocket } = this.backgroundApi;
    serviceSocket.registerSocketCallback(
      SocketEvents.Notification,
      (params: NotificationType) => {
        this.handleNotificationCallback({
          messageID: '',
          ...pick(params, 'title', 'content', 'extras'),
          notificationEventType: 'notificationArrived',
        });
        const n = new Notification(params.title, {
          body: params.content,
          icon: platformEnv.isDesktopMac ? undefined : logo,
        });
        n.onclick = () => {
          this.handleNotificationCallback({
            messageID: '',
            ...pick(params, 'title', 'content', 'extras'),
            notificationEventType: 'notificationOpened',
          });
          n.close();
        };
      },
    );
  }
}
