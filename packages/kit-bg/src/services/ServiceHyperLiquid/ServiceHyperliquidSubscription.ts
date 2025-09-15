/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment */
import { SubscriptionClient, WebSocketTransport } from '@nktkas/hyperliquid';
import { Semaphore } from 'async-mutex';

import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IHex } from '@onekeyhq/shared/types/hyperliquid/sdk';
import type { IL2BookOptions } from '@onekeyhq/shared/types/hyperliquid/types';
import { ESubscriptionType } from '@onekeyhq/shared/types/hyperliquid/types';

import ServiceBase from '../ServiceBase';

import {
  SUBSCRIPTION_TYPE_INFO,
  calculateRequiredSubscriptions,
  calculateSubscriptionDiff,
  createSubscription,
  getSubscriptionPriority,
} from './utils/SubscriptionConfig';

import type {
  ISubscriptionDiff,
  ISubscriptionSpec,
  ISubscriptionState,
} from './utils/SubscriptionConfig';
import type { IBackgroundApi } from '../../apis/IBackgroundApi';

interface IActiveSubscription {
  key: string;
  type: ESubscriptionType;
  sdkSubscription: any;
  createdAt: number;
  lastActivity: number;
  isActive: boolean;
}

interface ISubscriptionUpdateParams {
  currentUser?: IHex | null;
  currentSymbol?: string;
  isConnected?: boolean;
  l2BookOptions?: IL2BookOptions;
}

