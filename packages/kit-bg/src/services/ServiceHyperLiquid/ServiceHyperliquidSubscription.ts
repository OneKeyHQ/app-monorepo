/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment */
import { SubscriptionClient, WebSocketTransport } from '@nktkas/hyperliquid';
import { cloneDeep, debounce } from 'lodash';

import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import type { OneKeyError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { HYPERLIQUID_NETWORK_INACTIVE_TIMEOUT_MS } from '@onekeyhq/shared/types/hyperliquid/perp.constants';
import type {
  IHex,
  IHyperliquidEventTarget,
  IPerpsActiveAssetDataRaw,
  IPerpsSubscription,
  IPerpsSubscriptionParams,
  IWebSocketTransportOptions,
  IWsActiveAssetCtx,
  IWsUserFills,
  IWsWebData2,
} from '@onekeyhq/shared/types/hyperliquid/sdk';
import type { IL2BookOptions } from '@onekeyhq/shared/types/hyperliquid/types';
import { ESubscriptionType } from '@onekeyhq/shared/types/hyperliquid/types';

import { devSettingsPersistAtom } from '../../states/jotai/atoms';
import {
  perpsActiveAccountAtom,
  perpsActiveAssetAtom,
  perpsActiveOrderBookOptionsAtom,
  perpsCandlesWebviewReloadHookAtom,
  perpsNetworkStatusAtom,
  perpsTradesHistoryRefreshHookAtom,
  perpsWebSocketDataUpdateTimesAtom,
  perpsWebSocketReadyStateAtom,
} from '../../states/jotai/atoms/perps';
import ServiceBase from '../ServiceBase';

import {
  SUBSCRIPTION_TYPE_INFO,
  calculateRequiredSubscriptionsMap,
} from './utils/SubscriptionConfig';

import type {
  ISubscriptionSpec,
  ISubscriptionState,
} from './utils/SubscriptionConfig';
import type { IBackgroundApi } from '../../apis/IBackgroundApi';
import type {
  IPerpsActiveOrderBookOptionsAtom,
  IPerpsNetworkStatus,
} from '../../states/jotai/atoms/perps';

interface IActiveSubscription {
  key: string;
  type: ESubscriptionType;
  createdAt: number;
  lastActivity: number;
  isActive: boolean;
  spec: ISubscriptionSpec<ESubscriptionType>;
}

interface ISubscriptionUpdateParams {
  currentUser?: IHex | null;
  currentSymbol?: string;
  isConnected?: boolean;
  l2BookOptions?: IL2BookOptions | null;
}

@backgroundClass()
export default class ServiceHyperliquidSubscription extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: IBackgroundApi }) {
    super({ backgroundApi });
  }

  private _client: {
    transport: WebSocketTransport;
    dispose: () => Promise<void>;
    hlEventTarget: IHyperliquidEventTarget;
    wsRequester: {
      request: (method: string, payload: any) => Promise<void>;
    };
    subscribe: <T extends ESubscriptionType>(
      type: T,
      params: IPerpsSubscriptionParams[T],
    ) => Promise<void>;
    unsubscribe: <T extends ESubscriptionType>(
      type: T,
      params: IPerpsSubscriptionParams[T],
    ) => Promise<void>;
  } | null = null;

  private _currentState: ISubscriptionState = {
    currentUser: null,
    currentSymbol: '',
    isConnected: false,
    l2BookOptions: undefined,
  };

  private _networkTimeoutTimer: ReturnType<typeof setTimeout> | null = null;

  private _lastMessageAt: number | null = null;

  allSubSpecsMap: Record<string, ISubscriptionSpec<ESubscriptionType>> = {};

  pendingSubSpecsMap: Record<string, ISubscriptionSpec<ESubscriptionType>> = {};

  private _activeSubscriptions = new Map<string, IActiveSubscription>();

  async buildRequiredSubscriptionsMap() {
    const client = await this.getWebSocketClient();
    if (client?.transport?.socket?.readyState !== WebSocket.OPEN) {
      return;
    }

    const activeAccount = await perpsActiveAccountAtom.get();
    const activeAsset = await perpsActiveAssetAtom.get();
    const activeOrderBookOptions = await perpsActiveOrderBookOptionsAtom.get();

    if (
      activeOrderBookOptions?.coin &&
      activeOrderBookOptions?.coin !== activeAsset.coin
    ) {
      console.warn(
        'updateSubscriptionsDebounced ERROR: orderbook coin not matched',
      );
      return;
    }

    // TODO update isConnected by websocket connect/disconnect event
    const isConnected = this._currentState.isConnected;

    // Validate parameters before proceeding
    if (
      activeOrderBookOptions?.mantissa !== undefined &&
      activeOrderBookOptions?.mantissa !== null
    ) {
      if (![2, 5].includes(activeOrderBookOptions?.mantissa)) {
        console.warn(
          '[HyperLiquid WebSocket] Invalid mantissa parameter detected:',
          activeOrderBookOptions?.mantissa,
          'Valid values are: 2, 5, null, undefined. This may cause WebSocket connection issues.',
        );
      }
    }

    const l2BookOptions: IPerpsActiveOrderBookOptionsAtom | undefined =
      activeOrderBookOptions
        ? {
            ...activeOrderBookOptions,
          }
        : undefined;
    delete l2BookOptions?.assetId;
    const params: ISubscriptionState = {
      isConnected,
      l2BookOptions,
      currentSymbol: activeAsset?.coin,
      currentUser: activeAccount?.accountAddress,
    };

    const requiredSubSpecsMap = calculateRequiredSubscriptionsMap(params);
    return { requiredSubSpecsMap, params };
  }

  _updateSubscriptionsDebounced = debounce(
    async () => {
      const requiredSubInfo = await this.buildRequiredSubscriptionsMap();
      if (!requiredSubInfo) {
        return;
      }

      this.allSubSpecsMap = {
        ...this.allSubSpecsMap,
        ...requiredSubInfo.requiredSubSpecsMap,
      };
      this.pendingSubSpecsMap = {
        ...requiredSubInfo.requiredSubSpecsMap,
      };

      const newState: ISubscriptionState = { ...this._currentState };

      this._applyStateUpdates(newState, requiredSubInfo.params);

      console.log('updateSubscriptions', requiredSubInfo.requiredSubSpecsMap, {
        newState,
        params: requiredSubInfo.params,
      });

      this._emitConnectionStatus();
      this._executeSubscriptionChanges();

      this._currentState = newState;
    },
    300,
    {
      leading: false,
      trailing: true,
    },
  );

  @backgroundMethod()
  async updateSubscriptions(): Promise<void> {
    await this._updateSubscriptionsDebounced();
  }

  @backgroundMethod()
  async updateSubscriptionForUserFills(): Promise<void> {
    const requiredSubInfo = await this.buildRequiredSubscriptionsMap();
    if (!requiredSubInfo) {
      return;
    }
    Object.values(requiredSubInfo.requiredSubSpecsMap || {}).forEach((spec) => {
      if (spec.type === ESubscriptionType.USER_FILLS) {
        void (async () => {
          await this._destroySubscription(spec);
          await this._createSubscription(spec);
        })();
      }
    });
  }

  @backgroundMethod()
  async refreshAllPerpsData(): Promise<void> {
    await this.getWebSocketClient();
    await this._cleanupAllSubscriptions();
    await this.updateSubscriptions();
    this.backgroundApi.serviceHyperliquid._getUserFillsByTimeMemo.clear();
    await perpsTradesHistoryRefreshHookAtom.set({
      refreshHook: Date.now(),
    });
    await perpsCandlesWebviewReloadHookAtom.set({
      reloadHook: Date.now(),
    });
    await timerUtils.wait(3000);
  }

  @backgroundMethod()
  async getSubscriptionStatus(): Promise<{
    currentUser: string | null;
    currentSymbol: string;
    isConnected: boolean;
    activeSubscriptions: Array<{
      key: string;
      type: ESubscriptionType;
      createdAt: number;
      lastActivity: number;
      isActive: boolean;
    }>;
  }> {
    return {
      currentUser: this._currentState.currentUser,
      currentSymbol: this._currentState.currentSymbol,
      isConnected: this._currentState.isConnected,
      activeSubscriptions: Array.from(this._activeSubscriptions.values() || [])
        .filter(Boolean)
        .map((sub) => ({
          key: sub.key,
          type: sub.type,
          createdAt: sub.createdAt,
          lastActivity: sub.lastActivity,
          isActive: sub.isActive,
        })),
    };
  }

  @backgroundMethod()
  async resumeSubscriptions(): Promise<void> {
    await this.enableSubscriptionsHandler();
    await this.updateSubscriptions();
    const hookInfo = await perpsCandlesWebviewReloadHookAtom.get();
    if (hookInfo.reloadHook <= -1) {
      await perpsCandlesWebviewReloadHookAtom.set({
        reloadHook: Date.now(),
      });
    }
  }

  @backgroundMethod()
  async pauseSubscriptions(): Promise<void> {
    await this.disableSubscriptionsHandler();
    await this._cleanupAllSubscriptions();

    await perpsCandlesWebviewReloadHookAtom.set({
      reloadHook: -1 * Date.now(),
    });
  }

  hasNewUserFills = false;

  subscriptionsHandlerDisabled = false;

  subscriptionsHandlerDisabledCount = 0;

  @backgroundMethod()
  async disableSubscriptionsHandler(): Promise<void> {
    this.subscriptionsHandlerDisabled = true;
    this.subscriptionsHandlerDisabledCount += 1;
  }

  @backgroundMethod()
  async enableSubscriptionsHandler(): Promise<void> {
    this.subscriptionsHandlerDisabled = false;
    if (this.hasNewUserFills) {
      this.hasNewUserFills = false;
      void perpsTradesHistoryRefreshHookAtom.set({
        refreshHook: Date.now(),
      });
    }
  }

  @backgroundMethod()
  async getSubscriptionsHandlerDisabledCount(): Promise<number> {
    return this.subscriptionsHandlerDisabledCount;
  }

  @backgroundMethod()
  async connect(): Promise<void> {
    await this.getWebSocketClient();
    this._currentState.isConnected = true;
  }

  @backgroundMethod()
  async disconnect(): Promise<void> {
    await this._cleanupAllSubscriptions();
    this._clearNetworkTimeout();
    await this._closeClient();
    this._currentState.isConnected = false;
    this._emitConnectionStatus();
  }

  @backgroundMethod()
  async reconnect(): Promise<void> {
    await this.disconnect();
    await timerUtils.wait(1000);
    await this.connect();
  }

  @backgroundMethod()
  async cleanup(): Promise<void> {
    await this._cleanupAllSubscriptions();
  }

  private _applyStateUpdates(
    state: ISubscriptionState,
    params: ISubscriptionUpdateParams,
  ): void {
    if (params.currentUser !== undefined) {
      state.currentUser = params.currentUser;
    }
    if (params.currentSymbol !== undefined) {
      state.currentSymbol = params.currentSymbol;
    }
    if (params.isConnected !== undefined) {
      state.isConnected = params.isConnected;
    }
    if (params.l2BookOptions !== undefined) {
      state.l2BookOptions = params.l2BookOptions;
    }
  }

  // export interface ISubscriptionSpec<T extends ESubscriptionType> {
  //   readonly type: T;
  //   readonly key: string;
  //   readonly params: IPerpsSubscriptionParams[T];

  socketErrorHandler: (event: WebSocketEventMap['error']) => void = (
    event,
    ...args
  ) => {
    const socket = event.target as WebSocket | undefined;
    void perpsWebSocketReadyStateAtom.set({ readyState: socket?.readyState });
    console.log(
      'hyperliquidWebSocket__event__error',
      socket?.readyState,
      args,
      event,
    );
  };

  socketCloseHandler: (event: WebSocketEventMap['close']) => void = (
    event,
    ...args
  ) => {
    const socket = event.target as WebSocket | undefined;
    void perpsWebSocketReadyStateAtom.set({ readyState: socket?.readyState });
    console.log(
      'hyperliquidWebSocket__event__close',
      socket?.readyState,
      args,
      event,
    );
    this._activeSubscriptions.clear();
    void perpsNetworkStatusAtom.set((prev): IPerpsNetworkStatus => {
      return {
        ...prev,
        connected: false,
      };
    });
  };

  socketOpenHandler: (event: WebSocketEventMap['open']) => void = async (
    event,
    ...args
  ) => {
    const socket = event.target as WebSocket | undefined;
    void perpsWebSocketReadyStateAtom.set({ readyState: socket?.readyState });
    console.log(
      'hyperliquidWebSocket__event__open',
      socket?.readyState,
      args,
      event,
    );

    await timerUtils.wait(600); // wait network status atom update
    const { connected } = await perpsNetworkStatusAtom.get();
    if (connected === false) {
      // resubscribe when reconnecting
      await this.updateSubscriptions();
    }
  };

  socketMessageHandler: (event: WebSocketEventMap['message']) => void = (
    event,
    ...args
  ) => {
    const socket = event.target as WebSocket | undefined;
    void perpsWebSocketReadyStateAtom.set({ readyState: socket?.readyState });
    console.log(
      'hyperliquidWebSocket__event__message',
      socket?.readyState,
      args,
      event,
    );
  };

  private async getWebSocketClient() {
    if (!this._client) {
      const transportOptions: IWebSocketTransportOptions = {
        url: 'wss://api.hyperliquid.xyz/ws',
        reconnect: {
          maxRetries: 999_999_999,
          connectionTimeout: 5000,
          connectionDelay: (attempt) =>
            // eslint-disable-next-line no-bitwise
            Math.min(~~(1 << attempt) * 150, 8000),
          shouldReconnect: () => true,
        },
      };
      const transport = new WebSocketTransport(transportOptions);
      // transport.socket.readyState
      const removeAllSocketEventListeners = () => {
        transport?.socket?.removeEventListener(
          'close',
          this.socketCloseHandler,
        );
        transport?.socket?.removeEventListener(
          'error',
          this.socketErrorHandler,
        );
        transport?.socket?.removeEventListener('open', this.socketOpenHandler);
        transport?.socket?.removeEventListener(
          'message',
          this.socketMessageHandler,
        );
      };
      removeAllSocketEventListeners();
      transport.socket.addEventListener('close', this.socketCloseHandler);
      transport.socket.addEventListener('error', this.socketErrorHandler);
      transport.socket.addEventListener('open', this.socketOpenHandler);
      // transport.socket.addEventListener('message', this.socketMessageHandler);

      const innerClient = new SubscriptionClient({ transport });
      // @ts-ignore
      const hlEventTarget = innerClient.transport._hlEvents;

      const registerSubscriptionHandler = (type: ESubscriptionType) => {
        if (!this.subscriptionHandlerByType[type]) {
          const handleData = (data: unknown) => {
            void this._handleSubscriptionData(type, data as CustomEvent);
          };
          this.subscriptionHandlerByType[type] = handleData;
        }
        hlEventTarget.removeEventListener(
          type,
          this.subscriptionHandlerByType[type],
        );
        hlEventTarget.addEventListener(
          type,
          this.subscriptionHandlerByType[type],
        );
      };
      const allTypes = [
        ESubscriptionType.ALL_MIDS,
        ESubscriptionType.L2_BOOK,
        ESubscriptionType.ACTIVE_ASSET_CTX,
        ESubscriptionType.ACTIVE_ASSET_DATA,
        ESubscriptionType.WEB_DATA2,
        ESubscriptionType.USER_FILLS,
      ];
      const removeAllSubscriptionHandlers = () => {
        allTypes.forEach((type) => {
          if (this.subscriptionHandlerByType[type]) {
            hlEventTarget.removeEventListener(
              type,
              this.subscriptionHandlerByType[type],
            );
          }
        });
      };
      removeAllSubscriptionHandlers();
      allTypes.forEach((type) => {
        registerSubscriptionHandler(type);
      });

      // @ts-ignore
      const wsRequester = innerClient.transport._wsRequester as {
        request: (method: string, payload: any) => Promise<void>;
      };
      // const payload = { type: "activeAssetCtx", ...params };
      console.log('getWebSocketClient__wsRequester', wsRequester);
      const subscribe = async <T extends ESubscriptionType>(
        type: T,
        params: IPerpsSubscriptionParams[T],
      ) => {
        // for (let i = 0; i < 100; i += 1) {
        //   void wsRequester.request('subscribe', {
        //     type,
        //     ...params,
        //   });
        // }
        return wsRequester.request('subscribe', {
          type,
          ...params,
        });
      };
      const unsubscribe = async <T extends ESubscriptionType>(
        type: T,
        params: IPerpsSubscriptionParams[T],
      ) => {
        return wsRequester.request('unsubscribe', {
          type,
          ...params,
        });
      };
      this._client = {
        transport,
        hlEventTarget,
        wsRequester,
        subscribe,
        unsubscribe,
        dispose: async () => {
          try {
            removeAllSocketEventListeners();
          } catch (error) {
            console.error(
              'dispose__removeAllSocketEventListeners__error',
              error,
            );
          }
          try {
            removeAllSubscriptionHandlers();
          } catch (error) {
            console.error(
              'dispose__removeAllSubscriptionHandlers__error',
              error,
            );
          }
          await innerClient[Symbol.asyncDispose]();
        },
      };
    }

    return this._client;
  }

  private async _closeClient(): Promise<void> {
    if (this._client) {
      try {
        // TODO remove all eventListeners
        await this._client.dispose();
      } catch (error) {
        console.error(
          '[ServiceHyperliquidSubscription.closeClient] Failed to close client:',
          error,
        );
      }

      this._client = null;
    }
  }

  private async _createSubscriptionDirect<T extends ESubscriptionType>(
    spec: ISubscriptionSpec<T>,
  ): Promise<IPerpsSubscription | undefined> {
    const client = await this.getWebSocketClient();
    await client.subscribe(spec.type, spec.params);
    return undefined;
  }

  destroyUnusedSubscriptions(): void {
    Object.values(this.allSubSpecsMap).forEach((spec) => {
      if (!this.pendingSubSpecsMap[spec.key]) {
        console.log('destroyUnusedSubscriptions', spec.key);
        void this._destroySubscription(spec);
      }
    });
  }

  private _executeSubscriptionChanges(): void {
    this.destroyUnusedSubscriptions();

    Object.values(this.pendingSubSpecsMap).forEach((spec) => {
      if (!this._activeSubscriptions.has(spec.key)) {
        void this._createSubscription(spec);
      }
    });

    // this.destroyUnusedSubscriptions();
  }

  private async _createSubscription<T extends ESubscriptionType>(
    spec: ISubscriptionSpec<T>,
  ): Promise<void> {
    // eslint-disable-next-line no-param-reassign
    spec = cloneDeep(spec);
    if (spec.key.includes('l2Book')) {
      // debugger;
    }

    if (this._activeSubscriptions.has(spec.key)) {
      console.warn(
        `[ServiceHyperliquidSubscription.createSubscription] Subscription already exists: ${spec.key}`,
      );
      return;
    }

    try {
      console.log('createSubscription', spec.key);
      const sdkSubscription = await this._createSubscriptionDirect(spec);
      this._activeSubscriptions.set(spec.key, {
        key: spec.key,
        type: spec.type,
        spec,
        createdAt: Date.now(),
        lastActivity: Date.now(),
        isActive: true,
      });
      if (spec.key.includes('l2Book')) {
        console.log(
          'createSubscription__done',
          sdkSubscription,
          this._activeSubscriptions,
        );
      }
    } catch (error) {
      console.error(
        `[ServiceHyperliquidSubscription.createSubscription] Failed to create subscription ${spec.type}:`,
        error,
      );
    } finally {
      // this.destroyUnusedSubscriptions();
    }
  }

  private async _destroySubscription(
    spec: ISubscriptionSpec<ESubscriptionType>,
  ): Promise<void> {
    try {
      if (spec) {
        const removeSubCache = () => {
          delete this.allSubSpecsMap[spec.key];
          this._activeSubscriptions.delete(spec.key);
        };
        try {
          console.log('destroyUnusedSubscriptions__destroy', spec.key);
          const client = await this.getWebSocketClient();
          // await sdkSub.unsubscribe();
          await client.unsubscribe(spec.type, spec.params);
          removeSubCache();
        } catch (error) {
          const e = error as OneKeyError | undefined;
          console.error(
            `[HyperLiquid WebSocket] unsubscribe() failed for ${spec.key}:`,
            error,
          );
          if (e?.message.includes('Already unsubscribed')) {
            removeSubCache();
          }
        }
      }
    } catch (error) {
      console.error(
        `[ServiceHyperliquidSubscription.destroySubscription] Failed to destroy subscription ${spec.key}:`,
        error,
      );
    }
  }

  private async _cleanupAllSubscriptions(): Promise<void> {
    const allSpecs: ISubscriptionSpec<ESubscriptionType>[] = [
      ...Object.values(this.allSubSpecsMap),
      ...Object.values(this.pendingSubSpecsMap),
      ...Array.from(this._activeSubscriptions.values() || []).map(
        (subInfo) => subInfo.spec,
      ),
    ];
    allSpecs.forEach((spec) => {
      void this._destroySubscription(spec);
    });
    this._activeSubscriptions.clear();
    void perpsNetworkStatusAtom.set((prev): IPerpsNetworkStatus => {
      return {
        ...prev,
        connected: false,
      };
    });
  }

  subscriptionHandlerByType: Partial<
    Record<ESubscriptionType, (data: unknown) => void>
  > = {};

  private async _handleSubscriptionData(
    subscriptionType: ESubscriptionType,
    event: CustomEvent,
  ): Promise<void> {
    try {
      const devSettings = await devSettingsPersistAtom.get();
      const shouldUpdateWsDataUpdateTimes =
        devSettings.enabled && devSettings.settings?.showPerpsRenderStats;

      if (shouldUpdateWsDataUpdateTimes) {
        void perpsWebSocketDataUpdateTimesAtom.set((prev) => ({
          ...prev,
          wsDataReceiveTimes: prev.wsDataReceiveTimes + 1,
        }));
      }

      if (this.subscriptionsHandlerDisabled) {
        if (subscriptionType === ESubscriptionType.USER_FILLS) {
          const userFills = event?.detail as IWsUserFills;
          const isSnapshot = userFills?.isSnapshot;
          const fillsLength = userFills?.fills?.length;
          console.log(
            'userFills__handleSubscriptionData',
            userFills?.user,
            isSnapshot,
            fillsLength,
            userFills,
          );
          if (userFills?.user && fillsLength > 0 && !isSnapshot) {
            this.hasNewUserFills = true;
          }
        }
        return;
      }

      if (shouldUpdateWsDataUpdateTimes) {
        void perpsWebSocketDataUpdateTimesAtom.set((prev) => ({
          ...prev,
          wsDataUpdateTimes: prev.wsDataUpdateTimes + 1,
        }));
      }

      const data = event?.detail as unknown;

      if (data == null) {
        console.warn(
          `[ServiceHyperliquidSubscription.handleSubscriptionData] Data validation failed for: ${subscriptionType}`,
        );
        return;
      }

      if (subscriptionType === ESubscriptionType.ALL_MIDS) {
        // do nothing
      }
      if (subscriptionType === ESubscriptionType.WEB_DATA2) {
        void this.backgroundApi.serviceHyperliquid.updateActiveAccountSummary(
          data as IWsWebData2,
        );
      }

      if (subscriptionType === ESubscriptionType.ACTIVE_ASSET_CTX) {
        void this.backgroundApi.serviceHyperliquid.updateActiveAssetCtx(
          data as IWsActiveAssetCtx,
        );
      } else if (subscriptionType === ESubscriptionType.ACTIVE_ASSET_DATA) {
        void this.backgroundApi.serviceHyperliquid.updateActiveAssetData(
          data as IPerpsActiveAssetDataRaw,
        );
      } else {
        appEventBus.emit(EAppEventBusNames.HyperliquidDataUpdate, {
          type: SUBSCRIPTION_TYPE_INFO[subscriptionType].eventType,
          subType: subscriptionType,
          data,
        });
      }

      const messageTimestamp = Date.now();

      void perpsNetworkStatusAtom.set(
        (prev): IPerpsNetworkStatus => ({
          ...prev,
          connected: true,
          lastMessageAt: messageTimestamp,
        }),
      );

      this._scheduleNetworkTimeout(messageTimestamp);
    } catch (error) {
      console.error(
        `[ServiceHyperliquidSubscription.handleSubscriptionData] Failed to handle data for ${subscriptionType}:`,
        error,
      );
    }
  }

  private _scheduleNetworkTimeout(messageTimestamp: number): void {
    this._lastMessageAt = messageTimestamp;

    if (this._networkTimeoutTimer) {
      return;
    }

    this._networkTimeoutTimer = setTimeout(() => {
      void this._handleNetworkTimeout();
    }, HYPERLIQUID_NETWORK_INACTIVE_TIMEOUT_MS);
  }

  private _clearNetworkTimeout(): void {
    if (this._networkTimeoutTimer) {
      clearTimeout(this._networkTimeoutTimer);
      this._networkTimeoutTimer = null;
    }
  }

  private async _handleNetworkTimeout(): Promise<void> {
    this._networkTimeoutTimer = null;

    const lastMessageAt = this._lastMessageAt;
    const elapsed = lastMessageAt ? Date.now() - lastMessageAt : Infinity;

    if (elapsed < HYPERLIQUID_NETWORK_INACTIVE_TIMEOUT_MS) {
      void perpsNetworkStatusAtom.set(
        (prev): IPerpsNetworkStatus => ({
          ...prev,
          connected: true,
          lastMessageAt,
        }),
      );
      if (lastMessageAt) {
        this._scheduleNetworkTimeout(lastMessageAt);
      }
      return;
    }

    await perpsNetworkStatusAtom.set(
      (prev): IPerpsNetworkStatus => ({
        ...prev,
        connected: false,
      }),
    );
  }

  private _emitConnectionStatus(): void {
    appEventBus.emit(EAppEventBusNames.HyperliquidConnectionChange, {
      type: 'connection',
      subType: 'datastream',
      data: {
        status: this._currentState.isConnected ? 'connected' : 'disconnected',
        lastConnected: Date.now(),
        service: 'ServiceHyperliquidSubscription',
        activeSubscriptions: this._activeSubscriptions.size,
      },
      metadata: {
        timestamp: Date.now(),
        source: 'ServiceHyperliquidSubscription',
      },
    });
  }

  async dispose(): Promise<void> {
    await this.disconnect();
  }
}
