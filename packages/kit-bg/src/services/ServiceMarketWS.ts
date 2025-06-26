import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAppSocketEventNames } from '@onekeyhq/shared/types/socket';

import { notificationStatusAtom } from '../states/jotai/atoms/notifications';

import ServiceBase from './ServiceBase';

import type { Socket } from 'socket.io-client';

const EOperation = {
  subscribe: 'subscribe',
  unsubscribe: 'unsubscribe',
};

const EChannel = {
  tokenTxs: 'tokenTxs',
  ohlcv: 'ohlcv',
};

type IMarketSubscription = {
  channel: string;
  networkId: string;
  tokenAddress: string;
  queryType: 'simple';
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
  async connect(_instanceId: string): Promise<void> {
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
          queryType: 'simple',
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
  }: {
    networkId: string;
    tokenAddress: string;
  }) {
    const subscriptionKey = `${EChannel.ohlcv}-${networkId}-${tokenAddress}`;

    console.log('subscribeOHLCV', subscriptionKey);

    if (this.subscriptions.has(subscriptionKey)) {
      return;
    }

    const message: IMarketMessage = {
      operation: EOperation.subscribe,
      args: [
        {
          channel: EChannel.ohlcv,
          networkId,
          tokenAddress,
          queryType: 'simple',
        },
      ],
    };

    console.log('subscribeOHLCV', message);

    if (!this.socket?.connected) {
      console.error('WebSocket not connected');
      return;
    }

    this.socket.emit(EAppSocketEventNames.market, message);
    this.subscriptions.add(subscriptionKey);
  }

  async unsubscribe({
    channel,
    networkId,
    tokenAddress,
  }: {
    channel: string;
    networkId: string;
    tokenAddress: string;
  }) {
    const subscriptionKey = `${channel}-${networkId}-${tokenAddress}`;

    if (!this.subscriptions.has(subscriptionKey)) {
      return;
    }

    const message: IMarketMessage = {
      operation: EOperation.unsubscribe,
      args: [
        {
          channel,
          networkId,
          tokenAddress,
          queryType: 'simple',
        },
      ],
    };

    if (!this.socket?.connected) {
      return;
    }

    this.socket.emit(EAppSocketEventNames.market, message);
    this.subscriptions.delete(subscriptionKey);
  }

  private handleMarketMessage(data: unknown) {
    console.log('Market data received:', data);

    // Basic type validation
    if (typeof data !== 'object' || data === null) {
      return;
    }

    // Check required properties
    const requiredProperties = ['channel', 'networkId', 'tokenAddress'];
    const hasAllProperties = requiredProperties.every((prop) => prop in data);

    if (!hasAllProperties) {
      return;
    }

    const marketData = data as {
      channel: string;
      networkId: string;
      tokenAddress: string;
    };

    // Emit event to app event bus
    appEventBus.emit(EAppEventBusNames.MarketWSDataUpdate, {
      channel: marketData.channel,
      networkId: marketData.networkId,
      tokenAddress: marketData.tokenAddress,
      data,
    });
  }

  async getConnectionStatus() {
    const { websocketConnected } = await notificationStatusAtom.get();
    return {
      connected: websocketConnected,
      subscriptions: Array.from(this.subscriptions),
    };
  }
}

export default ServiceMarketWS;
