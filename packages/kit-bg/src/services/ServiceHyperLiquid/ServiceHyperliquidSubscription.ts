/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment */
/* spell-checker: disable */
// cspell:ignore rews
import { SubscriptionClient, WebSocketTransport } from '@nktkas/hyperliquid';
import { cloneDeep, debounce, isEqual } from 'lodash';

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
import {
  markPerpsColdStartPerf,
  markPerpsColdStartPerfOnce,
} from '@onekeyhq/shared/src/performance/perpsColdStartPerf';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { isAppVisible } from '@onekeyhq/shared/src/utils/appVisibility';
import {
  clearTrackedInterval,
  trackedSetInterval,
} from '@onekeyhq/shared/src/utils/timerRegistry';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import {
  HYPERLIQUID_NETWORK_INACTIVE_TIMEOUT_MS,
  HYPERLIQUID_REFRESH_DATA_FLOW_THRESHOLD_MS,
} from '@onekeyhq/shared/types/hyperliquid/perp.constants';
import type {
  IBook,
  IHex,
  IHyperliquidEventTarget,
  IPerpsActiveAssetDataRaw,
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
  IWsTwapStates,
  IWsUserFills,
  IWsUserTwapHistory,
  IWsUserTwapSliceFills,
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
  FastL2Book,
  type IFastL2Frame,
  isFastL2RecoveryCurrent,
  isStaleFastL2TargetError,
  shouldResetFastL2RecoveryAfterFrame,
} from './utils/FastL2Book';
import {
  SUBSCRIPTION_TYPE_INFO,
  calculateRequiredSubscriptionsMap,
  getOrderBookSubscriptionCoin,
  getSubscriptionResumeAction,
  isOrderBookOptionsTargetReady,
  normalizeL2BookForSubscriptionSpec,
} from './utils/SubscriptionConfig';
import {
  PerKeyMutationQueue,
  executeOrderBookSubscriptionTransition,
  executeSubscriptionTasksWithOrderBookPriority,
} from './utils/SubscriptionMutationQueue';
import { LatestSubscriptionReconcileQueue } from './utils/SubscriptionReconcileQueue';

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
  currentSpotSymbol?: string;
  tradingMode?: 'perp' | 'spot';
  isConnected?: boolean;
  l2BookOptions?: IL2BookOptions | null;
  orderBookTransport?: 'l2' | 'l2Book';
}

interface IRequiredSubscriptionInfo {
  requiredSubSpecsMap: Record<string, ISubscriptionSpec<ESubscriptionType>>;
  params: ISubscriptionState;
}

