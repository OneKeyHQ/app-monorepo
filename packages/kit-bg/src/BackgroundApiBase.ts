import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';
import { isFunction } from 'lodash';
import cloneDeep from 'lodash/cloneDeep';

import store, { appSelector, persistor } from '@onekeyhq/kit/src/store';
import {
  INTERNAL_METHOD_PREFIX,
  backgroundClass,
  backgroundMethod,
  bindThis,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import type { IDispatchActionBroadcastParams } from '@onekeyhq/shared/src/background/backgroundUtils';
import {
  DISPATCH_ACTION_BROADCAST_METHOD_NAME,
  buildReduxBatchAction,
  ensurePromiseObject,
  ensureSerializable,
  throwMethodNotFound,
} from '@onekeyhq/shared/src/background/backgroundUtils';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { createBackgroundProviders } from './providers/backgroundProviders';

import type {
  IBackgroundApiBridge,
  IBackgroundApiInternalCallMessage,
} from './IBackgroundApi';
import type ProviderApiBase from './providers/ProviderApiBase';
import type { JsBridgeBase } from '@onekeyfe/cross-inpage-provider-core';
import type {
  IInjectedProviderNamesStrings,
  IJsBridgeMessagePayload,
  IJsBridgeReceiveHandler,
  IJsonRpcRequest,
  IJsonRpcResponse,
} from '@onekeyfe/cross-inpage-provider-types';
import type { JsBridgeExtBackground } from '@onekeyfe/extension-bridge-hosted';

const PRIVATE_WHITE_LIST_ORIGIN = [
  'https://onekey.so',
  'http://localhost:3008', // iOS simulator DEV localhost for web-embed
  'http://localhost:8081', // iOS simulator DEV localhost for web-embed
  'null', // Android DEV localhost for web-embed. url like file://
  ...(platformEnv.isDev
    ? [
        // origin allowed in DEV
        'http://192.168.31.215:3008',
        'http://192.168.31.204:3008',
        'http://192.168.31.96:3008',
        'http://192.168.50.36:3008',
        'http://192.168.124.2:3008',
        'http://192.168.0.104:3008',
      ]
    : []),
].filter(Boolean);
function isPrivateAllowedOrigin(origin?: string) {
  return (
    origin &&
    (origin?.endsWith('.onekey.so') ||
      PRIVATE_WHITE_LIST_ORIGIN.includes(origin))
  );
}

function isPrivateAllowedMethod(method?: string) {
  return (
    method &&
    [
      'wallet_connectToWalletConnect',
      'wallet_getConnectWalletInfo',
      'wallet_sendSiteMetadata',
      'wallet_scanQrcode',
    ].includes(method || '')
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
    this.cycleDepsCheck();
    this._initBackgroundPersistor();
  }

  cycleDepsCheck() {
    if (!this.persistor || !this.store || !this.appSelector) {
      const msg = `background cycle deps ERROR: redux store failed, some reducer may reference backgroundApiProxy`;
      alert(msg);
      throw new Error(msg);
    }
  }

  persistor = persistor;

  store = store;

  appSelector = appSelector;

  bridge: JsBridgeBase | null = null;

  webEmbedBridge: JsBridgeBase | null = null;

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

  @bindThis()
  @backgroundMethod()
  dispatch(...actions: any[]) {
    if (!actions || !actions.length) {
      return;
    }
    // eslint-disable-next-line no-param-reassign
    actions = actions.filter(Boolean);
    const actionData = buildReduxBatchAction(...actions);

    if (actionData) {
      // * update background store
      this.store.dispatch(actionData);

      // * broadcast action to Ext ui
      //    packages/ext/src/ui/uiJsBridge.ts
      const params: IDispatchActionBroadcastParams = {
        actions,
        $isDispatchFromBackground: true,
      };
      this.bridgeExtBg?.requestToAllUi({
        method: DISPATCH_ACTION_BROADCAST_METHOD_NAME,
        params,
      } as IJsonRpcRequest);
    }
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

  connectWebEmbedBridge(bridge: JsBridgeBase) {
    this.webEmbedBridge = bridge;
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
      const error = new Error(
        `[${origin as string}] is not allowed to call $private methods: ${
          payloadData?.method
        }`,
      );
      debugLogger.providerApi.error(error);
      throw error;
    }
    // throw web3Errors.provider.custom({
    //   code: 3881,
    //   message: 'test custom error to dapp',
    // });
    debugLogger.providerApi.info(
      'provider.handleMethods ====> ',
      payloadData.method,
      payload,
    );
    const result = await provider.handleMethods(payload);
    ensureSerializable(result);
    // TODO non rpc result return in some chain provider
    const resultWrapped = this.rpcResult(result, payloadData);
    debugLogger.providerApi.info(
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

    if (!origin) {
      throw new Error('BackgroundApi [payload.origin] is required.');
    }

    if (!internal && !scope) {
      throw new Error(
        'BackgroundApi [payload.scope] is required for non-internal method call.',
      );
    }

    if (scope) {
      debugLogger.backgroundApi.info('_bridgeReceiveHandler', {
        scope,
        origin,
        method,
      });
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
    return res;
  };

  handleSelfOriginMethods(payload: IJsBridgeMessagePayload) {
    // TODO open webview url
    console.log(payload);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async handleInternalMethods(payload: IJsBridgeMessagePayload): Promise<any> {
    const { method, params, service } = (payload.data ??
      {}) as IBackgroundApiInternalCallMessage;
    const serviceName = service || '';
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
    if (!this.bridge && !this.webEmbedBridge) {
      if (!platformEnv.isWeb) {
        console.warn(
          `sendMessagesToInjectedBridge ERROR: bridge should be connected first. scope=${scope}`,
        );
      }
      return;
    }
    if (platformEnv.isExtension) {
      // send to all dapp sites content-script

      // * bridgeExtBg.requestToAllCS supports function data: await data({ origin })
      this.bridgeExtBg?.requestToAllCS(scope, data);
    } else {
      if (this.bridge) {
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
      if (this.webEmbedBridge) {
        if (isFunction(data)) {
          // eslint-disable-next-line no-param-reassign
          data = await data({ origin: this.webEmbedBridge.remoteInfo.origin });
        }
        ensureSerializable(data);

        // this.bridge.requestSync({ scope, data });
        if (this.webEmbedBridge.globalOnMessageEnabled) {
          this.webEmbedBridge.requestSync({ scope, data });
        }
      }
    }
  };
}
export default BackgroundApiBase;
