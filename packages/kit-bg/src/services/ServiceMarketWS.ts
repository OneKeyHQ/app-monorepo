import { io } from 'socket.io-client';

import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

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

  private socket: Socket | null = null;

  private subscriptions = new Set<string>();

  @backgroundMethod()
  async connect(instanceId: string): Promise<void> {
    if (this.socket?.connected) {
      return Promise.resolve();
    }

    const endpoint = 'wss://notification.onekeytest.com';

    return new Promise((resolve, reject) => {
      this.socket = io(endpoint, {
        transports: ['websocket'],
        auth: { instanceId },
      });

      this.socket.on('connect', () => {
        console.log('Market WebSocket connected');
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        console.error('Market WebSocket connect error:', error);
        reject(error);
      });

      this.socket.on('disconnect', (reason) => {
        console.log('Market WebSocket disconnected:', reason);
      });

      this.socket.on('market', (body) => {
        this.handleMarketMessage(body);
      });

      this.socket.on('error', (error) => {
        console.error('Market WebSocket error:', error);
      });
    });
  }

  @backgroundMethod()
  async disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.subscriptions.clear();
    }
  }

  async subscribeTokenTxs({
    networkId,
    tokenAddress,
  }: {
    networkId: string;
    tokenAddress: string;
  }) {
    if (!this.socket?.connected) {
      console.error('WebSocket not connected');
      return;
    }

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

    this.socket.emit('market', message);
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
    if (!this.socket?.connected) {
      console.error('WebSocket not connected');
      return;
    }

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

    this.socket.emit('market', message);
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
    if (!this.socket?.connected) {
      return;
    }

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

    this.socket.emit('market', message);
    this.subscriptions.delete(subscriptionKey);
  }

  private handleMarketMessage(data: unknown) {
    console.log('data', data);

    if (
      typeof data !== 'object' ||
      data === null ||
      !('channel' in data) ||
      !('networkId' in data) ||
      !('tokenAddress' in data)
    ) {
      return;
    }

    const marketData = data as {
      channel: string;
      networkId: string;
      tokenAddress: string;
    };

    // Emit event instead of calling callback
    appEventBus.emit(EAppEventBusNames.MarketWSDataUpdate, {
      channel: marketData.channel,
      networkId: marketData.networkId,
      tokenAddress: marketData.tokenAddress,
      data,
    });
  }

  async getConnectionStatus() {
    return {
      connected: this.socket?.connected || false,
      subscriptions: Array.from(this.subscriptions),
    };
  }
}

export default ServiceMarketWS;
