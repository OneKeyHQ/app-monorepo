/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment */
/* spell-checker: disable */
import { SubscriptionClient, WebSocketTransport } from '@nktkas/hyperliquid';
import { cloneDeep, debounce, isEmpty } from 'lodash';

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
  IWsAllDexsAssetCtxs,
  IWsAllDexsClearinghouseState,
  IWsOpenOrders,
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

type IHyperliquidWsClient = {
  clientId: string;
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
};

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

  private _client: IHyperliquidWsClient | null = null;

  private _clientInitPromise: Promise<IHyperliquidWsClient> | null = null;

  private _currentState: ISubscriptionState = {
    currentUser: null,
    currentSymbol: '',
    isConnected: false,
    l2BookOptions: undefined,
    enableLedgerUpdates: false,
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
      void this.showToast({
        method: 'error',
        title: 'orderbook coin not matched',
        message: 'Please change the asset',
      });
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
      enableLedgerUpdates: this._currentState.enableLedgerUpdates,
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
      if (isEmpty(this.allSubSpecsMap)) {
        // debugger;
      }
      this.pendingSubSpecsMap = {
        ...requiredSubInfo.requiredSubSpecsMap,
      };

      const newState: ISubscriptionState = { ...this._currentState };

      this._applyStateUpdates(newState, requiredSubInfo.params);

      console.log('updateSubscriptions____state', {
        requiredSubSpecsMap: requiredSubInfo.requiredSubSpecsMap,
        requiredParams: requiredSubInfo.params,
        allSubSpecsMap: this.allSubSpecsMap,
        pendingSubSpecsMap: this.pendingSubSpecsMap,
        newState,
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
  async refreshSubscriptionForUserFills(): Promise<void> {
    const now = Date.now();
    if (
      this.lastRefreshAllPerpsDataAt &&
      now - this.lastRefreshAllPerpsDataAt < 1000
    ) {
      return;
    }
    const requiredSubInfo = await this.buildRequiredSubscriptionsMap();
    if (!requiredSubInfo) {
      return;
    }
    Object.values(requiredSubInfo.requiredSubSpecsMap || {}).forEach((spec) => {
      if (spec.type === ESubscriptionType.USER_FILLS) {
        void (async () => {
          await this._destroySubscription(spec);
          await timerUtils.wait(50);
          await this._createSubscription(spec);
        })();
      }
    });
  }

  lastRefreshAllPerpsDataAt: number | null = null;

  @backgroundMethod()
  async refreshAllPerpsData(): Promise<void> {
    const client = await this.getWebSocketClient();
    if (client?.transport?.socket?.readyState === WebSocket.CLOSED) {
      await this.disconnect();
      await this.getWebSocketClient();
    } else {
      await this._cleanupAllSubscriptions();
      await timerUtils.wait(50);
      console.log('updateSubscriptions__by__refreshAllPerpsData');
      await this.updateSubscriptions();
    }
    this.backgroundApi.serviceHyperliquid._getUserFillsByTimeMemo.clear();
    await perpsTradesHistoryRefreshHookAtom.set({
      refreshHook: Date.now(),
    });
    await perpsCandlesWebviewReloadHookAtom.set({
      reloadHook: Date.now(),
    });
    this.lastRefreshAllPerpsDataAt = Date.now();
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
    console.log('updateSubscriptions__by__resumeSubscriptions');
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
  async enableLedgerUpdatesSubscription(): Promise<void> {
    if (this._currentState.enableLedgerUpdates) {
      return;
    }
    this._currentState.enableLedgerUpdates = true;
    console.log('updateSubscriptions__by__enableLedgerUpdatesSubscription');
    await this.updateSubscriptions();
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
    console.log('hyperliquidWebSocket__event__error', {
      readyState: socket?.readyState,
      code: (event as any)?.code,
      message: (event as any)?.message,
      reason: (event as any)?.reason,
      args,
      event,
    });
  };

  socketCloseHandler: (event: WebSocketEventMap['close']) => void = (
    event,
    ...args
  ) => {
    const socket = event.target as WebSocket | undefined;
    void perpsWebSocketReadyStateAtom.set({ readyState: socket?.readyState });
    console.log('hyperliquidWebSocket__event__close', {
      readyState: socket?.readyState,
      code: event.code,
      reason: event.reason,
      wasClean: event.wasClean,
      args,
      event,
    });
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
    console.log('hyperliquidWebSocket__event__open', {
      readyState: socket?.readyState,
      args,
      event,
    });

    const prevNetworkStatus = await perpsNetworkStatusAtom.get();
    const wasConnected = prevNetworkStatus?.connected;

    await timerUtils.wait(600); // wait network status atom update

    if (wasConnected === false) {
      console.log('updateSubscriptions__by__socketOpen');
      // resubscribe when reconnecting
      await this.updateSubscriptions();
    }

    // Mark connected after handling potential resubscribe.
    await perpsNetworkStatusAtom.set(
      (prev): IPerpsNetworkStatus => ({
        ...prev,
        connected: true,
      }),
    );
    this._currentState.isConnected = true;
  };

  socketMessageHandler: (event: WebSocketEventMap['message']) => void = (
    event,
    ...args
  ) => {
    const socket = event.target as WebSocket | undefined;
    void perpsWebSocketReadyStateAtom.set({ readyState: socket?.readyState });
    console.log('hyperliquidWebSocket__event__message', {
      readyState: socket?.readyState,
      args,
      event,
    });
  };

  private async getWebSocketClient(): Promise<IHyperliquidWsClient> {
    if (this._client) {
      return this._client;
    }
    if (this._clientInitPromise) {
      return this._clientInitPromise;
    }
    this._clientInitPromise = (async () => {
      const clientId = `hl-ws-${Date.now()}-${Math.random()
        .toString(16)
        .slice(2, 8)}`;
      const transportOptions: IWebSocketTransportOptions = {
        url: 'wss://api.hyperliquid.xyz/ws',
        /* spell-checker:disable */
        reconnect: {
          maxRetries: 999,
          connectionTimeout: 5000,
          // eslint-disable-next-line spellcheck/spell-checker
          reconnectionDelay: (
            attempt: number, // spell-checker:disable-line
          ) =>
            // eslint-disable-next-line no-bitwise
            Math.min(~~(1 << attempt) * 150, 8000),
        },
        /* spell-checker:enable */
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
      const innerTransport = transport;
      // @ts-ignore
      const hlEventTarget = innerTransport._hlEvents;

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
        ESubscriptionType.WEB_DATA3,
        ESubscriptionType.ALL_DEXS_CLEARINGHOUSE_STATE,
        ESubscriptionType.OPEN_ORDERS,
        ESubscriptionType.ALL_DEXS_ASSET_CTXS,
        ESubscriptionType.USER_FILLS,
        ESubscriptionType.USER_NON_FUNDING_LEDGER_UPDATES,
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
      const wsRequester = innerTransport._wsRequester as {
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
        clientId,
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
          try {
            transport.socket.close();
          } catch (error) {
            console.error('dispose__transport.socket.close__error', error);
          }
          const disposer = (
            innerClient as unknown as {
              [Symbol.asyncDispose]?: () => Promise<void>;
            }
          )[Symbol.asyncDispose];
          if (disposer) {
            await disposer();
          }
        },
      };
      return this._client;
    })();
    return this._clientInitPromise;
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
      this._clientInitPromise = null;
    }
  }

  private async _createSubscriptionDirect<T extends ESubscriptionType>(
    spec: ISubscriptionSpec<T>,
  ): Promise<IPerpsSubscription | undefined> {
    const client = await this.getWebSocketClient();
    if (!client) {
      return undefined;
    }
    await client.subscribe(spec.type, spec.params);
    return undefined;
  }

  destroyUnusedSubscriptions(): void {
    const toDestroySubscriptions: ISubscriptionSpec<ESubscriptionType>[] = [];
    Object.values(this.allSubSpecsMap).forEach((spec) => {
      if (!this.pendingSubSpecsMap[spec.key]) {
        toDestroySubscriptions.push(spec);
      }
    });
    if (toDestroySubscriptions.length) {
      console.log('toDestroySubscriptions__info', toDestroySubscriptions);
    } else {
      console.log(
        'toDestroySubscriptions__info__no_to_destroy',
        toDestroySubscriptions,
      );
    }
    toDestroySubscriptions.forEach((spec) => {
      console.log('destroyUnusedSubscriptions__destroy___2222', spec.key);
      void this._destroySubscription(spec);
    });
  }

  private _executeSubscriptionChanges(): void {
    console.log('_executeSubscriptionChanges___start');

    const toCreateSubscriptions: ISubscriptionSpec<ESubscriptionType>[] = [];
    Object.values(this.pendingSubSpecsMap).forEach((spec) => {
      if (!this._activeSubscriptions.has(spec.key)) {
        toCreateSubscriptions.push(spec);
      }
    });

    this.destroyUnusedSubscriptions();

    toCreateSubscriptions.forEach((spec) => {
      console.log('destroyUnusedSubscriptions__create', spec.key);
      void this._createSubscription(spec);
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

    const addSubCache = () => {
      if (!this.allSubSpecsMap[spec.key]) {
        this.allSubSpecsMap[spec.key] = spec;
      }
      if (!this.pendingSubSpecsMap[spec.key]) {
        this.pendingSubSpecsMap[spec.key] = spec;
      }
    };

    if (this._activeSubscriptions.has(spec.key)) {
      addSubCache();
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
      addSubCache();
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
          if (!client) {
            return;
          }
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
        this._emitHyperliquidDataUpdate(subscriptionType, data);
        return;
      }
      if (subscriptionType === ESubscriptionType.ALL_DEXS_CLEARINGHOUSE_STATE) {
        const stateData = data as IWsAllDexsClearinghouseState;
        const statePair =
          stateData.clearinghouseStates?.find(
            ([name]) => name === '', // Hyperliquid perps is empty string
          ) || stateData.clearinghouseStates?.[0];
        if (statePair) {
          void this.backgroundApi.serviceHyperliquid.updateActiveAccountSummaryFromClearinghouseState(
            stateData,
          );
        }
        this._emitHyperliquidDataUpdate(subscriptionType, data);
        return;
      }

      if (subscriptionType === ESubscriptionType.ACTIVE_ASSET_CTX) {
        void this.backgroundApi.serviceHyperliquid.updateActiveAssetCtx(
          data as IWsActiveAssetCtx,
        );
      } else if (subscriptionType === ESubscriptionType.ACTIVE_ASSET_DATA) {
        void this.backgroundApi.serviceHyperliquid.updateActiveAssetData(
          data as IPerpsActiveAssetDataRaw,
        );
      } else if (subscriptionType === ESubscriptionType.USER_FILLS) {
        const userFills = data as IWsUserFills;
        if (!userFills.isSnapshot && userFills.fills?.length > 0) {
          void this.backgroundApi.serviceHyperliquid.appendTradesHistory(
            userFills.fills,
            userFills.user,
          );
        }
        this._emitHyperliquidDataUpdate(subscriptionType, data);
      } else if (subscriptionType === ESubscriptionType.OPEN_ORDERS) {
        this._emitHyperliquidDataUpdate(
          subscriptionType,
          data as IWsOpenOrders,
        );
      } else if (subscriptionType === ESubscriptionType.ALL_DEXS_ASSET_CTXS) {
        this._emitHyperliquidDataUpdate(
          subscriptionType,
          data as IWsAllDexsAssetCtxs,
        );
      } else {
        this._emitHyperliquidDataUpdate(subscriptionType, data);
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

  private _emitHyperliquidDataUpdate(
    subscriptionType: ESubscriptionType,
    data: unknown,
  ): void {
    appEventBus.emit(EAppEventBusNames.HyperliquidDataUpdate, {
      type: SUBSCRIPTION_TYPE_INFO[subscriptionType].eventType,
      subType: subscriptionType,
      data,
    });
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
