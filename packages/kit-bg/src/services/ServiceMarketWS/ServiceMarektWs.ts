import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAppSocketEventNames } from '@onekeyhq/shared/types/socket';

import ServiceBase from '../ServiceBase';

import type { IWsPriceData, IWsTxsData } from './types';
import type { Socket } from 'socket.io-client';

const EOperation = {
  subscribe: 'subscribe',
  unsubscribe: 'unsubscribe',
};

export const EChannel = {
  tokenTxs: 'tokenTxs',
  ohlcv: 'ohlcv',
};

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

  private subscriptions = new Set<string>();

  private socket: Socket | null = null;

  private isMarketListenerRegistered = false;

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
    this.subscriptions.clear();
  }

  @backgroundMethod()
  async subscribeTokenTxs({
    networkId,
    tokenAddress,
  }: {
    networkId: string;
    tokenAddress: string;
  }) {
    const subscriptionKey = `${EChannel.tokenTxs}-${networkId}-${tokenAddress}`;

    if (this.subscriptions.has(subscriptionKey)) {
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
    this.subscriptions.add(subscriptionKey);
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
    const subscriptionKey = `${EChannel.ohlcv}-${networkId}-${tokenAddress}-${chartType}-${currency}`;

    if (this.subscriptions.has(subscriptionKey)) {
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
    this.subscriptions.add(subscriptionKey);
  }

  @backgroundMethod()
  async unsubscribe({
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
    // Generate the same subscription key as used in subscribe methods
    let subscriptionKey: string;
    if (channel === EChannel.ohlcv && chartType && currency) {
      subscriptionKey = `${channel}-${networkId}-${tokenAddress}-${chartType}-${currency}`;
    } else {
      subscriptionKey = `${channel}-${networkId}-${tokenAddress}`;
    }

    console.log('unsubscribe', subscriptionKey);

    if (!this.subscriptions.has(subscriptionKey)) {
      console.log('Subscription not found:', subscriptionKey);
      return;
    }

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
    this.subscriptions.delete(subscriptionKey);
  }

  @backgroundMethod()
  async unsubscribeTokenTxs({
    networkId,
    tokenAddress,
  }: {
    networkId: string;
    tokenAddress: string;
  }) {
    await this.unsubscribe({
      channel: EChannel.tokenTxs,
      networkId,
      tokenAddress,
    });
  }

  @backgroundMethod()
  async unsubscribeOHLCV({
    networkId,
    tokenAddress,
    chartType = '1m',
    currency = 'pair',
  }: {
    networkId: string;
    tokenAddress: string;
    chartType?: string;
    currency?: string;
  }) {
    await this.unsubscribe({
      channel: EChannel.ohlcv,
      networkId,
      tokenAddress,
      chartType,
      currency,
    });
  }

  private handleMarketMessage(data: unknown) {
    console.log('Market data received:', data);

    // Basic type validation
    if (typeof data !== 'object' || data === null) {
      return;
    }

    const messageData = data as Record<string, any>;

    console.log('messageData', messageData);

    // Handle different message formats from the WebSocket
    // Support both direct channel format and nested data format
    let channel: string;
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
    } else if (messageType === 'PRICE_DATA') {
      channel = EChannel.ohlcv;

      const priceData = processedData as IWsPriceData;

      tokenAddress = priceData.address;
    } else {
      console.warn('Invalid market data: missing required fields', {
        tokenAddress,
        originalData: data,
      });

      return;
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
