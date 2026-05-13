/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment */
/* spell-checker: disable */
// cspell:ignore rews
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
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import {
  HYPERLIQUID_NETWORK_INACTIVE_TIMEOUT_MS,
  HYPERLIQUID_REFRESH_DATA_FLOW_THRESHOLD_MS,
} from '@onekeyhq/shared/types/hyperliquid/perp.constants';
import type {
  IHex,
  IHyperliquidEventTarget,
  IPerpsActiveAssetDataRaw,
  IPerpsSubscription,
  IPerpsSubscriptionParams,
  IWebSocketTransportOptions,
  IWsActiveAssetCtx,
  IWsActiveSpotAssetCtx,
  IWsAllDexsAssetCtxs,
  IWsAllDexsClearinghouseState,
  IWsAllMids,
  IWsOpenOrders,
  IWsSpotAssetCtxs,
  IWsSpotState,
  IWsUserFills,
  IWsWebData2,
  IWsWebData3,
} from '@onekeyhq/shared/types/hyperliquid/sdk';
import type {
  EHyperLiquidAbstractionMode,
  IL2BookOptions,
} from '@onekeyhq/shared/types/hyperliquid/types';
import { ESubscriptionType } from '@onekeyhq/shared/types/hyperliquid/types';

import { devSettingsPersistAtom } from '../../states/jotai/atoms';
import {
  perpsAbstractionModeAtom,
  perpsActiveAccountAtom,
  perpsActiveAssetAtom,
  perpsActiveOrderBookOptionsAtom,
  perpsCandlesWebviewReloadHookAtom,
  perpsNetworkStatusAtom,
  perpsTradesHistoryRefreshHookAtom,
  perpsWebSocketDataUpdateTimesAtom,
  perpsWebSocketReadyStateAtom,
  tradingModeAtom,
} from '../../states/jotai/atoms/perps';
import { spotActiveAssetAtom } from '../../states/jotai/atoms/spot';
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
    spotEnabled: true, // default true — SPOT_STATE needed for total account value from first connection
    spotAssetCtxsEnabled: false,
    currentSpotSymbol: undefined,
    tradingMode: 'perp',
  };

  private _networkTimeoutTimer: ReturnType<typeof setTimeout> | null = null;

  private _pingIntervalTimer: ReturnType<typeof setInterval> | null = null;

  private _lastMessageAt: number | null = null;

  private _postOpenDataCheckTimer: ReturnType<typeof setTimeout> | null = null;

  private _postOpenDataCheckRetries = 0;

  private static readonly POST_OPEN_DATA_CHECK_MAX_RETRIES = 3;

  allSubSpecsMap: Record<string, ISubscriptionSpec<ESubscriptionType>> = {};

  pendingSubSpecsMap: Record<string, ISubscriptionSpec<ESubscriptionType>> = {};

  private _activeSubscriptions = new Map<string, IActiveSubscription>();

  // OK-53014: Extension-only defensive watcher.
  //
  // Context: On browser extension cold start (e.g. create wallet in popup
  // then expand to large-screen tab), UI-to-background atom sync is an async
  // IPC round-trip.  socketOpenHandler() calls updateSubscriptions() before
  // perpsActiveAccountAtom / perpsActiveAssetAtom / perpsActiveOrderBookOptionsAtom
  // have arrived from the freshly-mounted UI, so calculateRequiredSubscriptions()
  // silently skips all user-/symbol-gated subscriptions and the user sees
  // everything except the K-line iframe stuck in loading.
  //
  // Fix: subscribe to the three atoms that gate subscription creation and
  // re-run updateSubscriptions() whenever any of them changes while the
  // socket is OPEN.  updateSubscriptions() is debounced(300ms) + idempotent
  // via diff, so redundant fires are coalesced.
  //
  // Scope: extension only — other platforms run UI and background in the
  // same JS process where atom writes are effectively synchronous, so the
  // IPC race does not apply.
  private _subscriptionAtomsUnsubs: Array<() => void> = [];

  private _subscriptionLifecycleVersion = 0;

  private _watchSubscriptionAtoms(): void {
    if (!platformEnv.isExtension) {
      return;
    }
    this._unwatchSubscriptionAtoms();

    const handler = () => {
      const client = this._client;
      if (!client || client.transport?.socket?.readyState !== WebSocket.OPEN) {
        return;
      }
      console.log('updateSubscriptions__by__atomWatcher');
      void this.updateSubscriptions();
    };

    this._subscriptionAtomsUnsubs = [
      perpsActiveAccountAtom.sub(handler),
      perpsActiveAssetAtom.sub(handler),
      perpsActiveOrderBookOptionsAtom.sub(handler),
    ];
  }

  private _unwatchSubscriptionAtoms(): void {
    for (const unsub of this._subscriptionAtomsUnsubs) {
      try {
        unsub();
      } catch (e) {
        console.error('unwatchSubscriptionAtoms failed', e);
      }
    }
    this._subscriptionAtomsUnsubs = [];
  }

  async buildRequiredSubscriptionsMap() {
    const client = await this.getWebSocketClient();
    if (client?.transport?.socket?.readyState !== WebSocket.OPEN) {
      return;
    }

    const activeAccount = await perpsActiveAccountAtom.get();
    const activeAsset = await perpsActiveAssetAtom.get();
    const spotActiveAsset = await spotActiveAssetAtom.get();
    const currentMode = (await tradingModeAtom.get()) ?? 'perp';
    const currentCoin =
      currentMode === 'spot' ? spotActiveAsset?.coin : activeAsset?.coin;
    const currentAssetId =
      currentMode === 'spot' ? spotActiveAsset?.assetId : activeAsset?.assetId;
    let activeOrderBookOptions = await perpsActiveOrderBookOptionsAtom.get();

    if (
      activeOrderBookOptions?.coin &&
      activeOrderBookOptions?.coin !== currentCoin
    ) {
      const syncedOptions = {
        ...activeOrderBookOptions,
        coin: currentCoin,
        assetId: currentAssetId,
      };
      await perpsActiveOrderBookOptionsAtom.set(syncedOptions);
      activeOrderBookOptions = syncedOptions;
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
    const currentSpotSymbol = spotActiveAsset?.coin || undefined;
    const params: ISubscriptionState = {
      isConnected,
      l2BookOptions,
      currentSymbol: currentCoin,
      currentUser: activeAccount?.accountAddress,
      enableLedgerUpdates: this._currentState.enableLedgerUpdates,
      spotEnabled: this._currentState.spotEnabled,
      spotAssetCtxsEnabled: this._currentState.spotAssetCtxsEnabled,
      currentSpotSymbol,
      tradingMode: currentMode,
    };

    const requiredSubSpecsMap = calculateRequiredSubscriptionsMap(params);

    return { requiredSubSpecsMap, params };
  }

  private _hasInitialSubscription = false;

  private async _updateSubscriptionsCore() {
    if (this.subscriptionsHandlerDisabled) {
      return;
    }
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

    this._emitConnectionStatus();
    this._executeSubscriptionChanges();

    this._currentState = newState;
  }

  _updateSubscriptionsDebounced = debounce(
    async () => {
      await this._updateSubscriptionsCore();
    },
    300,
    {
      leading: false,
      trailing: true,
    },
  );

  @backgroundMethod()
  async updateSubscriptions(): Promise<void> {
    // Skip debounce on first subscription to speed up initial load
    if (!this._hasInitialSubscription) {
      this._hasInitialSubscription = true;
      await this._updateSubscriptionsCore();
      return;
    }
    await this._updateSubscriptionsDebounced();
  }

  @backgroundMethod()
  async refreshSubscriptionForUserFills(): Promise<void> {
    const lifecycleVersion = this._subscriptionLifecycleVersion;
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
    const tasks = Object.values(requiredSubInfo.requiredSubSpecsMap || [])
      .filter((spec) => spec.type === ESubscriptionType.USER_FILLS)
      .map(async (spec) => {
        await this._destroySubscription(spec);
        await timerUtils.wait(50);
        if (
          this.subscriptionsHandlerDisabled ||
          lifecycleVersion !== this._subscriptionLifecycleVersion
        ) {
          return;
        }
        const latestRequiredSubInfo =
          await this.buildRequiredSubscriptionsMap();
        if (
          lifecycleVersion !== this._subscriptionLifecycleVersion ||
          !latestRequiredSubInfo?.requiredSubSpecsMap?.[spec.key]
        ) {
          return;
        }
        await this._createSubscription(spec);
      });
    await Promise.all(tasks);
  }

  lastRefreshAllPerpsDataAt: number | null = null;

  @backgroundMethod()
  async refreshAllPerpsData(): Promise<boolean> {
    const client = await this.getWebSocketClient();
    const isSocketOpen =
      client?.transport?.socket?.readyState === WebSocket.OPEN;
    const isDataFlowing =
      this._lastMessageAt !== null &&
      this._lastMessageAt !== undefined &&
      Date.now() - this._lastMessageAt <
        HYPERLIQUID_REFRESH_DATA_FLOW_THRESHOLD_MS;

    void this.backgroundApi.serviceHyperliquid.updatePerpsConfigByServerSilently(
      {
        ignoreCache: true,
      },
    );
    if (isSocketOpen && isDataFlowing) {
      // connection is healthy, no-op — just show pull-to-refresh animation
      await timerUtils.wait(3000);
      return false;
    }

    if (!isSocketOpen) {
      // socket is closed or not available, full reconnect needed
      await this.disconnect();
      await this.getWebSocketClient();
    } else {
      // socket is open but no recent data (possible half-open), rebuild subscriptions
      await this._cleanupAllSubscriptions();
      await timerUtils.wait(50);
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
    return true;
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
    this._postOpenDataCheckRetries = 0;
    console.log('updateSubscriptions__by__resumeSubscriptions');

    const client = await this.getWebSocketClient();
    if (client?.transport?.socket?.readyState !== WebSocket.OPEN) {
      console.log('resumeSubscriptions__force_reconnect_transport');
      await this._forceReconnectTransport();
    } else {
      // OK-53014: re-install atom watcher since pauseSubscriptions() tore
      // it down.  The socket is still OPEN here, so socketOpenHandler will
      // not fire again to reinstall it for us.
      this._watchSubscriptionAtoms();
      await this.updateSubscriptions();
    }
  }

  @backgroundMethod()
  async pauseSubscriptions(): Promise<void> {
    this._subscriptionLifecycleVersion += 1;
    this._updateSubscriptionsDebounced.cancel();
    this._unwatchSubscriptionAtoms();
    await this.disableSubscriptionsHandler();
    this._clearPostOpenDataCheck();
    this._stopPingLoop();
    await this._cleanupAllSubscriptions();
    // No reloadHook change — iframe WS self-heals on resume
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
    this._currentState.enableLedgerUpdates = true;
    await this.updateSubscriptions();
  }

  @backgroundMethod()
  async setRouteSubscriptionState(params: {
    enableLedgerUpdates: boolean;
    spotAssetCtxsEnabled: boolean;
    spotEnabled: boolean;
  }): Promise<void> {
    // enableLedgerUpdates is a one-way toggle (set true by enableLedgerUpdatesSubscription
    // when user visits Account tab). Never reset to false — planTradeSubscriptions cannot
    // reliably compute this since infoPanelTab is not synced to real tab state.
    this._currentState.enableLedgerUpdates =
      params.enableLedgerUpdates || this._currentState.enableLedgerUpdates;
    this._currentState.spotAssetCtxsEnabled = params.spotAssetCtxsEnabled;
    this._currentState.spotEnabled = params.spotEnabled;
  }

  @backgroundMethod()
  async forceReloadCandlesWebview(): Promise<void> {
    await perpsCandlesWebviewReloadHookAtom.set({
      reloadHook: Date.now(),
    });
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
    this._subscriptionLifecycleVersion += 1;
    this._updateSubscriptionsDebounced.cancel();
    this._unwatchSubscriptionAtoms();
    await this._cleanupAllSubscriptions();
    this._clearNetworkTimeout();
    this._clearPostOpenDataCheck();
    this._stopPingLoop();
    await this._closeClient();
    this._currentState.isConnected = false;
    // Reset so the first post-reconnect updateSubscriptions() skips debounce
    // for fast recovery (critical for iOS foreground resume).
    this._hasInitialSubscription = false;
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
    this._subscriptionLifecycleVersion += 1;
    this._updateSubscriptionsDebounced.cancel();
    this._unwatchSubscriptionAtoms();
    this._stopPingLoop();
    this._clearPostOpenDataCheck();
    await this._cleanupAllSubscriptions();
  }

  // Skip per-subscription unsubscribe to avoid async race where stale
  // _destroySubscription completion deletes newly created tracking entries
  private async _forceReconnectTransport(): Promise<void> {
    this._subscriptionLifecycleVersion += 1;
    this._updateSubscriptionsDebounced.cancel();
    this._unwatchSubscriptionAtoms();
    this._clearPostOpenDataCheck();
    this._clearNetworkTimeout();
    this._stopPingLoop();
    this._activeSubscriptions.clear();
    await this._closeClient();
    this._client = null;
    this._clientInitPromise = null;
    this._currentState.isConnected = false;
    await perpsNetworkStatusAtom.set(
      (prev): IPerpsNetworkStatus => ({ ...prev, connected: false }),
    );
    this._emitConnectionStatus();
    await this.getWebSocketClient();
  }

  private _startPostOpenDataCheck(): void {
    this._clearPostOpenDataCheck();
    if (
      this._postOpenDataCheckRetries >=
      ServiceHyperliquidSubscription.POST_OPEN_DATA_CHECK_MAX_RETRIES
    ) {
      // Stop retrying — rely on transport's built-in backoff
      return;
    }
    const messageAtBefore = this._lastMessageAt;
    this._postOpenDataCheckTimer = setTimeout(async () => {
      this._postOpenDataCheckTimer = null;
      if (
        this._lastMessageAt === messageAtBefore &&
        !this.subscriptionsHandlerDisabled
      ) {
        this._postOpenDataCheckRetries += 1;
        console.log(
          `post_open_data_check__force_reconnect (${this._postOpenDataCheckRetries}/${ServiceHyperliquidSubscription.POST_OPEN_DATA_CHECK_MAX_RETRIES})`,
        );
        await this._forceReconnectTransport();
      } else {
        this._postOpenDataCheckRetries = 0;
      }
    }, 5000);
  }

  private _clearPostOpenDataCheck(): void {
    if (this._postOpenDataCheckTimer) {
      clearTimeout(this._postOpenDataCheckTimer);
      this._postOpenDataCheckTimer = null;
    }
  }

  @backgroundMethod()
  async cancelSubscriptionByType(
    type: ESubscriptionType,
  ): Promise<{ cancelled: boolean }> {
    const specs = Array.from(this._activeSubscriptions.values()).filter(
      (sub) => sub.type === type,
    );

    if (specs.length === 0) {
      return { cancelled: false };
    }

    for (const sub of specs) {
      await this._destroySubscription(sub.spec);
    }

    return { cancelled: true };
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
    ..._args
  ) => {
    const socket = event.target as WebSocket | undefined;
    const readyState = socket?.readyState;
    this._lastReadyState = readyState;
    void perpsWebSocketReadyStateAtom.set({ readyState });
    // WS error event — readyState tracked via perpsWebSocketReadyStateAtom
  };

  socketCloseHandler: (event: WebSocketEventMap['close']) => void = (
    event,
    ..._args
  ) => {
    const socket = event.target as WebSocket | undefined;
    const readyState = socket?.readyState;
    this._lastReadyState = readyState;
    void perpsWebSocketReadyStateAtom.set({ readyState });
    // WS close event — readyState tracked via perpsWebSocketReadyStateAtom
    this._activeSubscriptions.clear();
    this._clearPostOpenDataCheck();
    this._stopPingLoop();
    // OK-53014: WS closed — drop any pending atom-change reconcile.  A new
    // watcher will be installed by socketOpenHandler on the next successful
    // open to catch late-arriving atom writes.
    this._unwatchSubscriptionAtoms();
    void perpsNetworkStatusAtom.set((prev): IPerpsNetworkStatus => {
      return {
        ...prev,
        connected: false,
        pingMs: null,
      };
    });
  };

  socketOpenHandler: (event: WebSocketEventMap['open']) => void = async (
    event,
    ..._args
  ) => {
    // OneKey: defensive try/catch around the entire async handler body.
    // This handler is registered as a WebSocket "open" event listener but its
    // body is async. Any rejection here would become an unhandled promise
    // rejection. While RN routes those to reportError (soft) rather than
    // reportFatalError (fatal), some downstream paths can re-throw on the
    // event loop and turn into a RuntimeScheduler task error → SIGABRT.
    // Catch-all here keeps the WS lifecycle robust regardless of which atom
    // write or update fails.
    try {
      const socket = event.target as WebSocket | undefined;
      const readyState = socket?.readyState;
      this._lastReadyState = readyState;
      // OK-53208: SDK transport wrapper reports readyState=undefined in the
      // open event, which keeps perpsWebSocketConnectedAtom false forever.
      void perpsWebSocketReadyStateAtom.set({
        readyState: readyState ?? WebSocket.OPEN,
      });

      const prevNetworkStatus = await perpsNetworkStatusAtom.get();
      const wasConnected = prevNetworkStatus?.connected;
      const openClient = this._client;

      await timerUtils.wait(600); // wait network status atom update
      const currentClient = this._client;
      if (
        !currentClient ||
        currentClient !== openClient ||
        currentClient.transport?.socket?.readyState !== WebSocket.OPEN ||
        this.subscriptionsHandlerDisabled
      ) {
        return;
      }

      // OK-53014: Install atom watcher BEFORE initial updateSubscriptions so
      // that any atom change arriving in the gap between these two calls is
      // captured and re-triggers a reconcile.
      this._watchSubscriptionAtoms();

      if (!wasConnected) {
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
      this._startPingLoop();

      // Skip initial connect — only notify iframe on reconnection
      if (wasConnected === false && this._lastMessageAt !== null) {
        appEventBus.emit(EAppEventBusNames.PerpsWebSocketRecovered, undefined);
      }

      this._startPostOpenDataCheck();
    } catch (error) {
      defaultLogger.perp.hyperliquid.subscriptionSocketOpenError({ error });
    }
  };

  private _lastReadyState: number | undefined;

  socketMessageHandler: (event: WebSocketEventMap['message']) => void = (
    event,
    ..._args
  ) => {
    const socket = event.target as WebSocket | undefined;
    const readyState = socket?.readyState;
    // Only write readyState atom when it actually changes to avoid
    // triggering downstream re-renders on every WS message
    if (readyState !== this._lastReadyState) {
      this._lastReadyState = readyState;
      void perpsWebSocketReadyStateAtom.set({ readyState });
    }
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

          // oxlint-disable-next-line @cspell/spellchecker
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
            // OneKey: defensive try/catch on the WS message hot path.
            // Hyperliquid streams up to ~10 L2 book updates per second; any
            // synchronous throw inside _handleSubscriptionData (e.g. from a
            // jotai atom setter or a downstream service call) would propagate
            // through SDK's HyperliquidEventTarget.dispatchEvent and surface
            // as a fatal RuntimeScheduler task error → SIGABRT. The void on
            // the inner promise covers async rejections, but a sync throw
            // before the first await can still escape — this catch handles it.
            try {
              void this._handleSubscriptionData(type, data as CustomEvent);
            } catch (error) {
              defaultLogger.perp.hyperliquid.subscriptionHandlerError({
                type,
                error,
              });
            }
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
        ESubscriptionType.BBO,
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
        ESubscriptionType.ACTIVE_SPOT_ASSET_CTX,
        ESubscriptionType.SPOT_STATE,
        ESubscriptionType.SPOT_ASSET_CTXS,
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
      const wsRequester = innerTransport._postRequest as {
        request: (method: string, payload: any) => Promise<void>;
      };
      const subscribe = async <T extends ESubscriptionType>(
        type: T,
        params: IPerpsSubscriptionParams[T],
      ) => {
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
          // OneKey: dispose order matters for orphan-timer cleanup. We must
          // close the underlying socket BEFORE removing OUR listeners — the
          // close() triggers rews's internal `cleanup` listener (registered
          // with { once: true } on close/error/open) which calls clearTimeout
          // on its connection-timeout timer. If we removed listeners first,
          // any in-flight close event might be dropped before rews can clean
          // up its 5s setTimeout, leaving an orphan timer that could fire
          // after dispose and re-trigger the dispatchEvent path (now caught
          // defensively by the rews patch, but harmless cleanup is preferred).
          defaultLogger.perp.hyperliquid.subscriptionTransportDispose({
            clientId,
          });
          try {
            // Close socket first so rews's internal close listener fires and
            // clears its connection-timeout setTimeout.
            transport.socket.close();
          } catch (error) {
            console.error('dispose__transport.socket.close__error', error);
          }
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
          const disposer = (
            innerClient as unknown as {
              [Symbol.asyncDispose]?: () => Promise<void>;
            }
          )[Symbol.asyncDispose];
          if (disposer) {
            try {
              await disposer();
            } catch (error) {
              defaultLogger.perp.hyperliquid.subscriptionInnerClientDisposeError(
                { error },
              );
            }
          }
        },
      };
      return this._client;
    })();
    return this._clientInitPromise;
  }

  private async _closeClient(): Promise<void> {
    this._unwatchSubscriptionAtoms();
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
    toDestroySubscriptions.forEach((spec) => {
      void this._destroySubscription(spec);
    });
  }

  private _executeSubscriptionChanges(): void {
    const toCreateSubscriptions: ISubscriptionSpec<ESubscriptionType>[] = [];
    Object.values(this.pendingSubSpecsMap).forEach((spec) => {
      if (!this._activeSubscriptions.has(spec.key)) {
        toCreateSubscriptions.push(spec);
      }
    });

    this.destroyUnusedSubscriptions();

    toCreateSubscriptions.forEach((spec) => {
      void this._createSubscription(spec);
    });
    // this.destroyUnusedSubscriptions();
  }

  private async _createSubscription<T extends ESubscriptionType>(
    spec: ISubscriptionSpec<T>,
  ): Promise<void> {
    // eslint-disable-next-line no-param-reassign
    spec = cloneDeep(spec);

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
      const _sdkSubscription = await this._createSubscriptionDirect(spec);
      this._activeSubscriptions.set(spec.key, {
        key: spec.key,
        type: spec.type,
        spec,
        createdAt: Date.now(),
        lastActivity: Date.now(),
        isActive: true,
      });
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
  ): Promise<boolean> {
    try {
      if (spec) {
        const removeSubCache = () => {
          delete this.allSubSpecsMap[spec.key];
          this._activeSubscriptions.delete(spec.key);
        };
        try {
          const client = await this.getWebSocketClient();
          if (!client) {
            removeSubCache();
            return true;
          }
          // await sdkSub.unsubscribe();
          await client.unsubscribe(spec.type, spec.params);
          removeSubCache();
          return true;
        } catch (error) {
          const e = error as OneKeyError | undefined;
          console.error(
            `[HyperLiquid WebSocket] unsubscribe() failed for ${spec.key}:`,
            error,
          );
          if (e?.message.includes('Already unsubscribed')) {
            removeSubCache();
            return true;
          }
          return false;
        }
      }
    } catch (error) {
      console.error(
        `[ServiceHyperliquidSubscription.destroySubscription] Failed to destroy subscription ${spec.key}:`,
        error,
      );
    }
    return true;
  }

  private async _cleanupAllSubscriptions(): Promise<void> {
    const allSpecsByKey = new Map<
      string,
      ISubscriptionSpec<ESubscriptionType>
    >();
    [
      ...Object.values(this.allSubSpecsMap),
      ...Object.values(this.pendingSubSpecsMap),
      ...Array.from(this._activeSubscriptions.values() || []).map(
        (subInfo) => subInfo.spec,
      ),
    ].forEach((spec) => {
      allSpecsByKey.set(spec.key, spec);
    });
    const allSpecs: ISubscriptionSpec<ESubscriptionType>[] = Array.from(
      allSpecsByKey.values(),
    );
    // Await all unsubscribes before clearing the active set so that the
    // server has fully acknowledged the teardown before we forget about them.
    const results = await Promise.all(
      allSpecs.map((spec) => this._destroySubscription(spec)),
    );
    const hasUnsubscribeFailure = results.some((success) => !success);
    if (hasUnsubscribeFailure) {
      console.warn(
        '[ServiceHyperliquidSubscription.cleanupAllSubscriptions] Some unsubscribes failed, closing transport to reset server-side subscriptions.',
      );
      await this._closeClient();
    }
    this.allSubSpecsMap = {};
    this.pendingSubSpecsMap = {};
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

  private _showPerpsRenderStats = false;

  async updateDevSettings() {
    const devSettings = await devSettingsPersistAtom.get();
    this._showPerpsRenderStats = !!(
      devSettings.enabled && devSettings.settings?.showPerpsRenderStats
    );
  }

  private async _handleSubscriptionData(
    subscriptionType: ESubscriptionType,
    event: CustomEvent,
  ): Promise<void> {
    try {
      const shouldUpdateWsDataUpdateTimes = this._showPerpsRenderStats;

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

      if (data === null || data === undefined) {
        console.warn(
          `[ServiceHyperliquidSubscription.handleSubscriptionData] Data validation failed for: ${subscriptionType}`,
        );
        return;
      }

      if (subscriptionType === ESubscriptionType.ALL_MIDS) {
        // Cache allMids in background for spot balance USD calculation
        hyperLiquidCache.allMids = data as IWsAllMids;
        const allMidsData = data as { mids?: Record<string, string> };
        if (allMidsData?.mids) {
          void this.backgroundApi.serviceHyperliquid.extractSpotPricesFromAllMids(
            allMidsData.mids,
          );
        }
        // Re-trigger spot calculation if it was deferred (SPOT_STATE arrived before ALL_MIDS)
        void this.backgroundApi.serviceHyperliquid.recalculateSpotTotalUsd();
        // Emit to frontend (PerpsGlobalEffects listens for allMids updates)
        this._emitHyperliquidDataUpdate(subscriptionType, data);
        this._updateNetworkLiveness();
        return;
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
      if (subscriptionType === ESubscriptionType.WEB_DATA3) {
        const webData3 = data as IWsWebData3;
        const { userState } = webData3;
        const userAddress = userState?.user;

        if (userAddress) {
          // SDK 0.32.2 added userState.abstraction field
          const wsAbstraction = userState.abstraction;

          // Account alignment check
          const activeAccount = await perpsActiveAccountAtom.get();
          if (
            activeAccount?.accountAddress?.toLowerCase() !==
            userAddress.toLowerCase()
          ) {
            return;
          }

          if (wsAbstraction) {
            // mode rarely changes, skip redundant atom set + recomputation
            const currentAbstraction = await perpsAbstractionModeAtom.get();
            if (
              currentAbstraction?.mode !== wsAbstraction ||
              currentAbstraction?.accountAddress?.toLowerCase() !==
                userAddress.toLowerCase()
            ) {
              await perpsAbstractionModeAtom.set({
                accountAddress: userAddress.toLowerCase() as IHex,
                mode: wsAbstraction as EHyperLiquidAbstractionMode,
              });
            }
            // Persist to SimpleDb only for non-watch-only accounts
            const isWatcher = activeAccount?.accountId
              ? accountUtils.isWatchingAccount({
                  accountId: activeAccount.accountId,
                })
              : false;
            if (!isWatcher) {
              await this.backgroundApi.simpleDb.perp.setUserAbstractionMode(
                userAddress,
                wsAbstraction,
              );
            }
          }

          // Mode correction (setAbstraction) requires user wallet signature,
          // not agent wallet. It will be handled in the enable trading flow
          // when the user explicitly initiates it. WEB_DATA3 only reads mode.
        }
        return;
      }

      if (subscriptionType === ESubscriptionType.SPOT_STATE) {
        void this.backgroundApi.serviceHyperliquid.updateSpotBalances(
          data as IWsSpotState,
        );
        this._emitHyperliquidDataUpdate(subscriptionType, data);
        this._updateNetworkLiveness();
        return;
      }

      if (subscriptionType === ESubscriptionType.SPOT_ASSET_CTXS) {
        void this.backgroundApi.serviceHyperliquid.updateSpotAssetCtxsMap(
          data as IWsSpotAssetCtxs,
        );
        this._updateNetworkLiveness();
        return;
      }

      if (subscriptionType === ESubscriptionType.ACTIVE_SPOT_ASSET_CTX) {
        void this.backgroundApi.serviceHyperliquid.updateActiveSpotAssetCtx(
          data as IWsActiveSpotAssetCtx,
        );
        this._updateNetworkLiveness();
        return;
      }

      if (subscriptionType === ESubscriptionType.ACTIVE_ASSET_CTX) {
        const coinStr = (data as { coin?: string })?.coin ?? '';
        const isSpotData = coinStr.startsWith('@') || coinStr.includes('/');
        if (isSpotData) {
          // Fallback: some server versions may still send spot data on "activeAssetCtx"
          void this.backgroundApi.serviceHyperliquid.updateActiveSpotAssetCtx(
            data as IWsActiveSpotAssetCtx,
          );
        } else {
          void this.backgroundApi.serviceHyperliquid.updateActiveAssetCtx(
            data as IWsActiveAssetCtx,
          );
        }
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

      // Restart ping loop if not running (e.g. after transport auto-reconnect
      // where socketOpenHandler doesn't fire on the new internal socket)
      if (!this._pingIntervalTimer) {
        this._startPingLoop();
      }

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

  private _lastLivenessAtomUpdate = 0;

  private _updateNetworkLiveness() {
    const now = Date.now();
    if (!this._pingIntervalTimer) {
      this._startPingLoop();
    }
    // Throttle atom writes to at most once per 5 seconds to avoid
    // excessive re-renders from high-frequency events like ALL_MIDS
    if (now - this._lastLivenessAtomUpdate > 5000) {
      this._lastLivenessAtomUpdate = now;
      void perpsNetworkStatusAtom.set(
        (prev): IPerpsNetworkStatus => ({
          ...prev,
          connected: true,
          lastMessageAt: now,
        }),
      );
    }
    this._scheduleNetworkTimeout(now);
  }

  private _scheduleNetworkTimeout(messageTimestamp: number): void {
    this._lastMessageAt = messageTimestamp;
    this._postOpenDataCheckRetries = 0;

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

  private async _measurePing(): Promise<void> {
    const client = this._client;
    if (!client) {
      return;
    }
    try {
      const start = Date.now();
      await client.wsRequester.request('ping', undefined);
      // Guard: client may have been replaced/closed during await
      if (this._client !== client) return;
      const pingMs = Date.now() - start;
      void perpsNetworkStatusAtom.set(
        (prev): IPerpsNetworkStatus => ({ ...prev, pingMs }),
      );
    } catch {
      // Ping failed — clear displayed value without marking disconnected
      void perpsNetworkStatusAtom.set(
        (prev): IPerpsNetworkStatus => ({ ...prev, pingMs: null }),
      );
    }
  }

  private _startPingLoop(): void {
    this._stopPingLoop();
    // Measure immediately on connect, then periodically
    void this._measurePing();
    this._pingIntervalTimer = setInterval(() => {
      void this._measurePing();
    }, 3000);
  }

  private _stopPingLoop(): void {
    if (this._pingIntervalTimer) {
      clearInterval(this._pingIntervalTimer);
      this._pingIntervalTimer = null;
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
