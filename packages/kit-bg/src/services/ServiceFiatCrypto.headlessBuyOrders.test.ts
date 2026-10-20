/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/unbound-method */
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  EHeadlessBuyOrderStatus,
  type IHeadlessBuyOrder,
} from '@onekeyhq/shared/types/fiatCrypto';

import { SimpleDbEntityHeadlessBuyOrders } from '../dbs/simple/entity/SimpleDbEntityHeadlessBuyOrders';

import ServiceFiatCrypto from './ServiceFiatCrypto';

import type { IHeadlessBuyOrdersDBStructure } from '../dbs/simple/entity/SimpleDbEntityHeadlessBuyOrders';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: any) => target,
  backgroundMethod: () => (_t: any, _k: string, desc: any) => desc,
  backgroundMethodForDev: () => (_t: any, _k: string, desc: any) => desc,
  checkDevOnlyPassword: jest.fn(),
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    fiatCrypto: {
      request: {
        getTokensList: jest.fn(),
        onramperSessionMinted: jest.fn(),
        onramperSessionMintFailed: jest.fn(),
      },
      onramper: {
        orderRecorded: jest.fn(),
        orderSubmitted: jest.fn(),
        orderDiscarded: jest.fn(),
        orderStatusUpdated: jest.fn(),
        orderStatusFetchFailed: jest.fn(),
      },
    },
  },
}));

const T0 = 1_700_000_000_000;
const DAY_MS = 24 * 60 * 60 * 1000;
// Lets every already-settled await in the service run before the test goes
// on, so a second call can be interleaved at a known point.
const flushPromises = () =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

function baseOrder(
  overrides: Partial<IHeadlessBuyOrder> = {},
): IHeadlessBuyOrder {
  return {
    transactionId: '01M3',
    accountId: 'acc',
    networkId: 'evm--1',
    address: '0xabc',
    tokenSymbol: 'ETH',
    tokenAddress: '',
    fiatAmount: 100,
    fiatCurrency: 'usd',
    createdAt: T0,
    status: EHeadlessBuyOrderStatus.Processing,
    ...overrides,
  };
}

// The real entity on top of an in-memory store: the service's writes go
// through the entity's atomic read-modify-write helpers exactly as in
// production, only the storage layer is replaced.
function createService(orders: IHeadlessBuyOrder[]) {
  const store = new Map(orders.map((o) => [o.transactionId, o]));
  const entity = new SimpleDbEntityHeadlessBuyOrders();
  const snapshot = (): IHeadlessBuyOrdersDBStructure => ({
    orders: Object.fromEntries(store),
  });
  jest.spyOn(entity, 'getRawData').mockImplementation(async () => snapshot());
  jest.spyOn(entity, 'setRawData').mockImplementation(async (builder) => {
    const next = (
      builder as (
        raw: IHeadlessBuyOrdersDBStructure,
      ) => IHeadlessBuyOrdersDBStructure
    )(snapshot());
    store.clear();
    Object.values(next.orders).forEach((o) => store.set(o.transactionId, o));
    return next;
  });
  const simpleDb = { headlessBuyOrders: entity };
  const get = jest.fn();
  const backgroundApi: any = {
    simpleDb,
    serviceAccount: {
      getAccount: jest.fn(async () => ({ name: 'Account 1' })),
    },
    serviceNetwork: {
      getNetwork: jest.fn(async () => ({
        name: 'Ethereum',
        logoURI: 'https://logo',
      })),
    },
  };
  const service = new ServiceFiatCrypto({ backgroundApi });
  jest.spyOn(service as any, 'getClient').mockResolvedValue({ get });
  return { service, store, get, simpleDb, backgroundApi };
}

