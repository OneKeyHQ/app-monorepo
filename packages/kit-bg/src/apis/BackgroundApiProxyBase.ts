/* eslint-disable @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-return */

import appGlobals from '@onekeyhq/shared/src/appGlobals';
import { INTERNAL_METHOD_PREFIX } from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  getBackgroundServiceApi,
  throwMethodNotFound,
} from '@onekeyhq/shared/src/background/backgroundUtils';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { globalErrorHandler } from '@onekeyhq/shared/src/errors/globalErrorHandler';
import { isOneKeyHardwareError } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { isLegacyHardwareUiActive } from '@onekeyhq/shared/src/hardware/deviceStageOwnership';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IAsyncStorageWriteRequest } from '@onekeyhq/shared/src/storage/asyncStorageWriteForwarderTypes';
import type { INativeStorageRequest } from '@onekeyhq/shared/src/storage/nativeStorageTypes';
import {
  ensurePromiseObject,
  ensureSerializable,
} from '@onekeyhq/shared/src/utils/assertUtils';
import cacheUtils from '@onekeyhq/shared/src/utils/cacheUtils';

import { deviceStageAtom } from '../states/jotai/atoms';
import { jotaiBgSync } from '../states/jotai/jotaiBgSync';

import { BackgroundServiceProxyBase } from './BackgroundServiceProxyBase';
import { getLocalBackgroundServiceMethod } from './lazyServiceProxy';

import type {
  IBackgroundApi,
  IBackgroundApiBridge,
  IBackgroundApiInternalCallMessage,
  IBackgroundAtomStates,
} from './IBackgroundApi';
// NOTE: `waitForDataLoaded`, `timerUtils`, `isWebEmbedApiAllowedOrigin`
// and `IBackgroundApiWebembedCallMessage` used to be imported here for the
// now-commented-out `callWebEmbedBridgeLocal` method below. They are left
// off to keep the lint clean; re-add them alongside the method if it is
// ever revived.
import type ProviderApiBase from '../providers/ProviderApiBase';
import type { EAtomNames } from '../states/jotai/atomNames';
import type {
  IJotaiContextStoreRegistrationUpdate,
  IJotaiContextStoreRegistrationUpdateResult,
} from '../states/jotai/atoms/jotaiContextStoreMap';
import type { JsBridgeBase } from '@onekeyfe/cross-inpage-provider-core';
import type {
  IInjectedProviderNames,
  IInjectedProviderNamesStrings,
  IJsBridgeMessagePayload,
  IJsonRpcResponse,
} from '@onekeyfe/cross-inpage-provider-types';
import type { JsBridgeExtBackground } from '@onekeyfe/extension-bridge-hosted';

// OK-59934 hard rule #2 (失败不外溢): while the DeviceStage is carrying a
// hardware interaction, a hardware failure lands there as the stage's own
// outcome — the same rejection must not also toast. This is the belt for
// calls outside withHardwareProcessing (the wrapper clears autoToast for
// the ones inside); non-hardware errors and a resting stage keep the
// legacy toast behavior.
function showToastOfErrorUnlessStageCarriesIt(error: unknown) {
  void (async () => {
    try {
      if (!isLegacyHardwareUiActive() && isOneKeyHardwareError(error)) {
        const stage = await deviceStageAtom.get();
        if (stage && stage.step !== 'off') {
          return;
        }
      }
    } catch {
      // never let the gate itself eat the toast
    }
    errorToastUtils.showToastOfError(error as any);
  })();
}

