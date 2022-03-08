/* eslint-disable camelcase */
import {
  IInjectedProviderNames,
  IJsonRpcRequest,
} from '@onekeyfe/cross-inpage-provider-types';
import {
  IWebViewWrapperRef,
  JsBridgeDesktopHost,
} from '@onekeyfe/onekey-cross-webview';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import extUtils from '../utils/extUtils';

import ProviderApiBase, {
  IProviderBaseBackgroundNotifyInfo,
} from './ProviderApiBase';

class ProviderApiPrivate extends ProviderApiBase {
  public providerName = IInjectedProviderNames.$private;

  /*
    window.$onekey.$private.request({
      method: 'wallet_openUrl',
      params: { url: 'https://www.baidu.com' },
    });
  */
  wallet_openUrl(request: IJsonRpcRequest, { url }: { url: string }) {
    console.log('wallet_openUrl', request, url);

    if (platformEnv.isExtension) {
      extUtils.openUrlInTab(url);
    }
    if (platformEnv.isDesktop || platformEnv.isNative) {
      const bridge = this.bridge as JsBridgeDesktopHost;
      const webview = bridge.webviewWrapper as IWebViewWrapperRef;
      webview.loadURL(url);
    }
    if (platformEnv.isWeb) {
      extUtils.openUrl(url);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  notifyDappAccountsChanged(info: IProviderBaseBackgroundNotifyInfo): void {
    // noop
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  notifyDappChainChanged(info: IProviderBaseBackgroundNotifyInfo): void {
    // noop
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected rpcCall(request: IJsonRpcRequest): any {
    // noop
  }
}

export default ProviderApiPrivate;
