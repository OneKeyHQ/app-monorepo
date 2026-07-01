import { consts } from '@onekeyfe/cross-inpage-provider-core';
import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';
import { isFunction } from 'lodash';

import '@onekeyhq/kit-bg/src/webembeds/instance/webembedApiProxy';
import appGlobals from '@onekeyhq/shared/src/appGlobals';
import {
  backgroundClass,
  backgroundMethod,
  bindThis,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import type { IGlobalEventBusSyncBroadcastParams } from '@onekeyhq/shared/src/background/backgroundUtils';
import {
  GLOBAL_EVENT_BUS_SYNC_BROADCAST_METHOD_NAME,
  getBackgroundServiceApi,
  throwMethodNotFound,
} from '@onekeyhq/shared/src/background/backgroundUtils';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import performance from '@onekeyhq/shared/src/performance';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  ensurePromiseObject,
  ensureSerializable,
} from '@onekeyhq/shared/src/utils/assertUtils';
import { EAlignPrimaryAccountMode } from '@onekeyhq/shared/types/dappConnection';

import { updateInterceptorRequestHelper } from '../init/updateInterceptorRequestHelper';
import { updateInterceptorRequestHelperWithIpTable } from '../init/updateInterceptorRequestHelperWithIpTable';
import {
  createBackgroundProviders,
  providerApiLoaders,
} from '../providers/backgroundProviders';
import { settingsPersistAtom } from '../states/jotai/atoms';
import { jotaiBgSync } from '../states/jotai/jotaiBgSync';
import { jotaiInit } from '../states/jotai/jotaiInit';

import {
  isExtensionInternalCall,
  isProviderApiPrivateAllowedKeylessOrigin,
  isProviderApiPrivateAllowedMethod,
  isProviderApiPrivateAllowedOrigin,
  isProviderApiPrivateKeylessMethod,
} from './backgroundApiPermissions';

import type {
  IBackgroundApiBridge,
  IBackgroundApiInternalCallMessage,
} from './IBackgroundApi';
import type ProviderApiBase from '../providers/ProviderApiBase';
import type { EAtomNames } from '../states/jotai/atomNames';
import type { JotaiCrossAtom } from '../states/jotai/utils/JotaiCrossAtom';
import type { JsBridgeBase } from '@onekeyfe/cross-inpage-provider-core';
import type {
  IInjectedProviderNamesStrings,
  IJsBridgeMessagePayload,
  IJsBridgeReceiveHandler,
  IJsonRpcRequest,
  IJsonRpcResponse,
} from '@onekeyfe/cross-inpage-provider-types';
import type { JsBridgeExtBackground } from '@onekeyfe/extension-bridge-hosted';

updateInterceptorRequestHelper();
updateInterceptorRequestHelperWithIpTable();

function summarizeSetAtomValuePayload(value: unknown) {
  if (value === undefined) {
    return 'undefined';
  }
  if (value === null) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return `array(len=${value.length})`;
  }
  const valueType = typeof value;
  if (valueType === 'string') {
    return `string(len=${(value as string).length})`;
  }
  if (
    valueType === 'number' ||
    valueType === 'boolean' ||
    valueType === 'bigint'
  ) {
    return `${valueType}(${String(value)})`;
  }
  if (valueType === 'object') {
    const objectValue = value as Record<string, unknown>;
    const keys = Object.keys(objectValue);
    const previewKeys = keys.slice(0, 12);
    const undefinedKeys = previewKeys.filter(
      (key) => objectValue[key] === undefined,
    );
    return [
      `object(keys=${keys.length})`,
      `previewKeys=${previewKeys.join('|') || 'none'}`,
      `undefinedPreviewKeys=${undefinedKeys.join('|') || 'none'}`,
    ].join(', ');
  }
  return valueType;
}

@backgroundClass()
class BackgroundApiBase implements IBackgroundApiBridge {
  private static readonly PENDING_BRIDGE_MESSAGE_TTL_MS = 10_000;

  private static readonly MAX_PENDING_BRIDGE_MESSAGE_COUNT = 100;

