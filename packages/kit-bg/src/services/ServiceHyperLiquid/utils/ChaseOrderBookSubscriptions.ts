import { SubscriptionClient, WebSocketTransport } from '@nktkas/hyperliquid';
import BigNumber from 'bignumber.js';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type {
  IL2BookResponse,
  IWsBbo,
} from '@onekeyhq/shared/types/hyperliquid/sdk';

interface IChaseOrderBookEntry {
  coin: string;
  consumers: Set<string>;
  generation: number;
  retryAttempt: number;
  bestBid?: string;
  bestAsk?: string;
  transport?: WebSocketTransport;
  removeListeners?: () => void;
  retryTimer?: ReturnType<typeof setTimeout>;
}

export class ChaseOrderBookSubscriptions {
  private readonly entries = new Map<string, IChaseOrderBookEntry>();

  constructor(
    private readonly getSnapshot: (coin: string) => Promise<IL2BookResponse>,
  ) {}

  subscribe({
    coin,
    subscriptionId,
  }: {
    coin: string;
    subscriptionId: string;
  }) {
    const existing = this.entries.get(coin);
    if (existing) {
      existing.consumers.add(subscriptionId);
      this.emit(existing, subscriptionId);
      return;
    }
    const entry: IChaseOrderBookEntry = {
      coin,
      consumers: new Set([subscriptionId]),
      generation: 0,
      retryAttempt: 0,
    };
    this.entries.set(coin, entry);
    this.start(entry);
  }

  unsubscribe({
    coin,
    subscriptionId,
  }: {
    coin: string;
    subscriptionId: string;
  }) {
    const entry = this.entries.get(coin);
    if (
      !entry ||
      !entry.consumers.delete(subscriptionId) ||
      entry.consumers.size
    ) {
      return;
    }
    this.entries.delete(coin);
    entry.generation += 1;
    clearTimeout(entry.retryTimer);
    this.closeTransport(entry);
  }

  private emit(entry: IChaseOrderBookEntry, subscriptionId: string) {
    appEventBus.emit(EAppEventBusNames.PerpsChaseOrderBookUpdate, {
      coin: entry.coin,
      subscriptionId,
      bestBid: entry.bestBid,
      bestAsk: entry.bestAsk,
    });
  }

  private publish(
    entry: IChaseOrderBookEntry,
    bestBid?: string,
    bestAsk?: string,
  ) {
    if (entry.bestBid === bestBid && entry.bestAsk === bestAsk) {
      return;
    }
    entry.bestBid = bestBid;
    entry.bestAsk = bestAsk;
    entry.consumers.forEach((id) => this.emit(entry, id));
  }

  private closeTransport(entry: IChaseOrderBookEntry) {
    entry.removeListeners?.();
    entry.removeListeners = undefined;
    const transport = entry.transport;
    entry.transport = undefined;
    // Each transport owns only this coin's BBO, so closing also cancels pending ACKs.
    transport?.close();
  }

  private start(entry: IChaseOrderBookEntry) {
    entry.generation += 1;
    const generation = entry.generation;
    const isCurrent = () =>
      this.entries.get(entry.coin) === entry && entry.generation === generation;
    const transport = new WebSocketTransport({
      url: 'wss://api.hyperliquid.xyz/ws',
      reconnect: { maxRetries: 0, connectionTimeout: 5000 },
      resubscribe: false,
      keepAlive: { interval: 5000, timeout: 5000 },
    });
    entry.transport = transport;
    let receivedFrame = false;
    let latestTime = 0;
    const recover = () => {
      if (!isCurrent()) return;
      entry.generation += 1;
      this.closeTransport(entry);
      this.publish(entry);
      const delay = Math.min(1000 * 2 ** entry.retryAttempt, 8000);
      entry.retryAttempt += 1;
      entry.retryTimer = setTimeout(() => {
        if (this.entries.get(entry.coin) === entry) this.start(entry);
      }, delay);
    };
    transport.socket.addEventListener('close', recover);
    transport.socket.addEventListener('error', recover);
    entry.removeListeners = () => {
      transport.socket.removeEventListener('close', recover);
      transport.socket.removeEventListener('error', recover);
    };
    const publishBook = (data: IWsBbo) => {
      if (
        !isCurrent() ||
        data.coin !== entry.coin ||
        !Number.isFinite(data.time) ||
        data.time < latestTime
      )
        return;
      receivedFrame = true;
      latestTime = data.time;
      entry.retryAttempt = 0;
      const bid = data.bbo[0]?.px;
      const ask = data.bbo[1]?.px;
      const bidBN = new BigNumber(bid ?? '');
      const askBN = new BigNumber(ask ?? '');
      if (
        !bidBN.isFinite() ||
        !askBN.isFinite() ||
        !bidBN.gt(0) ||
        !askBN.gt(bidBN)
      ) {
        this.publish(entry);
        return;
      }
      this.publish(entry, bid, ask);
    };
    void new SubscriptionClient({ transport })
      .bbo({ coin: entry.coin }, publishBook, { onError: recover })
      .then(async () => {
        if (!isCurrent() || receivedFrame) return;
        // BBO is change-driven; seed an idle stream once, never over a newer WS frame.
        try {
          const book = await this.getSnapshot(entry.coin);
          if (
            !book ||
            !isCurrent() ||
            receivedFrame ||
            transport.socket.readyState !== 1
          )
            return;
          publishBook({
            coin: book.coin,
            time: book.time,
            bbo: [book.levels[0]?.[0] ?? null, book.levels[1]?.[0] ?? null],
          });
        } catch {
          // Keep listening if only the optional initial snapshot failed.
        }
      })
      .catch(recover);
  }
}
