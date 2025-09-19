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

import type { ISubscriptionType } from './MarketSubscriptionTracker';
import type { IWsPriceData, IWsTxsData } from './types';
import type { Socket } from 'socket.io-client';

type IMarketSubscription = {
  channel: string;
  networkId: string;
  tokenAddress: string;
  chartType?: string;
  currency?: string;
};

type IMarketMessage = {
  operation: string;
  args: IMarketSubscription[];
};

class ServiceMarketWS extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  private socket: Socket | null = null;

  private isMarketListenerRegistered = false;

  subscriptionTracker: MarketSubscriptionTracker =
    new MarketSubscriptionTracker();

  @backgroundMethod()
  async clearDataCount(params: { address: string; type: ISubscriptionType }) {
    this.subscriptionTracker.clearDataCount(params);
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
      this.socket.on(EAppSocketEventNames.market, (data: unknown) => {
        this.handleMarketMessage(data);
      });
      this.isMarketListenerRegistered = true;
    }

    return Promise.resolve();
  }

  @backgroundMethod()
  async disconnect() {
    // Remove market data listener
    if (this.socket && this.isMarketListenerRegistered) {
      this.socket.off(EAppSocketEventNames.market);
      this.isMarketListenerRegistered = false;
    }

    this.socket = null;
    this.subscriptionTracker.clear();
  }

  @backgroundMethod()
  async subscribeTokenTxs({
    networkId,
    tokenAddress,
  }: {
    networkId: string;
    tokenAddress: string;
  }) {
    // Check if already subscribed
    if (
      this.subscriptionTracker.hasSubscription({
        address: tokenAddress,
        type: EChannel.tokenTxs,
      })
    ) {
      this.subscriptionTracker.addSubscription({
        address: tokenAddress,
        type: EChannel.tokenTxs,
        networkId,
      });
      return;
    }

    const message: IMarketMessage = {
      operation: EOperation.subscribe,
      args: [
        {
          channel: EChannel.tokenTxs,
          networkId,
          tokenAddress,
        },
      ],
    };

    if (!this.socket?.connected) {
      console.error('WebSocket not connected');
      return;
    }

    this.socket.emit(EAppSocketEventNames.market, message);
    this.subscriptionTracker.addSubscription({
      address: tokenAddress,
      type: EChannel.tokenTxs,
      networkId,
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
    };

    // Add optional parameters if provided
    if (chartType) {
      subscriptionArgs.chartType = chartType;
    }
    if (currency) {
      subscriptionArgs.currency = currency;
    }

    const message: IMarketMessage = {
      operation: EOperation.subscribe,
      args: [subscriptionArgs],
    };

    if (!this.socket?.connected) {
      console.error('WebSocket not connected');
      return;
    }

    this.socket.emit(EAppSocketEventNames.market, message);
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
    };

    // Add optional parameters if provided
    if (chartType) {
      subscriptionArgs.chartType = chartType;
    }
    if (currency) {
      subscriptionArgs.currency = currency;
    }

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
  }: {
    networkId: string;
    tokenAddress: string;
  }) {
    this.subscriptionTracker.removeSubscription({
      address: tokenAddress,
      type: EChannel.tokenTxs,
      networkId,
    });

    // Only unsubscribe from WebSocket if no more connections
    if (
      !this.subscriptionTracker.hasSubscription({
        address: tokenAddress,
        type: EChannel.tokenTxs,
      })
    ) {
      await this.unsubscribe({
        channel: EChannel.tokenTxs,
        networkId,
        tokenAddress,
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

    if ('type' in messageData && 'data' in messageData) {
      messageType = messageData.type as string;
      processedData = messageData.data as Record<string, any>;
    } else {
      return;
    }

    if (messageType === 'TXS_DATA') {
      channel = EChannel.tokenTxs;
      const txsData = processedData as IWsTxsData;

      // Check both from and to addresses for TXS_DATA
      const fromAddress = txsData.from?.address;
      const toAddress = txsData.to?.address;

      // Try to find which address has subscription and increment its data count
      let hasSubscription = false;
      if (
        fromAddress &&
        this.subscriptionTracker.hasSubscription({
          address: fromAddress,
          type: EChannel.tokenTxs,
        })
      ) {
        this.subscriptionTracker.incrementDataCount({
          address: fromAddress,
          type: EChannel.tokenTxs,
        });
        tokenAddress = fromAddress;
        hasSubscription = true;
      } else if (
        toAddress &&
        this.subscriptionTracker.hasSubscription({
          address: toAddress,
          type: EChannel.tokenTxs,
        })
      ) {
        this.subscriptionTracker.incrementDataCount({
          address: toAddress,
          type: EChannel.tokenTxs,
        });
        tokenAddress = toAddress;
        hasSubscription = true;
      }

      // If no subscription found, skip this message
      if (!hasSubscription) {
        return;
      }
    } else if (messageType === 'PRICE_DATA') {
      channel = EChannel.ohlcv;
      const priceData = processedData as IWsPriceData;
      tokenAddress = priceData.address;

      // Increment data count for PRICE_DATA
      if (
        this.subscriptionTracker.hasSubscription({
          address: tokenAddress,
          type: EChannel.ohlcv,
        })
      ) {
        this.subscriptionTracker.incrementDataCount({
          address: tokenAddress,
          type: EChannel.ohlcv,
        });
      } else {
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

    // Check if subscription should be auto-unsubscribed due to data accumulation
    if (
      this.subscriptionTracker.shouldUnsubscribeWithDefaultThreshold({
        address: tokenAddress,
        type: channel,
      })
    ) {
      const subscription = this.subscriptionTracker.getSubscription({
        address: tokenAddress,
        type: channel,
      });
      if (subscription) {
        console.warn(
          `Auto-unsubscribing due to data accumulation: ${tokenAddress}, channel: ${channel}, dataCount: ${subscription.dataCount}`,
        );

        // Auto-unsubscribe based on channel type
        if (channel === EChannel.tokenTxs) {
          void this.unsubscribeTokenTxs({
            networkId: subscription.networkId,
            tokenAddress: subscription.address,
          });
        } else if (channel === EChannel.ohlcv) {
          void this.unsubscribeOHLCV({
            networkId: subscription.networkId,
            tokenAddress: subscription.address,
            chartType: subscription.chartType,
            currency: subscription.currency,
          });
        }
      }
    }

    // Emit event to app event bus with standardized format
    appEventBus.emit(EAppEventBusNames.MarketWSDataUpdate, {
      channel,
      tokenAddress,
      messageType,
      data: processedData,
      originalData: data,
    });
  }
}

export default ServiceMarketWS;