describe('ServiceFiatCrypto headless buy orders', () => {
  let emit: jest.SpyInstance;
  beforeEach(() => {
    emit = jest
      .spyOn(appEventBus, 'emit')
      .mockImplementation(() => undefined as never);
    jest.spyOn(Date, 'now').mockReturnValue(T0 + 1000);
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('addHeadlessBuyOrder records a hidden order with resolved names and is idempotent', async () => {
    const { service, store } = createService([]);
    const params = {
      transactionId: '01M3',
      accountId: 'acc',
      networkId: 'evm--1',
      address: '0xabc',
      tokenSymbol: 'ETH',
      tokenAddress: '',
      fiatAmount: 100,
      fiatCurrency: 'usd',
    };
    await service.addHeadlessBuyOrder(params);
    await service.addHeadlessBuyOrder({ ...params, fiatAmount: 999 });
    expect(store.get('01M3')).toMatchObject({
      accountName: 'Account 1',
      networkName: 'Ethereum',
      networkLogoURI: 'https://logo',
      fiatAmount: 100,
      createdAt: T0 + 1000,
      status: EHeadlessBuyOrderStatus.Processing,
    });
    expect(store.get('01M3')?.submittedAt).toBeUndefined();
    expect(emit).toHaveBeenCalledWith(
      EAppEventBusNames.HeadlessBuyOrdersChanged,
      undefined,
    );
  });

  test('markHeadlessBuyOrderSubmitted makes the order visible, creating it when missing', async () => {
    const { service, store } = createService([baseOrder()]);
    await service.markHeadlessBuyOrderSubmitted({ transactionId: '01M3' });
    expect(store.get('01M3')?.submittedAt).toBe(T0 + 1000);

    await service.markHeadlessBuyOrderSubmitted({
      transactionId: 'new',
      order: baseOrder({ transactionId: 'new' }),
    });
    expect(store.get('new')).toMatchObject({
      submittedAt: T0 + 1000,
      accountName: 'Account 1',
    });

    // Without a fallback there is nothing to create.
    await service.markHeadlessBuyOrderSubmitted({ transactionId: 'ghost' });
    expect(store.has('ghost')).toBe(false);
  });

  test('payment-seen and viewed flags are set once', async () => {
    const { service, store, simpleDb } = createService([
      baseOrder(),
      baseOrder({
        transactionId: 'failed',
        submittedAt: T0,
        status: EHeadlessBuyOrderStatus.Failed,
      }),
    ]);
    await service.markHeadlessBuyOrderPaymentSeen({ transactionId: '01M3' });
    await service.markHeadlessBuyOrderPaymentSeen({ transactionId: '01M3' });
    expect(store.get('01M3')?.paymentSeen).toBe(true);

    await service.markHeadlessBuyOrderViewed({ transactionId: '01M3' });
    expect(store.get('01M3')?.failureViewedAt).toBeUndefined();
    await service.markHeadlessBuyOrderViewed({ transactionId: 'failed' });
    await service.markHeadlessBuyOrderViewed({ transactionId: 'failed' });
    expect(store.get('failed')?.failureViewedAt).toBe(T0 + 1000);
    expect(simpleDb.headlessBuyOrders.setRawData).toHaveBeenCalledTimes(2);
  });

  test('addHeadlessBuyOrder keeps a payment authorization that overtook its metadata lookups', async () => {
    const { service, store, backgroundApi } = createService([]);
    let releaseAccount: (account: { name: string }) => void = () => undefined;
    backgroundApi.serviceAccount.getAccount.mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseAccount = resolve;
        }),
    );
    const adding = service.addHeadlessBuyOrder(baseOrder());
    await flushPromises();
    // paymentAuthorized lands while the account name is still being read:
    // there is no record to patch yet.
    await service.markHeadlessBuyOrderPaymentSeen({ transactionId: '01M3' });
    expect(store.has('01M3')).toBe(false);
    releaseAccount({ name: 'Account 1' });
    await adding;
    expect(store.get('01M3')).toMatchObject({
      paymentSeen: true,
      accountName: 'Account 1',
    });
  });

  test('addHeadlessBuyOrder patches in a payment authorization that landed during the insert', async () => {
    const { service, store, simpleDb } = createService([]);
    const entity = simpleDb.headlessBuyOrders;
    const realInsert = entity.insertOrderIfAbsent.bind(entity);
    let releaseInsert: () => void = () => undefined;
    jest
      .spyOn(entity, 'insertOrderIfAbsent')
      .mockImplementationOnce(async (args) => {
        await new Promise<void>((resolve) => {
          releaseInsert = resolve;
        });
        return realInsert(args);
      });
    const adding = service.addHeadlessBuyOrder(baseOrder());
    await flushPromises();
    await service.markHeadlessBuyOrderPaymentSeen({ transactionId: '01M3' });
    releaseInsert();
    await adding;
    expect(store.get('01M3')?.paymentSeen).toBe(true);
  });

  test('discardHeadlessBuyOrder removes only hidden orders that never saw a payment', async () => {
    const { service, store } = createService([
      baseOrder(),
      baseOrder({ transactionId: 'paid', submittedAt: T0 }),
      baseOrder({ transactionId: 'authorized', paymentSeen: true }),
    ]);
    await service.discardHeadlessBuyOrder({
      transactionId: '01M3',
      reason: 'cancelled',
    });
    await service.discardHeadlessBuyOrder({
      transactionId: 'paid',
      reason: 'failed',
    });
    // Apple Pay was authorized before the checkout failed: the record is
    // kept and surfaced so the user can track a possible charge.
    await service.discardHeadlessBuyOrder({
      transactionId: 'authorized',
      reason: 'failed',
    });
    expect(store.has('01M3')).toBe(false);
    expect(store.has('paid')).toBe(true);
    expect(store.get('authorized')).toMatchObject({
      submittedAt: T0 + 1000,
      paymentSeen: true,
      status: EHeadlessBuyOrderStatus.Processing,
    });
  });

  test('discardHeadlessBuyOrder keeps a record that got submitted after the read', async () => {
    const { service, store, simpleDb } = createService([baseOrder()]);
    // The `completed` event lands between the service's read and its
    // conditional delete.
    const { getOrder } = simpleDb.headlessBuyOrders;
    jest
      .spyOn(simpleDb.headlessBuyOrders, 'getOrder')
      .mockImplementationOnce(async (params) => {
        const order = await getOrder.call(simpleDb.headlessBuyOrders, params);
        store.set('01M3', { ...baseOrder(), submittedAt: T0 + 500 });
        return order;
      });
    await service.discardHeadlessBuyOrder({
      transactionId: '01M3',
      reason: 'cancelled',
    });
    expect(store.get('01M3')?.submittedAt).toBe(T0 + 500);
  });

  test('getHeadlessBuyOrders applies time rules, persists them and sorts newest first', async () => {
    const { service, store } = createService([
      baseOrder({ transactionId: 'stale-hidden', createdAt: T0 - 2 * DAY_MS }),
      baseOrder({
        transactionId: 'stale-visible',
        createdAt: T0 - 2 * DAY_MS,
        submittedAt: T0 - 2 * DAY_MS,
      }),
      baseOrder({ transactionId: 'fresh', submittedAt: T0 }),
    ]);
    const orders = await service.getHeadlessBuyOrders();
    expect(orders.map((o) => o.transactionId)).toEqual([
      'fresh',
      'stale-visible',
    ]);
    expect(store.has('stale-hidden')).toBe(false);
    expect(store.get('stale-visible')).toMatchObject({
      status: EHeadlessBuyOrderStatus.Failed,
      timedOut: true,
    });
  });

  test('refreshHeadlessBuyOrders looks up each real id, applies statuses and emits refresh events', async () => {
    const { service, store, get } = createService([
      baseOrder({ transactionId: 'a', submittedAt: T0 }),
      baseOrder({ transactionId: 'b', submittedAt: T0 }),
      baseOrder({
        transactionId: 'done',
        submittedAt: T0,
        status: EHeadlessBuyOrderStatus.Delivered,
      }),
    ]);
    const byId: Record<string, unknown> = {
      a: {
        transactionId: 'a',
        status: 'completed',
        outAmount: 0.05,
        transactionHash: '0xhash',
      },
      b: { transactionId: 'b', status: 'pending' },
    };
    get.mockImplementation(
      async (_path: string, config: { params: { transactionId: string } }) => ({
        data: { data: byId[config.params.transactionId] ?? null },
      }),
    );
    await service.refreshHeadlessBuyOrders({});
    expect(get).toHaveBeenCalledTimes(2);
    expect(get).toHaveBeenCalledWith(
      '/wallet/v1/fiat-pay/onramper-transaction',
      { params: { transactionId: 'a', source: 'headless' } },
    );
    expect(get).toHaveBeenCalledWith(
      '/wallet/v1/fiat-pay/onramper-transaction',
      { params: { transactionId: 'b', source: 'headless' } },
    );
    expect(store.get('a')).toMatchObject({
      status: EHeadlessBuyOrderStatus.Delivered,
      outAmount: 0.05,
      transactionHash: '0xhash',
      lastCheckOk: true,
    });
    expect(store.get('b')).toMatchObject({
      status: EHeadlessBuyOrderStatus.Processing,
      paymentSeen: true,
      rawStatus: 'pending',
    });
    expect(emit).toHaveBeenCalledWith(EAppEventBusNames.RefreshTokenList, {
      accounts: [{ accountId: 'acc', networkId: 'evm--1' }],
    });
    expect(emit).toHaveBeenCalledWith(
      EAppEventBusNames.RefreshHistoryList,
      undefined,
    );
  });

  test('refreshHeadlessBuyOrders narrows to the requested ids', async () => {
    const { service, get } = createService([
      baseOrder({ transactionId: 'a', submittedAt: T0 }),
      baseOrder({ transactionId: 'b', submittedAt: T0 }),
    ]);
    get.mockResolvedValue({ data: { data: null } });
    await service.refreshHeadlessBuyOrders({ transactionIds: ['b'] });
    expect(get).toHaveBeenCalledTimes(1);
    expect(get.mock.calls[0][1]).toEqual({
      params: { transactionId: 'b', source: 'headless' },
    });
  });

  test('refreshHeadlessBuyOrders flags only the orders whose lookup failed or was not found', async () => {
    const { service, store, get } = createService([
      baseOrder({ transactionId: 'a', submittedAt: T0 }),
      baseOrder({ transactionId: 'b', submittedAt: T0 }),
      baseOrder({ transactionId: 'c', submittedAt: T0 }),
    ]);
    get.mockImplementation(
      async (_path: string, config: { params: { transactionId: string } }) => {
        const { transactionId } = config.params;
        if (transactionId === 'a') {
          throw Object.assign(new Error('Too Many Requests'), {
            httpStatusCode: 429,
          });
        }
        if (transactionId === 'b') {
          // Unknown ids come back as a null payload with code 0.
          return { data: { data: null } };
        }
        return { data: { data: { transactionId, status: 'pending' } } };
      },
    );
    await service.refreshHeadlessBuyOrders({});
    expect(store.get('a')).toMatchObject({
      status: EHeadlessBuyOrderStatus.Processing,
      lastCheckOk: false,
      lastCheckedAt: T0 + 1000,
    });
    expect(store.get('b')).toMatchObject({ lastCheckOk: false });
    expect(store.get('c')).toMatchObject({
      status: EHeadlessBuyOrderStatus.Processing,
      paymentSeen: true,
      lastCheckOk: true,
    });
    expect(emit).not.toHaveBeenCalledWith(
      EAppEventBusNames.RefreshTokenList,
      expect.anything(),
    );

    // The 429 pauses every lookup on this device for a minute.
    get.mockClear();
    (Date.now as jest.Mock).mockReturnValue(T0 + 1000 + 59_000);
    await service.refreshHeadlessBuyOrders({ transactionIds: ['c'] });
    expect(get).not.toHaveBeenCalled();
    (Date.now as jest.Mock).mockReturnValue(T0 + 1000 + 61_000);
    await service.refreshHeadlessBuyOrders({ transactionIds: ['c'] });
    expect(get).toHaveBeenCalledTimes(1);
  });

  test('refreshHeadlessBuyOrders honours the recheck intervals, longer after a failure', async () => {
    const { service, get } = createService([
      baseOrder({
        transactionId: 'fresh',
        submittedAt: T0,
        lastCheckedAt: T0 + 1000 - 5000,
        lastCheckOk: true,
      }),
      baseOrder({
        transactionId: 'failed-check',
        submittedAt: T0,
        lastCheckedAt: T0 + 1000 - 30_000,
        lastCheckOk: false,
      }),
      baseOrder({
        transactionId: 'failed-old',
        submittedAt: T0,
        lastCheckedAt: T0 + 1000 - 90_000,
        lastCheckOk: false,
      }),
      baseOrder({
        transactionId: 'old-check',
        submittedAt: T0,
        lastCheckedAt: T0 + 1000 - 60_000,
        lastCheckOk: true,
      }),
    ]);
    get.mockResolvedValue({ data: { data: null } });
    await service.refreshHeadlessBuyOrders({});
    const requested = get.mock.calls.map(
      (call) =>
        (call[1] as { params: { transactionId: string } }).params.transactionId,
    );
    expect(requested.toSorted()).toEqual(['failed-old', 'old-check']);
  });

  test('refreshHeadlessBuyOrders rechecks hidden and timed-out records rarely, visible orders first', async () => {
    const { service, get } = createService([
      // Already checked hidden / timed-out records only get a slot after
      // ten minutes in a general refresh.
      baseOrder({
        transactionId: 'hidden-checked',
        lastCheckedAt: T0 + 1000 - 5 * 60_000,
        lastCheckOk: true,
      }),
      baseOrder({
        transactionId: 'timed-out',
        submittedAt: T0 - 2 * DAY_MS,
        status: EHeadlessBuyOrderStatus.Failed,
        timedOut: true,
        lastCheckedAt: T0 + 1000 - 5 * 60_000,
        lastCheckOk: true,
      }),
      baseOrder({ transactionId: 'hidden-new', createdAt: T0 + 5 }),
      baseOrder({ transactionId: 'v1', submittedAt: T0 + 1 }),
      baseOrder({ transactionId: 'v2', submittedAt: T0 + 2 }),
    ]);
    get.mockResolvedValue({ data: { data: null } });
    await service.refreshHeadlessBuyOrders({});
    const requested = () =>
      get.mock.calls.map(
        (call) =>
          (call[1] as { params: { transactionId: string } }).params
            .transactionId,
      );
    expect(requested()).toEqual(['v2', 'v1', 'hidden-new']);

    // An explicit id (the detail page) is exempt from the low-priority
    // interval.
    get.mockClear();
    await service.refreshHeadlessBuyOrders({ transactionIds: ['timed-out'] });
    expect(requested()).toEqual(['timed-out']);
    get.mockClear();
    (Date.now as jest.Mock).mockReturnValue(T0 + 1000 + 10 * 60_000);
    await service.refreshHeadlessBuyOrders({});
    expect(requested().toSorted()).toEqual([
      'hidden-checked',
      'hidden-new',
      'timed-out',
      'v1',
      'v2',
    ]);
  });

  test('refreshHeadlessBuyOrders spends at most six lookups per minute on a general refresh and keeps two for explicit ids', async () => {
    const { service, get } = createService(
      Array.from({ length: 10 }, (_, i) =>
        baseOrder({ transactionId: `v${i + 1}`, submittedAt: T0 + i + 1 }),
      ),
    );
    get.mockImplementation(
      async (_path: string, config: { params: { transactionId: string } }) => ({
        data: {
          data: {
            transactionId: config.params.transactionId,
            status: 'pending',
          },
        },
      }),
    );
    const requested = () =>
      get.mock.calls.map(
        (call) =>
          (call[1] as { params: { transactionId: string } }).params
            .transactionId,
      );
    // One page entry refreshes six orders, newest first.
    await service.refreshHeadlessBuyOrders({});
    expect(requested()).toEqual(['v10', 'v9', 'v8', 'v7', 'v6', 'v5']);
    // Inside the same minute a general refresh gets nothing more, not even
    // for the orders that were left out...
    get.mockClear();
    (Date.now as jest.Mock).mockReturnValue(T0 + 1000 + 15_000);
    await service.refreshHeadlessBuyOrders({});
    expect(requested()).toEqual([]);
    // ...while the detail page's poll still has the two reserved slots.
    await service.refreshHeadlessBuyOrders({ transactionIds: ['v4'] });
    await service.refreshHeadlessBuyOrders({ transactionIds: ['v3'] });
    await service.refreshHeadlessBuyOrders({ transactionIds: ['v2'] });
    expect(requested()).toEqual(['v4', 'v3']);
    // The whole budget is spent now: a general refresh must not go negative
    // and leak lookups.
    get.mockClear();
    await service.refreshHeadlessBuyOrders({});
    expect(requested()).toEqual([]);
    // Once the window has cleared: the never-checked orders go first, then
    // the least recently checked.
    get.mockClear();
    (Date.now as jest.Mock).mockReturnValue(T0 + 1000 + 80_000);
    await service.refreshHeadlessBuyOrders({});
    expect(requested()).toEqual(['v2', 'v1', 'v10', 'v9', 'v8', 'v7']);
  });

  test('refreshHeadlessBuyOrders shares one in-flight request per id', async () => {
    const { service, get } = createService([
      baseOrder({ transactionId: 'a', submittedAt: T0 }),
    ]);
    let release: (value: unknown) => void = () => undefined;
    get.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const first = service.refreshHeadlessBuyOrders({ transactionIds: ['a'] });
    const second = service.refreshHeadlessBuyOrders({});
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
    expect(get).toHaveBeenCalledTimes(1);
    release({ data: { data: { transactionId: 'a', status: 'pending' } } });
    await Promise.all([first, second]);
    expect(get).toHaveBeenCalledTimes(1);
  });

  test('refreshHeadlessBuyOrders merges a status into a record the checkout updated meanwhile', async () => {
    const { service, store, get } = createService([baseOrder()]);
    get.mockImplementation(async () => {
      // `completed` + `paymentAuthorized` land while the lookup is in flight.
      store.set('01M3', {
        ...baseOrder(),
        submittedAt: T0 + 900,
        paymentSeen: true,
      });
      return { data: { data: { transactionId: '01M3', status: 'new' } } };
    });
    await service.refreshHeadlessBuyOrders({});
    expect(store.get('01M3')).toMatchObject({
      submittedAt: T0 + 900,
      paymentSeen: true,
      rawStatus: 'new',
      lastCheckOk: true,
    });
  });

  test('refreshHeadlessBuyOrders never looks up Simulator or fallback ids', async () => {
    const { service, store, get } = createService([
      baseOrder({ transactionId: 'mock-1', submittedAt: T0 }),
      baseOrder({ transactionId: 'local-1', submittedAt: T0 }),
      baseOrder({ transactionId: 'a', submittedAt: T0 }),
    ]);
    get.mockResolvedValue({
      data: { data: { transactionId: 'a', status: 'pending' } },
    });
    await service.refreshHeadlessBuyOrders({});
    expect(get).toHaveBeenCalledTimes(1);
    expect(get.mock.calls[0][1]).toEqual({
      params: { transactionId: 'a', source: 'headless' },
    });
    expect(store.get('mock-1')?.lastCheckedAt).toBeUndefined();
    expect(store.get('local-1')?.lastCheckedAt).toBeUndefined();
    expect(store.get('a')).toMatchObject({
      paymentSeen: true,
      lastCheckOk: true,
    });
  });
});
