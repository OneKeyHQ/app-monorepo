/* eslint-disable camelcase */
import JsBridgeDesktopHost from '@onekeyhq/inpage-provider/src/jsBridge/JsBridgeDesktopHost';
import {
  IInjectedProviderNames,
  IJsonRpcRequest,
} from '@onekeyhq/inpage-provider/src/types';
import { IWebViewWrapperRef } from '@onekeyhq/inpage-provider/src/webview/useWebViewBridge';
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

  notifyDappAccountsChanged(info: IProviderBaseBackgroundNotifyInfo): void {
    console.log('ProviderApiPrivate-notifyDappAccountsChanged', info);
  }

  notifyDappChainChanged(info: IProviderBaseBackgroundNotifyInfo): void {
    console.log('ProviderApiPrivate-notifyDappChainChanged', info);
  }

  protected rpcCall(request: IJsonRpcRequest): any {
    console.log('ProviderApiPrivate-rpcCall', request);
  }
}

export default ProviderApiPrivate;
