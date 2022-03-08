import { JsBridgeBase } from '@onekeyfe/cross-inpage-provider-core';
import {
  IInjectedProviderNames,
  IInjectedProviderNamesStrings,
  IJsBridgeMessagePayload,
  IJsBridgeReceiveHandler,
  IJsonRpcRequest,
  IJsonRpcResponse,
} from '@onekeyfe/cross-inpage-provider-types';
import { JsBridgeExtBackground } from '@onekeyfe/extension-bridge-hosted';
import { isFunction } from 'lodash';

import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { INTERNAL_METHOD_PREFIX } from './decorators';
import { IBackgroundApiBridge } from './IBackgroundApi';
import PromiseContainer from './PromiseContainer';
import ProviderApiBase from './ProviderApiBase';
import ProviderApiEthereum from './ProviderApiEthereum';
import ProviderApiPrivate from './ProviderApiPrivate';

function throwMethodNotFound(method: string) {
  throw new Error(`dapp provider method not support (method=${method})`);
}

function isPrivateAllowedOrigin(origin?: string) {
  return (
    origin &&
    (origin?.endsWith('.onekey.so') || ['https://onekey.so'].includes(origin))
  );
}

function isExtensionInternalCall(payload: IJsBridgeMessagePayload) {
  const { internal, origin } = payload;
  const request = payload.data as IJsonRpcRequest;

  const extensionUrl = chrome.runtime.getURL('');

  return (
    platformEnv.isExtension &&
    origin &&
    internal &&
    request?.method?.startsWith(INTERNAL_METHOD_PREFIX) &&
    extensionUrl.startsWith(origin)
  );
}
class BackgroundApiBase implements IBackgroundApiBridge {
  promiseContainer: PromiseContainer = new PromiseContainer();

  bridge: JsBridgeBase | null = null;

  bridgeExtBg: JsBridgeExtBackground | null = null;

  providers: Record<string, ProviderApiBase> = {
    [IInjectedProviderNames.$private]: new ProviderApiPrivate({
      backgroundApi: this,
    }),
    [IInjectedProviderNames.ethereum]: new ProviderApiEthereum({
      backgroundApi: this,
    }),
    // near
    // conflux
    // solana
    // sollet
  };

  connectBridge(bridge: JsBridgeBase) {
    if (platformEnv.isExtension) {
      this.bridgeExtBg = bridge as JsBridgeExtBackground;
    }
    this.bridge = bridge;
  }

  protected rpcResult(result: any) {
    return {
      id: undefined,
      jsonrpc: '2.0',
      result,
    };
  }

  async handleProviderMethods(payload: IJsBridgeMessagePayload) {
    const { scope, origin } = payload;
    const provider: ProviderApiBase | null = this.providers[scope as string];
    if (!provider) {
      throw new Error(
        `[${scope as string}] ProviderApi instance is not found.`,
      );
    }
    if (
      scope === IInjectedProviderNames.$private &&
      !isPrivateAllowedOrigin(origin)
    ) {
      throw new Error(
        `${origin as string} is not allowed to call $private methods.`,
      );
    }
    // throw web3Errors.provider.custom({
    //   code: 3881,
    //   message: 'test custom error to dapp',
    // });
    const result = (await provider.handleMethods(
      payload,
    )) as IJsonRpcResponse<any>;
    return this.rpcResult(result);
  }

  async _bridgeReceiveHandler(payload: IJsBridgeMessagePayload): Promise<any> {
    const { scope, origin, internal } = payload;
    const request = (payload.data ?? {}) as IJsonRpcRequest;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { method, params } = request;

    debugLogger.backgroundApi('bridgeReceiveHandler', scope, request, payload);

    if (!origin) {
      throw new Error('BackgroundApi [payload.origin] is required.');
    }

    if (!internal && !scope) {
      throw new Error(
        'BackgroundApi [payload.scope] is required for non-internal method call.',
      );
    }

    if (scope) {
      return this.handleProviderMethods(payload);
    }

    // call background global methods (backgroundDappTest.ts)
    //    Only Extension and internal call allowed
    if (isExtensionInternalCall(payload)) {
      return this.handleInternalMethods(payload);
    }

    if (isPrivateAllowedOrigin(origin)) {
      return this.handleSelfOriginMethods(payload);
    }

    throwMethodNotFound(method);
  }

  bridgeReceiveHandler: IJsBridgeReceiveHandler = async (
    payload: IJsBridgeMessagePayload,
  ): Promise<any> => {
    const res = await this._bridgeReceiveHandler(payload);
    debugLogger.backgroundApi(
      'bridgeReceiveHandler->response',
      payload.scope,
      '\n',
      payload,
      '\n',
      payload.data,
      '\n -----> ',
      res,
    );
    return res;
  };

  handleSelfOriginMethods(payload: IJsBridgeMessagePayload) {
    // TODO open webview url
    console.log(payload);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async handleInternalMethods(payload: IJsBridgeMessagePayload): Promise<any> {
    const { method, params } = (payload.data ?? {}) as IJsonRpcRequest;
    const paramsArr = [].concat(params as any);

    /* eslint-disable  */
    // @ts-ignore
    const methodFunc = this[method];
    if (methodFunc) {
      // @ts-ignore
      return methodFunc.call(this, ...paramsArr);
    }
    /* eslint-enable  */

    throwMethodNotFound(method);
  }

  sendForProviderMaps: Record<string, any> = {};

  sendForProvider(providerName: IInjectedProviderNamesStrings): any {
    if (!providerName) {
      throw new Error('sendForProvider: providerName is required.');
    }
    if (!this.sendForProviderMaps[providerName]) {
      this.sendForProviderMaps[providerName] =
        this.sendMessagesToInjectedBridge.bind(this, providerName);
    }
    return this.sendForProviderMaps[providerName];
  }

  sendMessagesToInjectedBridge = async (
    scope: IInjectedProviderNamesStrings,
    data: unknown,
  ) => {
    if (!this.bridge) {
      console.warn('bridge should be connected first.');
      return;
    }
    if (platformEnv.isExtension) {
      // TODO scope
      // send to all dapp sites content-script
      this.bridgeExtBg?.requestToAllCS(scope, data);
    } else {
      // console.log('sendMessagesToInjectedBridge', { data, scope });
      if (isFunction(data)) {
        // eslint-disable-next-line no-param-reassign
        data = await data({ origin: this.bridge.remoteInfo.origin });
      }
      this.bridge.requestSync({ data, scope });
    }
  };
}
export default BackgroundApiBase;
