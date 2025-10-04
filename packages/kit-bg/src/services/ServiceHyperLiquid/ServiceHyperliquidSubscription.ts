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
  IWsAllMids,
  IWsWebData2,
} from '@onekeyhq/shared/types/hyperliquid/sdk';
import type { IL2BookOptions } from '@onekeyhq/shared/types/hyperliquid/types';
import { ESubscriptionType } from '@onekeyhq/shared/types/hyperliquid/types';

import {
  perpsActiveAccountAtom,
  perpsActiveAssetAtom,
  perpsActiveOrderBookOptionsAtom,
  perpsNetworkStatusAtom,
} from '../../states/jotai/atoms/perps';
import ServiceBase from '../ServiceBase';

import hyperLiquidCache from './hyperLiquidCache';
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
  sdkSubscription: IPerpsSubscription | undefined;
  unsubscribe: () => Promise<void>;
  createdAt: number;
  lastActivity: number;
  isActive: boolean;
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

  updateSubscriptionsDebounced = debounce(
    async () => {
      const activeAccount = await perpsActiveAccountAtom.get();
      const activeAsset = await perpsActiveAssetAtom.get();
      const activeOrderBookOptions =
        await perpsActiveOrderBookOptionsAtom.get();

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
      this.allSubSpecsMap = {
        ...this.allSubSpecsMap,
        ...requiredSubSpecsMap,
      };
      this.pendingSubSpecsMap = {
        ...requiredSubSpecsMap,
      };

      const newState: ISubscriptionState = { ...this._currentState };

      this._applyStateUpdates(newState, params);

      console.log('updateSubscriptions', requiredSubSpecsMap, {
        newState,
        params,
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
    await this.updateSubscriptionsDebounced();
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
      activeSubscriptions: Array.from(this._activeSubscriptions.values())
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

  socketCloseHandler: (event: WebSocketEventMap['close']) => void = (
    event,
    ...args
  ) => {
    const socket = event.target as WebSocket | undefined;
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

  socketErrorHandler: (event: WebSocketEventMap['error']) => void = (
    event,
    ...args
  ) => {
    const socket = event.target as WebSocket | undefined;
    console.log(
      'hyperliquidWebSocket__event__error',
      socket?.readyState,
      args,
      event,
    );
  };

  socketOpenHandler: (event: WebSocketEventMap['open']) => void = async (
    event,
    ...args
  ) => {
    const socket = event.target as WebSocket | undefined;
    console.log(
      'hyperliquidWebSocket__event__open',
      socket?.readyState,
      args,
      event,
    );
    const { connected } = await perpsNetworkStatusAtom.get();
    if (connected === false) {
      // resubscribe when reconnecting
      await this.updateSubscriptionsDebounced();
    }
  };

  socketMessageHandler: (event: WebSocketEventMap['message']) => void = (
    event,
    ...args
  ) => {
    const socket = event.target as WebSocket | undefined;
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
          maxRetries: 9_999_999,
          connectionTimeout: 10_000,
          connectionDelay: (attempt) =>
            // eslint-disable-next-line no-bitwise
            Math.min(~~(1 << attempt) * 150, 5000),
          shouldReconnect: () => true,
        },
      };
      const transport = new WebSocketTransport(transportOptions);
      transport.socket.removeEventListener('close', this.socketCloseHandler);
      transport.socket.addEventListener('close', this.socketCloseHandler);

      transport.socket.removeEventListener('error', this.socketErrorHandler);
      transport.socket.addEventListener('error', this.socketErrorHandler);

      transport.socket.removeEventListener('open', this.socketOpenHandler);
      transport.socket.addEventListener('open', this.socketOpenHandler);

      transport.socket.removeEventListener(
        'message',
        this.socketMessageHandler,
      );
      // transport.socket.addEventListener('message', this.socketMessageHandler);

      const innerClient = new SubscriptionClient({ transport });
      // @ts-ignore
      const hlEventTarget = innerClient.transport._hlEvents;

      const registerSubscriptionHandler = (type: ESubscriptionType) => {
        if (!this.subscriptionHandlerByType[type]) {
          const handleData = (data: unknown) => {
            this._handleSubscriptionData('', data as CustomEvent, type);
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
      registerSubscriptionHandler(ESubscriptionType.ACTIVE_ASSET_CTX);
      registerSubscriptionHandler(ESubscriptionType.ACTIVE_ASSET_DATA);
      registerSubscriptionHandler(ESubscriptionType.ALL_MIDS);
      registerSubscriptionHandler(ESubscriptionType.L2_BOOK);
      registerSubscriptionHandler(ESubscriptionType.USER_FILLS);
      registerSubscriptionHandler(ESubscriptionType.WEB_DATA2);

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
        hlEventTarget,
        wsRequester,
        subscribe,
        unsubscribe,
        async dispose() {
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
        if (this._activeSubscriptions.has(spec.key)) {
          void this._destroySubscription(spec.key);
        }
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
        sdkSubscription,
        unsubscribe: async () => {
          const client = await this.getWebSocketClient();
          await client.unsubscribe(spec.type, spec.params);
        },
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

  private async _destroySubscription(key: string): Promise<void> {
    if (key.includes('l2Book')) {
      // debugger;
    }
    const subscription = this._activeSubscriptions.get(key);
    if (!subscription) {
      return;
    }

    try {
      if (subscription) {
        const removeSub = () => {
          delete this.allSubSpecsMap[key];
          this._activeSubscriptions.delete(key);
        };
        try {
          console.log('destroyUnusedSubscriptions__destroy', key);
          // await sdkSub.unsubscribe();
          await subscription.unsubscribe();
          removeSub();
        } catch (error) {
          const e = error as OneKeyError | undefined;
          console.error(
            `[HyperLiquid WebSocket] unsubscribe() failed for ${key}:`,
            error,
          );
          if (e?.message.includes('Already unsubscribed')) {
            removeSub();
          }
        }
      }
    } catch (error) {
      console.error(
        `[ServiceHyperliquidSubscription.destroySubscription] Failed to destroy subscription ${key}:`,
        error,
      );
    }
  }

  private async _cleanupAllSubscriptions(): Promise<void> {
    const promises = Array.from(this._activeSubscriptions.keys()).map((key) =>
      this._destroySubscription(key).catch((error) => {
        console.error(
          `[ServiceHyperliquidSubscription.cleanupAllSubscriptions] Failed to cleanup subscription ${key}:`,
          error,
        );
      }),
    );
    await Promise.all(promises);
    this._activeSubscriptions.clear();
  }

  subscriptionHandlerByType: Partial<
    Record<ESubscriptionType, (data: unknown) => void>
  > = {};

  private _handleSubscriptionData(
    key: string,
    event: CustomEvent,
    subscriptionType: ESubscriptionType,
  ): void {
    try {
      if (key) {
        const subscription = this._activeSubscriptions.get(key);
        if (subscription) {
          subscription.lastActivity = Date.now();
          this._activeSubscriptions.set(key, subscription);
        }
      }

      const data = event?.detail as unknown;

      if (data == null) {
        console.warn(
          `[ServiceHyperliquidSubscription.handleSubscriptionData] Data validation failed for: ${key}`,
        );
        return;
      }

      const parts = key.split(':');
      const metadata: Record<string, any> = {
        timestamp: Date.now(),
        source: 'ServiceHyperliquidSubscription',
        key,
      };
      if (
        subscriptionType === ESubscriptionType.ACTIVE_ASSET_CTX ||
        subscriptionType === ESubscriptionType.L2_BOOK ||
        subscriptionType === ESubscriptionType.TRADES ||
        subscriptionType === ESubscriptionType.BBO
      ) {
        metadata.coin = parts?.[2];
      } else if (
        subscriptionType === ESubscriptionType.WEB_DATA2 ||
        subscriptionType === ESubscriptionType.USER_FILLS ||
        subscriptionType === ESubscriptionType.USER_EVENTS ||
        subscriptionType === ESubscriptionType.USER_NOTIFICATIONS ||
        subscriptionType === ESubscriptionType.ACTIVE_ASSET_DATA
      ) {
        metadata.userId = parts?.[2];
        if (subscriptionType === ESubscriptionType.ACTIVE_ASSET_DATA) {
          metadata.coin = parts?.[3];
        }
      }

      if (subscriptionType === ESubscriptionType.ALL_MIDS) {
        // TODO remove
        hyperLiquidCache.allMids = data as IWsAllMids;
        void this.backgroundApi.serviceHyperliquid.refreshCurrentMid();
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
          metadata,
        });
      }

      const messageTimestamp = metadata.timestamp ?? Date.now();
      const isFresh =
        Date.now() - messageTimestamp < HYPERLIQUID_NETWORK_INACTIVE_TIMEOUT_MS;
      void perpsNetworkStatusAtom.set((prev) => ({
        ...prev,
        connected: isFresh,
        lastMessageAt: messageTimestamp,
        lastMessageType: subscriptionType,
        lastMessageKey: key,
        activeSubscriptions: this._activeSubscriptions.size,
      }));

      this._scheduleNetworkTimeout(messageTimestamp);
    } catch (error) {
      console.error(
        `[ServiceHyperliquidSubscription.handleSubscriptionData] Failed to handle data for ${key}:`,
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
      void perpsNetworkStatusAtom.set((prev) => ({
        ...prev,
        connected: true,
        lastMessageAt,
      }));
      if (lastMessageAt) {
        this._scheduleNetworkTimeout(lastMessageAt);
      }
      return;
    }

    await perpsNetworkStatusAtom.set((prev) => ({
      ...prev,
      connected: false,
    }));
  }

  private _parseKeyToParams(key: string, type: ESubscriptionType): any {
    const parts = key.split(':');

    switch (type) {
      case ESubscriptionType.ALL_MIDS:
        return {};
      case ESubscriptionType.ACTIVE_ASSET_CTX:
      case ESubscriptionType.TRADES:
      case ESubscriptionType.BBO:
        return { coin: parts[2] };
      case ESubscriptionType.L2_BOOK: {
        const params: any = { coin: parts[2] };
        // Parse additional L2Book parameters from key
        for (let i = 3; i < parts.length; i += 1) {
          const part = parts[i];
          if (part.startsWith('nSigFigs-')) {
            const valueStr = part.substring(9);
            if (valueStr === 'null') {
              params.nSigFigs = null;
            } else {
              const value = parseInt(valueStr, 10);
              params.nSigFigs = Number.isNaN(value) ? null : value;
            }
          } else if (part.startsWith('mantissa-')) {
            const valueStr = part.substring(9);
            if (valueStr === 'null') {
              params.mantissa = null;
            } else {
              const value = parseInt(valueStr, 10);
              params.mantissa = Number.isNaN(value) ? null : value;
            }
          }
        }
        return params;
      }
      case ESubscriptionType.WEB_DATA2:
      case ESubscriptionType.USER_FILLS:
      case ESubscriptionType.USER_EVENTS:
      case ESubscriptionType.USER_NOTIFICATIONS:
        return { user: parts[2] };
      case ESubscriptionType.ACTIVE_ASSET_DATA:
        return { user: parts[2], coin: parts[3] };
      default:
        return {};
    }
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
