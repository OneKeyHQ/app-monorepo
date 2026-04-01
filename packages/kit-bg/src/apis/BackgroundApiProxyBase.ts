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

  private readonly backgroundApiFactory?: () => IBackgroundApi;

  private readonly backgroundApiAsyncFactory?: () => Promise<IBackgroundApi>;

  private backgroundApiAsyncFactoryPromise?: Promise<IBackgroundApi | null>;

  private getNativeBackgroundThreadTransport() {
    type INativeBackgroundThreadTransport = {
      callServiceRequest: (
        request: {
          type: 'service-call';
          method: string;
          params: Array<any>;
          sync: boolean;
        },
        localFallback: () => Promise<any>,
      ) => Promise<any>;
      emitAppEventRequest: (
        request: {
          type: 'app-event';
          eventName: string;
          payload: unknown;
        },
        localFallback: () => Promise<any>,
      ) => Promise<any>;
      callBridgeRequest: (
        request: {
          type: 'bridge-call';
          payload: IJsBridgeMessagePayload;
        },
        localFallback: () => Promise<any>,
      ) => Promise<any>;
      syncBridgeConnection: (
        params: {
          channel: 'dapp' | 'webEmbed';
          bridge: JsBridgeBase | null;
        },
        localFallback: () => Promise<any>,
      ) => Promise<any>;
      isEnabled: () => boolean;
    };

    const runtimeGlobal = globalThis as typeof globalThis & {
      __onekeyNativeBackgroundThreadTransport?: INativeBackgroundThreadTransport;
    };

    return runtimeGlobal.__onekeyNativeBackgroundThreadTransport;
  }

  private ensureLocalBackgroundApi() {
    if (!this.backgroundApi && this.backgroundApiFactory) {
      this.backgroundApi = this.backgroundApiFactory();
    }

    return this.backgroundApi;
  }

  private async ensureLocalBackgroundApiAsync(): Promise<IBackgroundApi | null> {
    // Return cached instance if already available
    if (this.backgroundApi) {
      return this.backgroundApi;
    }
    // Try sync factory first
    if (this.backgroundApiFactory) {
      this.backgroundApi = this.backgroundApiFactory();
      if (this.backgroundApi) {
        return this.backgroundApi;
      }
    }
    // Fall back to async factory (dynamic import of real BackgroundApi)
    if (this.backgroundApiAsyncFactory) {
      if (!this.backgroundApiAsyncFactoryPromise) {
        this.backgroundApiAsyncFactoryPromise = this.backgroundApiAsyncFactory()
          .then((api) => {
            this.backgroundApi = api;
            return api;
          })
          .catch((error) => {
            console.error('backgroundApiAsyncFactory failed', error);
            this.backgroundApiAsyncFactoryPromise = undefined;
            return null;
          });
      }
      return this.backgroundApiAsyncFactoryPromise;
    }
    return null;
  }

  private async connectLocalBackgroundBridge(
    channel: 'dapp' | 'webEmbed',
    bridge: JsBridgeBase | null,
  ) {
    let backgroundApi = this.ensureLocalBackgroundApi();
    if (!backgroundApi) {
      backgroundApi = await this.ensureLocalBackgroundApiAsync();
    }
    if (!backgroundApi) {
      throw new OneKeyLocalError('backgroundApi not found in non-ext env');
    }

    if (channel === 'webEmbed') {
      backgroundApi.connectWebEmbedBridge(bridge);
    } else {
      backgroundApi.connectBridge(bridge);
    }

    return true;
  }

  private async callLocalBridgeReceiveHandler(
    payload: IJsBridgeMessagePayload,
  ) {
    let backgroundApi = this.ensureLocalBackgroundApi();
    if (!backgroundApi) {
      // Sync factory unavailable (e.g. native-ui stub) — try async factory
      backgroundApi = await this.ensureLocalBackgroundApiAsync();
    }
    if (!backgroundApi) {
      throw new OneKeyLocalError('backgroundApi not found in non-ext env');
    }

    return backgroundApi.bridgeReceiveHandler(payload);
  }

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

    const callLocalBackgroundMethod = async () => {
      // some third party modules call native object methods, so we should NOT rename method
      //    react-native/node_modules/pretty-format
      //    expo/node_modules/pretty-format
      let backgroundMethodNameLocal = backgroundMethodName;
      const IGNORE_METHODS = new Set(['hasOwnProperty', 'toJSON']);
      if (platformEnv.isNative && IGNORE_METHODS.has(methodName)) {
        backgroundMethodNameLocal = methodName;
      }
      let backgroundApi = this.ensureLocalBackgroundApi();
      if (!backgroundApi) {
        backgroundApi = await this.ensureLocalBackgroundApiAsync();
      }
      if (!backgroundApi) {
        throw new OneKeyLocalError('backgroundApi not found in non-ext env');
      }

      const serviceApi = getBackgroundServiceApi({
        serviceName,
        backgroundApi,
      });

      if (serviceApi[backgroundMethodNameLocal] && serviceApi[methodName]) {
        const resultPromise = serviceApi[methodName].call(
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
      if (!IGNORE_METHODS.has(backgroundMethodNameLocal)) {
        return throwMethodNotFound(serviceName, backgroundMethodNameLocal);
      }
    };

    if (
      platformEnv.isNativeMainThread &&
      platformEnv.enableNativeBackgroundThread
    ) {
      const transport = this.getNativeBackgroundThreadTransport();
      if (transport?.isEnabled()) {
        const backgroundMethod =
          serviceName && serviceName !== 'ROOT'
            ? `${serviceName}.${methodName}`
            : methodName;
        return transport.callServiceRequest(
          {
            type: 'service-call',
            method: backgroundMethod,
            params,
            sync,
          },
          callLocalBackgroundMethod,
        );
      }
    }

    return callLocalBackgroundMethod();
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
    getBackgroundApi,
    getBackgroundApiAsync,
  }: {
    backgroundApi?: any;
    getBackgroundApi?: () => IBackgroundApi;
    getBackgroundApiAsync?: () => Promise<IBackgroundApi>;
  } = {}) {
    super();
    if (backgroundApi) {
      this.backgroundApi = backgroundApi as IBackgroundApi;
    }
    this.backgroundApiFactory = getBackgroundApi;
    this.backgroundApiAsyncFactory = getBackgroundApiAsync;
    jotaiBgSync.setBackgroundApi(this as any);
    void jotaiBgSync.jotaiInitFromUi();
    appEventBus.registerBroadcastMethods(
      EEventBusBroadcastMethodNames.uiToBg,
      async (type, payload) => {
        if (
          platformEnv.isNativeMainThread &&
          platformEnv.enableNativeBackgroundThread
        ) {
          const transport = this.getNativeBackgroundThreadTransport();
          if (transport?.isEnabled()) {
            await transport
              .emitAppEventRequest(
                {
                  type: 'app-event',
                  eventName: type,
                  payload,
                },
                async () => this.emitEvent(type as any, payload),
              )
              .catch((error: unknown) => {
                console.error('appEventBus uiToBg relay failed', error);
              });
            return;
          }
        }

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

  connectBridge(bridge: JsBridgeBase | null) {
    if (
      platformEnv.isNativeMainThread &&
      platformEnv.enableNativeBackgroundThread
    ) {
      const transport = this.getNativeBackgroundThreadTransport();
      if (transport?.isEnabled()) {
        void transport
          .syncBridgeConnection(
            {
              channel: 'dapp',
              bridge,
            },
            () => this.connectLocalBackgroundBridge('dapp', bridge),
          )
          .catch((error) => {
            console.error('connectBridge relay failed', error);
          });
        return;
      }
    }
    this.backgroundApi?.connectBridge(bridge);
  }

  connectWebEmbedBridge(bridge: JsBridgeBase | null) {
    if (
      platformEnv.isNativeMainThread &&
      platformEnv.enableNativeBackgroundThread
    ) {
      const transport = this.getNativeBackgroundThreadTransport();
      if (transport?.isEnabled()) {
        void transport
          .syncBridgeConnection(
            {
              channel: 'webEmbed',
              bridge,
            },
            () => this.connectLocalBackgroundBridge('webEmbed', bridge),
          )
          .catch((error) => {
            console.error('connectWebEmbedBridge relay failed', error);
          });
        return;
      }
    }
    this.backgroundApi?.connectWebEmbedBridge(bridge);
  }

  bridgeReceiveHandler = (payload: IJsBridgeMessagePayload): unknown => {
    if (
      platformEnv.isNativeMainThread &&
      platformEnv.enableNativeBackgroundThread
    ) {
      const transport = this.getNativeBackgroundThreadTransport();
      if (transport?.isEnabled()) {
        return transport.callBridgeRequest(
          {
            type: 'bridge-call',
            payload,
          },
          () => this.callLocalBridgeReceiveHandler(payload),
        );
      }
    }
    return this.backgroundApi?.bridgeReceiveHandler(payload);
  };

  // init in NON-Ext UI env
  backgroundApi?: IBackgroundApi | null = null;

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
