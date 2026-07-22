import {
  HttpTransport,
  InfoClient,
  SubscriptionClient,
  WebSocketTransport,
} from '@nktkas/hyperliquid';

import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type {
  ICandle,
  IPerpsSubscription,
} from '@onekeyhq/shared/types/hyperliquid/sdk';
import type {
  IMarketTokenKLineDataPoint,
  IMarketTokenKLineResponse,
} from '@onekeyhq/shared/types/marketV2';

import { normalizeHyperliquidCandle } from './hyperliquidCandleUtils';

import type { IHyperliquidCandleInterval } from './hyperliquidCandleUtils';
import type { ITradingViewNativeHyperliquidEnvironment } from '../types';

type IHyperliquidCandleListener = (point: IMarketTokenKLineDataPoint) => void;

interface IHyperliquidCandleListenerRegistration {
  listener: IHyperliquidCandleListener;
}

interface IHyperliquidCandleChannel {
  coin: string;
  interval: IHyperliquidCandleInterval;
  listeners: Map<string, IHyperliquidCandleListenerRegistration>;
  mutation: Promise<void>;
  subscription?: IPerpsSubscription;
}

interface IHyperliquidEnvironmentConnection {
  channels: Map<string, IHyperliquidCandleChannel>;
  client: SubscriptionClient;
  isActive: boolean;
  transport: WebSocketTransport;
}

interface ISubscribeHyperliquidCandleParams {
  coin: string;
  environment: ITradingViewNativeHyperliquidEnvironment;
  interval: IHyperliquidCandleInterval;
  listener: IHyperliquidCandleListener;
  subscriberId: string;
}

interface IFetchHyperliquidCandlesParams {
  coin: string;
  environment: ITradingViewNativeHyperliquidEnvironment;
  interval: IHyperliquidCandleInterval;
  signal?: AbortSignal;
  timeFrom: number;
  timeTo: number;
}

