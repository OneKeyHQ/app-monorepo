/* eslint-disable @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-return */

import appGlobals from '@onekeyhq/shared/src/appGlobals';
import { INTERNAL_METHOD_PREFIX } from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  getBackgroundServiceApi,
  throwMethodNotFound,
} from '@onekeyhq/shared/src/background/backgroundUtils';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { globalErrorHandler } from '@onekeyhq/shared/src/errors/globalErrorHandler';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import type {
  EAppEventBusNames,
  IAppEventBusPayload,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  EEventBusBroadcastMethodNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  ensurePromiseObject,
  ensureSerializable,
} from '@onekeyhq/shared/src/utils/assertUtils';
import cacheUtils from '@onekeyhq/shared/src/utils/cacheUtils';

import { jotaiBgSync } from '../states/jotai/jotaiBgSync';

import { BackgroundServiceProxyBase } from './BackgroundServiceProxyBase';

import type {
  IBackgroundApi,
  IBackgroundApiBridge,
  IBackgroundApiInternalCallMessage,
} from './IBackgroundApi';
import type ProviderApiBase from '../providers/ProviderApiBase';
import type { EAtomNames } from '../states/jotai/atomNames';
import type { JsBridgeBase } from '@onekeyfe/cross-inpage-provider-core';
import type {
  IInjectedProviderNames,
  IInjectedProviderNamesStrings,
  IJsBridgeMessagePayload,
  IJsonRpcResponse,
} from '@onekeyfe/cross-inpage-provider-types';
import type { JsBridgeExtBackground } from '@onekeyfe/extension-bridge-hosted';

export class BackgroundApiProxyBase
  extends BackgroundServiceProxyBase
  implements IBackgroundApiBridge
{
  override serviceNameSpace = '';

  private async _callBackgroundMethodAsync({
    sync,
    serviceName,
    methodName,
    backgroundMethodName,
    params,
  }: {
    sync: boolean;
    serviceName: string;
    methodName: string;
    backgroundMethodName: string;
    params: Array<any>;
  }): Promise<any> {
    if (platformEnv.isExtension && platformEnv.isExtensionUi) {
      const data: IBackgroundApiInternalCallMessage = {
        service: serviceName,
        method: backgroundMethodName,
        params,
      };
      if (sync) {
        // call without Promise result
        appGlobals.extJsBridgeUiToBg.requestSync({
          data,
        });
      } else {
        return appGlobals.extJsBridgeUiToBg.request({
          data,
        });
      }
    }

    // some third party modules call native object methods, so we should NOT rename method
    //    react-native/node_modules/pretty-format
    //    expo/node_modules/pretty-format
    let backgroundMethodNameLocal = backgroundMethodName;
    const IGNORE_METHODS = ['hasOwnProperty', 'toJSON'];
    if (platformEnv.isNative && IGNORE_METHODS.includes(methodName)) {
      backgroundMethodNameLocal = methodName;
    }
    if (!this.backgroundApi) {
      throw new OneKeyLocalError('backgroundApi not found in non-ext env');
    }

    const serviceApi = getBackgroundServiceApi({
      serviceName,
      backgroundApi: this.backgroundApi,
    });

    if (serviceApi[backgroundMethodNameLocal] && serviceApi[methodName]) {
      const resultPromise = serviceApi[methodName].call(serviceApi, ...params);
      ensurePromiseObject(resultPromise, {
        serviceName,
        methodName,
      });
      let result = await resultPromise;
      result = ensureSerializable(result, true);
      return result;
    }
    if (!IGNORE_METHODS.includes(backgroundMethodNameLocal)) {
      return throwMethodNotFound(serviceName, backgroundMethodNameLocal);
    }
  }

  private _callBackgroundMethodCachedByKey = cacheUtils.memoizee(
    async (
      _cacheKey: string,
      serviceName: string,
      methodName: string,
      backgroundMethodName: string,
      params: Array<any>,
    ): Promise<any> => {
      return this._callBackgroundMethodAsync({
        sync: false,
        serviceName,
        methodName,
        backgroundMethodName,
        params,
      });
    },
    {
      promise: true,
      normalizer: (args) => args[0],
    },
  );

  constructor({
    backgroundApi,
  }: {
    backgroundApi?: any;
  } = {}) {
    super();
    if (backgroundApi) {
      this.backgroundApi = backgroundApi as IBackgroundApi;
    }
    jotaiBgSync.setBackgroundApi(this as any);
    void jotaiBgSync.jotaiInitFromUi();
    appEventBus.registerBroadcastMethods(
      EEventBusBroadcastMethodNames.uiToBg,
      async (type, payload) => {
        await this.emitEvent(type as any, payload);
      },
    );
    globalErrorHandler.addListener(errorToastUtils.showToastOfError);
  }

  async getAtomStates(): Promise<{ states: Record<EAtomNames, any> }> {
    return this.callBackground('getAtomStates');
  }

  async setAtomValue(atomName: EAtomNames, value: any) {
    // await this.allAtoms;
    return this.callBackground('setAtomValue', atomName, value);
  }

  async emitEvent<T extends EAppEventBusNames>(
    type: T,
    payload: IAppEventBusPayload[T],
  ): Promise<boolean> {
    return this.callBackground('emitEvent', type, payload);
  }

  bridge = {} as JsBridgeBase;

  bridgeExtBg = {} as JsBridgeExtBackground;

  providers = {} as Record<IInjectedProviderNames, ProviderApiBase>;

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
    const backgroundMethodName = `${INTERNAL_METHOD_PREFIX}${methodName}`;

    const buildCacheKey = () => {
      // Reduce extremely hot-path calls from UI -> BG that return large static
      // payloads; otherwise the bridge + dev serializable checks dominate time.
      if (sync) return undefined;
      // serviceName might be `nameSpace@serviceNetwork` in some envs.
      const isServiceNetwork =
        serviceName === 'serviceNetwork' ||
        serviceName.endsWith('@serviceNetwork');
      if (!isServiceNetwork) return undefined;
      if (methodName !== 'getVaultSettings') return undefined;
      const networkId = (params?.[0] as { networkId?: string } | undefined)
        ?.networkId;
      if (!networkId) return undefined;
      return `${serviceName}.${methodName}:${networkId}`;
    };

    const cacheKey = buildCacheKey();
    if (cacheKey) {
      return this._callBackgroundMethodCachedByKey(
        cacheKey,
        serviceName,
        methodName,
        backgroundMethodName,
        params,
      );
    }
    return this._callBackgroundMethodAsync({
      sync,
      serviceName,
      methodName,
      backgroundMethodName,
      params,
    });
  }

  callBackgroundSync(method: string, ...params: Array<any>): any {
    void (async () => {
      try {
        await this.callBackgroundMethod(true, method, ...params);
      } catch (error) {
        setTimeout(() => {
          errorToastUtils.showToastOfError(error as any);
        }, 50);
        throw error;
      }
    })();
  }

  async callBackground(method: string, ...params: Array<any>): Promise<any> {
    try {
      return await this.callBackgroundMethod(false, method, ...params);
    } catch (error) {
      setTimeout(() => {
        errorToastUtils.showToastOfError(error as any);
      }, 50);
      throw error;
    }
  }

  handleProviderMethods(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    payload: IJsBridgeMessagePayload,
  ): Promise<IJsonRpcResponse<any>> {
    throw new OneKeyLocalError('handleProviderMethods in Proxy is mocked');
  }
}
