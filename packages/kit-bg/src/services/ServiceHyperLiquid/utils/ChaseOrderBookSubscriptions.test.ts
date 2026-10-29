import { SubscriptionClient, WebSocketTransport } from '@nktkas/hyperliquid';

import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import type {
  IL2BookResponse,
  IWsBbo,
} from '@onekeyhq/shared/types/hyperliquid/sdk';

import { ChaseOrderBookSubscriptions } from './ChaseOrderBookSubscriptions';

jest.mock('@nktkas/hyperliquid', () => ({
  SubscriptionClient: jest.fn(),
  WebSocketTransport: jest.fn(),
}));

type IAttempt = {
  socket: EventTarget;
  close: jest.Mock;
  onBbo: (bbo: IWsBbo) => void;
  onError: () => void;
  confirm: () => void;
  reject: (error: Error) => void;
  coin: string;
};
const attempts: IAttempt[] = [];
const emit = jest.spyOn(appEventBus, 'emit').mockImplementation(() => true);
const getSnapshot = jest.fn<Promise<IL2BookResponse>, [string]>();

function bbo(coin = 'ETH', bid = '100', ask = '101', time = 10): IWsBbo {
  return {
    coin,
    time,
    bbo: [
      { px: bid, sz: '1', n: 1 },
      { px: ask, sz: '1', n: 1 },
    ],
  };
}

beforeEach(() => {
  jest.useFakeTimers();
  attempts.length = 0;
  emit.mockClear();
  getSnapshot.mockReset().mockResolvedValue({
    coin: 'ETH',
    time: 10,
    levels: [[{ px: '100', sz: '1', n: 1 }], [{ px: '101', sz: '1', n: 1 }]],
  });
  jest.mocked(WebSocketTransport).mockImplementation(() => {
    const attempt: IAttempt = {
      socket: Object.assign(new EventTarget(), { readyState: 1 }),
      close: jest.fn(),
      onBbo: () => undefined,
      onError: () => undefined,
      confirm: () => undefined,
      reject: () => undefined,
      coin: '',
    };
    attempts.push(attempt);
    return {
      socket: attempt.socket,
      close: attempt.close,
    } as unknown as WebSocketTransport;
  });
  jest.mocked(SubscriptionClient).mockImplementation(
    () =>
      ({
        bbo: (
          { coin }: { coin: string },
          onBbo: IAttempt['onBbo'],
          options: { onError: () => void },
        ) => {
          const attempt = attempts[attempts.length - 1];
          Object.assign(attempt, { coin, onBbo, onError: options.onError });
          return new Promise((resolve, reject) => {
            attempt.confirm = () => resolve({ unsubscribe: jest.fn() });
            attempt.reject = reject;
          });
        },
      }) as unknown as SubscriptionClient,
  );
});

afterEach(() => {
  jest.useRealTimers();
});

it('shares one coin stream and closes it only after the last consumer leaves, even before ACK', () => {
  const manager = new ChaseOrderBookSubscriptions(getSnapshot);
  manager.subscribe({ coin: 'ETH', subscriptionId: 'a' });
  manager.subscribe({ coin: 'ETH', subscriptionId: 'b' });
  expect(attempts).toHaveLength(1);
  emit.mockClear();
  attempts[0].onBbo(bbo());
  expect(emit).toHaveBeenCalledTimes(2);
  expect(emit).toHaveBeenLastCalledWith('PerpsChaseOrderBookUpdate', {
    coin: 'ETH',
    subscriptionId: 'b',
    bestBid: '100',
    bestAsk: '101',
  });
  manager.subscribe({ coin: 'ETH', subscriptionId: 'c' });
  expect(emit).toHaveBeenLastCalledWith('PerpsChaseOrderBookUpdate', {
    coin: 'ETH',
    subscriptionId: 'c',
    bestBid: '100',
    bestAsk: '101',
  });
  manager.unsubscribe({ coin: 'ETH', subscriptionId: 'c' });
  manager.unsubscribe({ coin: 'ETH', subscriptionId: 'a' });
  expect(attempts[0].close).not.toHaveBeenCalled();
  manager.unsubscribe({ coin: 'ETH', subscriptionId: 'b' });
  expect(attempts[0].close).toHaveBeenCalledTimes(1);
  emit.mockClear();
  attempts[0].onBbo(bbo());
  expect(emit).not.toHaveBeenCalled();
});

it('keeps coins isolated and ignores wrong-coin, duplicate-price and older frames', () => {
  const manager = new ChaseOrderBookSubscriptions(getSnapshot);
  manager.subscribe({ coin: 'ETH', subscriptionId: 'eth' });
  manager.subscribe({ coin: 'BTC', subscriptionId: 'btc' });
  attempts[0].onBbo(bbo('BTC'));
  expect(emit).not.toHaveBeenCalled();
  attempts[0].onBbo(bbo());
  attempts[0].onBbo(bbo('ETH', '100', '101', 11));
  attempts[0].onBbo(bbo('ETH', '98', '99', 9));
  expect(emit).toHaveBeenCalledTimes(1);
  manager.unsubscribe({ coin: 'ETH', subscriptionId: 'eth' });
  manager.unsubscribe({ coin: 'BTC', subscriptionId: 'btc' });
});

