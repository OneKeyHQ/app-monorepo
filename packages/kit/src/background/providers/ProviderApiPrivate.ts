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

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import extUtils from '../../utils/extUtils';
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
    const debugLoggerSettings = '';
    const ethereum = this.backgroundApi.providers
      .ethereum as ProviderApiEthereum;
    return {
      pong: true,
      time: Date.now(),
      delay: Date.now() - time,
      debugLoggerConfig: {
        // TODO change in dapp localStorage
        config: debugLoggerSettings,
        enabledKeys: [
          // 'jsBridge', 'extInjected', 'providerBase'
        ],
      },
      walletInfo: {
        platform: process.env.ONEKEY_PLATFORM,
        version: process.env.VERSION,
        buildNumber: process.env.BUILD_NUMBER,
        isLegacy: false,
      },
      providerState: await ethereum.metamask_getProviderState(req),
    };
  }
}

export default ProviderApiPrivate;