  private pendingInjectedBridgeMessages: Array<{
    scope: IInjectedProviderNamesStrings;
    data: unknown;
    targetOrigin: string;
    createdAt: number;
  }> = [];

  private isFlushingPendingInjectedBridgeMessages = false;

  private getNativeBackgroundThreadBridgeRelay() {
    const runtimeGlobal = globalThis as typeof globalThis & {
      __onekeyNativeBackgroundThreadBridgeRelay?: {
        emitAppEventToUi: (payload: {
          eventName: string;
          payload: unknown;
          originNodeId?: string;
        }) => boolean;
        sendBridgeMessageToUi: (payload: {
          channel: 'dapp' | 'webEmbed';
          scope: IInjectedProviderNamesStrings;
          data: unknown;
          targetOrigin?: string;
        }) => boolean;
        getBridgeState: (channel: 'dapp' | 'webEmbed') =>
          | {
              channel: 'dapp' | 'webEmbed';
              connected: boolean;
              origin?: string;
              globalOnMessageEnabled: boolean;
            }
          | undefined;
      };
      __onekeyNativeBackgroundThreadFlushPendingBridgeMessages?: () => void;
    };

    return runtimeGlobal.__onekeyNativeBackgroundThreadBridgeRelay;
  }

  private getNativeBackgroundThreadActiveBridgeState(targetOrigin?: string) {
    const bridgeRelay = this.getNativeBackgroundThreadBridgeRelay();
    if (!bridgeRelay) {
      return undefined;
    }

    const bridgeStates = ['dapp', 'webEmbed']
      .map((channel) =>
        bridgeRelay.getBridgeState(channel as 'dapp' | 'webEmbed'),
      )
      .filter((state) => state?.connected);

    if (!bridgeStates.length) {
      return undefined;
    }

    if (targetOrigin) {
      const matchedBridgeState = bridgeStates.find(
        (state) => state?.origin === targetOrigin,
      );
      if (matchedBridgeState) {
        return matchedBridgeState;
      }
    }

    return bridgeStates[0];
  }

  constructor() {
    this.cycleDepsCheck();
    jotaiBgSync.setBackgroundApi(this as any);
    this.allAtoms = jotaiInit();
    if (process.env.NODE_ENV !== 'production') {
      appGlobals.$$backgroundApi = this as any;
    }
    if (
      platformEnv.isNativeBackgroundThread &&
      platformEnv.enableNativeBackgroundThread
    ) {
      (
        globalThis as typeof globalThis & {
          __onekeyNativeBackgroundThreadFlushPendingBridgeMessages?: () => void;
        }
      ).__onekeyNativeBackgroundThreadFlushPendingBridgeMessages = () => {
        void this.flushPendingInjectedBridgeMessages();
      };
    }
    // this.startDemoNowTimeUpdateInterval();
    // Register the 'background' role transport: fan-out received/emitted
    // events to every foreground. Each foreground inspects originNodeId on
    // arrival and skips its own echoes.
    appEventBus.registerTransports({
      broadcastToForegrounds: ({ type, payload, originNodeId }) => {
        if (
          platformEnv.isNativeBackgroundThread &&
          platformEnv.enableNativeBackgroundThread
        ) {
          this.getNativeBackgroundThreadBridgeRelay()?.emitAppEventToUi({
            eventName: type,
            payload,
            originNodeId,
          });
          return;
        }
        const params: IGlobalEventBusSyncBroadcastParams = {
          $$isFromBgEventBusSyncBroadcast: true,
          type,
          payload,
          originNodeId,
        };
        this.bridgeExtBg?.requestToAllUi({
          method: GLOBAL_EVENT_BUS_SYNC_BROADCAST_METHOD_NAME,
          params,
        });
      },
    });

    // Symmetric counterpart to the Main-side GC trigger in Bootstrap.tsx.
    // On native (Hermes split-runtime), the Main forceGarbageCollection()
    // only reclaims Main's heap — Background services' memoize/socket caches
    // live in this runtime's heap and need a local GC pass after their
    // synchronous `.clear()` handlers run. setTimeout(0) defers GC past the
    // current macrotask so every other listener on this runtime finishes
    // first. On Standalone (web/desktop) and Extension, the native memory-
    // warning event never fires (the shared performance shim is a no-op),
    // so this handler is dormant.
    appEventBus.on(EAppEventBusNames.MemoryPressureWarning, (event) => {
      if (event.level !== 'critical') return;
      setTimeout(() => {
        performance.forceGarbageCollection();
      }, 0);
    });
  }

