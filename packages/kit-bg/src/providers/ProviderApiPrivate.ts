/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable camelcase */
import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';

import { getBgSensitiveTextEncodeKey } from '@onekeyhq/core/src/secret';
import {
  backgroundClass,
  providerApiMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IEventBusPayloadShowToast } from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import { waitForDataLoaded } from '@onekeyhq/shared/src/utils/promiseUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EHostSecurityLevel } from '@onekeyhq/shared/types/discovery';

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
      data: { ...(payload?.data?.data ?? {}) },
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
    this.isWebEmbedApiReady = false;
    return Promise.resolve();
  }

  async callWebEmbedApiProxy(data: IBackgroundApiWebembedCallMessage) {
    if (!platformEnv.isNative) {
      throw new OneKeyLocalError('call webembed api only support native env');
    }
    const bg = this.backgroundApi as unknown as BackgroundApiBase;

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

    const webviewOrigin = `${bg?.webEmbedBridge?.remoteInfo?.origin || ''}`;
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
}

export default ProviderApiPrivate;
