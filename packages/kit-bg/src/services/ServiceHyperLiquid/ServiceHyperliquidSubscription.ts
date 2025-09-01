import {
  SubscriptionClient,
  WebSocketTransport,
} from '@nktkas/hyperliquid';

import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import ServiceBase from '../ServiceBase';
import type {
  SubscriptionType,
  SubscriptionSpec,
  SubscriptionState,
  SubscriptionDiff,
} from './utils/SubscriptionConfig';
import {
  SUBSCRIPTION_CONFIGS,
  getSubscriptionConfig,
  validateSubscriptionParams,
  calculateRequiredSubscriptions,
  calculateSubscriptionDiff,
  sortSubscriptionsByPriority,
} from './utils/SubscriptionConfig';

interface ActiveSubscription {
  key: string;
  type: SubscriptionType;
  sdkSubscription: any;
  createdAt: number;
  lastActivity: number;
  isActive: boolean;
}

interface ISubscriptionUpdateParams {
  currentUser?: `0x${string}` | null;
  currentSymbol?: string;
  isConnected?: boolean;
}

@backgroundClass()
export default class ServiceHyperliquidSubscription extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  private _client: SubscriptionClient | null = null;
  private _currentState: SubscriptionState = {
    currentUser: null,
    currentSymbol: '',
    isConnected: false,
  };
  private _activeSubscriptions = new Map<string, ActiveSubscription>();
  private _connectionMonitor: ReturnType<typeof setInterval> | null = null;
  private _pendingUpdate: Promise<void> | null = null;

  @backgroundMethod()
  async updateSubscriptions(params: ISubscriptionUpdateParams): Promise<void> {
    if (this._pendingUpdate) {
      await this._pendingUpdate;
    }

    const newState: SubscriptionState = { ...this._currentState };
    this._applyStateUpdates(newState, params);

    const diff = this._calculateStateDiff(newState);

    if (this._isDiffEmpty(diff)) {
      return;
    }
    this._emitConnectionStatus();
    await this._executeSubscriptionChanges(diff, newState);
    
    this._pendingUpdate = null;

    this._currentState = newState;
  }

  @backgroundMethod()
  async getSubscriptionStatus(): Promise<{
    currentUser: string | null;
    currentSymbol: string;
    isConnected: boolean;
    activeSubscriptions: Array<{
      key: string;
      type: SubscriptionType;
      createdAt: number;
      lastActivity: number;
      isActive: boolean;
    }>;
  }> {
    return {
      currentUser: this._currentState.currentUser,
      currentSymbol: this._currentState.currentSymbol,
      isConnected: this._currentState.isConnected,
      activeSubscriptions: Array.from(this._activeSubscriptions.values()).map(sub => ({
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
    await this._ensureClient();
    this._currentState.isConnected = true;
    // this._startConnectionMonitoring();
  }

  @backgroundMethod()
  async disconnect(): Promise<void> {
    // this._stopConnectionMonitoring();
    await this._cleanupAllSubscriptions();
    await this._closeClient();
    this._currentState.isConnected = false;
    this._emitConnectionStatus();
  }

  @backgroundMethod()
  async reconnect(): Promise<void> {

    await this.disconnect();
    await new Promise(resolve => setTimeout(resolve, 1000));
    await this.connect();
  }

  @backgroundMethod()
  async cleanup(): Promise<void> {
    await this._cleanupAllSubscriptions();
  }

  private _applyStateUpdates(
    state: SubscriptionState,
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
  }

  private _calculateStateDiff(newState: SubscriptionState): SubscriptionDiff {
    const currentSpecs = this._getCurrentSubscriptionSpecs();
    const newSpecs = calculateRequiredSubscriptions(newState);
    return calculateSubscriptionDiff(currentSpecs, newSpecs);
  }

  private _isDiffEmpty(diff: SubscriptionDiff): boolean {
    return diff.toUnsubscribe.length === 0 && diff.toSubscribe.length === 0;
  }

  private async _executeSubscriptionChanges(
    diff: SubscriptionDiff,
    newState: SubscriptionState,
  ): Promise<void> {
    await this._executeUnsubscriptions(diff.toUnsubscribe);
    await this._executeSubscriptions(diff.toSubscribe);
  }

  private async _executeUnsubscriptions(
    toUnsubscribe: SubscriptionSpec[],
  ): Promise<void> {
    if (toUnsubscribe.length === 0) return;
    const unsubscribePromises = toUnsubscribe.map(async (spec) => {
      try {
        await this._destroySubscription(spec.key);
      } catch (error) {
        console.error(`[ServiceHyperliquidSubscription.executeUnsubscriptions] Failed to unsubscribe ${spec.key}:`, error);
      }
    });

    await Promise.all(unsubscribePromises);
  }

  private async _executeSubscriptions(
    toSubscribe: SubscriptionSpec[],
  ): Promise<Promise<void>[]> {
    if (toSubscribe.length === 0) return [];
    
    const subscribePromises = toSubscribe.map(async (spec) => {
        await this._createSubscription(spec);
    });

    return subscribePromises;
  }

  private async _ensureClient(): Promise<SubscriptionClient> {
    if (!this._client) {
      const transport = new WebSocketTransport({
        url: 'wss://api.hyperliquid.xyz/ws',
      });

      this._client = new SubscriptionClient({ transport });

    }

    return this._client;
  }

  private async _closeClient(): Promise<void> {
    if (this._client) {
      try {
        if (this._client.transport && typeof (this._client.transport as any).close === 'function') {
          await (this._client.transport as any).close();
        }

      } catch (error) {
        console.error('[ServiceHyperliquidSubscription.closeClient] Failed to close client:', error);
      }
      this._client = null;
    }
  }

  private _getCurrentSubscriptionSpecs(): SubscriptionSpec[] {
    return Array.from(this._activeSubscriptions.values()).map(sub => ({
      type: sub.type,
      key: sub.key,
      params: this._parseKeyToParams(sub.key, sub.type),
      priority: SUBSCRIPTION_CONFIGS[sub.type].priority,
    }));
  }

  private async _createSubscription<T extends SubscriptionType>(
    spec: SubscriptionSpec<T>
  ): Promise<void> {
    if (this._activeSubscriptions.has(spec.key)) {
      console.warn(`[ServiceHyperliquidSubscription.createSubscription] Subscription already exists: ${spec.key}`);
      return;
    }

    const client = await this._ensureClient();
    const config = getSubscriptionConfig(spec.type);

    if (!validateSubscriptionParams(spec.type, spec.params)) {
      throw new OneKeyLocalError(`[ServiceHyperliquidSubscription.createSubscription] Invalid subscription parameters for type: ${spec.type}`);
    }

    let sdkSubscription: any;

    try {
      switch (spec.type) {
        case 'allMids':
          sdkSubscription = await client.allMids((data) => {
            this._handleSubscriptionData(spec.key, data, config);
          });
          break;

        case 'activeAssetCtx':
          sdkSubscription = await client.activeAssetCtx(
            spec.params as any,
            (data) => {
              this._handleSubscriptionData(spec.key, data, config);
            }
          );
          break;

        case 'webData2':
          sdkSubscription = await client.webData2(
            spec.params as any,
            (data) => {
              this._handleSubscriptionData(spec.key, data, config);
            }
          );
          break;

        case 'l2Book':
          sdkSubscription = await client.l2Book(
            spec.params as any,
            (data) => {
              this._handleSubscriptionData(spec.key, data, config);
            }
          );
          break;

        case 'candles':
          sdkSubscription = await client.candle(
            spec.params as any,
            (data) => {
              this._handleSubscriptionData(spec.key, data, config);
            }
          );
          break;

        case 'trades':
          sdkSubscription = await client.trades(
            spec.params as any,
            (data) => {
              this._handleSubscriptionData(spec.key, data, config);
            }
          );
          break;

        case 'bbo':
          sdkSubscription = await client.bbo(
            spec.params as any,
            (data) => {
              this._handleSubscriptionData(spec.key, data, config);
            }
          );
          break;

        case 'activeAssetData':
          sdkSubscription = await client.activeAssetData(
            spec.params as any,
            (data) => {
              this._handleSubscriptionData(spec.key, data, config);
            }
          );
          break;

        case 'userEvents':
          sdkSubscription = await client.userEvents(
            spec.params as any,
            (data) => {
              this._handleSubscriptionData(spec.key, data, config);
            }
          );
          break;

        case 'userNotifications':
          sdkSubscription = await client.notification(
            spec.params as any,
            (data) => {
              this._handleSubscriptionData(spec.key, data, config);
            }
          );
          break;

        default:
          throw new OneKeyLocalError(`[ServiceHyperliquidSubscription.createSubscription] Unsupported subscription type: ${spec.type}`);
      }

      this._activeSubscriptions.set(spec.key, {
        key: spec.key,
        type: spec.type,
        sdkSubscription,
        createdAt: Date.now(),
        lastActivity: Date.now(),
        isActive: true,
      });



    } catch (error) {
      console.error(`[ServiceHyperliquidSubscription.createSubscription] Failed to create subscription ${spec.type}:`, error);
      throw error;
    }
  }

  private async _destroySubscription(key: string): Promise<void> {
    const subscription = this._activeSubscriptions.get(key);
    if (!subscription) {
      return;
    }

    try {
      if (subscription.sdkSubscription?.unsubscribe) {
        await subscription.sdkSubscription.unsubscribe();
      }

    } catch (error) {
      console.error(`[ServiceHyperliquidSubscription.destroySubscription] Failed to destroy subscription ${key}:`, error);
    }

    this._activeSubscriptions.delete(key);
  }

  private async _cleanupAllSubscriptions(): Promise<void> {

    const promises = Array.from(this._activeSubscriptions.keys()).map(key =>
      this._destroySubscription(key).catch(error => {
        console.error(`[ServiceHyperliquidSubscription.cleanupAllSubscriptions] Failed to cleanup subscription ${key}:`, error);
      })
    );
    await Promise.all(promises);
    this._activeSubscriptions.clear();
  }

  private _handleSubscriptionData(key: string, data: any, config: any): void {
    try {
      const subscription = this._activeSubscriptions.get(key);
      if (subscription) {
        subscription.lastActivity = Date.now();
        this._activeSubscriptions.set(key, subscription);
      }

      if (data == null) {
        console.warn(`[ServiceHyperliquidSubscription.handleSubscriptionData] Data validation failed for: ${key}`);
        return;
      }

      const parts = key.split(':');
      const type = parts[0];
      const metadata: any = {
        timestamp: Date.now(),
        source: 'ServiceHyperliquidSubscription',
        key,
      };
      if (type === 'activeAssetCtx' || type === 'l2Book' || type === 'trades' || type === 'bbo') {
        metadata.coin = parts[1];
      } else if (type === 'candles') {
        metadata.coin = parts[1];
        metadata.interval = parts[2];
      } else if (type === 'webData2' || type === 'userEvents' || type === 'userNotifications' || type === 'activeAssetData') {
        metadata.userId = parts[1];
        if (type === 'activeAssetData') {
          metadata.coin = parts[2];
        }
      }

      appEventBus.emit(EAppEventBusNames.HyperliquidDataUpdate, {
        type: config.eventType,
        subType: config.eventSubType,
        data,
        metadata,
      });

    } catch (error) {
      console.error(`[ServiceHyperliquidSubscription.handleSubscriptionData] Failed to handle data for ${key}:`, error);
    }
  }

  private _parseKeyToParams(key: string, type: SubscriptionType): any {
    const parts = key.split(':');

    switch (type) {
      case 'allMids':
        return {};
      case 'activeAssetCtx':
      case 'l2Book':
      case 'trades':
      case 'bbo':
        return { coin: parts[2] };
      case 'candles':
        return { coin: parts[2], interval: parts[3] };
      case 'webData2':
      case 'userEvents':
      case 'userNotifications':
        return { user: parts[2] as `0x${string}` };
      case 'activeAssetData':
        return { user: parts[2] as `0x${string}`, coin: parts[3] };
      default:
        return {};
    }
  }

  private _startConnectionMonitoring(): void {
    if (this._connectionMonitor) {
      clearInterval(this._connectionMonitor);
    }

    this._connectionMonitor = setInterval(() => {
      this._emitConnectionStatus();
    }, 30000);
  }

  private _stopConnectionMonitoring(): void {
    if (this._connectionMonitor) {
      clearInterval(this._connectionMonitor);
      this._connectionMonitor = null;
    }
  }

  private _emitConnectionStatus(): void {
    appEventBus.emit(EAppEventBusNames.HyperliquidConnectionChange, {
      type: 'connection',
      subType: 'datastream' as any,
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