@backgroundClass()
export default class ServiceHyperliquidSubscription extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: IBackgroundApi }) {
    super({ backgroundApi });
    // Drop the heaviest per-account fills memo on critical memory
    // pressure. We deliberately keep the live WebSocket + per-route
    // subscriptions intact: a full disconnect() leaves the foreground
    // Perp page stuck on stale price/orderbook/userFlow data — nothing
    // re-arms updateSubscriptions() while connected=false, so the page
    // appears frozen until the user navigates away and back.
    appEventBus.on(EAppEventBusNames.MemoryPressureWarning, (event) => {
      if (event.level !== 'critical') return;
      this.backgroundApi.serviceHyperliquid._getUserFillsByTimeMemo.clear();
    });
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
    orderBookTransport: 'l2',
  };

  private _networkTimeoutTimer: ReturnType<typeof setTimeout> | null = null;

  private _pingIntervalTimer: ReturnType<typeof setInterval> | null = null;

  private _lastMessageAt: number | null = null;

  // Raw pipe liveness, unlike _lastMessageAt which freezes while the handler
  // is disabled (blur mutes processing, not the stream).
  private _lastFrameAt: number | null = null;

  private _socketOpenedAt: number | null = null;

  private _resumeReconnectPromise: Promise<void> | null = null;

  private _postOpenDataCheckTimer: ReturnType<typeof setTimeout> | null = null;

  private _postOpenDataCheckRetries = 0;

  private static readonly POST_OPEN_DATA_CHECK_MAX_RETRIES = 3;

  private static readonly SUBSCRIPTION_UPDATE_OPEN_WAIT_MS = 3000;

  private _criticalSubscriptionHealthCheckTimer: ReturnType<
    typeof setTimeout
  > | null = null;

  private _reconcileInFlight = false;

  private _resumeRecoveryPromise: Promise<void> | null = null;

  private _subscriptionUpdateRecoveryPromise: Promise<void> | null = null;

  allSubSpecsMap: Record<string, ISubscriptionSpec<ESubscriptionType>> = {};

  pendingSubSpecsMap: Record<string, ISubscriptionSpec<ESubscriptionType>> = {};

  private _activeSubscriptions = new Map<string, IActiveSubscription>();

  private _activeL2BookSpec: ISubscriptionSpec<ESubscriptionType.L2_BOOK> | null =
    null;

  private _fastL2Book: FastL2Book | null = null;

  private _fastL2SubscriptionKey: string | null = null;

  private _fastL2SnapshotTimer: ReturnType<typeof setTimeout> | null = null;

  private _fastL2TargetKey: string | null = null;

  private _fastL2FallbackTargetKey: string | null = null;

  private _fastL2RecoveryAttempts = 0;

  private _fastL2ReconnectAttempted = false;

  private _fastL2RecoveryPromise: Promise<void> | null = null;

  private _fastL2RecoveryGeneration = 0;

  private static readonly FAST_L2_SNAPSHOT_TIMEOUT_MS = 3000;

  private static readonly FAST_L2_RECOVERY_DELAYS_MS = [0, 1000, 3000];

  private static readonly ORDER_BOOK_MUTATION_KEY = 'hyperliquid-order-book';

  private static readonly ORDER_BOOK_STRATEGY: 'fastL2Primary' | 'l2BookOnly' =
    'fastL2Primary';

  // Cross-runtime atom sync can lag behind a reopened socket, leaving current
  // market subscriptions absent while the socket still looks healthy.
  private _subscriptionAtomsUnsubs: Array<() => void> = [];

  private _subscriptionLifecycleVersion = 0;

  private _subscriptionMutationQueue = new PerKeyMutationQueue();

  private _subscriptionReconcileQueue = new LatestSubscriptionReconcileQueue();

  private _destroyingSubscriptionKeys = new Set<string>();

  private _routeSubscriptionStateVersion = 0;

  private _isSubscriptionSpecPending(
    spec: ISubscriptionSpec<ESubscriptionType>,
  ): boolean {
    return Boolean(this.pendingSubSpecsMap[spec.key]);
  }

  private _watchSubscriptionAtoms(): void {
    if (!platformEnv.isExtension && !platformEnv.isNativeBackgroundThread) {
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
      spotActiveAssetAtom.sub(handler),
      tradingModeAtom.sub(handler),
      perpsActiveOrderBookOptionsAtom.sub(handler),
    ];
  }

  private _resetFastL2Book(subscriptionKey?: string): void {
    if (subscriptionKey && this._fastL2SubscriptionKey !== subscriptionKey) {
      return;
    }
    if (this._fastL2SnapshotTimer) {
      clearTimeout(this._fastL2SnapshotTimer);
      this._fastL2SnapshotTimer = null;
    }
    this._fastL2Book = null;
    this._fastL2SubscriptionKey = null;
  }

  private _clearActiveL2BookSpec(subscriptionKey?: string): void {
    if (subscriptionKey && this._activeL2BookSpec?.key !== subscriptionKey) {
      return;
    }
    this._activeL2BookSpec = null;
  }

  private _resetFastL2Recovery(): void {
    this._invalidateFastL2RecoveryTask();
    this._fastL2TargetKey = null;
    this._fastL2FallbackTargetKey = null;
    this._fastL2RecoveryAttempts = 0;
    this._fastL2ReconnectAttempted = false;
  }

  private _invalidateFastL2RecoveryTask(): void {
    this._fastL2RecoveryGeneration += 1;
    this._fastL2RecoveryPromise = null;
  }

  private _prepareFastL2Book(
    spec: ISubscriptionSpec<ESubscriptionType.L2>,
  ): void {
    this._resetFastL2Book();
    if (this._fastL2TargetKey !== spec.key) {
      this._invalidateFastL2RecoveryTask();
      this._fastL2TargetKey = spec.key;
      this._fastL2FallbackTargetKey = null;
      this._fastL2RecoveryAttempts = 0;
      this._fastL2ReconnectAttempted = false;
    }
    this._fastL2SubscriptionKey = spec.key;
    this._fastL2Book = new FastL2Book(spec.params.c, {
      nSigFigs: spec.params.s ?? null,
      mantissa: spec.params.m ?? null,
    });
  }

  private _startFastL2SnapshotTimer(subscriptionKey: string): void {
    if (
      this._fastL2SubscriptionKey !== subscriptionKey ||
      this._fastL2Book?.hasSnapshot
    ) {
      return;
    }
    if (this._fastL2SnapshotTimer) {
      clearTimeout(this._fastL2SnapshotTimer);
    }
    this._fastL2SnapshotTimer = setTimeout(() => {
      if (
        this._fastL2SubscriptionKey === subscriptionKey &&
        !this._fastL2Book?.hasSnapshot
      ) {
        void this._recoverFastL2('snapshot_timeout');
      }
    }, ServiceHyperliquidSubscription.FAST_L2_SNAPSHOT_TIMEOUT_MS);
  }

  private async _recoverFastL2(reason: string): Promise<void> {
    if (this._fastL2RecoveryPromise || !this._fastL2TargetKey) {
      return;
    }

    const targetKey = this._fastL2TargetKey;
    const spec = this.pendingSubSpecsMap[targetKey] as
      | ISubscriptionSpec<ESubscriptionType.L2>
      | undefined;
    if (!spec) {
      return;
    }
    const startedGeneration = this._fastL2RecoveryGeneration;
    const isRecoveryCurrent = () =>
      isFastL2RecoveryCurrent({
        startedGeneration,
        currentGeneration: this._fastL2RecoveryGeneration,
        targetKey,
        currentTargetKey: this._fastL2TargetKey,
        isTargetPending: Boolean(this.pendingSubSpecsMap[targetKey]),
      });

    const recoveryPromise = (async () => {
      const delay =
        ServiceHyperliquidSubscription.FAST_L2_RECOVERY_DELAYS_MS[
          this._fastL2RecoveryAttempts
        ];
      if (delay !== undefined) {
        this._fastL2RecoveryAttempts += 1;
        if (delay > 0) {
          await timerUtils.wait(delay);
        }
        if (!isRecoveryCurrent()) {
          return;
        }
        console.warn(
          `[HyperLiquid WebSocket] Reset Fast L2 subscription: ${reason}`,
        );
        const resetSucceeded = await this._subscriptionMutationQueue.enqueue(
          ServiceHyperliquidSubscription.ORDER_BOOK_MUTATION_KEY,
          async () => {
            if (!isRecoveryCurrent()) {
              return true;
            }
            const destroyed = await this._destroySubscription(spec);
            if (!destroyed) {
              return false;
            }
            if (isRecoveryCurrent()) {
              await this._createSubscription(spec);
            }
            return true;
          },
        );
        if (!resetSucceeded && !this._fastL2ReconnectAttempted) {
          this._fastL2ReconnectAttempted = true;
          await this._forceReconnectTransport();
        }
        return;
      }

      if (!this._fastL2ReconnectAttempted) {
        this._fastL2ReconnectAttempted = true;
        console.warn(
          `[HyperLiquid WebSocket] Reconnect after Fast L2 recovery exhausted: ${reason}`,
        );
        await this._forceReconnectTransport();
        return;
      }

      this._fastL2FallbackTargetKey = targetKey;
      this._resetFastL2Book(targetKey);
      console.warn(
        `[HyperLiquid WebSocket] Fast L2 fallback to l2Book for current target: ${reason}`,
      );
      await this.updateSubscriptions();
    })();
    this._fastL2RecoveryPromise = recoveryPromise;
    try {
      await recoveryPromise;
    } finally {
      if (this._fastL2RecoveryPromise === recoveryPromise) {
        this._fastL2RecoveryPromise = null;
      }
    }
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

  async buildRequiredSubscriptionsMap(): Promise<
    IRequiredSubscriptionInfo | undefined
  > {
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
    const activeOrderBookOptions = await perpsActiveOrderBookOptionsAtom.get();
    if (
      !isOrderBookOptionsTargetReady(currentCoin, activeOrderBookOptions?.coin)
    ) {
      return undefined;
    }
    const isOrderBookOptionsForCurrentCoin =
      Boolean(currentCoin) && activeOrderBookOptions?.coin === currentCoin;

    const isConnected =
      client?.transport?.socket?.readyState === WebSocket.OPEN;

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
      currentCoin
        ? {
            coin: currentCoin,
            assetId: currentAssetId,
            nSigFigs: isOrderBookOptionsForCurrentCoin
              ? (activeOrderBookOptions?.nSigFigs ?? null)
              : null,
            mantissa: isOrderBookOptionsForCurrentCoin
              ? (activeOrderBookOptions?.mantissa ?? null)
              : null,
          }
        : undefined;
    delete l2BookOptions?.assetId;
    const currentSpotSymbol = spotActiveAsset?.coin || undefined;
    const params: ISubscriptionState = {
      isConnected,
      l2BookOptions,
      currentSymbol: currentMode === 'spot' ? activeAsset?.coin : currentCoin,
      currentUser: activeAccount?.accountAddress,
      enableLedgerUpdates: this._currentState.enableLedgerUpdates,
      spotEnabled: this._currentState.spotEnabled,
      spotAssetCtxsEnabled: this._currentState.spotAssetCtxsEnabled,
      currentSpotSymbol,
      tradingMode: currentMode,
      orderBookTransport:
        ServiceHyperliquidSubscription.ORDER_BOOK_STRATEGY === 'l2BookOnly'
          ? 'l2Book'
          : 'l2',
    };

    let requiredSubSpecsMap = calculateRequiredSubscriptionsMap(params);
    const fastL2Spec = Object.values(requiredSubSpecsMap).find(
      (spec) => spec.type === ESubscriptionType.L2,
    );
    if (fastL2Spec?.key === this._fastL2FallbackTargetKey) {
      params.orderBookTransport = 'l2Book';
      requiredSubSpecsMap = calculateRequiredSubscriptionsMap(params);
    }

    return { requiredSubSpecsMap, params };
  }

  private _hasInitialSubscription = false;

  private _shouldUpdateSubscriptionsImmediately(
    params: ISubscriptionState,
  ): boolean {
    if (!this._hasInitialSubscription) {
      return true;
    }

    return (
      params.currentUser !== this._currentState.currentUser ||
      params.currentSymbol !== this._currentState.currentSymbol ||
      params.currentSpotSymbol !== this._currentState.currentSpotSymbol ||
      params.tradingMode !== this._currentState.tradingMode ||
      params.orderBookTransport !== this._currentState.orderBookTransport ||
      !isEqual(
        params.l2BookOptions ?? null,
        this._currentState.l2BookOptions ?? null,
      )
    );
  }

  private async _updateSubscriptionsCore(
    preparedRequiredSubInfo?: IRequiredSubscriptionInfo,
  ) {
    if (this.subscriptionsHandlerDisabled) {
      return;
    }
    const requiredSubInfo =
      preparedRequiredSubInfo ?? (await this.buildRequiredSubscriptionsMap());
    if (!requiredSubInfo) {
      return;
    }

    const staleCriticalTypes = this._getStaleCriticalOpenSubscriptionTypes(
      requiredSubInfo.requiredSubSpecsMap,
    );
    if (staleCriticalTypes.length > 0) {
      console.log(
        `updateSubscriptions__rebuild_stale_critical__${staleCriticalTypes.join(
          ',',
        )}`,
      );
      this._subscriptionLifecycleVersion += 1;
      this._updateSubscriptionsDebounced.cancel();
      this._clearPostOpenDataCheck();
      this._clearCriticalSubscriptionHealthCheck();
      this._hasInitialSubscription = false;
      await this._cleanupAllSubscriptions();
      await timerUtils.wait(50);
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

    this._currentState = newState;
    this._emitConnectionStatus();
    // Armed before the await: a hung subscribe ack keeps
    // _executeSubscriptionChanges pending, so a check scheduled after it never
    // gets armed at all. Must stay below the stale-critical branch above, which
    // bumps _subscriptionLifecycleVersion and would self-invalidate a timer
    // that captured the version before the bump.
    this._scheduleCriticalSubscriptionHealthCheck('update_subscriptions');
    this._reconcileInFlight = true;
    try {
      await this._executeSubscriptionChanges();
    } finally {
      this._reconcileInFlight = false;
      // _executeSubscriptionChanges can reach _forceReconnectTransport, which
      // clears the timer armed above; re-arm so the reconcile still ends with a
      // watchdog carrying the current lifecycle version.
      this._scheduleCriticalSubscriptionHealthCheck('update_subscriptions');
    }
    if (this._activeSubscriptions.size > 0) {
      this._startPostOpenDataCheck();
    }
  }

  private async _enqueueSubscriptionReconcile(): Promise<void> {
    await this._subscriptionReconcileQueue.enqueue(async () => {
      await this._updateSubscriptionsCore();
    });
  }

  _updateSubscriptionsDebounced = debounce(
    async () => {
      await this._enqueueSubscriptionReconcile();
    },
    300,
    {
      leading: false,
      trailing: true,
    },
  );

  @backgroundMethod()
  async updateSubscriptions(): Promise<void> {
    markPerpsColdStartPerf('service_update_subscriptions_start');
    if (this.subscriptionsHandlerDisabled) {
      markPerpsColdStartPerf('service_update_subscriptions_skipped_disabled');
      return;
    }
    const client = await this.getWebSocketClient();
    markPerpsColdStartPerf('service_update_subscriptions_client_ready', {
      clientId: client.clientId,
      readyState: client.transport?.socket?.readyState,
    });
    if (client?.transport?.socket?.readyState !== WebSocket.OPEN) {
      markPerpsColdStartPerf('service_update_subscriptions_socket_not_open', {
        clientId: client.clientId,
        readyState: client.transport?.socket?.readyState,
      });
      await this._recoverNotOpenSocketBeforeSubscriptionUpdate({
        client,
        reason: 'update_subscriptions_not_open',
      });
      return;
    }
    // Skip debounce on first subscription to speed up initial load
    if (!this._hasInitialSubscription) {
      this._hasInitialSubscription = true;
      markPerpsColdStartPerf('service_update_subscriptions_core_first_start');
      await this._enqueueSubscriptionReconcile();
      markPerpsColdStartPerf('service_update_subscriptions_core_first_end');
      return;
    }

    const requiredSubInfo = await this.buildRequiredSubscriptionsMap();
    if (!requiredSubInfo) {
      return;
    }
    if (this._shouldUpdateSubscriptionsImmediately(requiredSubInfo.params)) {
      this._updateSubscriptionsDebounced.cancel();
      this._hasInitialSubscription = true;
      await this._enqueueSubscriptionReconcile();
      markPerpsColdStartPerf('service_update_subscriptions_end');
      return;
    }
    await this._updateSubscriptionsDebounced();
    markPerpsColdStartPerf('service_update_subscriptions_end');
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

  // OS suspension can leave the socket half-dead while readyState still says
  // OPEN; without recent traffic (or a recent open) the pipe cannot be
  // trusted on resume. No evidence at all keeps the legacy reuse path.
  private _isResumeStreamStale(): boolean {
    const lastLifeAt = Math.max(
      this._lastFrameAt ?? 0,
      this._socketOpenedAt ?? 0,
    );
    if (!lastLifeAt) {
      return false;
    }
    return Date.now() - lastLifeAt > HYPERLIQUID_REFRESH_DATA_FLOW_THRESHOLD_MS;
  }

  private _hasRecentDataFlow(): boolean {
    return (
      this._lastMessageAt !== null &&
      this._lastMessageAt !== undefined &&
      Date.now() - this._lastMessageAt <
        HYPERLIQUID_REFRESH_DATA_FLOW_THRESHOLD_MS
    );
  }

  private _markSubscriptionActivity(
    subscriptionType: ESubscriptionType,
    messageTimestamp: number,
  ): void {
    for (const sub of this._activeSubscriptions.values()) {
      if (sub.type === subscriptionType) {
        sub.lastActivity = messageTimestamp;
        sub.isActive = true;
      }
    }
  }

  private _getStaleCriticalOpenSubscriptionTypes(
    requiredSubSpecsMap?: Record<string, ISubscriptionSpec<ESubscriptionType>>,
  ): ESubscriptionType[] {
    if (!platformEnv.isNative && !platformEnv.isNativeBackgroundThread) {
      return [];
    }

    const criticalTypes = new Set<ESubscriptionType>([
      ESubscriptionType.ALL_DEXS_ASSET_CTXS,
      ESubscriptionType.L2_BOOK,
      ESubscriptionType.L2,
    ]);
    const now = Date.now();
    const staleTypes = new Set<ESubscriptionType>();

    for (const sub of this._activeSubscriptions.values()) {
      const isCurrentRequired =
        !requiredSubSpecsMap || Boolean(requiredSubSpecsMap[sub.key]);
      const isPastGracePeriod =
        now - sub.createdAt >= HYPERLIQUID_REFRESH_DATA_FLOW_THRESHOLD_MS;
      const isStale =
        now - sub.lastActivity > HYPERLIQUID_REFRESH_DATA_FLOW_THRESHOLD_MS;
      if (
        criticalTypes.has(sub.type) &&
        isCurrentRequired &&
        isPastGracePeriod &&
        isStale
      ) {
        staleTypes.add(sub.type);
      }
    }

    return Array.from(staleTypes);
  }

  private _getMissingCriticalOpenSubscriptionTypes(
    requiredSubSpecsMap?: Record<string, ISubscriptionSpec<ESubscriptionType>>,
  ): ESubscriptionType[] {
    if (!requiredSubSpecsMap) {
      return [];
    }

    const criticalTypes = new Set<ESubscriptionType>([
      ESubscriptionType.ALL_DEXS_ASSET_CTXS,
      ESubscriptionType.L2_BOOK,
      ESubscriptionType.L2,
    ]);
    const missingTypes = new Set<ESubscriptionType>();
    for (const spec of Object.values(requiredSubSpecsMap)) {
      if (
        criticalTypes.has(spec.type) &&
        !this._activeSubscriptions.has(spec.key)
      ) {
        missingTypes.add(spec.type);
      }
    }
    return Array.from(missingTypes);
  }

  private _hasHealthyOpenSocketDataFlow(
    requiredSubSpecsMap?: Record<string, ISubscriptionSpec<ESubscriptionType>>,
  ): boolean {
    return (
      this._hasRecentDataFlow() &&
      this._getStaleCriticalOpenSubscriptionTypes(requiredSubSpecsMap)
        .length === 0 &&
      this._getMissingCriticalOpenSubscriptionTypes(requiredSubSpecsMap)
        .length === 0
    );
  }

  private _shouldRebuildOpenSocketSubscriptionsOnResume(params?: {
    forceRebuild?: boolean;
    requiredSubSpecsMap?: Record<string, ISubscriptionSpec<ESubscriptionType>>;
  }): boolean {
    if (params?.forceRebuild) {
      return this._activeSubscriptions.size > 0;
    }

    if (!platformEnv.isNative && !platformEnv.isNativeBackgroundThread) {
      return false;
    }

    return (
      this._activeSubscriptions.size > 0 &&
      (!this._hasRecentDataFlow() ||
        this._getStaleCriticalOpenSubscriptionTypes(params?.requiredSubSpecsMap)
          .length > 0 ||
        this._getMissingCriticalOpenSubscriptionTypes(
          params?.requiredSubSpecsMap,
        ).length > 0)
    );
  }

  private _scheduleCriticalSubscriptionHealthCheck(reason: string): void {
    if (!platformEnv.isNative && !platformEnv.isNativeBackgroundThread) {
      return;
    }

    this._clearCriticalSubscriptionHealthCheck();

    const lifecycleVersion = this._subscriptionLifecycleVersion;
    this._criticalSubscriptionHealthCheckTimer = setTimeout(async () => {
      this._criticalSubscriptionHealthCheckTimer = null;
      if (
        this.subscriptionsHandlerDisabled ||
        lifecycleVersion !== this._subscriptionLifecycleVersion
      ) {
        return;
      }

      // The timer is armed before the reconcile awaits, so it can fire while
      // that same reconcile is still pending. Rebuilding here would queue every
      // destroy behind the stalled mutation on the same per-key queue and tear
      // down the healthy subscriptions in the meantime, so wait it out instead.
      if (this._reconcileInFlight) {
        this._scheduleCriticalSubscriptionHealthCheck(
          `${reason}__reconcile_in_flight`,
        );
        return;
      }

      const client = this._client;
      if (client?.transport?.socket?.readyState !== WebSocket.OPEN) {
        return;
      }

      const requiredSubInfo = await this.buildRequiredSubscriptionsMap();
      if (
        this.subscriptionsHandlerDisabled ||
        lifecycleVersion !== this._subscriptionLifecycleVersion ||
        !requiredSubInfo
      ) {
        return;
      }

      // A reconcile can also start while buildRequiredSubscriptionsMap awaits.
      // A plain reconcile does not bump _subscriptionLifecycleVersion, so the
      // guard above cannot catch it, and its subscribes have not landed yet,
      // which biases the checks below toward reporting them missing. The
      // remaining steps are synchronous, so this is the last point a concurrent
      // reconcile can slip in before the rebuild.
      if (this._reconcileInFlight) {
        this._scheduleCriticalSubscriptionHealthCheck(
          `${reason}__reconcile_in_flight`,
        );
        return;
      }

      const missingCriticalTypes =
        this._getMissingCriticalOpenSubscriptionTypes(
          requiredSubInfo.requiredSubSpecsMap,
        );
      const staleCriticalTypes = this._getStaleCriticalOpenSubscriptionTypes(
        requiredSubInfo.requiredSubSpecsMap,
      );

      if (
        missingCriticalTypes.length === 0 &&
        staleCriticalTypes.length === 0
      ) {
        return;
      }

      console.log(
        `critical_subscription_health_check__rebuild__${reason}__missing=${missingCriticalTypes.join(
          ',',
        )}__stale=${staleCriticalTypes.join(',')}`,
      );
      this._subscriptionLifecycleVersion += 1;
      this._updateSubscriptionsDebounced.cancel();
      this._clearPostOpenDataCheck();
      this._hasInitialSubscription = false;
      await this._cleanupAllSubscriptions();
      await timerUtils.wait(50);
      await this.updateSubscriptions();
    }, HYPERLIQUID_REFRESH_DATA_FLOW_THRESHOLD_MS + 1000);
  }

  private _clearCriticalSubscriptionHealthCheck(): void {
    if (this._criticalSubscriptionHealthCheckTimer) {
      clearTimeout(this._criticalSubscriptionHealthCheckTimer);
      this._criticalSubscriptionHealthCheckTimer = null;
    }
  }

  private async _reconcileOpenSocketSubscriptionsOnResume(params?: {
    forceRebuild?: boolean;
    reason?: string;
  }): Promise<void> {
    if (this._resumeRecoveryPromise) {
      await this._resumeRecoveryPromise;
      return;
    }

    this._resumeRecoveryPromise = (async () => {
      const requiredSubInfo = await this.buildRequiredSubscriptionsMap();
      if (
        this._shouldRebuildOpenSocketSubscriptionsOnResume({
          ...params,
          requiredSubSpecsMap: requiredSubInfo?.requiredSubSpecsMap,
        })
      ) {
        const reason = params?.reason ?? 'resumeSubscriptions';
        console.log(`resumeSubscriptions__rebuild_open_socket__${reason}`);
        this._subscriptionLifecycleVersion += 1;
        this._updateSubscriptionsDebounced.cancel();
        this._clearPostOpenDataCheck();
        this._clearCriticalSubscriptionHealthCheck();
        this._hasInitialSubscription = false;
        await this._cleanupAllSubscriptions();
        await timerUtils.wait(50);
      }
      await this.updateSubscriptions();
    })().finally(() => {
      this._resumeRecoveryPromise = null;
    });

    await this._resumeRecoveryPromise;
  }

  private _isSocketClosedOrClosing(): boolean {
    const readyState = this._client?.transport?.socket?.readyState;
    return readyState === WebSocket.CLOSED || readyState === WebSocket.CLOSING;
  }

  private async _reconnectClosedOrClosingSocket(): Promise<boolean> {
    if (!this._isSocketClosedOrClosing()) {
      return false;
    }
    console.log('updateSubscriptions__force_reconnect_closed_socket');
    await this._forceReconnectTransport();
    return true;
  }

  @backgroundMethod()
  async refreshAllPerpsData(): Promise<boolean> {
    const client = await this.getWebSocketClient();
    const isSocketOpen =
      client?.transport?.socket?.readyState === WebSocket.OPEN;
    const requiredSubInfo = isSocketOpen
      ? await this.buildRequiredSubscriptionsMap()
      : undefined;
    const isDataFlowing = this._hasHealthyOpenSocketDataFlow(
      requiredSubInfo?.requiredSubSpecsMap,
    );

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
  async resumeSubscriptions(params?: {
    forceRebuild?: boolean;
    forceReconnect?: boolean;
  }): Promise<void> {
    await this.enableSubscriptionsHandler();
    this._postOpenDataCheckRetries = 0;
    console.log('updateSubscriptions__by__resumeSubscriptions');

    if (params?.forceReconnect) {
      console.log('resumeSubscriptions__force_reconnect_transport__requested');
      await this._forceReconnectTransport();
      return;
    }

    const client = await this.getWebSocketClient();
    const readyState = client?.transport?.socket?.readyState;
    const action = getSubscriptionResumeAction({
      isOpen: readyState === WebSocket.OPEN,
      isClosedOrClosing:
        readyState === WebSocket.CLOSED || readyState === WebSocket.CLOSING,
      isStreamStale: this._isResumeStreamStale(),
    });
    if (action === 'reconnect') {
      console.log('resumeSubscriptions__force_reconnect_transport');
      // Prewarm and AutoPause both fire resume on foreground; single-flight
      // so they cannot race two concurrent transport rebuilds.
      if (!this._resumeReconnectPromise) {
        this._resumeReconnectPromise = this._forceReconnectTransport().finally(
          () => {
            this._resumeReconnectPromise = null;
          },
        );
      }
      await this._resumeReconnectPromise;
      return;
    }
    if (action === 'waitForOpen') {
      return;
    }

    // OK-53014: re-install atom watcher since pauseSubscriptions() tore
    // it down. The socket is already OPEN, so socketOpenHandler will not
    // fire again to reinstall it for us.
    this._watchSubscriptionAtoms();
    await this._reconcileOpenSocketSubscriptionsOnResume({
      forceRebuild: params?.forceRebuild,
      reason: params?.forceRebuild
        ? 'force_rebuild'
        : 'native_resume_stale_data',
    });
  }

  @backgroundMethod()
  async pauseSubscriptions(): Promise<void> {
    this._subscriptionLifecycleVersion += 1;
    this._updateSubscriptionsDebounced.cancel();
    this._unwatchSubscriptionAtoms();
    await this.disableSubscriptionsHandler();
    this._clearPostOpenDataCheck();
    this._clearCriticalSubscriptionHealthCheck();
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
  async enableSubscriptionsHandler(options?: {
    ifDisabledCountAtMost?: number;
  }): Promise<void> {
    // Callers holding a liveness proof pass the disable count they observed
    // when it was captured; a disable landing after that (blur, lock) bumps
    // the count and wins over the now-stale proof. The count is monotonic in
    // this runtime, so no cross-runtime clock comparison is involved.
    if (
      options?.ifDisabledCountAtMost !== undefined &&
      this.subscriptionsHandlerDisabledCount > options.ifDisabledCountAtMost
    ) {
      return;
    }
    this.subscriptionsHandlerDisabled = false;
    if (this.hasNewUserFills) {
      this.hasNewUserFills = false;
      void perpsTradesHistoryRefreshHookAtom.set({
        refreshHook: Date.now(),
      });
    }
  }

  @backgroundMethod()
  async recoverSubscriptionsAfterLivenessProof(params: {
    disabledCount: number;
  }): Promise<boolean> {
    if (this.subscriptionsHandlerDisabledCount > params.disabledCount) {
      return false;
    }
    await this.enableSubscriptionsHandler({
      ifDisabledCountAtMost: params.disabledCount,
    });
    if (this.subscriptionsHandlerDisabled) {
      return false;
    }
    // AutoPause in the UI runtime still reads a stale blur; announce so it
    // drops the pending pause timer that would tear this recovery down.
    appEventBus.emit(EAppEventBusNames.PerpsSubscriptionsRecovered, undefined);
    // A prior pauseSubscriptions() may have unwatched the atoms; reinstall
    // before the reconcile (OK-53014 ordering).
    this._watchSubscriptionAtoms();
    await this.updateSubscriptions();
    return true;
  }

  @backgroundMethod()
  async enableLedgerUpdatesSubscription(): Promise<void> {
    this._currentState.enableLedgerUpdates = true;
    await this.updateSubscriptions();
  }

  @backgroundMethod()
  async setRouteSubscriptionState(params: {
    enableLedgerUpdates: boolean;
    routeStateVersion?: number;
    spotAssetCtxsEnabled: boolean;
    spotEnabled: boolean;
  }): Promise<boolean> {
    // UI effects can overlap across the native bridge; ignore older route
    // flag writes so they cannot silently undo a newer subscription plan.
    if (
      params.routeStateVersion !== undefined &&
      params.routeStateVersion < this._routeSubscriptionStateVersion
    ) {
      return false;
    }
    if (params.routeStateVersion !== undefined) {
      this._routeSubscriptionStateVersion = params.routeStateVersion;
    }
    // enableLedgerUpdates is a one-way toggle (set true by enableLedgerUpdatesSubscription
    // when user visits Account tab). Never reset to false — planTradeSubscriptions cannot
    // reliably compute this since infoPanelTab is not synced to real tab state.
    this._currentState.enableLedgerUpdates =
      params.enableLedgerUpdates || this._currentState.enableLedgerUpdates;
    this._currentState.spotAssetCtxsEnabled = params.spotAssetCtxsEnabled;
    this._currentState.spotEnabled = params.spotEnabled;
    return true;
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
    const client = await this.getWebSocketClient();
    if (await this._reconnectClosedOrClosingSocket()) {
      return;
    }
    const readyState = client.transport?.socket?.readyState;
    if (readyState === WebSocket.OPEN) {
      this._currentState.isConnected = true;
      this._watchSubscriptionAtoms();
      // connect() is an idempotent socket entrypoint; resume-specific rebuilds
      // would penalize normal token switches that only need a target diff.
      if (this._activeSubscriptions.size === 0) {
        await this.updateSubscriptions();
      }
    }
  }

  @backgroundMethod()
  async disconnect(): Promise<void> {
    this.backgroundApi.serviceHyperliquidCache.flushPendingL2BookSnapshotCache();
    this._subscriptionLifecycleVersion += 1;
    this._resetFastL2Book();
    this._resetFastL2Recovery();
    this._updateSubscriptionsDebounced.cancel();
    this._unwatchSubscriptionAtoms();
    await this._cleanupAllSubscriptions();
    this._clearNetworkTimeout();
    this._clearPostOpenDataCheck();
    this._clearCriticalSubscriptionHealthCheck();
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
    this.backgroundApi.serviceHyperliquidCache.flushPendingL2BookSnapshotCache();
    this._subscriptionLifecycleVersion += 1;
    this._resetFastL2Book();
    this._resetFastL2Recovery();
    this._updateSubscriptionsDebounced.cancel();
    this._unwatchSubscriptionAtoms();
    this._stopPingLoop();
    this._clearPostOpenDataCheck();
    this._clearCriticalSubscriptionHealthCheck();
    await this._cleanupAllSubscriptions();
  }

  // Skip per-subscription unsubscribe to avoid async race where stale
  // _destroySubscription completion deletes newly created tracking entries
  private async _forceReconnectTransport(): Promise<void> {
    this.backgroundApi.serviceHyperliquidCache.flushPendingL2BookSnapshotCache();
    this._subscriptionLifecycleVersion += 1;
    this._resetFastL2Book();
    this._updateSubscriptionsDebounced.cancel();
    this._unwatchSubscriptionAtoms();
    this._clearPostOpenDataCheck();
    this._clearCriticalSubscriptionHealthCheck();
    this._clearNetworkTimeout();
    this._stopPingLoop();
    this._activeSubscriptions.clear();
    await this._closeClient();
    this._client = null;
    this._clientInitPromise = null;
    this._currentState.isConnected = false;
    this._hasInitialSubscription = false;
    this._markNetworkStatusPending();
    this._emitConnectionStatus();
    await this.getWebSocketClient();
  }

  private async _recoverNotOpenSocketBeforeSubscriptionUpdate(params: {
    client: IHyperliquidWsClient;
    reason: string;
  }): Promise<void> {
    if (this._subscriptionUpdateRecoveryPromise) {
      await this._subscriptionUpdateRecoveryPromise;
      return;
    }

    this._subscriptionUpdateRecoveryPromise = (async () => {
      const readyState = params.client.transport?.socket?.readyState;
      if (readyState === WebSocket.CLOSED || readyState === WebSocket.CLOSING) {
        await this._forceReconnectTransport();
        return;
      }

      const isOpen = await this._waitForOpenSocket({
        client: params.client,
        timeoutMs:
          ServiceHyperliquidSubscription.SUBSCRIPTION_UPDATE_OPEN_WAIT_MS,
      });
      if (isOpen) {
        this._watchSubscriptionAtoms();
        await this._reconcileOpenSocketSubscriptionsOnResume({
          reason: params.reason,
        });
        await perpsNetworkStatusAtom.set(
          (prev): IPerpsNetworkStatus => ({
            ...prev,
            connected: true,
          }),
        );
        this._currentState.isConnected = true;
        this._startPingLoop();
        return;
      }

      if (
        params.client === this._client &&
        (platformEnv.isNative || platformEnv.isNativeBackgroundThread)
      ) {
        // Native main/BG restart can leave the first sync request racing a
        // stuck CONNECTING transport; recreating it lets socketOpenHandler own
        // the eventual subscription rebuild.
        console.log(
          `updateSubscriptions__force_reconnect_not_open__${params.reason}`,
        );
        await this._forceReconnectTransport();
      }
    })().finally(() => {
      this._subscriptionUpdateRecoveryPromise = null;
    });

    await this._subscriptionUpdateRecoveryPromise;
  }

  private async _waitForOpenSocket(params: {
    client: IHyperliquidWsClient;
    timeoutMs: number;
  }): Promise<boolean> {
    const startedAt = Date.now();
    while (Date.now() - startedAt < params.timeoutMs) {
      if (params.client !== this._client) {
        return false;
      }
      const readyState = params.client.transport?.socket?.readyState;
      if (readyState === WebSocket.OPEN) {
        return true;
      }
      if (readyState === WebSocket.CLOSED || readyState === WebSocket.CLOSING) {
        return false;
      }
      await timerUtils.wait(100);
    }
    return (
      params.client === this._client &&
      params.client.transport?.socket?.readyState === WebSocket.OPEN
    );
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
    if ('currentSpotSymbol' in params) {
      state.currentSpotSymbol = params.currentSpotSymbol;
    }
    if (params.tradingMode !== undefined) {
      state.tradingMode = params.tradingMode;
    }
    if (params.isConnected !== undefined) {
      state.isConnected = params.isConnected;
    }
    if ('l2BookOptions' in params) {
      state.l2BookOptions = params.l2BookOptions;
    }
    if ('orderBookTransport' in params) {
      state.orderBookTransport = params.orderBookTransport;
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
    this._invalidateFastL2RecoveryTask();
    this._resetFastL2Book();
    this._clearPostOpenDataCheck();
    this._stopPingLoop();
    // OK-53014: WS closed — drop any pending atom-change reconcile.  A new
    // watcher will be installed by socketOpenHandler on the next successful
    // open to catch late-arriving atom writes.
    this._unwatchSubscriptionAtoms();
    this._markNetworkStatusPending();
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
      markPerpsColdStartPerfOnce('service_ws_open_first');
      const socket = event.target as WebSocket | undefined;
      const readyState = socket?.readyState;
      this._lastReadyState = readyState;
      // Grace for the stale-stream resume check: a just-opened socket has no
      // messages yet but must not be judged dead.
      this._socketOpenedAt = Date.now();
      // OK-53208: SDK transport wrapper reports readyState=undefined in the
      // open event, which keeps perpsWebSocketConnectedAtom false forever.
      await perpsWebSocketReadyStateAtom.set({
        readyState: readyState ?? WebSocket.OPEN,
      });
      // A new transport retries Fast L2 even if the previous connection had
      // temporarily degraded this target to l2Book.
      this._fastL2FallbackTargetKey = null;
      const prevNetworkStatus = await perpsNetworkStatusAtom.get();
      const wasConnected = prevNetworkStatus?.connected;
      const openClient = this._client;

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

      // Network status may still be connected when the native socket reopens.
      await this.updateSubscriptions();

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
      markPerpsColdStartPerfOnce('service_ws_client_reuse_first', {
        clientId: this._client.clientId,
        readyState: this._client.transport?.socket?.readyState,
      });
      return this._client;
    }
    if (this._clientInitPromise) {
      markPerpsColdStartPerf('service_ws_client_init_join');
      return this._clientInitPromise;
    }
    this._clientInitPromise = (async () => {
      const clientId = `hl-ws-${Date.now()}-${Math.random()
        .toString(16)
        .slice(2, 8)}`;
      markPerpsColdStartPerf('service_ws_client_create_start', {
        clientId,
      });
      const transportOptions: IWebSocketTransportOptions = {
        url: 'wss://api.hyperliquid.xyz/ws',
        // A dropped subscribe ack stalls the whole reconcile for the SDK's 10s
        // default, leaving the order book empty. Keep this at or above
        // reconnect.connectionTimeout so frames rews buffers while the socket
        // is reconnecting still get a chance to flush before aborting.
        timeout: 5000,
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
        ESubscriptionType.L2,
        ESubscriptionType.ACTIVE_ASSET_CTX,
        ESubscriptionType.ACTIVE_ASSET_DATA,
        ESubscriptionType.WEB_DATA2,
        ESubscriptionType.WEB_DATA3,
        ESubscriptionType.ALL_DEXS_CLEARINGHOUSE_STATE,
        ESubscriptionType.OPEN_ORDERS,
        ESubscriptionType.ALL_DEXS_ASSET_CTXS,
        ESubscriptionType.TWAP_STATES,
        ESubscriptionType.USER_TWAP_HISTORY,
        ESubscriptionType.USER_TWAP_SLICE_FILLS,
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
      markPerpsColdStartPerf('service_ws_client_create_end', {
        clientId,
        readyState: transport.socket?.readyState,
      });
      return this._client;
    })();
    return this._clientInitPromise;
  }

  private async _closeClient(): Promise<void> {
    this._invalidateFastL2RecoveryTask();
    this._unwatchSubscriptionAtoms();
    this._clearActiveL2BookSpec();
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
  ): Promise<IHyperliquidWsClient | undefined> {
    const client = await this.getWebSocketClient();
    if (!client) {
      return undefined;
    }
    await client.subscribe(spec.type, spec.params);
    return client;
  }

  async destroyUnusedSubscriptions(): Promise<void> {
    const toDestroySubscriptions: ISubscriptionSpec<ESubscriptionType>[] = [];
    Object.values(this.allSubSpecsMap).forEach((spec) => {
      if (!this.pendingSubSpecsMap[spec.key]) {
        toDestroySubscriptions.push(spec);
      }
    });
    await Promise.all(
      toDestroySubscriptions.map((spec) => this._destroySubscription(spec)),
    );
  }

  private async _executeSubscriptionChanges(): Promise<void> {
    const toDestroySubscriptions: ISubscriptionSpec<ESubscriptionType>[] = [];
    Object.values(this.allSubSpecsMap).forEach((spec) => {
      if (!this.pendingSubSpecsMap[spec.key]) {
        toDestroySubscriptions.push(spec);
      }
    });

    const toCreateSubscriptions: ISubscriptionSpec<ESubscriptionType>[] = [];
    Object.values(this.pendingSubSpecsMap).forEach((spec) => {
      if (
        !this._activeSubscriptions.has(spec.key) ||
        this._destroyingSubscriptionKeys.has(spec.key)
      ) {
        toCreateSubscriptions.push(spec);
      }
    });

    const isOrderBookSpec = (spec: ISubscriptionSpec<ESubscriptionType>) =>
      spec.type === ESubscriptionType.L2 ||
      spec.type === ESubscriptionType.L2_BOOK;
    const orderBookToDestroy = toDestroySubscriptions.filter(isOrderBookSpec);
    const orderBookToCreate = toCreateSubscriptions.filter(isOrderBookSpec);
    const otherTasks = [
      ...toDestroySubscriptions
        .filter((spec) => !isOrderBookSpec(spec))
        .map((spec) => () => this._destroySubscription(spec)),
      ...toCreateSubscriptions
        .filter((spec) => !isOrderBookSpec(spec))
        .map((spec) => () => this._createSubscription(spec)),
    ];

    const orderBookTask = () =>
      orderBookToDestroy.length > 0 || orderBookToCreate.length > 0
        ? executeOrderBookSubscriptionTransition({
            toDestroy: orderBookToDestroy,
            toCreate: orderBookToCreate,
            destroy: (spec) => this._destroySubscription(spec),
            create: (spec) => this._createSubscription(spec),
            isPending: (spec) => this._isSubscriptionSpecPending(spec),
            getConflictKey: (spec) => getOrderBookSubscriptionCoin(spec),
            runExclusive: (task) =>
              this._subscriptionMutationQueue.enqueue(
                ServiceHyperliquidSubscription.ORDER_BOOK_MUTATION_KEY,
                task,
              ),
            reconnect: () => this._forceReconnectTransport(),
          })
        : Promise.resolve(true);

    await executeSubscriptionTasksWithOrderBookPriority({
      orderBookTask,
      otherTasks,
    });
  }

  private async _createSubscription<T extends ESubscriptionType>(
    spec: ISubscriptionSpec<T>,
  ): Promise<void> {
    // eslint-disable-next-line no-param-reassign
    spec = cloneDeep(spec);
    await this._subscriptionMutationQueue.enqueue(spec.key, async () => {
      await this._createSubscriptionLocked(spec);
    });
  }

  private async _createSubscriptionLocked<T extends ESubscriptionType>(
    spec: ISubscriptionSpec<T>,
  ): Promise<void> {
    const addSubCache = () => {
      if (!this.allSubSpecsMap[spec.key]) {
        this.allSubSpecsMap[spec.key] = spec;
      }
      if (!this.pendingSubSpecsMap[spec.key]) {
        this.pendingSubSpecsMap[spec.key] = spec;
      }
    };

    if (!this._isSubscriptionSpecPending(spec)) {
      return;
    }

    if (this._activeSubscriptions.has(spec.key)) {
      addSubCache();
      console.warn(
        `[ServiceHyperliquidSubscription.createSubscription] Subscription already exists: ${spec.key}`,
      );
      return;
    }

    try {
      const lifecycleVersion = this._subscriptionLifecycleVersion;
      if (spec.type === ESubscriptionType.L2) {
        this._prepareFastL2Book(
          spec as ISubscriptionSpec<ESubscriptionType.L2>,
        );
      }
      const client = await this._createSubscriptionDirect(spec);
      const isCreateResultStale =
        this.subscriptionsHandlerDisabled ||
        lifecycleVersion !== this._subscriptionLifecycleVersion ||
        client !== this._client ||
        !this._isSubscriptionSpecPending(spec);
      if (isCreateResultStale) {
        if (client) {
          await this._destroySubscriptionLocked(spec, client, {
            removeCache:
              this.subscriptionsHandlerDisabled ||
              !this._isSubscriptionSpecPending(spec),
          });
        }
        return;
      }
      this._activeSubscriptions.set(spec.key, {
        key: spec.key,
        type: spec.type,
        spec,
        createdAt: Date.now(),
        lastActivity: Date.now(),
        isActive: true,
      });
      if (spec.type === ESubscriptionType.L2_BOOK) {
        this._activeL2BookSpec =
          spec as ISubscriptionSpec<ESubscriptionType.L2_BOOK>;
      }
      if (spec.type === ESubscriptionType.L2) {
        this._startFastL2SnapshotTimer(spec.key);
      }
    } catch (error) {
      this._resetFastL2Book(spec.key);
      console.error(
        `[ServiceHyperliquidSubscription.createSubscription] Failed to create subscription ${spec.type}:`,
        error,
      );
      if (spec.type === ESubscriptionType.L2) {
        setTimeout(() => {
          void this._recoverFastL2('subscribe_failed');
        }, 0);
      }
    } finally {
      if (
        !this.subscriptionsHandlerDisabled &&
        this._isSubscriptionSpecPending(spec)
      ) {
        addSubCache();
      }
    }
  }

  private async _destroySubscription(
    spec: ISubscriptionSpec<ESubscriptionType>,
    targetClient?: IHyperliquidWsClient,
    options?: { removeCache?: boolean },
  ): Promise<boolean> {
    return this._subscriptionMutationQueue.enqueue(spec.key, async () =>
      this._destroySubscriptionLocked(spec, targetClient, options),
    );
  }

  private async _destroySubscriptionLocked(
    spec: ISubscriptionSpec<ESubscriptionType>,
    targetClient?: IHyperliquidWsClient,
    options?: { removeCache?: boolean },
  ): Promise<boolean> {
    try {
      if (spec) {
        if (spec.type === ESubscriptionType.L2) {
          this._resetFastL2Book(spec.key);
        }
        const shouldRemoveCache = options?.removeCache ?? true;
        const clearActiveL2BookSpec = () => {
          if (spec.type === ESubscriptionType.L2_BOOK) {
            this._clearActiveL2BookSpec(spec.key);
          }
        };
        const removeSubCache = () => {
          if (!shouldRemoveCache) {
            return;
          }
          delete this.allSubSpecsMap[spec.key];
          this._activeSubscriptions.delete(spec.key);
        };
        try {
          this._destroyingSubscriptionKeys.add(spec.key);
          const client = targetClient ?? (await this.getWebSocketClient());
          if (!client) {
            clearActiveL2BookSpec();
            removeSubCache();
            return true;
          }
          // await sdkSub.unsubscribe();
          await client.unsubscribe(spec.type, spec.params);
          clearActiveL2BookSpec();
          removeSubCache();
          return true;
        } catch (error) {
          const e = error as OneKeyError | undefined;
          if (e?.message?.includes('Already unsubscribed')) {
            clearActiveL2BookSpec();
            removeSubCache();
            return true;
          }
          console.log(
            `[HyperLiquid WebSocket] unsubscribe() failed for ${spec.key}:`,
            error,
          );
          return false;
        } finally {
          this._destroyingSubscriptionKeys.delete(spec.key);
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
    this._markNetworkStatusPending();
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
      // Stamp before the disabled early-return: a muted-but-alive stream
      // must not be judged dead by the resume staleness check.
      this._lastFrameAt = Date.now();
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

      const messageTimestamp = Date.now();
      if (
        subscriptionType !== ESubscriptionType.L2 &&
        subscriptionType !== ESubscriptionType.L2_BOOK
      ) {
        this._markSubscriptionActivity(subscriptionType, messageTimestamp);
      }
      markPerpsColdStartPerfOnce(`service_ws_first_${subscriptionType}`, {
        subscriptionType,
      });

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

          await this.backgroundApi.serviceHyperliquid.updateSpotDustingOptOutStatus(
            {
              accountAddress: userAddress,
              optOut: userState.optOutOfSpotDusting === true,
              source: 'live',
            },
          );

          if (wsAbstraction) {
            // mode rarely changes, skip redundant atom set + recomputation
            const currentAbstraction = await perpsAbstractionModeAtom.get();
            if (
              currentAbstraction?.mode !== wsAbstraction ||
              currentAbstraction?.accountAddress?.toLowerCase() !==
                userAddress.toLowerCase() ||
              currentAbstraction?.source !== 'live'
            ) {
              await perpsAbstractionModeAtom.set({
                accountAddress: userAddress.toLowerCase() as IHex,
                mode: wsAbstraction as EHyperLiquidAbstractionMode,
                source: 'live',
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
      } else if (subscriptionType === ESubscriptionType.TWAP_STATES) {
        this._emitHyperliquidDataUpdate(
          subscriptionType,
          data as IWsTwapStates,
        );
      } else if (subscriptionType === ESubscriptionType.USER_TWAP_HISTORY) {
        this._emitHyperliquidDataUpdate(
          subscriptionType,
          data as IWsUserTwapHistory,
        );
      } else if (subscriptionType === ESubscriptionType.USER_TWAP_SLICE_FILLS) {
        this._emitHyperliquidDataUpdate(
          subscriptionType,
          data as IWsUserTwapSliceFills,
        );
      } else if (subscriptionType === ESubscriptionType.ALL_DEXS_ASSET_CTXS) {
        this.backgroundApi.serviceHyperliquidCache.cacheAllDexsAssetCtxsSnapshot(
          data as IWsAllDexsAssetCtxs,
        );
        this._emitHyperliquidDataUpdate(
          subscriptionType,
          data as IWsAllDexsAssetCtxs,
        );
      } else if (subscriptionType === ESubscriptionType.L2) {
        const subscriptionKey = this._fastL2SubscriptionKey;
        const fastL2Book = this._fastL2Book;
        if (!subscriptionKey || !fastL2Book) {
          return;
        }
        // A late frame from a destroyed subscription must never mutate a
        // newly selected market's book.
        if (!this.pendingSubSpecsMap[subscriptionKey]) {
          return;
        }

        const fastL2Frame = data as IFastL2Frame;
        let normalizedBook: IBook | null;
        try {
          normalizedBook = fastL2Book.apply(fastL2Frame);
        } catch (error) {
          if (isStaleFastL2TargetError(error)) {
            return;
          }
          await this._recoverFastL2('invalid_frame');
          return;
        }
        if (!normalizedBook) {
          return;
        }
        this._markSubscriptionActivity(subscriptionType, messageTimestamp);
        if (this._fastL2SnapshotTimer && fastL2Book.hasSnapshot) {
          clearTimeout(this._fastL2SnapshotTimer);
          this._fastL2SnapshotTimer = null;
        }
        if (shouldResetFastL2RecoveryAfterFrame(fastL2Frame, normalizedBook)) {
          this._invalidateFastL2RecoveryTask();
          this._fastL2RecoveryAttempts = 0;
          this._fastL2ReconnectAttempted = false;
          this._fastL2FallbackTargetKey = null;
        }
        this.backgroundApi.serviceHyperliquidCache.cacheL2BookSnapshot({
          data: normalizedBook,
          activeBookCoin:
            this._currentState.tradingMode === 'spot'
              ? this._currentState.currentSpotSymbol
              : this._currentState.currentSymbol,
          activeOptions: this._currentState.l2BookOptions,
        });
        this._emitHyperliquidDataUpdate(
          ESubscriptionType.L2_BOOK,
          normalizedBook,
        );
      } else if (subscriptionType === ESubscriptionType.L2_BOOK) {
        const activeL2BookSpec = this._activeL2BookSpec;
        const normalizedBook = normalizeL2BookForSubscriptionSpec(
          data as IBook,
          activeL2BookSpec,
        );
        if (!normalizedBook || !activeL2BookSpec) {
          return;
        }
        this._markSubscriptionActivity(subscriptionType, messageTimestamp);
        this.backgroundApi.serviceHyperliquidCache.cacheL2BookSnapshot({
          data: normalizedBook,
          activeBookCoin: activeL2BookSpec.params.coin,
          activeOptions: {
            nSigFigs: activeL2BookSpec.params.nSigFigs,
            mantissa: activeL2BookSpec.params.mantissa,
          },
        });
        this._emitHyperliquidDataUpdate(subscriptionType, normalizedBook);
      } else {
        this._emitHyperliquidDataUpdate(subscriptionType, data);
      }

      // Route default-case messages through the same liveness path used by
      // ALL_MIDS / SPOT_STATE / SPOT_ASSET_CTXS etc. The throttled
      // _updateNetworkLiveness() variant updates perpsNetworkStatusAtom at
      // most once per 5 s — the prior unconditional set() here fired on
      // every WS message (10+/s for high-frequency streams), generating a
      // setAtomValue storm across the bg→ui bridge.
      this._updateNetworkLiveness();
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

  private _markNetworkStatusPending(): void {
    void perpsNetworkStatusAtom.set(
      (prev): IPerpsNetworkStatus => ({
        ...prev,
        connected: undefined,
        pingMs: null,
      }),
    );
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
    this._pingIntervalTimer = trackedSetInterval(
      'hyperliquid:ping',
      () => {
        // Defense: skip when the app is not visible (desktop window
        // unfocused, web tab hidden, or RN app backgrounded). The pingMs
        // value drives a UI indicator the user can not see, and the WS
        // layer maintains its own liveness signal. Avoids ~1,200
        // allocation/atom-write cycles per hour of background uptime.
        if (!isAppVisible()) return;
        void this._measurePing();
      },
      3000,
    );
  }

  private _stopPingLoop(): void {
    if (this._pingIntervalTimer) {
      clearTrackedInterval(this._pingIntervalTimer);
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
