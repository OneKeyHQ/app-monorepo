import { JsBridgeBase } from '@onekeyfe/cross-inpage-provider-core';
import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';

type IWebEmbedPrivateProvider = {
  request?: (data: unknown) => Promise<unknown>;
  webembedReceiveHandler?: (
    payload: IJsBridgeMessagePayload,
    bridge: JsBridgeBase,
  ) => Promise<unknown> | unknown;
};

type IWebEmbedGlobal = typeof globalThis & {
  ReactNativeWebView?: {
    postMessage: (message: string) => void;
  };
  $onekey?: {
    jsBridge?: JsBridgeBase;
    $private?: IWebEmbedPrivateProvider;
  };
};

class WebEmbedNativeJsBridge extends JsBridgeBase {
  protected override sendAsString = true;

  protected override isInjected = true;

  protected override callbacksExpireTimeout = 0;

  override sendPayload(payload: IJsBridgeMessagePayload | string): void {
    const message =
      typeof payload === 'string' ? payload : JSON.stringify(payload);
    const postMessage: ((messageToNative: string) => void) | undefined =
      getWebEmbedGlobal().ReactNativeWebView?.postMessage;
    if (!postMessage) {
      throw new OneKeyLocalError(
        'ReactNativeWebView.postMessage is not available',
      );
    }
    postMessage(message);
  }
}

function getWebEmbedGlobal() {
  return globalThis as IWebEmbedGlobal;
}

function unwrapRpcResult(response: unknown) {
  if (
    response &&
    typeof response === 'object' &&
    Object.prototype.hasOwnProperty.call(response, 'result')
  ) {
    return (response as { result: unknown }).result;
  }
  return response;
}

export function setupNativeWebEmbedBridge() {
  const webEmbedGlobal = getWebEmbedGlobal();
  if (webEmbedGlobal.$onekey?.jsBridge) {
    return;
  }

  const bridge = new WebEmbedNativeJsBridge({
    receiveHandler: (payload) => {
      const handler =
        getWebEmbedGlobal().$onekey?.$private?.webembedReceiveHandler;
      if (!handler) {
        throw new OneKeyLocalError('webembedReceiveHandler is not ready');
      }
      return handler(payload, bridge);
    },
  });

  webEmbedGlobal.$onekey = webEmbedGlobal.$onekey || {};
  webEmbedGlobal.$onekey.jsBridge = bridge;
  webEmbedGlobal.$onekey.$private = webEmbedGlobal.$onekey.$private || {};
  webEmbedGlobal.$onekey.$private.request = async (data) => {
    const response = await bridge.request({
      scope: IInjectedProviderNames.$private,
      data,
    });
    return unwrapRpcResult(response);
  };
}
