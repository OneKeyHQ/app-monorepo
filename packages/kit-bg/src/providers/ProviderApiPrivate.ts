/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable camelcase */
import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';

import walletConnectUtils from '@onekeyhq/kit/src/components/WalletConnect/utils/walletConnectUtils';
import extUtils from '@onekeyhq/kit/src/utils/extUtils';
import { timeout } from '@onekeyhq/kit/src/utils/helper';
import { scanFromURLAsync } from '@onekeyhq/kit/src/views/ScanQrcode/scanFromURLAsync';
import {
  backgroundClass,
  providerApiMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import debugLogger, {
  getDebugLoggerSettings,
} from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import ProviderApiBase from './ProviderApiBase';

import type { IProviderBaseBackgroundNotifyInfo } from './ProviderApiBase';
import type ProviderApiEthereum from './ProviderApiEthereum';
import type {
  IJsBridgeMessagePayload,
  IJsonRpcRequest,
} from '@onekeyfe/cross-inpage-provider-types';
import type {
  IWebViewWrapperRef,
  JsBridgeDesktopHost,
} from '@onekeyfe/onekey-cross-webview';

@backgroundClass()
class ProviderApiPrivate extends ProviderApiBase {
  public providerName = IInjectedProviderNames.$private;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  notifyDappAccountsChanged(info: IProviderBaseBackgroundNotifyInfo): void {
    // noop
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  notifyDappChainChanged(info: IProviderBaseBackgroundNotifyInfo): void {
    // noop
  }

  public notifyExtSwitchChanged(info: IProviderBaseBackgroundNotifyInfo) {
    const params = this.getWalletInfo();
    info.send({ method: 'wallet_events_ext_switch_changed', params });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public rpcCall(request: IJsonRpcRequest): any {
    // noop
  }

  // ----------------------------------------------
  @providerApiMethod()
  async wallet_scanQrcode(
    request: IJsonRpcRequest,
    { base64 }: { base64: string },
  ): Promise<{ result: string; base64?: string; error?: string }> {
    try {
      const result = await timeout(
        scanFromURLAsync(base64),
        3000,
        'wallet_scanQrcode timeout',
      );
      return { result: result || '', base64 };
    } catch (error) {
      console.error(error);
      return { result: '', base64, error: (error as Error)?.message };
    }
  }

  @providerApiMethod()
  async wallet_connectToWalletConnect(
    request: IJsonRpcRequest,
    { uri }: { uri: string },
  ): Promise<any> {
    if (uri) {
      if (platformEnv.isExtension) {
        // extension can not show Modal UI directly from background
        this.backgroundApi.walletConnect.connect({ uri });
      } else {
        walletConnectUtils.openConnectToDappModal({ uri });
      }
    }
    return Promise.resolve(`uri=${uri}`);
  }

  /*
    window.$onekey.$private.request({
      method: 'wallet_openUrl',
      params: { url: 'https://www.baidu.com' },
    });
  */
  @providerApiMethod()
  wallet_openUrl(request: IJsonRpcRequest, { url }: { url: string }) {
    console.log('wallet_openUrl', request, url);

    if (platformEnv.isExtension) {
      extUtils.openUrlInTab(url);
    }
    if (platformEnv.isDesktop || platformEnv.isNative) {
      const bridge = this.backgroundApi.bridge as JsBridgeDesktopHost;
      const webview = bridge.webviewWrapper as IWebViewWrapperRef;
      webview.loadURL(url);
    }
    if (platformEnv.isWeb) {
      extUtils.openUrl(url);
    }
  }

  // $onekey.$private.request({method:'wallet_sendSiteMetadata'})
  @providerApiMethod()
  wallet_sendSiteMetadata() {
    // TODO save to DB
    return { success: 'wallet_sendSiteMetadata: save to DB' };
  }

  getWalletInfo() {
    const disableExt = !!this.backgroundApi.appSelector(
      (s) => s.settings.disableExt,
    );
    const walletSwitchData = this.backgroundApi.appSelector(
      (s) => s.settings.walletSwitchData,
    );
    const walletSwitchConfig: Record<string, string[]> = {
      enable: [],
      disable: [],
    };
    if (walletSwitchData && Object.values(walletSwitchData).length) {
      Object.values(walletSwitchData).forEach((item) => {
        if (item.enable) {
          walletSwitchConfig.enable = [
            ...walletSwitchConfig.enable,
            ...item.propertyKeys,
          ];
        } else {
          walletSwitchConfig.disable = [
            ...walletSwitchConfig.disable,
            ...item.propertyKeys,
          ];
        }
      });
    }
    return {
      platform: process.env.ONEKEY_PLATFORM,
      version: process.env.VERSION,
      buildNumber: process.env.BUILD_NUMBER,
      disableExt,
      walletSwitchConfig,
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
    req: IJsBridgeMessagePayload,
    { time = 0 }: { time?: number } = {},
  ) {
    // const manifest = chrome.runtime.getManifest();
    // pass debugLoggerSettings to dapp injected provider
    const debugLoggerSettings: string = (await getDebugLoggerSettings()) || '';
    const ethereum = this.backgroundApi.providers
      .ethereum as ProviderApiEthereum;
    const providerState = await ethereum.metamask_getProviderState(req);
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
      walletInfo: this.getWalletInfo(),
      providerState,
    };
  }

  @providerApiMethod()
  callChainWebEmbedMethod(payload: any) {
    const method: string = payload.data?.method;
    debugLogger.providerApi.info(
      'ProviderApiPrivate.callChainWebEmbedMethod',
      payload,
    );
    const data = ({ origin }: { origin: string }) => {
      const result = {
        method,
        params: {
          event: payload.data?.event,
          promiseId: payload.data?.promiseId,
          params: { ...payload.data?.params },
        },
      };
      debugLogger.providerApi.info(
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
    debugLogger.providerApi.info(
      'ProviderApiPrivate.chainWebEmbedResponse',
      payload,
    );
    this.backgroundApi.servicePromise.resolveCallback({
      id: payload?.data?.promiseId,
      data: { ...(payload?.data?.data ?? {}) },
    });
  }
}

export default ProviderApiPrivate;
