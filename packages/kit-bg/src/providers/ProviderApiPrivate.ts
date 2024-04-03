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
import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';

export interface IOneKeyWalletInfo {
  enableExtContentScriptReloadButton?: boolean;
  platform?: string;
  version?: string;
  buildNumber?: string;
  disableExt: boolean;
  walletSwitchConfig: Record<string, string[]>;
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public rpcCall(request: IJsBridgeMessagePayload): any {
    // noop
  }

  // ----------------------------------------------
  getWalletInfo(): IOneKeyWalletInfo {
    // TODO: get config from global jotai
    // const disableExt = !!this.backgroundApi.appSelector(
    //   (s) => s.settings.disableExt,
    // );
    // const walletSwitchData = this.backgroundApi.appSelector(
    //   (s) => s.settings.walletSwitchData,
    // );
    // const showContentScriptReloadButton = this.backgroundApi.appSelector(
    //   (s) => s.settings?.devMode?.showContentScriptReloadButton,
    // );

    const disableExt = false;
    const walletSwitchConfig: Record<string, string[]> = {
      enable: [],
      disable: [],
    };
    // if (walletSwitchData && Object.values(walletSwitchData).length) {
    //   Object.values(walletSwitchData).forEach((item) => {
    //     if (item.enable) {
    //       walletSwitchConfig.enable = [
    //         ...walletSwitchConfig.enable,
    //         ...item.propertyKeys,
    //       ];
    //     } else {
    //       walletSwitchConfig.disable = [
    //         ...walletSwitchConfig.disable,
    //         ...item.propertyKeys,
    //       ];
    //     }
    //   });
    // }
    return {
      enableExtContentScriptReloadButton: false,
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
