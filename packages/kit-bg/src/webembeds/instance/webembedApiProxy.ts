import appGlobals from '@onekeyhq/shared/src/appGlobals';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';

import { RemoteApiProxyBase } from '../../apis/RemoteApiProxyBase';

import type { IWebembedApi, IWebembedApiKeys } from './IWebembedApi';
import type { IBackgroundApiWebembedCallMessage } from '../../apis/IBackgroundApi';
import type WebEmbedApiChainAdaLegacy from '../WebEmbedApiChainAdaLegacy';
import type WebEmbedApiChainKaspa from '../WebEmbedApiChainKaspa';
import type WebEmbedApiImageUtils from '../WebEmbedApiImageUtils';
import type WebEmbedApiSecret from '../WebEmbedApiSecret';
import type WebEmbedApiTest from '../WebEmbedApiTest';

class WebembedApiProxy extends RemoteApiProxyBase implements IWebembedApi {
  // backgroundApiProxy = appGlobals.$backgroundApiProxy;
  // backgroundApiProxy = backgroundApiProxy;

  override checkEnvAvailable(): void {
    if (!platformEnv.isNative) {
      throw new OneKeyLocalError(
        'WebembedApiProxy should only be used in iOS/Android Native env.',
      );
    }
  }

  override async waitRemoteApiReady(): Promise<void> {
    const ready = await this.isSDKReady();
    if (!ready) {
      return new Promise((resolve, reject) => {
        const timerId = setTimeout(() => {
          defaultLogger.app.webembed.initTimeout();
          globalThis.$onekeyAppWebembedApiWebviewInitFailed = true;
          reject(new Error('WebEmbedApi not ready after 30s.'));
        }, 30 * 1000);
        appEventBus.once(EAppEventBusNames.LoadWebEmbedWebViewComplete, () => {
          defaultLogger.app.webembed.loadWebEmbedWebViewComplete();
          clearTimeout(timerId);
          globalThis.$onekeyAppWebembedApiWebviewInitFailed = false;
          resolve();
        });

        // use event emit to trigger the webview to render
        appEventBus.emit(EAppEventBusNames.LoadWebEmbedWebView, undefined);
        defaultLogger.app.webembed.emitRenderEvent();
      });
    }
  }

  protected override async callRemoteApi(options: {
    module: IWebembedApiKeys;
    method: string;
    params: any[];
  }): Promise<any> {
    const { module, method, params } = options;
    const message: IBackgroundApiWebembedCallMessage = {
      module: module as any,
      method,
      params,
    };

    // await timerUtils.wait(5*1000);

    return checkIsDefined(
      appGlobals?.$backgroundApiProxy,
    ).serviceDApp.callWebEmbedApiProxy(message);
  }

  async isSDKReady(): Promise<boolean> {
    const isWebEmbedApiReady = await checkIsDefined(
      appGlobals?.$backgroundApiProxy,
    ).serviceDApp.isWebEmbedApiReady();
    return Promise.resolve(!!isWebEmbedApiReady);
  }

  test: WebEmbedApiTest = this._createProxyModule<IWebembedApiKeys>('test');

  chainAdaLegacy: WebEmbedApiChainAdaLegacy =
    this._createProxyModule<IWebembedApiKeys>('chainAdaLegacy', undefined, {
      asyncThenSupport: true,
    });

  chainKaspa: WebEmbedApiChainKaspa = this._createProxyModule<IWebembedApiKeys>(
    'chainKaspa',
    undefined,
    {
      asyncThenSupport: true,
    },
  );

  secret: WebEmbedApiSecret =
    this._createProxyModule<IWebembedApiKeys>('secret');

  imageUtils: WebEmbedApiImageUtils =
    this._createProxyModule<IWebembedApiKeys>('imageUtils');
}

const webembedApiProxy = new WebembedApiProxy();
export default webembedApiProxy;
appGlobals.$webembedApiProxy = webembedApiProxy;