  allAtoms: Promise<{
    [key: string]: JotaiCrossAtom<any>;
  }>;

  @backgroundMethod()
  async getAtomStates(): Promise<{ states: Record<EAtomNames, any> }> {
    const atoms = await this.allAtoms;
    const states = {} as Record<EAtomNames, any>;
    await Promise.all(
      Object.entries(atoms).map(async ([key, value]) => {
        states[key as EAtomNames] = await value.get();
      }),
    );
    return { states };
  }

  @bindThis()
  @backgroundMethod()
  async setAtomValue(atomName: EAtomNames, value: any) {
    const startedAt = Date.now();
    const atoms = await this.allAtoms;
    const atom = atoms[atomName];
    if (!atom) {
      throw new OneKeyLocalError(
        `setAtomValue ERROR: atomName not found: ${atomName}`,
      );
    }
    try {
      await atom.set(value);
      const durationMs = Date.now() - startedAt;
      if (durationMs >= 1000) {
        defaultLogger.app.appUpdate.log(
          `[BgSetAtomValue] slow atom=${atomName}, durationMs=${durationMs}, payload=${summarizeSetAtomValuePayload(
            value,
          )}`,
        );
      }
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      defaultLogger.app.appUpdate.log(
        `[BgSetAtomValue] failed atom=${atomName}, durationMs=${durationMs}, payload=${summarizeSetAtomValuePayload(
          value,
        )}, error=${(error as Error)?.message || 'unknown'}`,
      );
      throw error;
    }
  }

  @backgroundMethod()
  async emitEvent<T extends keyof IAppEventBusPayload>(
    type: T,
    payload: IAppEventBusPayload[T],
    originNodeId?: string,
  ): Promise<boolean> {
    if (!originNodeId) {
      // A bridge regression dropped the sender's nodeId. Don't re-label as
      // BG-originated (which would let the sender skip its own echo and
      // mask the regression silently). Log so the regression is visible
      // and pass through empty so downstream receivers all fire — the
      // sender will then double-fire, which is detectable in dev.
      defaultLogger.app.eventBus.missingOriginNodeId({
        source: 'BackgroundApi.emitEvent',
        eventName: type,
      });
    }
    // Route the foreground-originated event through the bus' inbound handler
    // so that (1) bg listeners fire with isRemote=true, and (2) the event is
    // fanned out to every foreground with the *original* sender's nodeId —
    // the sender then skips its own echo.
    appEventBus.dispatchInboundFromForeground({
      type,
      payload,
      originNodeId: originNodeId ?? '',
    });
    return Promise.resolve(true);
  }

  cycleDepsCheck() {
    //
  }

  bridge: JsBridgeBase | null = null;

  webEmbedBridge: JsBridgeBase | null = null;

  bridgeExtBg: JsBridgeExtBackground | null = null;

  // Only $private is eager here; per-chain providers are loaded lazily on first
  // use via getProviderApi() so their heavy chain SDKs stay out of the initial
  // (web) / startup (native) bundle graph.
  providers: Partial<Record<IInjectedProviderNames, ProviderApiBase>> =
    createBackgroundProviders({
      backgroundApi: this,
    });

  // In-flight loader cache: dedupes concurrent loads of the same provider so two
  // simultaneous dapp messages can't construct two ProviderApi instances.
  private providerApiLoadingCache: Partial<
    Record<IInjectedProviderNames, Promise<ProviderApiBase>>
  > = {};

