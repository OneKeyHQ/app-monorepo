/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable camelcase */
import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';

import { getBgSensitiveTextEncodeKey } from '@onekeyhq/core/src/secret';
import {
  backgroundClass,
  providerApiMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import type { EOAuthSocialLoginProvider } from '@onekeyhq/shared/src/consts/authConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IEventBusPayloadShowToast } from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  EKeylessWebBridgeEvent,
  type IKeylessWebBridgeEventPayload,
  type IKeylessWebSessionState,
} from '@onekeyhq/shared/src/keylessWallet/keylessWebTypes';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import {
  EOnboardingPagesV2,
  EOnboardingV2OneKeyIDLoginMode,
} from '@onekeyhq/shared/src/routes/onboardingv2';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import { waitForDataLoaded } from '@onekeyhq/shared/src/utils/promiseUtils';
import { sidePanelState } from '@onekeyhq/shared/src/utils/sidePanelUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EHostSecurityLevel } from '@onekeyhq/shared/types/discovery';
import type {
  IRookieGuideInfo,
  IRookieShareData,
} from '@onekeyhq/shared/types/rookieGuide';

import { isWebEmbedApiAllowedOrigin } from '../apis/backgroundApiPermissions';

import ProviderApiBase from './ProviderApiBase';

import type { IProviderBaseBackgroundNotifyInfo } from './ProviderApiBase';
import type BackgroundApiBase from '../apis/BackgroundApiBase';
import type { IBackgroundApiWebembedCallMessage } from '../apis/IBackgroundApi';
import type { IFloatingIconSettings } from '../dbs/simple/entity/SimpleDbEntityFloatingIconSettings';
import type {
  IJsBridgeMessagePayload,
  IJsonRpcRequest,
} from '@onekeyfe/cross-inpage-provider-types';

export interface IOneKeyWalletInfo {
  enableExtContentScriptReloadButton?: boolean;
  platform?: string;
  version?: string;
  buildNumber?: string;
  disableExt: boolean;
  isDefaultWallet?: boolean;
  excludedDappList: string[];
  isLegacy: boolean;
  platformEnv: {
    isRuntimeBrowser?: boolean;
    isRuntimeChrome?: boolean;
    isRuntimeFirefox?: boolean;

    isWeb?: boolean;

    isNative?: boolean;
    isNativeIOS?: boolean;
    isNativeAndroid?: boolean;

    isExtension?: boolean;
    isExtChrome?: boolean;
    isExtFirefox?: boolean;

    isDesktop?: boolean;
    isDesktopWin?: boolean;
    isDesktopLinux?: boolean;
    isDesktopMac?: boolean;
  };
}

@backgroundClass()
class ProviderApiPrivate extends ProviderApiBase {
  public providerName = IInjectedProviderNames.$private;

  private lastFocusUrl = '';

  private static readonly MAX_KEYLESS_CACHE_SIZE = 50;

  private keylessLoginDoneEventCache = new Set<string>();

  private addToKeylessLoginDoneEventCache(key: string) {
    if (
      this.keylessLoginDoneEventCache.size >=
      ProviderApiPrivate.MAX_KEYLESS_CACHE_SIZE
    ) {
      this.keylessLoginDoneEventCache.clear();
    }
    this.keylessLoginDoneEventCache.add(key);
  }

  private async queryTabsByOrigin(origin: string): Promise<chrome.tabs.Tab[]> {
    if (!platformEnv.isExtension || !chrome.tabs?.query) {
      return [];
    }
    try {
      const originUrl = new URL(origin);
      const tabPattern = `${originUrl.origin}/*`;
      const tabs = await chrome.tabs.query({
        url: [tabPattern],
      });
      return tabs;
    } catch {
      return [];
    }
  }

