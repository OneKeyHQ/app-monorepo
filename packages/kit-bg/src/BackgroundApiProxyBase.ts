/* eslint-disable @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-return */

import type { IAppSelector, IPersistor, IStore } from '@onekeyhq/kit/src/store';
import { INTERNAL_METHOD_PREFIX } from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  ensurePromiseObject,
  ensureSerializable,
  throwMethodNotFound,
} from '@onekeyhq/shared/src/background/backgroundUtils';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type {
  IBackgroundApi,
  IBackgroundApiBridge,
  IBackgroundApiInternalCallMessage,
} from './IBackgroundApi';
import type ProviderApiBase from './providers/ProviderApiBase';
import type { JsBridgeBase } from '@onekeyfe/cross-inpage-provider-core';
import type {
  IInjectedProviderNames,
  IInjectedProviderNamesStrings,
  IJsBridgeMessagePayload,
  IJsonRpcResponse,
} from '@onekeyfe/cross-inpage-provider-types';
import type { JsBridgeExtBackground } from '@onekeyfe/extension-bridge-hosted';

export class BackgroundApiProxyBase implements IBackgroundApiBridge {
  appSelector = (() => {
    throw new Error('please use `useAppSelector()` instead.');
  }) as IAppSelector;

  // Dependency cycle
  // import { useAppSelector } from '../hooks';
  // useAppSelector = useAppSelector;

  persistor = {} as IPersistor;

  store = {} as IStore;

  bridge = {} as JsBridgeBase;

  bridgeExtBg = {} as JsBridgeExtBackground;

  providers = {} as Record<IInjectedProviderNames, ProviderApiBase>;

  dispatch = (...actions: any[]) => {
    this.callBackgroundSync('dispatch', ...actions);
  };

  getState = (): Promise<{ state: any; bootstrapped: boolean }> =>
    this.callBackground('getState');

  sendForProvider(providerName: IInjectedProviderNamesStrings): any {
    return this.backgroundApi?.sendForProvider(providerName);
  }

  connectBridge(bridge: JsBridgeBase) {
    this.backgroundApi?.connectBridge(bridge);
  }

  connectWebEmbedBridge(bridge: JsBridgeBase) {
    this.backgroundApi?.connectWebEmbedBridge(bridge);
  }

  bridgeReceiveHandler = (
    payload: IJsBridgeMessagePayload,
  ): any | Promise<any> => this.backgroundApi?.bridgeReceiveHandler(payload);

  constructor({
    backgroundApi,
  }: {
    backgroundApi?: any;
  } = {}) {
    if (backgroundApi) {
      this.backgroundApi = backgroundApi as IBackgroundApi;
    }
  }

  // init in NON-Ext UI env
  readonly backgroundApi?: IBackgroundApi | null = null;

  async callBackgroundMethod(
    sync = true,
    method: string,
    ...params: Array<any>
  ): Promise<any> {
    ensureSerializable(params);
    let [serviceName, methodName] = method.split('.');
    if (!methodName) {
      methodName = serviceName;
      serviceName = '';
    }
    if (serviceName === 'ROOT') {
      serviceName = '';
    }
    let backgroundMethodName = `${INTERNAL_METHOD_PREFIX}${methodName}`;
    if (platformEnv.isExtension && platformEnv.isExtensionUi) {
      const data: IBackgroundApiInternalCallMessage = {
        service: serviceName,
        method: backgroundMethodName,
        params,
      };
      if (sync) {
        // call without Promise result
        window.extJsBridgeUiToBg.requestSync({
          data,
        });
      } else {
        return window.extJsBridgeUiToBg.request({
          data,
        });
      }
    } else {
      // some third party modules call native object methods, so we should NOT rename method
      //    react-native/node_modules/pretty-format
      //    expo/node_modules/pretty-format
      const IGNORE_METHODS = ['hasOwnProperty', 'toJSON'];
      if (platformEnv.isNative && IGNORE_METHODS.includes(methodName)) {
        backgroundMethodName = methodName;
      }
      if (!this.backgroundApi) {
        throw new Error('backgroundApi not found in non-ext env');
      }
      const serviceApi = serviceName
        ? (this.backgroundApi as any)[serviceName]
        : this.backgroundApi;
      if (serviceApi[backgroundMethodName]) {
        const resultPromise = serviceApi[backgroundMethodName].call(
          serviceApi,
          ...params,
        );
        ensurePromiseObject(resultPromise, {
          serviceName,
          methodName,
        });
        let result = await resultPromise;
        result = ensureSerializable(result, true);
        return result;
      }
      if (!IGNORE_METHODS.includes(backgroundMethodName)) {
        throwMethodNotFound(serviceName, backgroundMethodName);
      }
    }
  }

  callBackgroundSync(method: string, ...params: Array<any>): any {
    this.callBackgroundMethod(true, method, ...params);
  }

  callBackground(method: string, ...params: Array<any>): any {
    return this.callBackgroundMethod(false, method, ...params);
  }

  handleProviderMethods(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    payload: IJsBridgeMessagePayload,
  ): Promise<IJsonRpcResponse<any>> {
    throw new Error('handleProviderMethods in Proxy is mocked');
  }
}