  async getProviderApi(
    scope: IInjectedProviderNames,
  ): Promise<ProviderApiBase> {
    const existing = this.providers[scope];
    if (existing) {
      return existing;
    }
    let loading = this.providerApiLoadingCache[scope];
    if (!loading) {
      const loader = providerApiLoaders[scope];
      if (!loader) {
        throw new OneKeyLocalError(
          `[${scope as string}] ProviderApi loader is not found.`,
        );
      }
      loading = loader()
        .then((module) => {
          const ProviderApiClass = module.default;
          const instance = new ProviderApiClass({ backgroundApi: this });
          this.providers[scope] = instance;
          return instance;
        })
        .catch((error) => {
          // Drop the rejected promise so a transient load failure (e.g. a
          // failed webpack chunk request on web) doesn't permanently poison
          // the cache and leave the provider unavailable for the session.
          delete this.providerApiLoadingCache[scope];
          throw error;
        });
      this.providerApiLoadingCache[scope] = loading;
    }
    return loading;
  }

  // @ts-ignore
  _persistorUnsubscribe: () => void;

  connectBridge(bridge: JsBridgeBase | null) {
    if (platformEnv.isExtension) {
      this.bridgeExtBg = bridge as unknown as JsBridgeExtBackground | null;
    }
    this.bridge = bridge;
    if (bridge) {
      void this.flushPendingInjectedBridgeMessages();
    }
  }

  connectWebEmbedBridge(bridge: JsBridgeBase | null) {
    defaultLogger.app.webembed.webEmbedBgConnectWebEmbedBridge({
      hasBridge: !!bridge,
    });
    this.webEmbedBridge = bridge;
    if (bridge) {
      void this.flushPendingInjectedBridgeMessages();
    }
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
    const isKeylessPrivateMethod = isProviderApiPrivateKeylessMethod(
      payloadData?.method,
    );
    const provider: ProviderApiBase = await this.getProviderApi(
      scope as IInjectedProviderNames,
    );
    if (
      scope === IInjectedProviderNames.$private &&
      ((isKeylessPrivateMethod &&
        !isProviderApiPrivateAllowedKeylessOrigin(origin)) ||
        (!isKeylessPrivateMethod &&
          !isProviderApiPrivateAllowedOrigin(origin) &&
          !isProviderApiPrivateAllowedMethod(payloadData?.method)))
    ) {
      const error = new Error(
        `[${origin as string}] is not allowed to call $private methods: ${
          payloadData?.method
        }`,
      );
      throw error;
    }
    // throw web3Errors.provider.custom({
    //   code: 3881,
    //   message: 'test custom error to dapp',
    // });
    const result = await provider.handleMethods(payload);
    ensureSerializable(result);
    // TODO non rpc result return in some chain provider
    const resultWrapped = this.rpcResult(result, payloadData);

    return resultWrapped;
  }

