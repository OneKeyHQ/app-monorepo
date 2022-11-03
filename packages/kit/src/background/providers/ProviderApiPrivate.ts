/* eslint-disable camelcase */
import {
  IInjectedProviderNames,
  IJsBridgeMessagePayload,
  IJsonRpcRequest,
} from '@onekeyfe/cross-inpage-provider-types';
import {
  IWebViewWrapperRef,
  JsBridgeDesktopHost,
} from '@onekeyfe/onekey-cross-webview';

import { getDebugLoggerSettings } from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import walletConnectUtils from '../../components/WalletConnect/utils/walletConnectUtils';
import extUtils from '../../utils/extUtils';
import { timeout } from '../../utils/helper';
import { scanFromURLAsync } from '../../views/ScanQrcode/scanFromURLAsync';
import { backgroundClass, providerApiMethod } from '../decorators';

import ProviderApiBase, {
  IProviderBaseBackgroundNotifyInfo,
} from './ProviderApiBase';

import type ProviderApiEthereum from './ProviderApiEthereum';

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
      walletInfo: {
        platform: process.env.ONEKEY_PLATFORM,
        version: process.env.VERSION,
        buildNumber: process.env.BUILD_NUMBER,
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
      },
      providerState,
    };
  }
}

export default ProviderApiPrivate;