export class BackgroundApiProxyBase
  extends BackgroundServiceProxyBase
  implements IBackgroundApiBridge
{
  override serviceNameSpace = '';

  private readonly backgroundApiFactory?: () =>
    | IBackgroundApi
    | null
    | Promise<IBackgroundApi | null>;

  private backgroundApiFactoryInvoked = false;

  private backgroundApiFactoryPromise?: Promise<IBackgroundApi | null>;

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
        options?: { signal?: AbortSignal },
      ) => Promise<any>;
      emitAppEventRequest: (
        request: {
          type: 'app-event';
          eventName: string;
          payload: unknown;
          originNodeId?: string;
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
      ensureReady?: () => Promise<void>;
      isEnabled: () => boolean;
    };

    const runtimeGlobal = globalThis as typeof globalThis & {
      __onekeyNativeBackgroundThreadTransport?: INativeBackgroundThreadTransport;
    };

    return runtimeGlobal.__onekeyNativeBackgroundThreadTransport;
  }

  private async ensureLocalBackgroundApi() {
    // Invoke the factory at most once. In dual-thread native, the factory
    // is the `native-ui` stub that returns `null`; without this guard,
    // every call into the local dispatch path would re-run the factory
    // (since `!null` is still truthy) and replay its `console.log`.
    if (this.backgroundApiFactoryPromise) {
      return this.backgroundApiFactoryPromise;
    }
    if (
      !this.backgroundApi &&
      !this.backgroundApiFactoryInvoked &&
      this.backgroundApiFactory
    ) {
      this.backgroundApiFactoryInvoked = true;
      this.backgroundApiFactoryPromise = Promise.resolve(
        this.backgroundApiFactory(),
      ).then(
        (backgroundApi) => {
          this.backgroundApi = backgroundApi;
          return backgroundApi;
        },
        (error: unknown) => {
          this.backgroundApiFactoryInvoked = false;
          this.backgroundApiFactoryPromise = undefined;
          throw error;
        },
      );
      return this.backgroundApiFactoryPromise;
    }

    return this.backgroundApi;
  }

  private async connectLocalBackgroundBridge(
    channel: 'dapp' | 'webEmbed',
    bridge: JsBridgeBase | null,
  ) {
    const backgroundApi = await this.ensureLocalBackgroundApi();
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
    const backgroundApi = await this.ensureLocalBackgroundApi();
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
      const backgroundApi = await this.ensureLocalBackgroundApi();
      if (!backgroundApi) {
        throw new OneKeyLocalError('backgroundApi not found in non-ext env');
      }

      const serviceApi = getBackgroundServiceApi({
        serviceName,
        backgroundApi,
      });

      const serviceMethod = getLocalBackgroundServiceMethod({
        serviceApi,
        methodName,
        backgroundMethodName: backgroundMethodNameLocal,
      });
      if (serviceMethod) {
        const resultPromise = Reflect.apply(serviceMethod, serviceApi, params);
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
      if (transport) {
        const backgroundMethod =
          serviceName && serviceName !== 'ROOT'
            ? `${serviceName}.${methodName}`
            : methodName;
        const abortSignal = params
          .map((param) =>
            param && typeof param === 'object'
              ? (param as { signal?: AbortSignal }).signal
              : undefined,
          )
          .find(
            (signal) =>
              typeof signal?.aborted === 'boolean' &&
              typeof signal.addEventListener === 'function',
          );
        const remoteParams = abortSignal
          ? params.map((param) => {
              if (
                !param ||
                typeof param !== 'object' ||
                (param as { signal?: AbortSignal }).signal !== abortSignal
              ) {
                return param;
              }
              const { signal: _signal, ...serializableParam } = param as Record<
                string,
                unknown
              >;
              return serializableParam;
            })
          : params;
        return transport.callServiceRequest(
          {
            type: 'service-call',
            method: backgroundMethod,
            params: remoteParams,
            sync,
          },
          callLocalBackgroundMethod,
          abortSignal ? { signal: abortSignal } : undefined,
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
  }: {
    backgroundApi?: any;
    getBackgroundApi?: () =>
      | IBackgroundApi
      | null
      | Promise<IBackgroundApi | null>;
  } = {}) {
    super();
    if (backgroundApi) {
      this.backgroundApi = backgroundApi as IBackgroundApi;
    }
    this.backgroundApiFactory = getBackgroundApi;
    jotaiBgSync.setBackgroundApi(this as any);
    // Native main awaits this initialization in NativeStorageBootstrapRoot so
    // startup failures can use the existing Retry/Restart recovery surface.
    if (
      !platformEnv.isNativeMainThread ||
      !platformEnv.enableNativeBackgroundThread
    ) {
      void this.initializeJotaiFromBackground().catch((err: unknown) => {
        console.error('[JOTAI_INIT_ERROR] jotaiInitFromUi failed', err);
      });
    }
    // Register the 'main' role transport: forward ui-emitted events to the
    // singleton background, which will fan-out to every foreground. The
    // sender's `originNodeId` travels with the message so it can skip its
    // own echo when the broadcast comes back.
    appEventBus.registerTransports({
      sendToBackground: async ({ type, payload, originNodeId }) => {
        if (
          platformEnv.isNativeMainThread &&
          platformEnv.enableNativeBackgroundThread
        ) {
          const transport = this.getNativeBackgroundThreadTransport();
          if (transport) {
            await transport
              .emitAppEventRequest(
                {
                  type: 'app-event',
                  eventName: type,
                  payload,
                  originNodeId,
                },
                async () => this.emitEvent(type as any, payload, originNodeId),
              )
              .catch((error: unknown) => {
                console.error(
                  'appEventBus sendToBackground relay failed',
                  error,
                );
              });
            return;
          }
        }

        await this.emitEvent(type as any, payload, originNodeId);
      },
    });
    globalErrorHandler.addListener(showToastOfErrorUnlessStageCarriesIt);
  }

  async getAtomStates(
    atomNames?: EAtomNames[],
  ): Promise<{ states: IBackgroundAtomStates }> {
    if (atomNames) {
      return this.callBackground('getAtomStates', atomNames);
    }
    return this.callBackground('getAtomStates');
  }

  async setAtomValue(atomName: EAtomNames, value: any) {
    // await this.allAtoms;
    return this.callBackground('setAtomValue', atomName, value);
  }

  async updateJotaiContextStoreRegistration(
    update: IJotaiContextStoreRegistrationUpdate,
  ): Promise<IJotaiContextStoreRegistrationUpdateResult> {
    return this.callBackground('updateJotaiContextStoreRegistration', update);
  }

  async emitEvent<T extends keyof IAppEventBusPayload>(
    type: T,
    payload: IAppEventBusPayload[T],
    originNodeId?: string,
  ): Promise<boolean> {
    return this.callBackground('emitEvent', type, payload, originNodeId);
  }

  async writeAsyncStorage(request: IAsyncStorageWriteRequest): Promise<void> {
    return this.callBackground('writeAsyncStorage', request);
  }

  async nativeStorage(request: INativeStorageRequest): Promise<unknown> {
    return this.callBackground('nativeStorage', request);
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
      if (transport) {
        void Promise.resolve()
          .then(() =>
            transport.syncBridgeConnection(
              {
                channel: 'dapp',
                bridge,
              },
              () => this.connectLocalBackgroundBridge('dapp', bridge),
            ),
          )
          .catch((error) => {
            console.error('connectBridge relay failed', error);
          });
        return;
      }
    }
    if (this.backgroundApi) {
      this.backgroundApi.connectBridge(bridge);
      return;
    }
    if (!platformEnv.isExtensionUi) {
      void this.connectLocalBackgroundBridge('dapp', bridge).catch((error) => {
        console.error('connectBridge local failed', error);
      });
    }
  }

  connectWebEmbedBridge(bridge: JsBridgeBase | null) {
    const hasTransport = !!this.getNativeBackgroundThreadTransport();
    defaultLogger.app.webembed.connectWebEmbedBridgeEntry({
      isMainThread: !!platformEnv.isNativeMainThread,
      enableBgThread: !!platformEnv.enableNativeBackgroundThread,
      hasTransport,
      bridgeExists: !!bridge,
    });
    if (
      platformEnv.isNativeMainThread &&
      platformEnv.enableNativeBackgroundThread
    ) {
      const transport = this.getNativeBackgroundThreadTransport();
      if (transport) {
        // NOTE: the block below used to mirror the webEmbed bridge onto the
        // main-thread local BackgroundApi so that callWebEmbedBridgeLocal()
        // (further down in this file) could dispatch directly. In dual-thread
        // mode `ensureLocalBackgroundApi()` is wired to the native-ui stub
        // (`backgroundApiInit.native-ui.ts`) which returns `null`, so this
        // call can never succeed and the silent `.catch` just hid a false
        // alarm on every connect. The real webEmbed path in dual-thread mode
        // is the reverse RPC via `__onekeyCallWebEmbedBridgeViaMainThread`
        // (see `webembedApiProxy.callRemoteApi()`), so nothing reads the
        // local BackgroundApi bridge reference. Left commented-out instead
        // of deleted in case a future single-thread fallback path revives
        // `callWebEmbedBridgeLocal`.
        // void this.connectLocalBackgroundBridge('webEmbed', bridge).catch(
        //   (error) => {
        //     defaultLogger.app.webembed.connectWebEmbedBridgeSyncError({
        //       error: `connectLocalBackgroundBridge(webEmbed) failed: ${String(
        //         error,
        //       )}`,
        //     });
        //     console.error(
        //       'connectLocalBackgroundBridge(webEmbed) failed',
        //       error,
        //     );
        //   },
        // );
        void Promise.resolve()
          .then(() => {
            defaultLogger.app.webembed.connectWebEmbedBridgeTransportReady();
            return transport.syncBridgeConnection(
              {
                channel: 'webEmbed',
                bridge,
              },
              () => this.connectLocalBackgroundBridge('webEmbed', bridge),
            );
          })
          .then(() => {
            defaultLogger.app.webembed.connectWebEmbedBridgeSyncDone();
          })
          .catch((error) => {
            defaultLogger.app.webembed.connectWebEmbedBridgeSyncError({
              error: String(error),
            });
            console.error('connectWebEmbedBridge relay failed', error);
          });
        return;
      }
    }
    defaultLogger.app.webembed.connectWebEmbedBridgeDirect();
    if (this.backgroundApi) {
      this.backgroundApi.connectWebEmbedBridge(bridge);
      return;
    }
    if (!platformEnv.isExtensionUi) {
      void this.connectLocalBackgroundBridge('webEmbed', bridge).catch(
        (error) => {
          defaultLogger.app.webembed.connectWebEmbedBridgeSyncError({
            error: String(error),
          });
          console.error('connectWebEmbedBridge local failed', error);
        },
      );
    }
  }

  // NOTE: `callWebEmbedBridgeLocal` was added per the 2026-04-06 dual-thread
  // plan (see docs/plans/2026-04-06-fix-webembed-dual-thread.md) as a
  // main-thread local dispatch path for webEmbed calls. The final
  // implementation instead routes dual-thread webEmbed traffic through the
  // reverse RPC `__onekeyCallWebEmbedBridgeViaMainThread` exposed from the
  // main thread, and single-thread traffic through
  // `serviceDApp.callWebEmbedApiProxy` — see
  // `packages/kit-bg/src/webembeds/instance/webembedApiProxy.ts`
  // `callRemoteApi()`. As a result this method has no callers anywhere in
  // the repo.
  //
  // Additionally, in dual-thread mode `ensureLocalBackgroundApi()` resolves
  // to `backgroundApiInit.native-ui.ts` which returns `null`, so the
  // `waitForDataLoaded` here would never observe a bridge and would time
  // out after 3 minutes, silently hanging any future caller.
  //
  // Left commented-out rather than deleted so the dispatch shape is still
  // discoverable if a future single-thread fallback needs to revive it —
  // when that happens, remember to also re-enable the companion
  // `connectLocalBackgroundBridge('webEmbed', bridge)` call inside
  // `connectWebEmbedBridge` above.
  //
  // async callWebEmbedBridgeLocal(
  //   data: IBackgroundApiWebembedCallMessage,
  // ): Promise<any> {
  //   const bg = this.ensureLocalBackgroundApi() as unknown as
  //     | import('./BackgroundApiBase').default
  //     | undefined;
  //
  //   defaultLogger.app.webembed.callWebEmbedApiProxyEntry({
  //     module: data?.module || '',
  //     method: data?.method || '',
  //     isWebEmbedApiReady: true,
  //     hasWebEmbedBridge: !!bg?.webEmbedBridge,
  //   });
  //
  //   await waitForDataLoaded({
  //     data: () => Boolean(bg?.webEmbedBridge),
  //     logName: `callWebEmbedBridgeLocal: bridge=${Boolean(bg?.webEmbedBridge)}`,
  //     wait: 1000,
  //     timeout: timerUtils.getTimeDurationMs({ minute: 3 }),
  //   });
  //
  //   if (!bg?.webEmbedBridge?.request) {
  //     throw new OneKeyLocalError('webembed webview bridge not ready (local).');
  //   }
  //
  //   const webviewOrigin = bg.webEmbedBridge.remoteInfo?.origin || '';
  //   defaultLogger.app.webembed.callWebEmbedApiProxyBridgeReady({
  //     module: data?.module || '',
  //     method: data?.method || '',
  //     origin: webviewOrigin,
  //   });
  //
  //   if (!isWebEmbedApiAllowedOrigin(webviewOrigin)) {
  //     throw new OneKeyLocalError(
  //       `callWebEmbedBridgeLocal not allowed origin: ${webviewOrigin || 'undefined'}`,
  //     );
  //   }
  //
  //   const result = await bg.webEmbedBridge.request({
  //     scope: '$private',
  //     data,
  //   });
  //   return result;
  // }

  bridgeReceiveHandler = (payload: IJsBridgeMessagePayload): unknown => {
    if (
      platformEnv.isNativeMainThread &&
      platformEnv.enableNativeBackgroundThread
    ) {
      const transport = this.getNativeBackgroundThreadTransport();
      if (transport) {
        return Promise.resolve().then(() =>
          transport.callBridgeRequest(
            {
              type: 'bridge-call',
              payload,
            },
            () => this.callLocalBridgeReceiveHandler(payload),
          ),
        );
      }
    }
    // Use async fallback if backgroundApi is not yet available (native-ui stub)
    if (!this.backgroundApi) {
      return this.callLocalBridgeReceiveHandler(payload);
    }
    return this.backgroundApi.bridgeReceiveHandler(payload);
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

  initializeJotaiFromBackground() {
    return jotaiBgSync.jotaiInitFromUi();
  }

  callBackgroundSync(method: string, ...params: Array<any>): any {
    void (async () => {
      try {
        await this.callBackgroundMethod(true, method, ...params);
      } catch (error) {
        setTimeout(() => {
          showToastOfErrorUnlessStageCarriesIt(error);
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
        showToastOfErrorUnlessStageCarriesIt(error);
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

  getProviderApi(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    scope: IInjectedProviderNames,
  ): Promise<ProviderApiBase> {
    throw new OneKeyLocalError('getProviderApi in Proxy is mocked');
  }
}
