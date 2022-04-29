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
import cloneDeep from 'lodash/cloneDeep';

import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import store, { appSelector, persistor } from '../store';

import {
  INTERNAL_METHOD_PREFIX,
  backgroundClass,
  backgroundMethod,
  bindThis,
} from './decorators';
import { IBackgroundApiBridge } from './IBackgroundApi';
import { createBackgroundProviders } from './providers/backgroundProviders';
import ProviderApiBase from './providers/ProviderApiBase';
import {
  ensurePromiseObject,
  ensureSerializable,
  throwMethodNotFound,
} from './utils';

function isPrivateAllowedOrigin(origin?: string) {
  return (
    origin &&
    (origin?.endsWith('.onekey.so') || ['https://onekey.so'].includes(origin))
  );
}

function isPrivateAllowedMethod(method?: string) {
  return (
    method &&
    ['wallet_getConnectWalletInfo', 'wallet_sendSiteMetadata'].includes(
      method || '',
    )
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

@backgroundClass()
class BackgroundApiBase implements IBackgroundApiBridge {
  constructor() {
    this._initBackgroundPersistor();
  }

  persistor = persistor;

  store = store;

  appSelector = appSelector;

  bridge: JsBridgeBase | null = null;

  bridgeExtBg: JsBridgeExtBackground | null = null;

  providers: Record<IInjectedProviderNames, ProviderApiBase> =
    createBackgroundProviders({
      backgroundApi: this,
    });

  // @ts-ignore
  _persistorUnsubscribe: () => void;

  _handlePersistorState = () => {
    const persistorState = this.persistor.getState();
    if (persistorState.bootstrapped) {
      // TODO dispatch persistorState.bootstrapped
      // this.dispatch('persistor/bootstrapped');
      if (this._persistorUnsubscribe) {
        this._persistorUnsubscribe();
      }
    }
  };

  _initBackgroundPersistor() {
    this._persistorUnsubscribe = this.persistor.subscribe(
      this._handlePersistorState,
    );
  }

  // dispatchAction
  @bindThis()
  @backgroundMethod()
  dispatch(action: any) {
    if (isFunction(action)) {
      throw new Error(
        'backgroundApi.dispatch ERROR:  async action is NOT allowed.',
      );
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    action.$isDispatchFromBackground = true;

    // * update background store
    // TODO init store from constructor
    this.store.dispatch(action);
    // * broadcast action
    ensureSerializable(action);
    this.bridgeExtBg?.requestToAllUi({
      // TODO use consts
      method: 'dispatchActionBroadcast',
      params: action,
    } as IJsonRpcRequest);
    // * TODO auto sync full state to UI when ui mount
  }

  // getStoreState
  @bindThis()
  @backgroundMethod()
  getState(): Promise<{ state: any; bootstrapped: boolean }> {
    const state = cloneDeep(this.store.getState());
    const { bootstrapped } = this.persistor.getState();
    return Promise.resolve({ state, bootstrapped });
  }

  connectBridge(bridge: JsBridgeBase) {
    if (platformEnv.isExtension) {
      this.bridgeExtBg = bridge as JsBridgeExtBackground;
    }
    this.bridge = bridge;
  }

  protected rpcResult(
    result: any,
    rpcRequest?: IJsonRpcRequest,
  ): IJsonRpcResponse<any> {
    return {
      id: rpcRequest?.id ?? undefined,
      jsonrpc: rpcRequest?.jsonrpc ?? '2.0',
      result,
    };
  }

  async handleProviderMethods(
    payload: IJsBridgeMessagePayload,
  ): Promise<IJsonRpcResponse<any>> {
    const { scope, origin } = payload;
    const payloadData = payload?.data as IJsonRpcRequest;
    const provider: ProviderApiBase | null =
      this.providers[scope as IInjectedProviderNames];
    if (!provider) {
      throw new Error(
        `[${scope as string}] ProviderApi instance is not found.`,
      );
    }
    if (
      scope === IInjectedProviderNames.$private &&
      !isPrivateAllowedOrigin(origin) &&
      !isPrivateAllowedMethod(payloadData?.method)
    ) {
      throw new Error(
        `${origin as string} is not allowed to call $private methods: ${
          payloadData?.method
        }`,
      );
    }
    // throw web3Errors.provider.custom({
    //   code: 3881,
    //   message: 'test custom error to dapp',
    // });
    debugLogger.ethereum(
      'provider.handleMethods ====> ',
      payloadData.method,
      payload,
    );
    const result = await provider.handleMethods(payload);
    ensureSerializable(result);
    // TODO non rpc result return in some chain provider
    const resultWrapped = this.rpcResult(result, payloadData);
    debugLogger.ethereum(
      'provider.handleMethods RESULT:',
      payloadData,
      '\r\n ----> \r\n',
      resultWrapped,
      payload,
    );
    return resultWrapped;
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
    const serviceName = (payload.data as { service?: string })?.service || '';
    const paramsArr = [].concat(params as any);

    /* eslint-disable  */
    const serviceApi = serviceName ? (this as any)[serviceName] : this;
    const methodFunc = serviceApi[method];
    if (methodFunc) {
      const resultPromise = methodFunc.call(serviceApi, ...paramsArr);
      ensurePromiseObject(resultPromise, {
        serviceName,
        methodName: method,
      });
      const result = await resultPromise;
      ensureSerializable(result);
      return result;
    }
    /* eslint-enable  */

    throwMethodNotFound(serviceName, method);
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
      // send to all dapp sites content-script

      // * bridgeExtBg.requestToAllCS supports function data: await data({ origin })
      this.bridgeExtBg?.requestToAllCS(scope, data);
    } else {
      // console.log('sendMessagesToInjectedBridge', { data, scope });
      if (isFunction(data)) {
        // eslint-disable-next-line no-param-reassign
        data = await data({ origin: this.bridge.remoteInfo.origin });
      }
      ensureSerializable(data);

      // this.bridge.requestSync({ scope, data });
      if (this.bridge.globalOnMessageEnabled) {
        this.bridge.requestSync({ scope, data });
      }
    }
  };
}
export default BackgroundApiBase;
