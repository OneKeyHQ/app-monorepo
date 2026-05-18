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
  createdAt: number;
  socketUrl: string;
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

interface ISubscriptionDiagnosticParams {
  event: string;
  clientId?: string | null;
  readyState?: number;
  elapsedMs?: number;
  reason?: string;
  code?: number;
  wasClean?: boolean;
  subscriptionType?: ESubscriptionType;
  subscriptionTypes?: ESubscriptionType[];
  paramsSummary?: Record<string, unknown>;
  requiredSubSpecsMap?: Record<string, ISubscriptionSpec<ESubscriptionType>>;
  missingCriticalTypes?: ESubscriptionType[];
  staleCriticalTypes?: ESubscriptionType[];
  extra?: Record<string, unknown>;
  error?: unknown;
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
  };

  private _networkTimeoutTimer: ReturnType<typeof setTimeout> | null = null;

  private _pingIntervalTimer: ReturnType<typeof setInterval> | null = null;

  private _lastMessageAt: number | null = null;

  private _postOpenDataCheckTimer: ReturnType<typeof setTimeout> | null = null;

  private _postOpenDataCheckRetries = 0;

  private static readonly POST_OPEN_DATA_CHECK_MAX_RETRIES = 3;

  private static readonly SUBSCRIPTION_UPDATE_OPEN_WAIT_MS = 3000;

  private static readonly DIAGNOSTIC_DATA_LOG_THROTTLE_MS = 30_000;

  private static readonly DIAGNOSTIC_LIVENESS_LOG_THROTTLE_MS = 15_000;

  private static readonly DIAGNOSTIC_PING_LOG_THROTTLE_MS = 30_000;

  private _criticalSubscriptionHealthCheckTimer: ReturnType<
    typeof setTimeout
  > | null = null;

  private _resumeRecoveryPromise: Promise<void> | null = null;

  private _subscriptionUpdateRecoveryPromise: Promise<void> | null = null;

  allSubSpecsMap: Record<string, ISubscriptionSpec<ESubscriptionType>> = {};

  pendingSubSpecsMap: Record<string, ISubscriptionSpec<ESubscriptionType>> = {};

  private _activeSubscriptions = new Map<string, IActiveSubscription>();

  // Cross-runtime atom sync can lag behind a reopened socket, leaving current
  // market subscriptions absent while the socket still looks healthy.
  private _subscriptionAtomsUnsubs: Array<() => void> = [];

  private _subscriptionLifecycleVersion = 0;

  private _firstDataLoggedTypes = new Set<ESubscriptionType>();

  private _lastDataDiagnosticLogAt = new Map<ESubscriptionType, number>();

  private _lastDisabledDataDiagnosticLogAt = new Map<
    ESubscriptionType,
    number
  >();

  private _lastLivenessDiagnosticLogAt = 0;

  private _lastPingDiagnosticLogAt = 0;

  private _hasLoggedRawSocketMessage = false;

  private _lastRawSocketMessageDiagnosticLogAt = 0;

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

  private _getLastMessageAgeMs(now = Date.now()): number | null {
    return this._lastMessageAt ? now - this._lastMessageAt : null;
  }

  private _getDiagnosticRequiredSubSpecsMap(
    requiredSubSpecsMap?: Record<string, ISubscriptionSpec<ESubscriptionType>>,
  ): Record<string, ISubscriptionSpec<ESubscriptionType>> | undefined {
    if (requiredSubSpecsMap) {
      return requiredSubSpecsMap;
    }
    if (Object.keys(this.pendingSubSpecsMap).length > 0) {
      return this.pendingSubSpecsMap;
    }
    if (Object.keys(this.allSubSpecsMap).length > 0) {
      return this.allSubSpecsMap;
    }
    return undefined;
  }

  private _getSubscriptionParamsSummary<T extends ESubscriptionType>(
    spec: ISubscriptionSpec<T>,
  ): Record<string, unknown> {
    const params = spec.params as Record<string, unknown>;
    const summary: Record<string, unknown> = {};

    if (typeof params.coin === 'string') {
      summary.coin = params.coin;
    }
    if (typeof params.dex === 'string') {
      summary.dex = params.dex;
    }
    if (typeof params.nSigFigs === 'number' || params.nSigFigs === null) {
      summary.nSigFigs = params.nSigFigs;
    }
    if (typeof params.mantissa === 'number' || params.mantissa === null) {
      summary.mantissa = params.mantissa;
    }
    if (typeof params.aggregateByTime === 'boolean') {
      summary.aggregateByTime = params.aggregateByTime;
    }
    if (typeof params.user === 'string') {
      summary.hasUser = true;
    }

    return summary;
  }

  private _getSubscriptionDataSummary(data: unknown): Record<string, unknown> {
    if (!data || typeof data !== 'object') {
      return { dataType: typeof data };
    }

    const record = data as Record<string, unknown>;
    const summary: Record<string, unknown> = {
      keys: Object.keys(record).slice(0, 12),
    };

    const levels = record.levels;
    if (Array.isArray(levels)) {
      summary.levelSideLengths = levels
        .slice(0, 2)
        .map((side) => (Array.isArray(side) ? side.length : null));
    }

    const mids = record.mids;
    if (mids && typeof mids === 'object') {
      summary.midsCount = Object.keys(mids).length;
    }

    [
      'fills',
      'orders',
      'clearinghouseStates',
      'assetCtxs',
      'tokens',
      'balances',
    ].forEach((key) => {
      const value = record[key];
      if (Array.isArray(value)) {
        summary[`${key}Length`] = value.length;
      }
    });

    if (typeof record.coin === 'string') {
      summary.hasCoin = true;
    }
    if (typeof record.user === 'string') {
      summary.hasUser = true;
    }
    if (typeof record.isSnapshot === 'boolean') {
      summary.isSnapshot = record.isSnapshot;
    }

    return summary;
  }

  private _getRawSocketMessageSummary(data: unknown): Record<string, unknown> {
    if (typeof data === 'string') {
      return {
        dataType: 'string',
        length: data.length,
      };
    }
    if (data && typeof data === 'object') {
      const record = data as Record<string, unknown>;
      const byteLength = record.byteLength;
      const size = record.size;
      return {
        dataType: data.constructor?.name ?? 'object',
        byteLength: typeof byteLength === 'number' ? byteLength : undefined,
        size: typeof size === 'number' ? size : undefined,
      };
    }
    return { dataType: typeof data };
  }

  private _logSubscriptionDataDiagnostics(params: {
    subscriptionType: ESubscriptionType;
    data: unknown;
    messageTimestamp: number;
  }): void {
    const { subscriptionType, data, messageTimestamp } = params;
    const isFirst = !this._firstDataLoggedTypes.has(subscriptionType);
    const lastLoggedAt =
      this._lastDataDiagnosticLogAt.get(subscriptionType) ?? 0;
    const shouldLogPeriodic =
      messageTimestamp - lastLoggedAt >=
      ServiceHyperliquidSubscription.DIAGNOSTIC_DATA_LOG_THROTTLE_MS;

    if (!isFirst && !shouldLogPeriodic) {
      return;
    }

    this._firstDataLoggedTypes.add(subscriptionType);
    this._lastDataDiagnosticLogAt.set(subscriptionType, messageTimestamp);
    this._logSubscriptionDiagnostics({
      event: isFirst ? 'subscription_data_first' : 'subscription_data_periodic',
      subscriptionType,
      extra: {
        dataSummary: this._getSubscriptionDataSummary(data),
        messageTimestamp,
      },
    });
  }

  private _logDisabledSubscriptionDataDiagnostics(params: {
    subscriptionType: ESubscriptionType;
    data: unknown;
    force?: boolean;
  }): void {
    const now = Date.now();
    const { subscriptionType, data, force } = params;
    const lastLoggedAt =
      this._lastDisabledDataDiagnosticLogAt.get(subscriptionType) ?? 0;
    if (
      !force &&
      now - lastLoggedAt <
        ServiceHyperliquidSubscription.DIAGNOSTIC_DATA_LOG_THROTTLE_MS
    ) {
      return;
    }

    this._lastDisabledDataDiagnosticLogAt.set(subscriptionType, now);
    this._logSubscriptionDiagnostics({
      event: 'subscription_data_dropped_disabled',
      subscriptionType,
      extra: {
        disabledCount: this.subscriptionsHandlerDisabledCount,
        dataSummary: this._getSubscriptionDataSummary(data),
      },
    });
  }

  private _logPingDiagnostics(params: {
    event: string;
    pingMs?: number;
    error?: unknown;
  }): void {
    const now = Date.now();
    if (
      now - this._lastPingDiagnosticLogAt <
      ServiceHyperliquidSubscription.DIAGNOSTIC_PING_LOG_THROTTLE_MS
    ) {
      return;
    }

    this._lastPingDiagnosticLogAt = now;
    this._logSubscriptionDiagnostics({
      event: params.event,
      elapsedMs: params.pingMs,
      error: params.error,
    });
  }

  private _getDiagnosticErrorSummary(
    error: unknown,
  ): Record<string, unknown> | undefined {
    if (!error) {
      return undefined;
    }
    if (typeof error === 'string') {
      return {
        message: error.slice(0, 300),
      };
    }
    if (typeof error !== 'object') {
      return {
        message: String(error),
      };
    }

    const record = error as Record<string, unknown>;
    return {
      name: typeof record.name === 'string' ? record.name : undefined,
      message:
        typeof record.message === 'string'
          ? record.message.slice(0, 300)
          : undefined,
      code:
        typeof record.code === 'string' || typeof record.code === 'number'
          ? record.code
          : undefined,
      status:
        typeof record.status === 'string' || typeof record.status === 'number'
          ? record.status
          : undefined,
    };
  }

  private _logSubscriptionDiagnostics(
    params: ISubscriptionDiagnosticParams,
  ): void {
    const now = Date.now();
    const client = this._client;
    const requiredSubSpecsMap = this._getDiagnosticRequiredSubSpecsMap(
      params.requiredSubSpecsMap,
    );
    const missingCriticalTypes =
      params.missingCriticalTypes ??
      this._getMissingCriticalOpenSubscriptionTypes(requiredSubSpecsMap);
    const staleCriticalTypes =
      params.staleCriticalTypes ??
      this._getStaleCriticalOpenSubscriptionTypes(requiredSubSpecsMap);

    defaultLogger.perp.hyperliquid.subscriptionDiagnostics({
      event: params.event,
      clientId: params.clientId ?? client?.clientId,
      readyState:
        params.readyState ??
        client?.transport?.socket?.readyState ??
        this._lastReadyState,
      socketUrl: client?.socketUrl,
      elapsedMs: params.elapsedMs,
      reason: params.reason,
      code: params.code,
      wasClean: params.wasClean,
      activeCount: this._activeSubscriptions.size,
      pendingCount: Object.keys(this.pendingSubSpecsMap).length,
      allCount: Object.keys(this.allSubSpecsMap).length,
      lastMessageAgeMs: this._getLastMessageAgeMs(now),
      missingCriticalTypes: missingCriticalTypes.map((type) => String(type)),
      staleCriticalTypes: staleCriticalTypes.map((type) => String(type)),
      subscriptionType: params.subscriptionType
        ? String(params.subscriptionType)
        : undefined,
      subscriptionTypes: params.subscriptionTypes?.map((type) => String(type)),
      paramsSummary: params.paramsSummary,
      extra: params.extra,
      error: this._getDiagnosticErrorSummary(params.error),
    });
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
      this._logSubscriptionDiagnostics({
        event: 'update_subscriptions_core_no_required_info',
      });
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
      this._logSubscriptionDiagnostics({
        event: 'update_subscriptions_rebuild_stale_critical',
        requiredSubSpecsMap: requiredSubInfo.requiredSubSpecsMap,
        staleCriticalTypes,
      });
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

    this._emitConnectionStatus();
    const toCreateSubscriptionTypes = Object.values(
      requiredSubInfo.requiredSubSpecsMap,
    )
      .filter((spec) => !this._activeSubscriptions.has(spec.key))
      .map((spec) => spec.type);
    this._logSubscriptionDiagnostics({
      event: 'update_subscriptions_core_plan',
      requiredSubSpecsMap: requiredSubInfo.requiredSubSpecsMap,
      subscriptionTypes: toCreateSubscriptionTypes,
      extra: {
        requiredCount: Object.keys(requiredSubInfo.requiredSubSpecsMap).length,
        toCreateCount: toCreateSubscriptionTypes.length,
        currentSymbol: requiredSubInfo.params.currentSymbol,
        currentSpotSymbol: requiredSubInfo.params.currentSpotSymbol,
        tradingMode: requiredSubInfo.params.tradingMode,
        hasUser: Boolean(requiredSubInfo.params.currentUser),
        hasL2BookOptions: Boolean(requiredSubInfo.params.l2BookOptions),
        enableLedgerUpdates: Boolean(
          requiredSubInfo.params.enableLedgerUpdates,
        ),
        spotEnabled: Boolean(requiredSubInfo.params.spotEnabled),
        spotAssetCtxsEnabled: Boolean(
          requiredSubInfo.params.spotAssetCtxsEnabled,
        ),
      },
    });
    this._executeSubscriptionChanges();
    this._scheduleCriticalSubscriptionHealthCheck('update_subscriptions');

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
    if (this.subscriptionsHandlerDisabled) {
      this._logSubscriptionDiagnostics({
        event: 'update_subscriptions_skipped_disabled',
      });
      return;
    }
    const startedAt = Date.now();
    const client = await this.getWebSocketClient();
    if (client?.transport?.socket?.readyState !== WebSocket.OPEN) {
      this._logSubscriptionDiagnostics({
        event: 'update_subscriptions_socket_not_open',
        clientId: client?.clientId,
        readyState: client?.transport?.socket?.readyState,
        elapsedMs: Date.now() - startedAt,
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
      await this._updateSubscriptionsCore();
      this._logSubscriptionDiagnostics({
        event: 'update_subscriptions_initial_done',
        clientId: client.clientId,
        elapsedMs: Date.now() - startedAt,
      });
      return;
    }
    await this._updateSubscriptionsDebounced();
    this._logSubscriptionDiagnostics({
      event: 'update_subscriptions_debounced',
      clientId: client.clientId,
      elapsedMs: Date.now() - startedAt,
    });
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
        this._logSubscriptionDiagnostics({
          event: 'critical_subscription_health_check_ok',
          reason,
          requiredSubSpecsMap: requiredSubInfo.requiredSubSpecsMap,
        });
        return;
      }

      console.log(
        `critical_subscription_health_check__rebuild__${reason}__missing=${missingCriticalTypes.join(
          ',',
        )}__stale=${staleCriticalTypes.join(',')}`,
      );
      this._logSubscriptionDiagnostics({
        event: 'critical_subscription_health_check_rebuild',
        reason,
        requiredSubSpecsMap: requiredSubInfo.requiredSubSpecsMap,
        missingCriticalTypes,
        staleCriticalTypes,
      });
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
      this._logSubscriptionDiagnostics({
        event: 'resume_reconcile_start',
        reason: params?.reason,
        requiredSubSpecsMap: requiredSubInfo?.requiredSubSpecsMap,
        extra: {
          forceRebuild: Boolean(params?.forceRebuild),
        },
      });
      if (
        this._shouldRebuildOpenSocketSubscriptionsOnResume({
          ...params,
          requiredSubSpecsMap: requiredSubInfo?.requiredSubSpecsMap,
        })
      ) {
        const reason = params?.reason ?? 'resumeSubscriptions';
        console.log(`resumeSubscriptions__rebuild_open_socket__${reason}`);
        this._logSubscriptionDiagnostics({
          event: 'resume_rebuild_open_socket',
          reason,
          requiredSubSpecsMap: requiredSubInfo?.requiredSubSpecsMap,
        });
        this._subscriptionLifecycleVersion += 1;
        this._updateSubscriptionsDebounced.cancel();
        this._clearPostOpenDataCheck();
        this._clearCriticalSubscriptionHealthCheck();
        this._hasInitialSubscription = false;
        await this._cleanupAllSubscriptions();
        await timerUtils.wait(50);
      }
      await this.updateSubscriptions();
      this._logSubscriptionDiagnostics({
        event: 'resume_reconcile_done',
        reason: params?.reason,
        requiredSubSpecsMap: requiredSubInfo?.requiredSubSpecsMap,
      });
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
    this._logSubscriptionDiagnostics({
      event: 'force_reconnect_closed_or_closing_socket',
    });
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
    clientId?: string;
    socketReadyState?: number;
    lastReadyState?: number;
    lastMessageAt: number | null;
    lastMessageAgeMs: number | null;
    missingCriticalTypes: ESubscriptionType[];
    staleCriticalTypes: ESubscriptionType[];
    pendingSubscriptionTypes: ESubscriptionType[];
    activeSubscriptions: Array<{
      type: ESubscriptionType;
      createdAt: number;
      createdAgeMs: number;
      lastActivity: number;
      lastActivityAgeMs: number;
      isActive: boolean;
    }>;
  }> {
    const now = Date.now();
    const requiredSubSpecsMap = this._getDiagnosticRequiredSubSpecsMap();
    return {
      currentUser: this._currentState.currentUser,
      currentSymbol: this._currentState.currentSymbol,
      isConnected: this._currentState.isConnected,
      clientId: this._client?.clientId,
      socketReadyState: this._client?.transport?.socket?.readyState,
      lastReadyState: this._lastReadyState,
      lastMessageAt: this._lastMessageAt,
      lastMessageAgeMs: this._getLastMessageAgeMs(now),
      missingCriticalTypes:
        this._getMissingCriticalOpenSubscriptionTypes(requiredSubSpecsMap),
      staleCriticalTypes:
        this._getStaleCriticalOpenSubscriptionTypes(requiredSubSpecsMap),
      pendingSubscriptionTypes: Object.values(this.pendingSubSpecsMap).map(
        (spec) => spec.type,
      ),
      activeSubscriptions: Array.from(this._activeSubscriptions.values() || [])
        .filter(Boolean)
        .map((sub) => ({
          type: sub.type,
          createdAt: sub.createdAt,
          createdAgeMs: now - sub.createdAt,
          lastActivity: sub.lastActivity,
          lastActivityAgeMs: now - sub.lastActivity,
          isActive: sub.isActive,
        })),
    };
  }

  @backgroundMethod()
  async resumeSubscriptions(params?: {
    forceRebuild?: boolean;
    forceReconnect?: boolean;
  }): Promise<void> {
    const startedAt = Date.now();
    await this.enableSubscriptionsHandler();
    this._postOpenDataCheckRetries = 0;
    console.log('updateSubscriptions__by__resumeSubscriptions');
    this._logSubscriptionDiagnostics({
      event: 'resume_subscriptions_start',
      extra: {
        forceRebuild: Boolean(params?.forceRebuild),
        forceReconnect: Boolean(params?.forceReconnect),
      },
    });

    if (params?.forceReconnect) {
      console.log('resumeSubscriptions__force_reconnect_transport__requested');
      this._logSubscriptionDiagnostics({
        event: 'resume_subscriptions_force_reconnect_requested',
      });
      await this._forceReconnectTransport();
      this._logSubscriptionDiagnostics({
        event: 'resume_subscriptions_done',
        elapsedMs: Date.now() - startedAt,
      });
      return;
    }

    const client = await this.getWebSocketClient();
    if (client?.transport?.socket?.readyState !== WebSocket.OPEN) {
      console.log('resumeSubscriptions__force_reconnect_transport');
      this._logSubscriptionDiagnostics({
        event: 'resume_subscriptions_socket_not_open',
        clientId: client?.clientId,
        readyState: client?.transport?.socket?.readyState,
      });
      await this._forceReconnectTransport();
    } else {
      // OK-53014: re-install atom watcher since pauseSubscriptions() tore
      // it down.  The socket is still OPEN here, so socketOpenHandler will
      // not fire again to reinstall it for us.
      this._watchSubscriptionAtoms();
      await this._reconcileOpenSocketSubscriptionsOnResume({
        forceRebuild: params?.forceRebuild,
        reason: params?.forceRebuild
          ? 'force_rebuild'
          : 'native_resume_stale_data',
      });
    }
    this._logSubscriptionDiagnostics({
      event: 'resume_subscriptions_done',
      elapsedMs: Date.now() - startedAt,
    });
  }

  @backgroundMethod()
  async pauseSubscriptions(): Promise<void> {
    const startedAt = Date.now();
    this._logSubscriptionDiagnostics({
      event: 'pause_subscriptions_start',
    });
    this._subscriptionLifecycleVersion += 1;
    this._updateSubscriptionsDebounced.cancel();
    this._unwatchSubscriptionAtoms();
    await this.disableSubscriptionsHandler();
    this._clearPostOpenDataCheck();
    this._clearCriticalSubscriptionHealthCheck();
    this._stopPingLoop();
    await this._cleanupAllSubscriptions();
    // No reloadHook change — iframe WS self-heals on resume
    this._logSubscriptionDiagnostics({
      event: 'pause_subscriptions_done',
      elapsedMs: Date.now() - startedAt,
    });
  }

  hasNewUserFills = false;

  subscriptionsHandlerDisabled = false;

  subscriptionsHandlerDisabledCount = 0;

  @backgroundMethod()
  async disableSubscriptionsHandler(): Promise<void> {
    this.subscriptionsHandlerDisabled = true;
    this.subscriptionsHandlerDisabledCount += 1;
    this._logSubscriptionDiagnostics({
      event: 'subscriptions_handler_disabled',
      extra: {
        disabledCount: this.subscriptionsHandlerDisabledCount,
      },
    });
  }

  @backgroundMethod()
  async enableSubscriptionsHandler(): Promise<void> {
    const hadNewUserFills = this.hasNewUserFills;
    this.subscriptionsHandlerDisabled = false;
    if (this.hasNewUserFills) {
      this.hasNewUserFills = false;
      void perpsTradesHistoryRefreshHookAtom.set({
        refreshHook: Date.now(),
      });
    }
    this._logSubscriptionDiagnostics({
      event: 'subscriptions_handler_enabled',
      extra: {
        disabledCount: this.subscriptionsHandlerDisabledCount,
        hadNewUserFills,
      },
    });
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
    const prevState = {
      enableLedgerUpdates: this._currentState.enableLedgerUpdates,
      spotAssetCtxsEnabled: this._currentState.spotAssetCtxsEnabled,
      spotEnabled: this._currentState.spotEnabled,
    };
    // enableLedgerUpdates is a one-way toggle (set true by enableLedgerUpdatesSubscription
    // when user visits Account tab). Never reset to false — planTradeSubscriptions cannot
    // reliably compute this since infoPanelTab is not synced to real tab state.
    this._currentState.enableLedgerUpdates =
      params.enableLedgerUpdates || this._currentState.enableLedgerUpdates;
    this._currentState.spotAssetCtxsEnabled = params.spotAssetCtxsEnabled;
    this._currentState.spotEnabled = params.spotEnabled;
    this._logSubscriptionDiagnostics({
      event: 'route_subscription_state_set',
      extra: {
        prevState,
        nextState: {
          enableLedgerUpdates: this._currentState.enableLedgerUpdates,
          spotAssetCtxsEnabled: this._currentState.spotAssetCtxsEnabled,
          spotEnabled: this._currentState.spotEnabled,
        },
      },
    });
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
    const startedAt = Date.now();
    const client = await this.getWebSocketClient();
    this._logSubscriptionDiagnostics({
      event: 'connect_start',
      clientId: client.clientId,
      readyState: client.transport?.socket?.readyState,
    });
    if (await this._reconnectClosedOrClosingSocket()) {
      this._logSubscriptionDiagnostics({
        event: 'connect_reconnected_closed_socket',
        elapsedMs: Date.now() - startedAt,
      });
      return;
    }
    const readyState = client.transport?.socket?.readyState;
    if (readyState === WebSocket.OPEN) {
      this._currentState.isConnected = true;
      this._watchSubscriptionAtoms();
      await this._reconcileOpenSocketSubscriptionsOnResume({
        reason: 'connect_open_socket',
      });
      this._logSubscriptionDiagnostics({
        event: 'connect_open_socket_done',
        clientId: client.clientId,
        elapsedMs: Date.now() - startedAt,
      });
    } else {
      this._logSubscriptionDiagnostics({
        event: 'connect_waiting_for_socket_open',
        clientId: client.clientId,
        readyState,
        elapsedMs: Date.now() - startedAt,
      });
    }
  }

  @backgroundMethod()
  async disconnect(): Promise<void> {
    this._logSubscriptionDiagnostics({
      event: 'disconnect_start',
    });
    this._subscriptionLifecycleVersion += 1;
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
    this._logSubscriptionDiagnostics({
      event: 'disconnect_done',
    });
  }

  @backgroundMethod()
  async reconnect(): Promise<void> {
    this._logSubscriptionDiagnostics({
      event: 'reconnect_start',
    });
    await this.disconnect();
    await timerUtils.wait(1000);
    await this.connect();
    this._logSubscriptionDiagnostics({
      event: 'reconnect_done',
    });
  }

  @backgroundMethod()
  async cleanup(): Promise<void> {
    this._logSubscriptionDiagnostics({
      event: 'cleanup_start',
    });
    this._subscriptionLifecycleVersion += 1;
    this._updateSubscriptionsDebounced.cancel();
    this._unwatchSubscriptionAtoms();
    this._stopPingLoop();
    this._clearPostOpenDataCheck();
    this._clearCriticalSubscriptionHealthCheck();
    await this._cleanupAllSubscriptions();
    this._logSubscriptionDiagnostics({
      event: 'cleanup_done',
    });
  }

  // Skip per-subscription unsubscribe to avoid async race where stale
  // _destroySubscription completion deletes newly created tracking entries
  private async _forceReconnectTransport(): Promise<void> {
    const startedAt = Date.now();
    this._logSubscriptionDiagnostics({
      event: 'force_reconnect_transport_start',
    });
    this._subscriptionLifecycleVersion += 1;
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
    await perpsNetworkStatusAtom.set(
      (prev): IPerpsNetworkStatus => ({ ...prev, connected: false }),
    );
    this._emitConnectionStatus();
    await this.getWebSocketClient();
    this._logSubscriptionDiagnostics({
      event: 'force_reconnect_transport_done',
      elapsedMs: Date.now() - startedAt,
    });
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
      const startedAt = Date.now();
      const readyState = params.client.transport?.socket?.readyState;
      this._logSubscriptionDiagnostics({
        event: 'recover_not_open_socket_start',
        clientId: params.client.clientId,
        readyState,
        reason: params.reason,
      });
      if (readyState === WebSocket.CLOSED || readyState === WebSocket.CLOSING) {
        this._logSubscriptionDiagnostics({
          event: 'recover_not_open_socket_closed_or_closing',
          clientId: params.client.clientId,
          readyState,
          reason: params.reason,
          elapsedMs: Date.now() - startedAt,
        });
        await this._forceReconnectTransport();
        return;
      }

      const isOpen = await this._waitForOpenSocket({
        client: params.client,
        timeoutMs:
          ServiceHyperliquidSubscription.SUBSCRIPTION_UPDATE_OPEN_WAIT_MS,
      });
      if (isOpen) {
        this._logSubscriptionDiagnostics({
          event: 'recover_not_open_socket_opened',
          clientId: params.client.clientId,
          readyState: params.client.transport?.socket?.readyState,
          reason: params.reason,
          elapsedMs: Date.now() - startedAt,
        });
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
        this._startPostOpenDataCheck();
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
        this._logSubscriptionDiagnostics({
          event: 'recover_not_open_socket_timeout_force_reconnect',
          clientId: params.client.clientId,
          readyState: params.client.transport?.socket?.readyState,
          reason: params.reason,
          elapsedMs: Date.now() - startedAt,
        });
        await this._forceReconnectTransport();
      } else {
        this._logSubscriptionDiagnostics({
          event: 'recover_not_open_socket_timeout_noop',
          clientId: params.client.clientId,
          readyState: params.client.transport?.socket?.readyState,
          reason: params.reason,
          elapsedMs: Date.now() - startedAt,
        });
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
      this._logSubscriptionDiagnostics({
        event: 'post_open_data_check_max_retries_reached',
        extra: {
          retries: this._postOpenDataCheckRetries,
        },
      });
      return;
    }
    const messageAtBefore = this._lastMessageAt;
    this._logSubscriptionDiagnostics({
      event: 'post_open_data_check_scheduled',
      extra: {
        retries: this._postOpenDataCheckRetries,
        messageAtBefore,
      },
    });
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
        this._logSubscriptionDiagnostics({
          event: 'post_open_data_check_force_reconnect',
          extra: {
            retries: this._postOpenDataCheckRetries,
            maxRetries:
              ServiceHyperliquidSubscription.POST_OPEN_DATA_CHECK_MAX_RETRIES,
            messageAtBefore,
          },
        });
        await this._forceReconnectTransport();
      } else {
        this._logSubscriptionDiagnostics({
          event: 'post_open_data_check_data_received',
          extra: {
            retries: this._postOpenDataCheckRetries,
            messageAtBefore,
            lastMessageAt: this._lastMessageAt,
          },
        });
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
    this._logSubscriptionDiagnostics({
      event: 'socket_error_event',
      readyState,
      extra: {
        eventType: event.type,
      },
    });
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
    const closeEvent = event as {
      code?: number;
      reason?: string;
      wasClean?: boolean;
    };
    this._logSubscriptionDiagnostics({
      event: 'socket_close_event',
      readyState,
      code: closeEvent.code,
      reason: closeEvent.reason,
      wasClean: closeEvent.wasClean,
    });
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
      const openStartedAt = Date.now();
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
      this._logSubscriptionDiagnostics({
        event: 'socket_open_event',
        clientId: openClient?.clientId,
        readyState: readyState ?? WebSocket.OPEN,
        elapsedMs: openClient ? Date.now() - openClient.createdAt : undefined,
        extra: {
          wasConnected,
        },
      });

      await timerUtils.wait(600); // wait network status atom update
      const currentClient = this._client;
      if (
        !currentClient ||
        currentClient !== openClient ||
        currentClient.transport?.socket?.readyState !== WebSocket.OPEN ||
        this.subscriptionsHandlerDisabled
      ) {
        this._logSubscriptionDiagnostics({
          event: 'socket_open_event_skipped',
          clientId: openClient?.clientId,
          readyState: currentClient?.transport?.socket?.readyState,
          elapsedMs: Date.now() - openStartedAt,
          extra: {
            hasCurrentClient: Boolean(currentClient),
            isSameClient: currentClient === openClient,
            subscriptionsHandlerDisabled: this.subscriptionsHandlerDisabled,
          },
        });
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

      this._startPostOpenDataCheck();
      this._logSubscriptionDiagnostics({
        event: 'socket_open_handler_done',
        clientId: currentClient.clientId,
        readyState: currentClient.transport?.socket?.readyState,
        elapsedMs: Date.now() - openStartedAt,
      });
    } catch (error) {
      defaultLogger.perp.hyperliquid.subscriptionSocketOpenError({ error });
      this._logSubscriptionDiagnostics({
        event: 'socket_open_handler_error',
        error,
      });
    }
  };

  private _lastReadyState: number | undefined;

  socketMessageHandler: (event: WebSocketEventMap['message']) => void = (
    event,
    ..._args
  ) => {
    const now = Date.now();
    const socket = event.target as WebSocket | undefined;
    const readyState = socket?.readyState;
    const isFirstRawMessage = !this._hasLoggedRawSocketMessage;
    const shouldLogRawMessage =
      isFirstRawMessage ||
      now - this._lastRawSocketMessageDiagnosticLogAt >=
        ServiceHyperliquidSubscription.DIAGNOSTIC_DATA_LOG_THROTTLE_MS;
    if (shouldLogRawMessage) {
      const messageEvent = event as { data?: unknown };
      this._hasLoggedRawSocketMessage = true;
      this._lastRawSocketMessageDiagnosticLogAt = now;
      this._logSubscriptionDiagnostics({
        event: isFirstRawMessage
          ? 'socket_raw_message_first'
          : 'socket_raw_message_periodic',
        readyState,
        extra: {
          dataSummary: this._getRawSocketMessageSummary(messageEvent.data),
        },
      });
    }
    // Only write readyState atom when it actually changes to avoid
    // triggering downstream re-renders on every WS message
    if (readyState !== this._lastReadyState) {
      this._lastReadyState = readyState;
      void perpsWebSocketReadyStateAtom.set({ readyState });
      this._logSubscriptionDiagnostics({
        event: 'socket_message_ready_state_changed',
        readyState,
      });
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
      const createdAt = Date.now();
      const clientId = `hl-ws-${Date.now()}-${Math.random()
        .toString(16)
        .slice(2, 8)}`;
      const socketUrl = 'wss://api.hyperliquid.xyz/ws';
      this._firstDataLoggedTypes.clear();
      this._lastDataDiagnosticLogAt.clear();
      this._hasLoggedRawSocketMessage = false;
      this._lastRawSocketMessageDiagnosticLogAt = 0;
      const transportOptions: IWebSocketTransportOptions = {
        url: socketUrl,
        /* spell-checker:disable */
        reconnect: {
          maxRetries: 999,
          connectionTimeout: 5000,

          // oxlint-disable-next-line @cspell/spellchecker
          reconnectionDelay: (
            attempt: number, // spell-checker:disable-line
          ) => {
            // eslint-disable-next-line no-bitwise
            const delayMs = Math.min(~~(1 << attempt) * 150, 8000);
            this._logSubscriptionDiagnostics({
              event: 'transport_reconnection_delay',
              clientId,
              elapsedMs: Date.now() - createdAt,
              extra: {
                attempt,
                delayMs,
              },
            });
            return delayMs;
          },
        },
        /* spell-checker:enable */
      };
      this._logSubscriptionDiagnostics({
        event: 'client_create_start',
        clientId,
        extra: {
          socketUrl,
          connectionTimeout:
            transportOptions.reconnect?.connectionTimeout ?? undefined,
        },
      });
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
      transport.socket.addEventListener('message', this.socketMessageHandler);
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
        createdAt,
        socketUrl,
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
          this._logSubscriptionDiagnostics({
            event: 'transport_dispose_start',
            clientId,
            readyState: transport.socket?.readyState,
            elapsedMs: Date.now() - createdAt,
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
          this._logSubscriptionDiagnostics({
            event: 'transport_dispose_done',
            clientId,
            readyState: transport.socket?.readyState,
            elapsedMs: Date.now() - createdAt,
          });
        },
      };
      this._logSubscriptionDiagnostics({
        event: 'client_create_done',
        clientId,
        readyState: transport.socket?.readyState,
        elapsedMs: Date.now() - createdAt,
      });
      return this._client;
    })();
    return this._clientInitPromise;
  }

  private async _closeClient(): Promise<void> {
    this._unwatchSubscriptionAtoms();
    if (this._client) {
      const client = this._client;
      this._logSubscriptionDiagnostics({
        event: 'close_client_start',
        clientId: client.clientId,
        readyState: client.transport?.socket?.readyState,
      });
      try {
        // TODO remove all eventListeners
        await client.dispose();
      } catch (error) {
        console.error(
          '[ServiceHyperliquidSubscription.closeClient] Failed to close client:',
          error,
        );
        this._logSubscriptionDiagnostics({
          event: 'close_client_error',
          clientId: client.clientId,
          readyState: client.transport?.socket?.readyState,
          error,
        });
      }

      this._client = null;
      this._clientInitPromise = null;
      this._logSubscriptionDiagnostics({
        event: 'close_client_done',
        clientId: client.clientId,
        readyState: client.transport?.socket?.readyState,
      });
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
    const startedAt = Date.now();
    const paramsSummary = this._getSubscriptionParamsSummary(spec);

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
      this._logSubscriptionDiagnostics({
        event: 'subscription_create_skipped_exists',
        subscriptionType: spec.type,
        paramsSummary,
      });
      return;
    }

    try {
      this._logSubscriptionDiagnostics({
        event: 'subscription_create_start',
        subscriptionType: spec.type,
        paramsSummary,
      });
      const _sdkSubscription = await this._createSubscriptionDirect(spec);
      this._activeSubscriptions.set(spec.key, {
        key: spec.key,
        type: spec.type,
        spec,
        createdAt: Date.now(),
        lastActivity: Date.now(),
        isActive: true,
      });
      this._logSubscriptionDiagnostics({
        event: 'subscription_create_success',
        subscriptionType: spec.type,
        paramsSummary,
        elapsedMs: Date.now() - startedAt,
      });
    } catch (error) {
      console.error(
        `[ServiceHyperliquidSubscription.createSubscription] Failed to create subscription ${spec.type}:`,
        error,
      );
      this._logSubscriptionDiagnostics({
        event: 'subscription_create_error',
        subscriptionType: spec.type,
        paramsSummary,
        elapsedMs: Date.now() - startedAt,
        error,
      });
    } finally {
      // this.destroyUnusedSubscriptions();
      addSubCache();
    }
  }

  private async _destroySubscription(
    spec: ISubscriptionSpec<ESubscriptionType>,
  ): Promise<boolean> {
    const startedAt = Date.now();
    const paramsSummary = this._getSubscriptionParamsSummary(spec);
    try {
      if (spec) {
        const removeSubCache = () => {
          delete this.allSubSpecsMap[spec.key];
          this._activeSubscriptions.delete(spec.key);
        };
        try {
          this._logSubscriptionDiagnostics({
            event: 'subscription_destroy_start',
            subscriptionType: spec.type,
            paramsSummary,
          });
          const client = await this.getWebSocketClient();
          if (!client) {
            removeSubCache();
            this._logSubscriptionDiagnostics({
              event: 'subscription_destroy_no_client',
              subscriptionType: spec.type,
              paramsSummary,
              elapsedMs: Date.now() - startedAt,
            });
            return true;
          }
          // await sdkSub.unsubscribe();
          await client.unsubscribe(spec.type, spec.params);
          removeSubCache();
          this._logSubscriptionDiagnostics({
            event: 'subscription_destroy_success',
            subscriptionType: spec.type,
            paramsSummary,
            elapsedMs: Date.now() - startedAt,
          });
          return true;
        } catch (error) {
          const e = error as OneKeyError | undefined;
          console.error(
            `[HyperLiquid WebSocket] unsubscribe() failed for ${spec.key}:`,
            error,
          );
          if (e?.message.includes('Already unsubscribed')) {
            removeSubCache();
            this._logSubscriptionDiagnostics({
              event: 'subscription_destroy_already_unsubscribed',
              subscriptionType: spec.type,
              paramsSummary,
              elapsedMs: Date.now() - startedAt,
            });
            return true;
          }
          this._logSubscriptionDiagnostics({
            event: 'subscription_destroy_error',
            subscriptionType: spec.type,
            paramsSummary,
            elapsedMs: Date.now() - startedAt,
            error,
          });
          return false;
        }
      }
    } catch (error) {
      console.error(
        `[ServiceHyperliquidSubscription.destroySubscription] Failed to destroy subscription ${spec.key}:`,
        error,
      );
      this._logSubscriptionDiagnostics({
        event: 'subscription_destroy_unexpected_error',
        subscriptionType: spec.type,
        paramsSummary,
        elapsedMs: Date.now() - startedAt,
        error,
      });
    }
    return true;
  }

  private async _cleanupAllSubscriptions(): Promise<void> {
    const startedAt = Date.now();
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
    this._logSubscriptionDiagnostics({
      event: 'cleanup_all_subscriptions_start',
      subscriptionTypes: allSpecs.map((spec) => spec.type),
      extra: {
        specsCount: allSpecs.length,
        activeCount: this._activeSubscriptions.size,
        pendingCount: Object.keys(this.pendingSubSpecsMap).length,
        allCount: Object.keys(this.allSubSpecsMap).length,
      },
    });
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
      this._logSubscriptionDiagnostics({
        event: 'cleanup_all_subscriptions_unsubscribe_failure',
        subscriptionTypes: allSpecs.map((spec) => spec.type),
        elapsedMs: Date.now() - startedAt,
      });
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
    this._logSubscriptionDiagnostics({
      event: 'cleanup_all_subscriptions_done',
      elapsedMs: Date.now() - startedAt,
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
        const droppedData = event?.detail as unknown;
        let forceLogDroppedData = false;
        if (subscriptionType === ESubscriptionType.USER_FILLS) {
          const userFills = event?.detail as IWsUserFills;
          const isSnapshot = userFills?.isSnapshot;
          const fillsLength = userFills?.fills?.length;
          if (userFills?.user && fillsLength > 0 && !isSnapshot) {
            this.hasNewUserFills = true;
            forceLogDroppedData = true;
          }
        }
        this._logDisabledSubscriptionDataDiagnostics({
          subscriptionType,
          data: droppedData,
          force: forceLogDroppedData,
        });
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
        this._logSubscriptionDiagnostics({
          event: 'subscription_data_invalid',
          subscriptionType,
        });
        return;
      }

      const messageTimestamp = Date.now();
      this._markSubscriptionActivity(subscriptionType, messageTimestamp);
      this._logSubscriptionDataDiagnostics({
        subscriptionType,
        data,
        messageTimestamp,
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
      this._logSubscriptionDiagnostics({
        event: 'subscription_data_handler_error',
        subscriptionType,
        error,
      });
    }
  }

  private _lastLivenessAtomUpdate = 0;

  private _updateNetworkLiveness() {
    const now = Date.now();
    if (!this._pingIntervalTimer) {
      this._startPingLoop();
    }
    if (
      now - this._lastLivenessDiagnosticLogAt >
      ServiceHyperliquidSubscription.DIAGNOSTIC_LIVENESS_LOG_THROTTLE_MS
    ) {
      this._lastLivenessDiagnosticLogAt = now;
      this._logSubscriptionDiagnostics({
        event: 'network_liveness_update',
        extra: {
          lastLivenessAtomUpdateAgeMs: now - this._lastLivenessAtomUpdate,
        },
      });
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

    this._logSubscriptionDiagnostics({
      event: 'network_timeout_scheduled',
      extra: {
        timeoutMs: HYPERLIQUID_NETWORK_INACTIVE_TIMEOUT_MS,
        messageTimestamp,
      },
    });
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
      this._logSubscriptionDiagnostics({
        event: 'network_timeout_checked_recent',
        elapsedMs: elapsed,
        extra: {
          timeoutMs: HYPERLIQUID_NETWORK_INACTIVE_TIMEOUT_MS,
        },
      });
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
    this._logSubscriptionDiagnostics({
      event: 'network_timeout_triggered',
      elapsedMs: Number.isFinite(elapsed) ? elapsed : undefined,
      extra: {
        timeoutMs: HYPERLIQUID_NETWORK_INACTIVE_TIMEOUT_MS,
      },
    });
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
      this._logPingDiagnostics({
        event: 'ping_success',
        pingMs,
      });
    } catch (error) {
      // Ping failed — clear displayed value without marking disconnected
      void perpsNetworkStatusAtom.set(
        (prev): IPerpsNetworkStatus => ({ ...prev, pingMs: null }),
      );
      this._logPingDiagnostics({
        event: 'ping_error',
        error,
      });
    }
  }

  private _startPingLoop(): void {
    this._stopPingLoop();
    this._logSubscriptionDiagnostics({
      event: 'ping_loop_start',
    });
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
      this._logSubscriptionDiagnostics({
        event: 'ping_loop_stop',
      });
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