@backgroundClass()
export default class ServiceHyperliquidSubscription extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: IBackgroundApi }) {
    super({ backgroundApi });
  }

  private _client: SubscriptionClient | null = null;

  // Ensure updateSubscriptions runs exclusively to avoid race conditions
  private _updateSemaphore = new Semaphore(1);

  private _currentState: ISubscriptionState = {
    currentUser: null,
    currentSymbol: '',
    isConnected: false,
    l2BookOptions: undefined,
  };

  private _activeSubscriptions = new Map<string, IActiveSubscription>();

  @backgroundMethod()
  async updateSubscriptions(params: ISubscriptionUpdateParams): Promise<void> {
    const [, release] = await this._updateSemaphore.acquire();
    try {
      const newState: ISubscriptionState = { ...this._currentState };
      this._applyStateUpdates(newState, params);

      const diff = this._calculateStateDiff(newState);

      if (this._isDiffEmpty(diff)) {
        return;
      }
      this._emitConnectionStatus();
      await this._executeSubscriptionChanges(diff, newState);

      this._currentState = newState;
    } finally {
      release();
    }
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
      activeSubscriptions: Array.from(this._activeSubscriptions.values()).map(
        (sub) => ({
          key: sub.key,
          type: sub.type,
          createdAt: sub.createdAt,
          lastActivity: sub.lastActivity,
          isActive: sub.isActive,
        }),
      ),
    };
  }

  @backgroundMethod()
  async connect(): Promise<void> {
    await this._ensureClient();
    this._currentState.isConnected = true;
  }

  @backgroundMethod()
  async disconnect(): Promise<void> {
    await this._cleanupAllSubscriptions();
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

  @backgroundMethod()
  async updateL2BookSubscription(
    params: ISubscriptionUpdateParams,
  ): Promise<void> {
    // Validate parameters before proceeding
    if (
      params.l2BookOptions?.mantissa !== undefined &&
      params.l2BookOptions?.mantissa !== null
    ) {
      if (![2, 5].includes(params.l2BookOptions?.mantissa)) {
        console.warn(
          '[HyperLiquid WebSocket] Invalid mantissa parameter detected:',
          params.l2BookOptions?.mantissa,
          'Valid values are: 2, 5, null, undefined. This may cause WebSocket connection issues.',
        );
      }
    }

    // Update the subscription with new L2Book parameters
    // Important: Only update l2BookOptions, keep other state unchanged
    await this.updateSubscriptions({
      l2BookOptions: params.l2BookOptions,
      // Preserve current state to avoid losing currentSymbol and currentUser
      currentSymbol: params.currentSymbol,
      currentUser: params.currentUser,
      isConnected: this._currentState.isConnected,
    });
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

  private _calculateStateDiff(newState: ISubscriptionState): ISubscriptionDiff {
    const currentSpecs = this._getCurrentSubscriptionSpecs();
    const newSpecs = calculateRequiredSubscriptions(newState);
    const diff = calculateSubscriptionDiff(currentSpecs, newSpecs);
    return diff;
  }

  private _isDiffEmpty(diff: ISubscriptionDiff): boolean {
    return diff.toUnsubscribe.length === 0 && diff.toSubscribe.length === 0;
  }

  private async _executeSubscriptionChanges(
    diff: ISubscriptionDiff,
    _newState: ISubscriptionState,
  ): Promise<void> {
    await this._executeUnsubscriptions(diff.toUnsubscribe);
    await this._executeSubscriptions(diff.toSubscribe);
  }

  private async _executeUnsubscriptions(
    toUnsubscribe: ISubscriptionSpec[],
  ): Promise<void> {
    if (toUnsubscribe.length === 0) return;
    const unsubscribePromises = toUnsubscribe.map(async (spec) => {
      try {
        await this._destroySubscription(spec.key);
      } catch (error) {
        console.error(
          `[ServiceHyperliquidSubscription.executeUnsubscriptions] Failed to unsubscribe ${spec.key}:`,
          error,
        );
      }
    });

    await Promise.all(unsubscribePromises);
  }

  private async _executeSubscriptions(
    toSubscribe: ISubscriptionSpec[],
  ): Promise<void> {
    if (toSubscribe.length) {
      // Process subscriptions sequentially to avoid overwhelming the connection
      for (const spec of toSubscribe) {
        try {
          await this._createSubscription(spec);
        } catch (error) {
          console.error(
            `[ServiceHyperliquidSubscription.executeSubscriptions] Failed to subscribe ${spec.key}:`,
            error,
          );
        }
      }
    }
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
        await this._client[Symbol.asyncDispose]();
      } catch (error) {
        console.error(
          '[ServiceHyperliquidSubscription.closeClient] Failed to close client:',
          error,
        );
      }

      this._client = null;
    }
  }

  private _getCurrentSubscriptionSpecs(): ISubscriptionSpec[] {
    return Array.from(this._activeSubscriptions.values()).map((sub) => ({
      type: sub.type,
      key: sub.key,
      params: this._parseKeyToParams(sub.key, sub.type),
      priority: getSubscriptionPriority(sub.type),
    }));
  }

  private async _createSubscriptionDirect(
    spec: ISubscriptionSpec,
    client: SubscriptionClient,
  ): Promise<unknown> {
    const handleData = (data: unknown) => {
      this._handleSubscriptionData(spec.key, data, spec.type);
    };

    // Use type-safe subscription creation function from mapping
    return createSubscription(spec.type, client, spec.params, handleData);
  }

  private async _createSubscription(spec: ISubscriptionSpec): Promise<void> {
    if (this._activeSubscriptions.has(spec.key)) {
      console.warn(
        `[ServiceHyperliquidSubscription.createSubscription] Subscription already exists: ${spec.key}`,
      );
      return;
    }

    const client = await this._ensureClient();

    try {
      const sdkSubscription = await this._createSubscriptionDirect(
        spec,
        client,
      );

      this._activeSubscriptions.set(spec.key, {
        key: spec.key,
        type: spec.type,
        sdkSubscription,
        createdAt: Date.now(),
        lastActivity: Date.now(),
        isActive: true,
      });
    } catch (error) {
      console.error(
        `[ServiceHyperliquidSubscription.createSubscription] Failed to create subscription ${spec.type}:`,
        error,
      );
      throw error;
    }
  }

  private async _destroySubscription(key: string): Promise<void> {
    const subscription = this._activeSubscriptions.get(key);
    if (!subscription) {
      return;
    }

    try {
      const sdkSub = subscription.sdkSubscription;
      if (sdkSub?.unsubscribe && typeof sdkSub.unsubscribe === 'function') {
        try {
          await sdkSub.unsubscribe();
        } catch (error) {
          console.error(
            `[HyperLiquid WebSocket] unsubscribe() failed for ${key}:`,
            error,
          );
          throw error;
        }
      }
    } catch (error) {
      console.error(
        `[ServiceHyperliquidSubscription.destroySubscription] Failed to destroy subscription ${key}:`,
        error,
      );
    }

    this._activeSubscriptions.delete(key);
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

  private _handleSubscriptionData(
    key: string,
    data: unknown,
    subscriptionType: ESubscriptionType,
  ): void {
    try {
      const subscription = this._activeSubscriptions.get(key);
      if (subscription) {
        subscription.lastActivity = Date.now();
        this._activeSubscriptions.set(key, subscription);
      }

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
        metadata.coin = parts[2];
      } else if (
        subscriptionType === ESubscriptionType.WEB_DATA2 ||
        subscriptionType === ESubscriptionType.USER_FILLS ||
        subscriptionType === ESubscriptionType.USER_EVENTS ||
        subscriptionType === ESubscriptionType.USER_NOTIFICATIONS ||
        subscriptionType === ESubscriptionType.ACTIVE_ASSET_DATA
      ) {
        metadata.userId = parts[2];
        if (subscriptionType === ESubscriptionType.ACTIVE_ASSET_DATA) {
          metadata.coin = parts[3];
        }
      }

      appEventBus.emit(EAppEventBusNames.HyperliquidDataUpdate, {
        type: SUBSCRIPTION_TYPE_INFO[subscriptionType].eventType,
        subType: subscriptionType,
        data,
        metadata,
      });
    } catch (error) {
      console.error(
        `[ServiceHyperliquidSubscription.handleSubscriptionData] Failed to handle data for ${key}:`,
        error,
      );
    }
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