  async _bridgeReceiveHandler(payload: IJsBridgeMessagePayload): Promise<any> {
    const { scope, origin, internal } = payload;
    const request = (payload.data ?? {}) as IJsonRpcRequest;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { method, params } = request;

    if (!origin) {
      throw new OneKeyLocalError('BackgroundApi [payload.origin] is required.');
    }

    if (!internal && !scope) {
      throw new OneKeyLocalError(
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

    if (isProviderApiPrivateAllowedOrigin(origin)) {
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

    const serviceApi = getBackgroundServiceApi({
      serviceName,
      backgroundApi: this,
    });

    const methodFunc = serviceApi[method];
    if (methodFunc) {
      const resultPromise = methodFunc.call(serviceApi, ...paramsArr);
      ensurePromiseObject(resultPromise, {
        serviceName,
        methodName: method,
      });
      const result = await resultPromise;
      ensureSerializable(result);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return result;
    }

    throwMethodNotFound(serviceName, method);
  }

  sendForProviderMaps: Record<string, any> = {};

  sendForProvider(providerName: IInjectedProviderNamesStrings): any {
    if (!providerName) {
      throw new OneKeyLocalError('sendForProvider: providerName is required.');
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
    targetOrigin: string,
  ) => {
    const delivered = await this.trySendMessagesToInjectedBridge({
      scope,
      data,
      targetOrigin,
    });

    if (!delivered) {
      this.enqueuePendingInjectedBridgeMessage({
        scope,
        data,
        targetOrigin,
      });
    }
  };

  private prunePendingInjectedBridgeMessages() {
    const now = Date.now();
    this.pendingInjectedBridgeMessages =
      this.pendingInjectedBridgeMessages.filter(
        (message) =>
          now - message.createdAt <=
          BackgroundApiBase.PENDING_BRIDGE_MESSAGE_TTL_MS,
      );
  }

  private enqueuePendingInjectedBridgeMessage(params: {
    scope: IInjectedProviderNamesStrings;
    data: unknown;
    targetOrigin: string;
  }) {
    this.prunePendingInjectedBridgeMessages();
    this.pendingInjectedBridgeMessages.push({
      ...params,
      createdAt: Date.now(),
    });

    if (
      this.pendingInjectedBridgeMessages.length >
      BackgroundApiBase.MAX_PENDING_BRIDGE_MESSAGE_COUNT
    ) {
      this.pendingInjectedBridgeMessages.shift();
    }
  }

  private async resolveBridgeMessageData(params: {
    data: unknown;
    origin: string;
  }) {
    let { data } = params;
    if (isFunction(data)) {
      data = await data({ origin: params.origin });
    }
    ensureSerializable(data);
    return data;
  }

  private async trySendMessagesToInjectedBridge(params: {
    scope: IInjectedProviderNamesStrings;
    data: unknown;
    targetOrigin: string;
  }) {
    const { scope, targetOrigin } = params;
    let { data } = params;

    if (
      platformEnv.isNativeBackgroundThread &&
      platformEnv.enableNativeBackgroundThread
    ) {
      const bridgeRelay = this.getNativeBackgroundThreadBridgeRelay();
      const bridgeState =
        this.getNativeBackgroundThreadActiveBridgeState(targetOrigin);
      if (!bridgeRelay || !bridgeState || !bridgeState.globalOnMessageEnabled) {
        return false;
      }

      data = await this.resolveBridgeMessageData({
        data,
        origin: bridgeState.origin || targetOrigin,
      });
      const delivered = bridgeRelay.sendBridgeMessageToUi({
        channel: bridgeState.channel,
        scope,
        data,
        targetOrigin,
      });
      return delivered;
    }

    if (platformEnv.isExtension) {
      const currentSettings = await settingsPersistAtom.get();
      let requestTargetOrigin = targetOrigin;
      if (
        currentSettings.alignPrimaryAccountMode ===
        EAlignPrimaryAccountMode.AlwaysUsePrimaryAccount
      ) {
        requestTargetOrigin = consts.ONEKEY_REQUEST_TO_ALL_CS;
      }
      this.bridgeExtBg?.requestToAllCS(scope, data, requestTargetOrigin);
      return true;
    }

    let delivered = false;
    const bridges = [this.bridge, this.webEmbedBridge].filter(
      (bridge): bridge is JsBridgeBase => Boolean(bridge),
    );

    for (const bridge of bridges) {
      const bridgeOrigin = bridge.remoteInfo?.origin;
      const shouldSend =
        Boolean(bridgeOrigin) &&
        (!targetOrigin || targetOrigin === bridgeOrigin) &&
        bridge.globalOnMessageEnabled;
      if (shouldSend && bridgeOrigin) {
        const payload = await this.resolveBridgeMessageData({
          data,
          origin: bridgeOrigin,
        });
        bridge.requestSync({ scope, data: payload });
        delivered = true;
      }
    }

    return delivered;
  }

  private async flushPendingInjectedBridgeMessages() {
    if (this.isFlushingPendingInjectedBridgeMessages) {
      return;
    }

    this.isFlushingPendingInjectedBridgeMessages = true;
    try {
      this.prunePendingInjectedBridgeMessages();
      const pendingMessages = this.pendingInjectedBridgeMessages.splice(0);
      const undeliveredMessages: typeof pendingMessages = [];

      for (const message of pendingMessages) {
        const delivered = await this.trySendMessagesToInjectedBridge(message);
        if (!delivered) {
          undeliveredMessages.push(message);
        }
      }

      this.pendingInjectedBridgeMessages.unshift(...undeliveredMessages);
      this.prunePendingInjectedBridgeMessages();
    } finally {
      this.isFlushingPendingInjectedBridgeMessages = false;
    }
  }
}
export default BackgroundApiBase;
