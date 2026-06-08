import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAppSocketEventNames } from '@onekeyhq/shared/types/socket';

import ServiceBase from '../ServiceBase';

import { EChannel, EOperation } from './const';
import { MarketSubscriptionTracker } from './MarketSubscriptionTracker';
import { EMessageType } from './types/messageType';
import {
  convertOkxPriceDataToWsPriceData,
  isOkxPriceData,
} from './types/okxPriceData';
import { convertOkxTxsDataToWsTxsData, isOkxTxsData } from './types/okxTxsData';

import type {
  ISubscription,
  ISubscriptionType,
} from './MarketSubscriptionTracker';
import type { IWsPriceData, IWsTxsData } from './types';
import type { Socket } from 'socket.io-client';

type IMarketSubscription = {
  channel: string;
  networkId: string;
  tokenAddress: string;
  chartType?: string;
  currencyCode?: string;
  dataSource?: string;
};

type IMarketMessage = {
  operation: string;
  args: IMarketSubscription[];
};

class ServiceMarketWS extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
    // Drop the WS connection + cached tx buffers on critical memory
    // pressure. The next subscribeTokenTxs() call will reconnect on
    // demand; until then we free the per-token data accumulated by
    // MarketSubscriptionTracker.
    appEventBus.on(EAppEventBusNames.MemoryPressureWarning, (event) => {
      if (event.level !== 'critical') return;
      void this.disconnect();
    });
  }

  private socket: Socket | null = null;

  private isMarketListenerRegistered = false;

  private isReconnectListenerRegistered = false;

  private retryTimers: ReturnType<typeof setTimeout>[] = [];

  private reconnectHandler = () => {
    this.resubscribeAll();
  };

  private marketHandler = (data: unknown) => {
    console.log('handleMarketMessage', data);
    this.handleMarketMessage(data);
  };

  subscriptionTracker: MarketSubscriptionTracker =
    new MarketSubscriptionTracker();

  @backgroundMethod()
  async clearDataCount(params: {
    address: string;
    type: ISubscriptionType;
    networkId?: string;
    chartType?: string;
    currency?: string;
  }) {
    this.subscriptionTracker.clearDataCount(params);
  }

  private getSubscriptionQuery(subscription: ISubscription) {
    return {
      address: subscription.address,
      type: subscription.type,
      networkId: subscription.networkId,
      chartType: subscription.chartType,
      currency: subscription.currency,
    };
  }

  private incrementDataCountForSubscriptions(subscriptions: ISubscription[]) {
    subscriptions.forEach((subscription) => {
      this.subscriptionTracker.incrementDataCount(
        this.getSubscriptionQuery(subscription),
      );
    });
  }

  private getUniqueSubscriptionNetworkId(subscriptions: ISubscription[]) {
    return subscriptions.length === 1 ? subscriptions[0].networkId : undefined;
  }

  private autoUnsubscribeStaleSubscriptions(subscriptions: ISubscription[]) {
    subscriptions.forEach((subscription) => {
      const subscriptionQuery = this.getSubscriptionQuery(subscription);
      if (
        !this.subscriptionTracker.shouldUnsubscribeWithDefaultThreshold(
          subscriptionQuery,
        )
      ) {
        return;
      }

      const latestSubscription =
        this.subscriptionTracker.getSubscription(subscriptionQuery);
      if (!latestSubscription) {
        return;
      }

      console.warn(
        `Auto-unsubscribing due to data accumulation: ${latestSubscription.address}, channel: ${latestSubscription.type}, dataCount: ${latestSubscription.dataCount}`,
      );

      if (latestSubscription.type === EChannel.tokenTxs) {
        void this.unsubscribeTokenTxs({
          networkId: latestSubscription.networkId,
          tokenAddress: latestSubscription.address,
          currency: latestSubscription.currency,
        });
      } else if (latestSubscription.type === EChannel.ohlcv) {
        void this.unsubscribeOHLCV({
          networkId: latestSubscription.networkId,
          tokenAddress: latestSubscription.address,
          chartType: latestSubscription.chartType,
          currency: latestSubscription.currency,
        });
      }
    });
  }

  @backgroundMethod()
  async connect(): Promise<void> {
    // Get the shared WebSocket from PushProviderWebSocket
    const webSocketProvider = (
      await this.backgroundApi.serviceNotification.getNotificationProvider()
    )?.webSocketProvider;

    if (!webSocketProvider) {
      throw new OneKeyLocalError('WebSocket provider not available');
    }

    this.socket = webSocketProvider.getSocket();

    if (!this.socket) {
      throw new OneKeyLocalError('WebSocket connection not available');
    }

    // Register market data listener only once
    if (!this.isMarketListenerRegistered) {
      this.socket.on(EAppSocketEventNames.market, this.marketHandler);
      this.isMarketListenerRegistered = true;
    }

    // Re-subscribe all active subscriptions after reconnect
    if (!this.isReconnectListenerRegistered) {
      this.socket.on('connect', this.reconnectHandler);
      this.isReconnectListenerRegistered = true;
    }

    return Promise.resolve();
  }

  @backgroundMethod()
  async ensureSubscription({
    networkId,
    tokenAddress,
    chartType,
    currency,
    channel,
  }: {
    networkId: string;
    tokenAddress: string;
    chartType?: string;
    currency?: string;
    channel: string;
  }) {
    if (!this.socket) {
      return;
    }

    const hasExisting = this.subscriptionTracker.hasSubscription({
      address: tokenAddress,
      type: channel as ISubscriptionType,
      networkId,
      chartType,
      currency,
    });

    if (hasExisting) {
      // Subscription still exists in tracker — just re-emit to server and reset data count
      const subscriptionArgs: IMarketSubscription = {
        channel,
        networkId,
        tokenAddress,
        chartType,
        currencyCode: currency,
        dataSource: 'okx',
      };
      const message: IMarketMessage = {
        operation: EOperation.subscribe,
        args: [subscriptionArgs],
      };
      this.emitSubscribeWithRetry({ message });
      this.subscriptionTracker.clearDataCount({
        address: tokenAddress,
        type: channel as ISubscriptionType,
        networkId,
        chartType,
        currency,
      });
    } else if (channel === EChannel.ohlcv) {
      // Subscription was auto-unsubscribed — re-create it
      await this.subscribeOHLCV({
        networkId,
        tokenAddress,
        chartType,
        currency,
      });
    } else if (channel === EChannel.tokenTxs) {
      await this.subscribeTokenTxs({
        networkId,
        tokenAddress,
        currency,
      });
    }
  }

  private resubscribeAll() {
    // Cancel all pending retry timers to prevent duplicate subscriptions
    this.clearRetryTimers();

    const subscriptions = this.subscriptionTracker.getSubscriptions();
    if (subscriptions.length === 0) {
      return;
    }
    console.log(
      `Reconnected, re-subscribing ${subscriptions.length} active subscription(s)`,
    );
    for (const sub of subscriptions) {
      const subscriptionArgs: IMarketSubscription = {
        channel: sub.type,
        networkId: sub.networkId,
        tokenAddress: sub.address,
        chartType: sub.chartType,
        currencyCode: sub.currency,
        dataSource: 'okx',
      };
      const message: IMarketMessage = {
        operation: EOperation.subscribe,
        args: [subscriptionArgs],
      };
      this.socket?.emit(EAppSocketEventNames.market, message);
      // Reset data count on re-subscribe to prevent stale threshold triggers
      this.subscriptionTracker.clearDataCount({
        address: sub.address,
        type: sub.type,
        networkId: sub.networkId,
        chartType: sub.chartType,
        currency: sub.currency,
      });
    }
  }

  private emitSubscribeWithRetry({
    message,
    retries = 3,
    delayMs = 2000,
  }: {
    message: IMarketMessage;
    retries?: number;
    delayMs?: number;
  }) {
    if (this.socket?.connected) {
      this.socket.emit(EAppSocketEventNames.market, message);
      return;
    }
    if (retries <= 0) {
      console.error('WebSocket not connected after retries, subscribe failed');
      return;
    }
    const timer = setTimeout(() => {
      this.retryTimers = this.retryTimers.filter((t) => t !== timer);
      this.emitSubscribeWithRetry({
        message,
        retries: retries - 1,
        delayMs,
      });
    }, delayMs);
    this.retryTimers.push(timer);
  }

  private clearRetryTimers() {
    this.retryTimers.forEach(clearTimeout);
    this.retryTimers = [];
  }

  @backgroundMethod()
  async disconnect() {
    // Cancel all pending retry timers
    this.clearRetryTimers();

    // Remove market data listener (pass specific handler to avoid removing others)
    if (this.socket && this.isMarketListenerRegistered) {
      this.socket.off(EAppSocketEventNames.market, this.marketHandler);
      this.isMarketListenerRegistered = false;
    }

    if (this.socket && this.isReconnectListenerRegistered) {
      this.socket.off('connect', this.reconnectHandler);
      this.isReconnectListenerRegistered = false;
    }

    this.socket = null;
    this.subscriptionTracker.clear();
  }

  @backgroundMethod()
  async subscribeTokenTxs({
    networkId,
    tokenAddress,
    currency = 'usd',
  }: {
    networkId: string;
    tokenAddress: string;
    currency?: string;
  }) {
    // Check if already subscribed
    if (
      this.subscriptionTracker.hasSubscription({
        address: tokenAddress,
        type: EChannel.tokenTxs,
        networkId,
        currency,
      })
    ) {
      this.subscriptionTracker.addSubscription({
        address: tokenAddress,
        type: EChannel.tokenTxs,
        networkId,
        currency,
      });
      return;
    }

    const subscriptionArgs: IMarketSubscription = {
      channel: EChannel.tokenTxs,
      networkId,
      tokenAddress,
      currencyCode: currency,
      dataSource: 'okx',
    };

    const message: IMarketMessage = {
      operation: EOperation.subscribe,
      args: [subscriptionArgs],
    };

    this.emitSubscribeWithRetry({ message });
    this.subscriptionTracker.addSubscription({
      address: tokenAddress,
      type: EChannel.tokenTxs,
      networkId,
      currency,
    });
  }

  @backgroundMethod()
  async subscribeOHLCV({
    networkId,
    tokenAddress,
    chartType = '1m',
    currency = 'usd',
  }: {
    networkId: string;
    tokenAddress: string;
    chartType?: string;
    currency?: string;
  }) {
    // Check if already subscribed
    if (
      this.subscriptionTracker.hasSubscription({
        address: tokenAddress,
        type: EChannel.ohlcv,
        networkId,
        chartType,
        currency,
      })
    ) {
      this.subscriptionTracker.addSubscription({
        address: tokenAddress,
        type: EChannel.ohlcv,
        networkId,
        chartType,
        currency,
      });
      return;
    }

    const subscriptionArgs: IMarketSubscription = {
      channel: EChannel.ohlcv,
      networkId,
      tokenAddress,
      chartType,
      currencyCode: currency,
      dataSource: 'okx',
    };

    const message: IMarketMessage = {
      operation: EOperation.subscribe,
      args: [subscriptionArgs],
    };

    this.emitSubscribeWithRetry({ message });
    this.subscriptionTracker.addSubscription({
      address: tokenAddress,
      type: EChannel.ohlcv,
      networkId,
      chartType,
      currency,
    });
  }

  private async unsubscribe({
    channel,
    networkId,
    tokenAddress,
    chartType,
    currency,
  }: {
    channel: string;
    networkId: string;
    tokenAddress: string;
    chartType?: string;
    currency?: string;
  }) {
    const subscriptionArgs: IMarketSubscription = {
      channel,
      networkId,
      tokenAddress,
      chartType,
      currencyCode: currency,
      dataSource: 'okx',
    };

    const message: IMarketMessage = {
      operation: EOperation.unsubscribe,
      args: [subscriptionArgs],
    };

    if (!this.socket?.connected) {
      return;
    }

    this.socket.emit(EAppSocketEventNames.market, message);
  }

  @backgroundMethod()
  async unsubscribeTokenTxs({
    networkId,
    tokenAddress,
    currency = 'usd',
  }: {
    networkId: string;
    tokenAddress: string;
    currency?: string;
  }) {
    this.subscriptionTracker.removeSubscription({
      address: tokenAddress,
      type: EChannel.tokenTxs,
      networkId,
      currency,
    });

    // Only unsubscribe from WebSocket if no more connections
    if (
      !this.subscriptionTracker.hasSubscription({
        address: tokenAddress,
        type: EChannel.tokenTxs,
        networkId,
        currency,
      })
    ) {
      await this.unsubscribe({
        channel: EChannel.tokenTxs,
        networkId,
        tokenAddress,
        currency,
      });
    }
  }

  @backgroundMethod()
  async unsubscribeOHLCV({
    networkId,
    tokenAddress,
    chartType = '1m',
    currency = 'usd',
  }: {
    networkId: string;
    tokenAddress: string;
    chartType?: string;
    currency?: string;
  }) {
    this.subscriptionTracker.removeSubscription({
      address: tokenAddress,
      type: EChannel.ohlcv,
      networkId,
      chartType,
      currency,
    });

    // Only unsubscribe from WebSocket if no more connections
    if (
      !this.subscriptionTracker.hasSubscription({
        address: tokenAddress,
        type: EChannel.ohlcv,
        networkId,
        chartType,
        currency,
      })
    ) {
      await this.unsubscribe({
        channel: EChannel.ohlcv,
        networkId,
        tokenAddress,
        chartType,
        currency,
      });
    }
  }

  private handleMarketMessage(data: unknown) {
    // Basic type validation
    if (typeof data !== 'object' || data === null) {
      return;
    }

    const messageData = data as Record<string, any>;

    // Handle different message formats from the WebSocket
    // Support both direct channel format and nested data format
    let channel: ISubscriptionType;
    let tokenAddress = '';
    let messageType: string | undefined;
    let processedData: any;
    let matchedSubscriptions: ISubscription[] = [];

    console.log('messageData', messageData);

    if ('type' in messageData && 'data' in messageData) {
      messageType = messageData.type as string;
      const rawData = messageData.data as Record<string, any>;

      if (messageType === EMessageType.TXS_DATA && Array.isArray(rawData)) {
        const normalizedItem = rawData.find((item) => isOkxTxsData(item));
        if (!normalizedItem) {
          return;
        }

        processedData = convertOkxTxsDataToWsTxsData(normalizedItem);
      } else if (
        messageType === EMessageType.TXS_DATA &&
        isOkxTxsData(rawData)
      ) {
        processedData = convertOkxTxsDataToWsTxsData(rawData);
      } else if (
        messageType === EMessageType.PRICE_DATA &&
        Array.isArray(rawData)
      ) {
        const normalizedItem = rawData.find((item) => isOkxPriceData(item));
        if (!normalizedItem) {
          return;
        }

        processedData = convertOkxPriceDataToWsPriceData(normalizedItem);
      } else if (
        messageType === EMessageType.PRICE_DATA &&
        isOkxPriceData(rawData)
      ) {
        processedData = convertOkxPriceDataToWsPriceData(rawData);
      } else {
        processedData = rawData;
      }
    } else {
      return;
    }

    if (messageType === EMessageType.TXS_DATA) {
      channel = EChannel.tokenTxs;
      const txsData = processedData as IWsTxsData;

      // Check both from and to addresses for TXS_DATA
      const fromAddress = txsData.from?.address;
      const toAddress = txsData.to?.address;

      // Try to find which address has subscription
      if (fromAddress) {
        matchedSubscriptions =
          this.subscriptionTracker.getSubscriptionsByParams({
            address: fromAddress,
            type: EChannel.tokenTxs,
          });
      }
      if (matchedSubscriptions.length > 0 && fromAddress) {
        tokenAddress = fromAddress;
      } else if (toAddress) {
        matchedSubscriptions =
          this.subscriptionTracker.getSubscriptionsByParams({
            address: toAddress,
            type: EChannel.tokenTxs,
          });
        if (matchedSubscriptions.length > 0) {
          tokenAddress = toAddress;
        }
      }

      // If no subscription found, skip this message
      if (matchedSubscriptions.length === 0) {
        return;
      }
    } else if (messageType === EMessageType.PRICE_DATA) {
      channel = EChannel.ohlcv;
      const priceData = processedData as IWsPriceData;
      tokenAddress = priceData.address;

      matchedSubscriptions = this.subscriptionTracker.getSubscriptionsByParams({
        address: tokenAddress,
        type: EChannel.ohlcv,
        chartType: priceData.type,
      });
      if (matchedSubscriptions.length === 0) {
        // If no subscription found, skip this message
        return;
      }
    } else {
      console.warn('Invalid market data: missing required fields', {
        tokenAddress,
        originalData: data,
      });

      return;
    }

    this.incrementDataCountForSubscriptions(matchedSubscriptions);
    const networkId = this.getUniqueSubscriptionNetworkId(matchedSubscriptions);
    this.autoUnsubscribeStaleSubscriptions(matchedSubscriptions);

    // Emit event to app event bus with standardized format
    appEventBus.emit(EAppEventBusNames.MarketWSDataUpdate, {
      channel,
      tokenAddress,
      networkId,
      isSubscriptionAmbiguous: matchedSubscriptions.length > 1,
      messageType,
      data: processedData,
      originalData: data,
    });
  }
}

export default ServiceMarketWS;