  private async emitKeylessBridgeEventToOrigin({
    origin,
    payload,
  }: {
    origin: string;
    payload: IKeylessWebBridgeEventPayload;
  }) {
    if (
      !platformEnv.isExtension ||
      !chrome.scripting?.executeScript ||
      !origin
    ) {
      return;
    }
    const tabs = await this.queryTabsByOrigin(origin);
    const eventPayload = payload;
    await Promise.all(
      tabs.map(async (tab) => {
        if (typeof tab.id !== 'number') {
          return;
        }
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            args: [eventPayload],
            func: (bridgePayload) => {
              globalThis.postMessage(bridgePayload, globalThis.location.origin);
            },
          });
        } catch (error) {
          console.error('emitKeylessBridgeEventToOrigin', error);
        }
      }),
    );
  }

  private async getKeylessSessionState({
    request,
    provider,
    nonce,
  }: {
    request: IJsBridgeMessagePayload;
    provider?: EOAuthSocialLoginProvider;
    nonce?: string;
  }): Promise<IKeylessWebSessionState> {
    const keylessWallet = await this.backgroundApi.serviceAccount
      .getKeylessWallet()
      .catch(() => undefined);
    const connectedAccounts = await this.backgroundApi.serviceDApp
      .dAppGetConnectedAccountsInfo(request)
      .catch(() => null);

    return {
      pluginInstalled: true,
      walletExists: Boolean(keylessWallet),
      walletType: keylessWallet?.keylessDetailsInfo?.keylessProvider,
      siteConnected: Boolean(connectedAccounts?.length),
      connectedAccountId: connectedAccounts?.[0]?.account?.id,
      pendingProvider: provider,
      pendingNonce: nonce,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  notifyDappAccountsChanged(info: IProviderBaseBackgroundNotifyInfo): void {
    // noop
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  notifyDappChainChanged(info: IProviderBaseBackgroundNotifyInfo): void {
    // noop
  }

  public async notifyExtSwitchChanged(info: IProviderBaseBackgroundNotifyInfo) {
    const params = await this.getWalletInfo();
    info.send(
      { method: 'wallet_events_ext_switch_changed', params },
      info.targetOrigin,
    );
  }

  public async notifyFloatingIconChanged(
    info: IProviderBaseBackgroundNotifyInfo,
    params: { showFloatingIcon: boolean },
  ) {
    info.send(
      { method: 'wallet_events_floating_icon_changed', params },
      info.targetOrigin,
    );
  }

  // UI Notify
  public async notifyDappSiteOfNetworkChange(
    info: IProviderBaseBackgroundNotifyInfo,
    params: {
      getNetworkName: ({ origin }: { origin: string }) => Promise<string>;
    },
  ) {
    const networkName = await params.getNetworkName({
      origin: info.targetOrigin,
    });
    if (!networkName) {
      return;
    }
    const networkChangedText = appLocale.intl.formatMessage(
      {
        id: ETranslations.feedback_current_network_message,
      },
      {
        network: networkName,
      },
    );
    console.log(
      'notifyNetworkChangedToDappSite ======>>>>>>>>>>>>: ',
      networkChangedText,
    );
    info.send(
      {
        method: 'wallet_events_dapp_network_changed',
        params: {
          networkChangedText,
        },
      },
      info.targetOrigin,
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public rpcCall(request: IJsBridgeMessagePayload): any {
    // noop
  }

  // ----------------------------------------------
  async getWalletInfo(): Promise<IOneKeyWalletInfo> {
    const { isDefaultWallet, excludedDappList } =
      await this.backgroundApi.serviceContextMenu.getDefaultWalletSettings();
    return {
      enableExtContentScriptReloadButton: false,
      platform: process.env.ONEKEY_PLATFORM,
      version: process.env.VERSION,
      buildNumber: process.env.BUILD_NUMBER,
      disableExt: false,
      isDefaultWallet,
      excludedDappList,
      isLegacy: false,
      platformEnv: {
        isRuntimeBrowser: platformEnv.isRuntimeBrowser,
        isRuntimeChrome: platformEnv.isRuntimeChrome,
        isRuntimeFirefox: platformEnv.isRuntimeFirefox,

        isWeb: platformEnv.isWeb,

        isNative: platformEnv.isNative,
        isNativeIOS: platformEnv.isNativeIOS,
        isNativeAndroid: platformEnv.isNativeAndroid,

        isExtension: platformEnv.isExtension,
        isExtChrome: platformEnv.isExtChrome,
        isExtFirefox: platformEnv.isExtFirefox,

        isDesktop: platformEnv.isDesktop,
        isDesktopWin: platformEnv.isDesktopWin,
        isDesktopLinux: platformEnv.isDesktopLinux,
        isDesktopMac: platformEnv.isDesktopMac,
      },
    };
  }

  // $onekey.$private.request({method:'wallet_getConnectWalletInfo'})
  @providerApiMethod()
  async wallet_getConnectWalletInfo(
    request: IJsBridgeMessagePayload,
    { time = 0 }: { time?: number } = {},
  ) {
    setTimeout(() => {
      if (request.origin) {
        void this.backgroundApi.serviceDApp.notifyDAppAccountAndChainChangedWithCache(
          {
            targetOrigin: request.origin,
          },
        );
      }
    }, 200);

    // const manifest = chrome.runtime.getManifest();
    // pass debugLoggerSettings to dapp injected provider
    // TODO: (await getDebugLoggerSettings())
    const debugLoggerSettings = '';
    // const ethereum = this.backgroundApi.providers
    //   .ethereum as ProviderApiEthereum;
    // const providerState = await ethereum.metamask_getProviderState(request);
    return {
      pong: true,
      time: Date.now(),
      delay: Date.now() - time,
      debugLoggerConfig: {
        // ** pass full logger settings string to Dapp
        config: debugLoggerSettings,

        // ** or you can enable some Dapp logger keys manually
        enabledKeys: platformEnv.isDev
          ? [
              // 'jsBridge', 'extInjected', 'providerBase'
            ]
          : [],

        // ** or you can update logger settings in Dapp console directly
        //    ** (all logger settings in Wallet should be disabled first)
        /*
          window.localStorage.setItem('$$ONEKEY_DEBUG_LOGGER', 'jsBridge,ethereum');
          window.location.reload();
           */
      },
      walletInfo: await this.getWalletInfo(),
      providerState: {},
    };
  }

  // $onekey.$private.request({method:'wallet_sendSiteMetadata'})
  @providerApiMethod()
  wallet_sendSiteMetadata() {
    // TODO save to DB
    return { success: 'wallet_sendSiteMetadata: save to DB' };
  }

  /*
    window.$onekey.$private.request({
      method: 'wallet_detectRiskLevel',
      params: { url: 'https://www.google.com' },
    });
  */
  @providerApiMethod()
  async wallet_detectRiskLevel(request: IJsBridgeMessagePayload) {
    console.log('ProviderApiPrivate.detectRiskLevel', request);
    if (request.origin) {
      const securityInfo =
        await this.backgroundApi.serviceDiscovery.checkUrlSecurity({
          url: request.origin,
          from: 'script',
        });
      return {
        securityInfo,
        isExtension: !!platformEnv.isExtension,
        i18n: {
          title: appLocale.intl.formatMessage({
            id: ETranslations.explore_malicious_dapp,
          }),
          description: appLocale.intl.formatMessage({
            id: ETranslations.explore_malicious_dapp_warning_description,
          }),
          continueMessage: appLocale.intl.formatMessage({
            id: ETranslations.explore_malicious_dapp_warning_continueMessage,
          }),
          continueLink: appLocale.intl.formatMessage({
            id: ETranslations.explore_malicious_dapp_warning_continueLink,
          }),
          addToWhiteListLink: appLocale.intl.formatMessage({
            id: ETranslations.explore_malicious_dapp_warning_addToWhiteListLink,
          }),
          sourceMessage: appLocale.intl.formatMessage({
            id: ETranslations.explore_malicious_dapp_warning_sourceMessage,
          }),
          fetchingDAppInfo: appLocale.intl.formatMessage({
            id: ETranslations.browser_fetching_dapp_info,
          }),
          dappListedBy: appLocale.intl.formatMessage({
            id: ETranslations.browser_dapp_listed_by,
          }),
          riskDetection: appLocale.intl.formatMessage({
            id: ETranslations.browser_risk_detection,
          }),
          maliciousDappWarningSourceMessage: appLocale.intl.formatMessage({
            id: ETranslations.explore_malicious_dapp_warning_sourceMessage,
          }),
          verifiedSite: appLocale.intl.formatMessage({
            id: ETranslations.dapp_connect_verified_site,
          }),
          unknown: appLocale.intl.formatMessage({
            id: ETranslations.browser_risk_detection_unknown,
          }),
        },
      };
    }
    throw new OneKeyLocalError('Invalid request');
  }

  /*
    window.$onekey.$private.request({
      method: 'wallet_isShowFloatingButton',
      params: { url: 'https://www.google.com' },
    });
  */
  @providerApiMethod()
  async wallet_isShowFloatingButton(request: IJsBridgeMessagePayload) {
    if (request.origin) {
      const isShow =
        await this.backgroundApi.serviceSetting.shouldDisplayFloatingButtonInUrl(
          { url: request.origin },
        );
      const securityInfo =
        await this.backgroundApi.serviceDiscovery.checkUrlSecurity({
          url: request.origin,
          from: 'script',
        });

      const inDapps = (securityInfo.dapp?.origins?.length || 0) > 0;
      const settings =
        await this.backgroundApi.simpleDb.floatingIconSettings.getSettings();
      return {
        isShow:
          securityInfo.level === EHostSecurityLevel.Unknown && !inDapps
            ? false
            : isShow,
        settings,
        i18n: {
          title: appLocale.intl.formatMessage({
            id: ETranslations.explore_malicious_dapp,
          }),
          description: appLocale.intl.formatMessage({
            id: ETranslations.explore_malicious_dapp_warning_description,
          }),
          continueMessage: appLocale.intl.formatMessage({
            id: ETranslations.explore_malicious_dapp_warning_continueMessage,
          }),
          continueLink: appLocale.intl.formatMessage({
            id: ETranslations.explore_malicious_dapp_warning_continueLink,
          }),
          addToWhiteListLink: appLocale.intl.formatMessage({
            id: ETranslations.explore_malicious_dapp_warning_addToWhiteListLink,
          }),
          sourceMessage: appLocale.intl.formatMessage({
            id: ETranslations.explore_malicious_dapp_warning_sourceMessage,
          }),
          fetchingDAppInfo: appLocale.intl.formatMessage({
            id: ETranslations.browser_fetching_dapp_info,
          }),
          dappListedBy: appLocale.intl.formatMessage({
            id: ETranslations.browser_dapp_listed_by,
          }),
          riskDetection: appLocale.intl.formatMessage({
            id: ETranslations.browser_risk_detection,
          }),
          maliciousDappWarningSourceMessage: appLocale.intl.formatMessage({
            id: ETranslations.explore_malicious_dapp_warning_sourceMessage,
          }),
          maliciousSiteWarning: appLocale.intl.formatMessage({
            id: ETranslations.dapp_connect_malicious_site_warning,
          }),
          suspectedMaliciousBehavior: appLocale.intl.formatMessage({
            id: ETranslations.dapp_connect_suspected_malicious_behavior,
          }),
          verifiedSite: appLocale.intl.formatMessage({
            id: ETranslations.dapp_connect_verified_site,
          }),
          unknown: appLocale.intl.formatMessage({
            id: ETranslations.browser_risk_detection_unknown,
          }),
          lastVerifiedAt: appLocale.intl.formatMessage({
            id: ETranslations.browser_last_verified_at,
          }),
          disable: appLocale.intl.formatMessage({
            id: ETranslations.browser_disable,
          }),
          hideOnThisSite: appLocale.intl.formatMessage({
            id: ETranslations.browser_hide_on_this_site,
          }),
          canBeReEnabledInSettings: appLocale.intl.formatMessage({
            id: ETranslations.browser_can_be_re_enabled_in_settings,
          }),
        },
      };
    }
    return {
      isShow: false,
      i18n: {},
    };
  }

  @providerApiMethod()
  async wallet_saveFloatingIconSettings(request: IJsBridgeMessagePayload) {
    console.log('ProviderApiPrivate.wallet_saveFloatingIconSettings', request);
    const { params } = request.data as {
      params?: Partial<IFloatingIconSettings>;
    };
    await this.backgroundApi.simpleDb.floatingIconSettings.setSettings(params);
  }

  /*
    window.$onekey.$private.request({
      method: 'wallet_disableFloatingButton',
    });
  */
  @providerApiMethod()
  async wallet_disableFloatingButton() {
    void this.backgroundApi.serviceSetting.setIsShowFloatingButton(false);
  }

  /*
    window.$onekey.$private.request({
      method: 'wallet_hideFloatingButtonOnSite',
      params: { url: 'https://www.google.com' },
    });
  */
  @providerApiMethod()
  async wallet_hideFloatingButtonOnSite(request: IJsBridgeMessagePayload) {
    if (request.origin) {
      void this.backgroundApi.serviceSetting.hideFloatingButtonOnSite({
        url: request.origin,
      });
    }
  }

  /*
    Only use for native and desktop browser
    window.$onekey.$private.request({
      method: 'wallet_closeCurrentBrowserTab',
    });
  */
  @providerApiMethod()
  async wallet_closeCurrentBrowserTab() {
    if (platformEnv.isExtension) {
      return;
    }
    console.log('wallet_closeCurrentBrowserTab');
    appEventBus.emit(EAppEventBusNames.CloseCurrentBrowserTab, undefined);
  }

  /*
    window.$onekey.$private.request({
      method: 'wallet_addBrowserUrlToRiskWhiteList',
    });
  */
  @providerApiMethod()
  async wallet_addBrowserUrlToRiskWhiteList(request: IJsBridgeMessagePayload) {
    console.log('ProviderApiPrivate.addBrowserUrlToRiskWhiteList', request);
    if (request.origin) {
      request.scope = request.scope || this.providerName;
      await this.backgroundApi.serviceDApp.openRiskWhiteListModal(request);
      await this.backgroundApi.serviceDiscovery.addBrowserUrlToRiskWhiteList(
        request.origin,
      );
      return;
    }
    throw new OneKeyLocalError('Invalid request');
  }

  @providerApiMethod()
  callChainWebEmbedMethod(payload: any) {
    const method: string = payload.data?.method;
    console.log('ProviderApiPrivate.callChainWebEmbedMethod', payload);
    const data = ({ origin }: { origin: string }) => {
      const result = {
        method,
        params: {
          event: payload.data?.event,
          promiseId: payload.data?.promiseId,
          params: { ...payload.data?.params },
        },
      };
      console.log(
        'ProviderApiPrivate.callChainWebEmbedMethod',
        method,
        origin,
        result,
      );
      return result;
    };
    payload.data?.send?.(data);
  }

  @providerApiMethod()
  chainWebEmbedResponse(payload: any) {
    console.log('ProviderApiPrivate.chainWebEmbedResponse', payload);
    void this.backgroundApi.servicePromise.resolveCallback({
      id: payload?.data?.promiseId,
      data: { ...payload?.data?.data },
    });
  }

  @providerApiMethod()
  async getSensitiveEncodeKey(): Promise<string> {
    defaultLogger.app.webembed.getSensitiveEncodeKey();
    return getBgSensitiveTextEncodeKey();
  }

  isWebEmbedApiReady = false;

  @providerApiMethod()
  async webEmbedApiReady(): Promise<void> {
    defaultLogger.app.webembed.webembedApiReady();
    this.isWebEmbedApiReady = true;
    appEventBus.emit(EAppEventBusNames.LoadWebEmbedWebViewComplete, undefined);
    return Promise.resolve();
  }

  @providerApiMethod()
  async webEmbedApiNotReady(): Promise<void> {
    defaultLogger.app.webembed.webembedApiNotReady();
    this.isWebEmbedApiReady = false;
    return Promise.resolve();
  }

  async callWebEmbedApiProxy(data: IBackgroundApiWebembedCallMessage) {
    if (!platformEnv.isNative) {
      throw new OneKeyLocalError('call webembed api only support native env');
    }
    const bg = this.backgroundApi as unknown as BackgroundApiBase;

    defaultLogger.app.webembed.callWebEmbedApiProxyEntry({
      module: data?.module || '',
      method: data?.method || '',
      isWebEmbedApiReady: !!this.isWebEmbedApiReady,
      hasWebEmbedBridge: !!bg?.webEmbedBridge,
    });

    await waitForDataLoaded({
      data: () => this.isWebEmbedApiReady && Boolean(bg?.webEmbedBridge),
      logName: `ProviderApiPrivate.callWebEmbedApiProxy: ${JSON.stringify({
        module: data?.module,
        method: data?.method,
        isWebEmbedApiReady: Boolean(this.isWebEmbedApiReady),
        webEmbedBridge: Boolean(bg?.webEmbedBridge),
      })}`,
      wait: 1000,
      timeout: timerUtils.getTimeDurationMs({ minute: 3 }),
    });

    if (!bg?.webEmbedBridge?.request) {
      throw new OneKeyLocalError('webembed webview bridge not ready.');
    }

    const webviewOrigin = bg?.webEmbedBridge?.remoteInfo?.origin || '';
    defaultLogger.app.webembed.callWebEmbedApiProxyBridgeReady({
      module: data?.module || '',
      method: data?.method || '',
      origin: webviewOrigin,
    });
    if (!isWebEmbedApiAllowedOrigin(webviewOrigin)) {
      throw new OneKeyLocalError(
        `callWebEmbedApiProxy not allowed origin: ${
          webviewOrigin || 'undefined'
        }`,
      );
    }

    const result = await bg?.webEmbedBridge?.request?.({
      scope: '$private',
      data,
    });
    return result;
  }

  @providerApiMethod()
  async wallet_lastFocusUrl(request: IJsBridgeMessagePayload) {
    if (request.origin) {
      if (this.lastFocusUrl !== request.origin) {
        this.lastFocusUrl = request.origin;
        appEventBus.emit(EAppEventBusNames.DAppLastFocusUrlUpdate, undefined);
      }
    }
  }

  @providerApiMethod()
  async getLastFocusUrl() {
    return Promise.resolve(this.lastFocusUrl);
  }

  @providerApiMethod()
  async wallet_keylessGetStatus(
    request: IJsBridgeMessagePayload,
    {
      provider,
      nonce,
    }: {
      provider?: EOAuthSocialLoginProvider;
      nonce?: string;
    } = {},
  ): Promise<IKeylessWebSessionState> {
    const sessionState = await this.getKeylessSessionState({
      request,
      provider,
      nonce,
    });

    if (
      request.origin &&
      nonce &&
      sessionState.siteConnected &&
      !this.keylessLoginDoneEventCache.has(`${request.origin}:${nonce}`)
    ) {
      this.addToKeylessLoginDoneEventCache(`${request.origin}:${nonce}`);
      void this.emitKeylessBridgeEventToOrigin({
        origin: request.origin,
        payload: {
          type: EKeylessWebBridgeEvent.LoginDone,
          nonce,
          provider,
          accountId: sessionState.connectedAccountId,
          timestamp: Date.now(),
        },
      });
    }

    return sessionState;
  }

  @providerApiMethod()
  async wallet_keylessOpenSidePanel(request: IJsBridgeMessagePayload) {
    if (!platformEnv.isExtension || !chrome.sidePanel?.open) {
      throw new OneKeyLocalError('keyless side panel only supports extension');
    }
    if (!request.origin) {
      throw new OneKeyLocalError('origin is required');
    }

    const tabs = await this.queryTabsByOrigin(request.origin);
    const targetTab = tabs.find((tab) => typeof tab.id === 'number');
    if (!targetTab || typeof targetTab.id !== 'number') {
      throw new OneKeyLocalError('active web tab not found');
    }

    const sidePanelPath = chrome.runtime.getURL('/ui-side-panel.html');
    await chrome.sidePanel.setOptions({
      tabId: targetTab.id,
      path: sidePanelPath,
      enabled: true,
    });
    if (targetTab.windowId) {
      await chrome.sidePanel.open({
        windowId: targetTab.windowId,
      });
    }

    return {
      success: true,
      tabId: targetTab.id,
      windowId: targetTab.windowId,
    };
  }

  @providerApiMethod()
  async wallet_keylessStartLogin(
    request: IJsBridgeMessagePayload,
    {
      provider,
      nonce,
    }: {
      provider?: EOAuthSocialLoginProvider;
      nonce?: string;
    } = {},
  ) {
    if (!provider || !nonce) {
      throw new OneKeyLocalError('provider and nonce are required');
    }
    await this.wallet_keylessOpenSidePanel(request);
    await timerUtils.wait(600);

    if (sidePanelState.isOpen) {
      appEventBus.emit(EAppEventBusNames.SidePanel_BgToUI, {
        type: 'pushModal',
        payload: {
          modalParams: {
            screen: EModalRoutes.OnboardingModal,
            params: {
              screen: EOnboardingPagesV2.OneKeyIDLogin,
              params: {
                mode: EOnboardingV2OneKeyIDLoginMode.KeylessCreateOrRestore,
                provider,
              },
            },
          },
        },
      });
    }

    return this.getKeylessSessionState({
      request,
      provider,
      nonce,
    });
  }

  @providerApiMethod()
  async wallet_keylessConfirmPin(
    request: IJsBridgeMessagePayload,
    {
      provider,
      nonce,
    }: {
      provider?: EOAuthSocialLoginProvider;
      nonce?: string;
    } = {},
  ) {
    return this.getKeylessSessionState({
      request,
      provider,
      nonce,
    });
  }

  @providerApiMethod()
  async wallet_keylessSelectAccount(
    request: IJsBridgeMessagePayload,
    {
      provider,
      nonce,
      accountId,
      accountAddress,
    }: {
      provider?: EOAuthSocialLoginProvider;
      nonce?: string;
      accountId?: string;
      accountAddress?: string;
    } = {},
  ) {
    if (!nonce) {
      throw new OneKeyLocalError('nonce is required');
    }
    if (request.origin) {
      this.addToKeylessLoginDoneEventCache(`${request.origin}:${nonce}`);
      await this.emitKeylessBridgeEventToOrigin({
        origin: request.origin,
        payload: {
          type: EKeylessWebBridgeEvent.LoginDone,
          nonce,
          provider,
          accountId,
          accountAddress,
          timestamp: Date.now(),
        },
      });
    }
    return this.getKeylessSessionState({
      request,
      provider,
      nonce,
    });
  }

  @providerApiMethod()
  async wallet_keylessDisconnectSite(
    request: IJsBridgeMessagePayload,
    {
      nonce,
      provider,
    }: {
      nonce?: string;
      provider?: EOAuthSocialLoginProvider;
    } = {},
  ) {
    if (request.origin) {
      await this.backgroundApi.serviceDApp.disconnectWebsite({
        origin: request.origin,
        storageType: 'injectedProvider',
        entry: 'ExtPanel',
      });
      if (nonce) {
        await this.emitKeylessBridgeEventToOrigin({
          origin: request.origin,
          payload: {
            type: EKeylessWebBridgeEvent.LoginFailed,
            nonce,
            provider,
            error: 'DISCONNECTED',
            timestamp: Date.now(),
          },
        });
      }
    }

    return {
      success: true,
    };
  }

  // $onekey.$private.request({method:'wallet_showToast', params: {method: 'success',title:'2333', message: 'test'}})
  @providerApiMethod()
  async wallet_showToast(request: IJsBridgeMessagePayload) {
    const params = (request.data as IJsonRpcRequest)
      ?.params as IEventBusPayloadShowToast;
    if (params) {
      params.toastId = generateUUID();
      return this.backgroundApi.serviceApp.showToast(params);
    }
  }

  // ----------------------------------------------
  // Rookie Guide API
  // ----------------------------------------------

  /*
    window.$onekey.$private.request({
      method: 'wallet_getRookieGuideInfo',
    });
  */
  @providerApiMethod()
  async wallet_getRookieGuideInfo(): Promise<IRookieGuideInfo> {
    return this.backgroundApi.serviceRookieGuide.getRookieGuideInfo();
  }

  /*
    window.$onekey.$private.request({
      method: 'wallet_resetRookieGuideProgress',
    });
  */
  @providerApiMethod()
  async wallet_resetRookieGuideProgress(): Promise<{ success: boolean }> {
    await this.backgroundApi.serviceRookieGuide.resetProgress();
    return { success: true };
  }

  /*
    window.$onekey.$private.request({
      method: 'wallet_showRookieShare',
      params: {
        data: {
          imageUrl: 'https://example.com/badge.png',
          title: 'How to deposit? Your first step on-chain',
          subtitle: 'Every step brings you closer to Web3',
          footerText: 'Open source and easy to use from day one.',
          referralCode: 'ABC123',
          referralUrl: 'https://web.onekey.so/learning?ref=ABC123',
        }
      }
    });
  */
  @providerApiMethod()
  async wallet_showRookieShare(
    request: IJsBridgeMessagePayload,
    params: { data: IRookieShareData },
  ): Promise<{ success: boolean }> {
    const data = params?.data;
    if (!data?.imageUrl || !data?.title) {
      throw new OneKeyLocalError(
        'Invalid share data: imageUrl and title are required',
      );
    }
    appEventBus.emit(EAppEventBusNames.ShowRookieShare, { data });
    return { success: true };
  }

  @providerApiMethod()
  async wallet_requestClipboardPermission(
    request: IJsBridgeMessagePayload,
    params: { type: 'read' | 'write'; text?: string } = {} as {
      type: 'read' | 'write';
    },
  ) {
    if (!params?.type || !['read', 'write'].includes(params.type)) {
      throw new OneKeyLocalError('Invalid clipboard permission request');
    }

    if (params.type === 'write' && params.text === undefined) {
      throw new OneKeyLocalError('Clipboard write requires text parameter');
    }

    // Sanitize request before passing to modal to prevent clipboard text
    // from being logged by ServiceDApp.openModal's dappOpenModal logger
    const sanitizedRequest = {
      ...request,
      scope: request.scope || this.providerName,
      data: request.data
        ? {
            ...(request.data as Record<string, unknown>),
            params: { type: params.type },
          }
        : request.data,
    };

    // Modal performs clipboard operations in the UI process (where
    // expo-clipboard is available), then resolves with the result.
    // This avoids importing expo-clipboard in kit-bg, which runs in
    // a service worker on extensions and has no clipboard API access.
    const modalResult =
      await this.backgroundApi.serviceDApp.openClipboardPermissionModal(
        sanitizedRequest as IJsBridgeMessagePayload,
        params.type,
        params.text,
      );

    return modalResult;
  }
}

export default ProviderApiPrivate;
