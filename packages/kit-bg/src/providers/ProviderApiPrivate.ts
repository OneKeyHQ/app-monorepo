/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable camelcase */
import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';

import {
  backgroundClass,
  providerApiMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import ProviderApiBase from './ProviderApiBase';

import type { IProviderBaseBackgroundNotifyInfo } from './ProviderApiBase';
import type ProviderApiEthereum from './ProviderApiEthereum';
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public rpcCall(request: IJsonRpcRequest): any {
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
        await this.backgroundApi.serviceDiscovery.checkUrlSecurity(
          request.origin,
        );
      return {
        securityInfo,
        isExtension: !!platformEnv.isExtension,
        i18n: {
          title: 'Malicious Dapp',
          listTitle: 'Potential risks:',
          listContent: [
            'Theft of recovery phrase or password',
            'Phishing attacks',
            'Fake tokens or scams',
          ],
          continueMessage:
            'If you understand the risks and want to proceed, you can',
          continueLink: 'continue to the site',
          closeButton: 'Close Tab',
          sourceMessage: 'Connection blocked by',
        },
      };
    }
    throw new Error('Invalid request');
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
}

export default ProviderApiPrivate;
