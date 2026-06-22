import appGlobals from '@onekeyhq/shared/src/appGlobals';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import { registerImageEmbedBridge } from '@onekeyhq/shared/src/utils/imageUtils.embedBridge';

import { RemoteApiProxyBase } from '../../apis/RemoteApiProxyBase';

import type { IWebembedApi, IWebembedApiKeys } from './IWebembedApi';
import type { IBackgroundApiWebembedCallMessage } from '../../apis/IBackgroundApi';
import type WebEmbedApiChainAdaLegacy from '../WebEmbedApiChainAdaLegacy';
import type WebEmbedApiChainKaspa from '../WebEmbedApiChainKaspa';
import type WebEmbedApiImageUtils from '../WebEmbedApiImageUtils';
import type WebEmbedApiSecret from '../WebEmbedApiSecret';
import type WebEmbedApiTest from '../WebEmbedApiTest';

const WEB_EMBED_API_READY_TIMEOUT_MS = 40 * 1000;

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
    defaultLogger.app.webembed.webEmbedWaitRemoteApiReady({ isReady: !!ready });
    if (!ready) {
      return new Promise((resolve, reject) => {
        const timerId = setTimeout(() => {
          defaultLogger.app.webembed.initTimeout();
          globalThis.$onekeyAppWebembedApiWebviewInitFailed = true;
          reject(new Error('WebEmbedApi not ready after 40s.'));
        }, WEB_EMBED_API_READY_TIMEOUT_MS);
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

    let result: any;
    // In dual-thread mode, the background thread doesn't have the JsBridge
    // object. Route the call to the main thread via reverse RPC.
    const callViaMainThread = (globalThis as any)
      .__onekeyCallWebEmbedBridgeViaMainThread as
      | ((data: unknown) => Promise<unknown>)
      | undefined;
    if (callViaMainThread) {
      result = await callViaMainThread(message);
    } else {
      // Single-thread: existing flow through background serviceDApp
      result = await checkIsDefined(
        appGlobals?.$backgroundApiProxy,
      ).serviceDApp.callWebEmbedApiProxy(message);
    }

    if (
      module === 'secret' &&
      ['batchGetPublicKeys', 'encryptAsync', 'decryptAsync'].includes(method) &&
      result === undefined
    ) {
      defaultLogger.app.webembed.webembedApiCallResultIsUndefined({
        module,
        method,
      });
    }

    return result;
  }

  async isSDKReady(): Promise<boolean> {
    const bgApiProxy = appGlobals?.$backgroundApiProxy;
    const serviceDApp = bgApiProxy?.serviceDApp;
    const isWebEmbedApiReady = await serviceDApp?.isWebEmbedApiReady();
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

// Typed slot for shared/imageUtils. Routes via the same callRemoteApi path,
// so single-thread (web/desktop/ext) and BG-thread (dual-thread native) both
// pick up this registration. Main thread native registers a direct adapter
// in setupMainThreadBackgroundRunner.
registerImageEmbedBridge({
  convertToBlackAndWhiteImageBase64: (img, mime) =>
    webembedApiProxy.imageUtils.convertToBlackAndWhiteImageBase64(img, mime),
  applyRoundedCorners: (params) =>
    webembedApiProxy.imageUtils.applyRoundedCorners(params),
  base64ImageToBitmap: (params) =>
    webembedApiProxy.imageUtils.base64ImageToBitmap(params),
  processImageBlur: (params) =>
    webembedApiProxy.imageUtils.processImageBlur(params),
});
