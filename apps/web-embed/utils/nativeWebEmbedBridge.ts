import { JsBridgeBase } from '@onekeyfe/cross-inpage-provider-core';
import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';

import { EWebEmbedPrivateRequestMethod } from '@onekeyhq/shared/src/consts/webEmbedConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';

const WEB_EMBED_PRIVATE_REQUEST_METHODS = new Set<string>([
  'getSensitiveEncodeKey',
  'webEmbedApiReady',
  EWebEmbedPrivateRequestMethod.closeWebViewModal,
  EWebEmbedPrivateRequestMethod.showToast,
  EWebEmbedPrivateRequestMethod.showDebugMessageDialog,
]);

type IWebEmbedPrivateProviderFacade = {
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
    $private?: IWebEmbedPrivateProviderFacade;
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

function ensureSupportedPrivateRequest(data: unknown) {
  if (!data || typeof data !== 'object') {
    throw new OneKeyLocalError('Invalid WebEmbed private request');
  }

  const method = (data as { method?: unknown }).method;
  if (
    typeof method !== 'string' ||
    !WEB_EMBED_PRIVATE_REQUEST_METHODS.has(method)
  ) {
    throw new OneKeyLocalError(
      `Unsupported WebEmbed private request: ${String(method)}`,
    );
  }
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
  // This is a WebEmbed-only facade, not the full upstream injected $private provider.
  webEmbedGlobal.$onekey.$private = webEmbedGlobal.$onekey.$private || {};
  webEmbedGlobal.$onekey.$private.request = async (data) => {
    ensureSupportedPrivateRequest(data);
    const response = await bridge.request({
      scope: IInjectedProviderNames.$private,
      data,
    });
    return unwrapRpcResult(response);
  };
}