it('clears disconnected data, retries failed streams, and rejects old-generation callbacks', async () => {
  const manager = new ChaseOrderBookSubscriptions(getSnapshot);
  manager.subscribe({ coin: 'ETH', subscriptionId: 'a' });
  attempts[0].onBbo(bbo());
  attempts[0].socket.dispatchEvent(new Event('close'));
  expect(emit).toHaveBeenLastCalledWith('PerpsChaseOrderBookUpdate', {
    coin: 'ETH',
    subscriptionId: 'a',
    bestBid: undefined,
    bestAsk: undefined,
  });
  await jest.advanceTimersByTimeAsync(1000);
  expect(attempts).toHaveLength(2);
  emit.mockClear();
  attempts[0].onBbo(bbo('ETH', '200', '201'));
  expect(emit).not.toHaveBeenCalled();
  attempts[1].onBbo(bbo('ETH', '102', '103'));
  expect(emit).toHaveBeenLastCalledWith('PerpsChaseOrderBookUpdate', {
    coin: 'ETH',
    subscriptionId: 'a',
    bestBid: '102',
    bestAsk: '103',
  });
  attempts[1].onError();
  manager.unsubscribe({ coin: 'ETH', subscriptionId: 'a' });
  await jest.advanceTimersByTimeAsync(8000);
  expect(attempts).toHaveLength(2);
});

it('seeds an idle stream once without polling or allowing a late snapshot to overwrite BBO', async () => {
  let resolveSnapshot: (book: IL2BookResponse) => void = () => undefined;
  getSnapshot.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveSnapshot = resolve;
      }),
  );
  const manager = new ChaseOrderBookSubscriptions(getSnapshot);
  manager.subscribe({ coin: 'ETH', subscriptionId: 'a' });
  attempts[0].confirm();
  await Promise.resolve();
  attempts[0].onBbo(bbo('ETH', '102', '103'));
  resolveSnapshot({
    coin: 'ETH',
    time: 9,
    levels: [[{ px: '98', sz: '1', n: 1 }], [{ px: '99', sz: '1', n: 1 }]],
  });
  await Promise.resolve();
  await jest.advanceTimersByTimeAsync(60_000);
  expect(getSnapshot).toHaveBeenCalledTimes(1);
  expect(emit).toHaveBeenCalledTimes(1);
  expect(emit).toHaveBeenLastCalledWith('PerpsChaseOrderBookUpdate', {
    coin: 'ETH',
    subscriptionId: 'a',
    bestBid: '102',
    bestAsk: '103',
  });
  manager.unsubscribe({ coin: 'ETH', subscriptionId: 'a' });
});

it('seeds again after reconnect without accepting an old connection snapshot', async () => {
  let resolveOld: (book: IL2BookResponse) => void = () => undefined;
  getSnapshot.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveOld = resolve;
      }),
  );
  const manager = new ChaseOrderBookSubscriptions(getSnapshot);
  manager.subscribe({ coin: 'ETH', subscriptionId: 'a' });
  attempts[0].confirm();
  await Promise.resolve();
  attempts[0].socket.dispatchEvent(new Event('close'));
  await jest.advanceTimersByTimeAsync(1000);
  attempts[1].confirm();
  await Promise.resolve();
  await Promise.resolve();
  emit.mockClear();
  resolveOld({
    coin: 'ETH',
    time: 9,
    levels: [[{ px: '98', sz: '1', n: 1 }], [{ px: '99', sz: '1', n: 1 }]],
  });
  await Promise.resolve();
  expect(getSnapshot).toHaveBeenCalledTimes(2);
  expect(emit).not.toHaveBeenCalled();
  manager.unsubscribe({ coin: 'ETH', subscriptionId: 'a' });
});

it('retries an initial ACK rejection even while the socket is open', async () => {
  const manager = new ChaseOrderBookSubscriptions(getSnapshot);
  manager.subscribe({ coin: 'ETH', subscriptionId: 'a' });
  attempts[0].reject(new Error('Subscription rejected'));
  await jest.advanceTimersByTimeAsync(1000);
  expect(attempts).toHaveLength(2);
  expect(attempts[0].close).toHaveBeenCalledTimes(1);
  expect(getSnapshot).not.toHaveBeenCalled();
  manager.unsubscribe({ coin: 'ETH', subscriptionId: 'a' });
});

it('does not replace an empty live BBO with a delayed HTTP snapshot', async () => {
  let resolveSnapshot: (book: IL2BookResponse) => void = () => undefined;
  getSnapshot.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveSnapshot = resolve;
      }),
  );
  const manager = new ChaseOrderBookSubscriptions(getSnapshot);
  manager.subscribe({ coin: 'ETH', subscriptionId: 'a' });
  attempts[0].confirm();
  await Promise.resolve();
  attempts[0].onBbo({ coin: 'ETH', time: 11, bbo: [null, null] });
  resolveSnapshot({
    coin: 'ETH',
    time: 10,
    levels: [[{ px: '100', sz: '1', n: 1 }], [{ px: '101', sz: '1', n: 1 }]],
  });
  await jest.advanceTimersByTimeAsync(0);
  expect(emit).not.toHaveBeenCalled();
  manager.unsubscribe({ coin: 'ETH', subscriptionId: 'a' });
});