function getChannelKey(coin: string, interval: IHyperliquidCandleInterval) {
  return `${coin}:${interval}`;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export class TradingViewNativeHyperliquidGateway {
  private readonly connections = new Map<
    ITradingViewNativeHyperliquidEnvironment,
    IHyperliquidEnvironmentConnection
  >();

  private readonly environmentMutations = new Map<
    ITradingViewNativeHyperliquidEnvironment,
    Promise<void>
  >();

  private readonly infoClients = new Map<
    ITradingViewNativeHyperliquidEnvironment,
    InfoClient
  >();

  private readonly restartPromises = new Map<
    ITradingViewNativeHyperliquidEnvironment,
    Promise<void>
  >();

  private createConnection(
    environment: ITradingViewNativeHyperliquidEnvironment,
  ): IHyperliquidEnvironmentConnection {
    const transport = new WebSocketTransport({
      isTestnet: environment === 'testnet',
      reconnect: {
        connectionTimeout: 5000,
        maxRetries: 999,
        reconnectionDelay: (attempt: number) =>
          Math.min(2 ** attempt * 150, 8000),
      },
      resubscribe: true,
    });
    return {
      channels: new Map(),
      client: new SubscriptionClient({ transport }),
      isActive: true,
      transport,
    };
  }

  private getConnection(environment: ITradingViewNativeHyperliquidEnvironment) {
    const existing = this.connections.get(environment);
    if (existing?.isActive) {
      return existing;
    }

    const connection = this.createConnection(environment);
    this.connections.set(environment, connection);
    return connection;
  }

  private getInfoClient(environment: ITradingViewNativeHyperliquidEnvironment) {
    const existing = this.infoClients.get(environment);
    if (existing) {
      return existing;
    }

    const client = new InfoClient({
      transport: new HttpTransport({ isTestnet: environment === 'testnet' }),
    });
    this.infoClients.set(environment, client);
    return client;
  }

  private enqueueChannelMutation(
    channel: IHyperliquidCandleChannel,
    mutation: () => Promise<void>,
  ) {
    const nextMutation = channel.mutation.catch(() => undefined).then(mutation);
    channel.mutation = nextMutation.catch(() => undefined);
    return nextMutation;
  }

  private enqueueEnvironmentMutation<T>(
    environment: ITradingViewNativeHyperliquidEnvironment,
    mutation: () => Promise<T>,
  ) {
    const previousMutation =
      this.environmentMutations.get(environment) ?? Promise.resolve();
    const nextMutation = previousMutation.catch(() => undefined).then(mutation);
    this.environmentMutations.set(
      environment,
      nextMutation.then(
        () => undefined,
        () => undefined,
      ),
    );
    return nextMutation;
  }

  private async reconcileChannel({
    channel,
    connection,
    environment,
  }: {
    channel: IHyperliquidCandleChannel;
    connection: IHyperliquidEnvironmentConnection;
    environment: ITradingViewNativeHyperliquidEnvironment;
  }) {
    if (
      !connection.isActive ||
      this.connections.get(environment) !== connection
    ) {
      return;
    }

    if (channel.listeners.size === 0) {
      if (channel.subscription) {
        const subscription = channel.subscription;
        channel.subscription = undefined;
        await subscription.unsubscribe();
      }
      return;
    }

    if (channel.subscription) {
      return;
    }

    const subscription = await connection.client.candle(
      { coin: channel.coin, interval: channel.interval },
      (candle: ICandle) => {
        if (
          !connection.isActive ||
          this.connections.get(environment) !== connection ||
          candle.s !== channel.coin ||
          candle.i !== channel.interval
        ) {
          return;
        }

        const point = normalizeHyperliquidCandle(candle);
        if (!point) {
          return;
        }

        channel.listeners.forEach(({ listener }) => {
          try {
            listener(point);
          } catch (error) {
            defaultLogger.networkDoctor.log.error({
              info: `Failed to deliver Hyperliquid candle: ${getErrorMessage(
                error,
              )}`,
            });
          }
        });
      },
    );

    if (
      !connection.isActive ||
      this.connections.get(environment) !== connection ||
      channel.listeners.size === 0
    ) {
      await subscription.unsubscribe();
      return;
    }

    channel.subscription = subscription;
  }

  private async disposeConnectionIfUnused(
    environment: ITradingViewNativeHyperliquidEnvironment,
  ) {
    const connection = this.connections.get(environment);
    if (!connection) {
      return;
    }

    for (const channel of connection.channels.values()) {
      if (channel.listeners.size > 0 || channel.subscription) {
        return;
      }
    }

    connection.isActive = false;
    this.connections.delete(environment);
    try {
      await connection.transport.close();
    } catch (error) {
      defaultLogger.networkDoctor.log.error({
        info: `Failed to close shared Hyperliquid candle WebSocket: ${getErrorMessage(
          error,
        )}`,
      });
    }
  }

  async fetchCandles({
    coin,
    environment,
    interval,
    signal,
    timeFrom,
    timeTo,
  }: IFetchHyperliquidCandlesParams): Promise<IMarketTokenKLineResponse> {
    const candles = await this.getInfoClient(environment).candleSnapshot(
      {
        coin,
        interval,
        startTime: timeFrom * 1000,
        endTime: timeTo * 1000,
      },
      signal,
    );
    const points = candles
      .map(normalizeHyperliquidCandle)
      .filter((point) => point !== null);

    return { points, total: points.length };
  }

  async subscribeCandle({
    coin,
    environment,
    interval,
    listener,
    subscriberId,
  }: ISubscribeHyperliquidCandleParams) {
    const channelKey = getChannelKey(coin, interval);
    const registration = { listener };

    await this.enqueueEnvironmentMutation(environment, async () => {
      const connection = this.getConnection(environment);
      const channel = connection.channels.get(channelKey) ?? {
        coin,
        interval,
        listeners: new Map<string, IHyperliquidCandleListenerRegistration>(),
        mutation: Promise.resolve(),
      };
      connection.channels.set(channelKey, channel);
      channel.listeners.set(subscriberId, registration);

      try {
        await this.enqueueChannelMutation(channel, () =>
          this.reconcileChannel({ channel, connection, environment }),
        );
      } catch (error) {
        if (channel.listeners.get(subscriberId) === registration) {
          channel.listeners.delete(subscriberId);
        }
        await this.disposeConnectionIfUnused(environment);
        throw error;
      }
    });

    let isClosed = false;
    return {
      ensure: async () => {
        const currentConnection = this.connections.get(environment);
        const currentChannel = currentConnection?.channels.get(channelKey);
        if (
          isClosed ||
          !currentConnection ||
          currentChannel?.listeners.get(subscriberId) !== registration
        ) {
          return;
        }

        try {
          await currentConnection.transport.ready();
        } catch {
          const latestConnection = this.connections.get(environment);
          const latestChannel = latestConnection?.channels.get(channelKey);
          if (
            !isClosed &&
            latestConnection === currentConnection &&
            latestChannel?.listeners.get(subscriberId) === registration
          ) {
            await this.restartConnection(environment);
          }
        }
      },
      unsubscribe: async () => {
        if (isClosed) {
          return;
        }
        isClosed = true;
        await this.enqueueEnvironmentMutation(environment, async () => {
          const currentConnection = this.connections.get(environment);
          const currentChannel = currentConnection?.channels.get(channelKey);
          if (!currentConnection || !currentChannel) {
            return;
          }

          if (currentChannel.listeners.get(subscriberId) !== registration) {
            return;
          }
          currentChannel.listeners.delete(subscriberId);
          try {
            await this.enqueueChannelMutation(currentChannel, async () => {
              try {
                await this.reconcileChannel({
                  channel: currentChannel,
                  connection: currentConnection,
                  environment,
                });
              } finally {
                if (
                  currentChannel.listeners.size === 0 &&
                  !currentChannel.subscription
                ) {
                  currentConnection.channels.delete(channelKey);
                }
              }
            });
          } finally {
            await this.disposeConnectionIfUnused(environment);
          }
        });
      },
    };
  }

  async restartConnection(
    environment: ITradingViewNativeHyperliquidEnvironment,
  ) {
    const pendingRestart = this.restartPromises.get(environment);
    if (pendingRestart) {
      return pendingRestart;
    }

    const restartPromise = this.enqueueEnvironmentMutation(
      environment,
      async () => {
        const previousConnection = this.connections.get(environment);
        if (!previousConnection || previousConnection.channels.size === 0) {
          return;
        }

        previousConnection.isActive = false;
        this.connections.delete(environment);
        try {
          await previousConnection.transport.close();
        } catch (error) {
          defaultLogger.networkDoctor.log.error({
            info: `Failed to restart shared Hyperliquid candle WebSocket: ${getErrorMessage(
              error,
            )}`,
          });
        }

        const nextConnection = this.createConnection(environment);
        nextConnection.channels = previousConnection.channels;
        this.connections.set(environment, nextConnection);
        const reconcileTasks: Promise<void>[] = [];
        nextConnection.channels.forEach((channel) => {
          channel.subscription = undefined;
          reconcileTasks.push(
            this.enqueueChannelMutation(channel, () =>
              this.reconcileChannel({
                channel,
                connection: nextConnection,
                environment,
              }),
            ),
          );
        });
        await Promise.all(reconcileTasks);
      },
    ).finally(() => {
      if (this.restartPromises.get(environment) === restartPromise) {
        this.restartPromises.delete(environment);
      }
    });
    this.restartPromises.set(environment, restartPromise);
    return restartPromise;
  }
}

// Split runtimes intentionally get one gateway instance per foreground JS heap.
export const tradingViewNativeHyperliquidGateway =
  new TradingViewNativeHyperliquidGateway();
