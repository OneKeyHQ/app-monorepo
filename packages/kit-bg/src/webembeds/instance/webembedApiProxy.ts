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

  private pendingReady: Promise<void> | undefined;

  private readyRequestSequence = 0;

  override checkEnvAvailable(): void {
    if (!platformEnv.isNative) {
      throw new OneKeyLocalError(
        'WebembedApiProxy should only be used in iOS/Android Native env.',
      );
    }
    if (
      !platformEnv.isJest &&
      platformEnv.enableNativeBackgroundThread &&
      platformEnv.isNativeMainThread
    ) {
      throw new OneKeyLocalError(
        'WebembedApiProxy must be used from the background JS runtime in native dual-runtime builds. Route this call through backgroundApiProxy instead of calling webembed APIs from the UI/main runtime.',
      );
    }
  }

  override async waitRemoteApiReady(): Promise<void> {
    if (this.pendingReady) {
      return this.pendingReady;
    }

    let resolvePending: () => void = () => {};
    let rejectPending: (error: unknown) => void = () => {};
    const pending = new Promise<void>((resolve, reject) => {
      resolvePending = resolve;
      rejectPending = reject;
    });
    this.pendingReady = pending;

    this.readyRequestSequence += 1;
    const requestId = `${appEventBus.nodeId}-${this.readyRequestSequence}`;
    let settled = false;
    let hasEmittedLoad = false;
    let timerId: ReturnType<typeof setTimeout> | undefined;

    const cleanup = () => {
      if (timerId) {
        clearTimeout(timerId);
      }
      appEventBus.off(
        EAppEventBusNames.LoadWebEmbedWebViewComplete,
        // eslint-disable-next-line no-use-before-define
        onComplete,
      );
      appEventBus.off(
        EAppEventBusNames.WebEmbedWebViewProviderReady,
        // eslint-disable-next-line no-use-before-define
        onProviderReady,
      );
      if (this.pendingReady === pending) {
        this.pendingReady = undefined;
      }
    };
    const complete = () => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      globalThis.$onekeyAppWebembedApiWebviewInitFailed = false;
      resolvePending();
    };
    const fail = (error: unknown) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      rejectPending(error);
    };
    const emitLoad = () => {
      if (settled) {
        return;
      }
      hasEmittedLoad = true;
      appEventBus.emit(EAppEventBusNames.LoadWebEmbedWebView, { requestId });
      defaultLogger.app.webembed.emitRenderEvent();
    };
    const onComplete = () => {
      defaultLogger.app.webembed.loadWebEmbedWebViewComplete();
      complete();
    };
    const onProviderReady = () => {
      if (hasEmittedLoad) {
        emitLoad();
      }
    };

    appEventBus.on(EAppEventBusNames.LoadWebEmbedWebViewComplete, onComplete);
    appEventBus.on(
      EAppEventBusNames.WebEmbedWebViewProviderReady,
      onProviderReady,
    );
    void this.isSDKReady()
      .then((ready) => {
        if (settled) {
          return;
        }
        defaultLogger.app.webembed.webEmbedWaitRemoteApiReady({
          isReady: !!ready,
        });
        if (ready) {
          complete();
          return;
        }
        timerId = setTimeout(() => {
          defaultLogger.app.webembed.initTimeout();
          globalThis.$onekeyAppWebembedApiWebviewInitFailed = true;
          fail(new Error('WebEmbedApi not ready after 40s.'));
        }, WEB_EMBED_API_READY_TIMEOUT_MS);
        emitLoad();
      })
      .catch(fail);
    return pending;
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

// A page may become ready after a timed-out attempt; restore the fallback flag
// without retaining that attempt's completion and provider-ready listeners.
appEventBus.on(EAppEventBusNames.LoadWebEmbedWebViewComplete, () => {
  globalThis.$onekeyAppWebembedApiWebviewInitFailed = false;
});

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
