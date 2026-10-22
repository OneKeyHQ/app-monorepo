/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/unbound-method */
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  EHeadlessBuyOrderStatus,
  type IHeadlessBuyOrder,
  type IOnramperTransactionLookupItem,
  type IOnramperTransactionStatus,
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
  const post = jest.fn();
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
  jest.spyOn(service as any, 'getClient').mockResolvedValue({ post });
  return { service, store, post, simpleDb, backgroundApi };
}

type ILookupBody = {
  transactions: { transactionId: string; source: string }[];
};

function requestedIdsOf(body: ILookupBody): string[] {
  return body.transactions.map((t) => t.transactionId);
}

// Ids carried by every request so far, in request order.
function requestedIds(post: jest.Mock): string[] {
  return post.mock.calls.flatMap((call) =>
    requestedIdsOf(call[1] as ILookupBody),
  );
}

// The batch endpoint's payload: every requested id echoed back, resolved
// ids with their transaction, the rest as `transaction: null, failed: true`.
function lookupResponse(
  body: ILookupBody,
  byId: Record<string, Partial<IOnramperTransactionStatus>>,
): { data: { data: IOnramperTransactionLookupItem[] } } {
  return {
    data: {
      data: body.transactions.map(({ transactionId, source }) => {
        const tx = byId[transactionId];
        return tx
          ? {
              transactionId,
              source,
              transaction: { transactionId, ...tx },
              failed: false,
            }
          : { transactionId, source, transaction: null, failed: true };
      }),
    },
  };
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

  test('addHeadlessBuyOrder surfaces an authorized checkout whose failure overtook its metadata lookups', async () => {
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
    // Apple Pay was authorized and the checkout then failed, both while the
    // account name was still being read: neither event found a record.
    await service.markHeadlessBuyOrderPaymentSeen({ transactionId: '01M3' });
    await service.discardHeadlessBuyOrder({
      transactionId: '01M3',
      reason: 'failed',
    });
    expect(store.has('01M3')).toBe(false);
    releaseAccount({ name: 'Account 1' });
    await adding;
    // Money may have moved: the order is visible right away, not only once
    // the 24 h rule surfaces it as timed out.
    expect(store.get('01M3')).toMatchObject({
      paymentSeen: true,
      submittedAt: T0 + 1000,
      status: EHeadlessBuyOrderStatus.Processing,
      accountName: 'Account 1',
    });
  });

  test('addHeadlessBuyOrder drops a record whose cancellation overtook its metadata lookups', async () => {
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
    await service.discardHeadlessBuyOrder({
      transactionId: '01M3',
      reason: 'cancelled',
    });
    releaseAccount({ name: 'Account 1' });
    await adding;
    // Nothing was paid: the late insert must not leave a hidden record behind.
    expect(store.has('01M3')).toBe(false);
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

  test('discardHeadlessBuyOrder surfaces a hidden order when the provider failed without confirming the payment', async () => {
    const { service, store } = createService([
      baseOrder(),
      baseOrder({ transactionId: 'paid', submittedAt: T0 }),
    ]);
    // SDK 1.3 `providerFailed`: the checkout surface broke with the payment
    // outcome unknown, so the user may have been charged. The record is
    // shown for tracking instead of being dropped, but nothing proved a
    // payment: without backend progress the 24 h rule may still fail it.
    await service.discardHeadlessBuyOrder({
      transactionId: '01M3',
      reason: 'providerFailed',
    });
    await service.discardHeadlessBuyOrder({
      transactionId: 'paid',
      reason: 'providerFailed',
    });
    expect(store.get('01M3')).toMatchObject({
      submittedAt: T0 + 1000,
      status: EHeadlessBuyOrderStatus.Processing,
    });
    expect(store.get('01M3')?.paymentSeen).toBeFalsy();
    expect(store.get('paid')?.submittedAt).toBe(T0);
  });

  test('addHeadlessBuyOrder surfaces a record whose provider failure overtook its metadata lookups', async () => {
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
    await service.discardHeadlessBuyOrder({
      transactionId: '01M3',
      reason: 'providerFailed',
    });
    expect(store.has('01M3')).toBe(false);
    releaseAccount({ name: 'Account 1' });
    await adding;
    expect(store.get('01M3')).toMatchObject({
      submittedAt: T0 + 1000,
      status: EHeadlessBuyOrderStatus.Processing,
      accountName: 'Account 1',
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

  test('refreshHeadlessBuyOrders looks up the real ids in one request, applies statuses and emits refresh events', async () => {
    const { service, store, post } = createService([
      baseOrder({ transactionId: 'a', submittedAt: T0 }),
      baseOrder({ transactionId: 'b', submittedAt: T0 }),
      baseOrder({
        transactionId: 'done',
        submittedAt: T0,
        status: EHeadlessBuyOrderStatus.Delivered,
      }),
    ]);
    post.mockImplementation(async (_path: string, body: ILookupBody) =>
      lookupResponse(body, {
        a: { status: 'completed', outAmount: 0.05, transactionHash: '0xhash' },
        b: { status: 'pending' },
      }),
    );
    await service.refreshHeadlessBuyOrders({});
    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][0]).toBe(
      '/wallet/v1/fiat-pay/onramper-transactions',
    );
    expect(
      (post.mock.calls[0][1] as ILookupBody).transactions.toSorted((x, y) =>
        x.transactionId.localeCompare(y.transactionId),
      ),
    ).toEqual([
      { transactionId: 'a', source: 'headless' },
      { transactionId: 'b', source: 'headless' },
    ]);
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
    const { service, post } = createService([
      baseOrder({ transactionId: 'a', submittedAt: T0 }),
      baseOrder({ transactionId: 'b', submittedAt: T0 }),
    ]);
    post.mockImplementation(async (_path: string, body: ILookupBody) =>
      lookupResponse(body, {}),
    );
    await service.refreshHeadlessBuyOrders({ transactionIds: ['b'] });
    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][1]).toEqual({
      transactions: [{ transactionId: 'b', source: 'headless' }],
    });
  });

  test('refreshHeadlessBuyOrders flags only the orders whose entry came back unresolved or missing', async () => {
    const { service, store, post } = createService([
      baseOrder({ transactionId: 'a', submittedAt: T0 }),
      baseOrder({ transactionId: 'b', submittedAt: T0 }),
      baseOrder({ transactionId: 'c', submittedAt: T0 }),
    ]);
    post.mockImplementation(async (_path: string, body: ILookupBody) => {
      const resp = lookupResponse(body, { c: { status: 'pending' } });
      // The backend could not resolve `a`; `b` is missing from the payload.
      resp.data.data = resp.data.data.filter(
        (item) => item.transactionId !== 'b',
      );
      return resp;
    });
    await service.refreshHeadlessBuyOrders({});
    expect(post).toHaveBeenCalledTimes(1);
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
  });

  test('refreshHeadlessBuyOrders fails every id of a rejected request and pauses for a minute after a 429', async () => {
    const { service, store, post } = createService([
      baseOrder({ transactionId: 'a', submittedAt: T0 }),
      baseOrder({ transactionId: 'b', submittedAt: T0 }),
    ]);
    post.mockRejectedValue(
      Object.assign(new Error('Too Many Requests'), { httpStatusCode: 429 }),
    );
    await service.refreshHeadlessBuyOrders({});
    expect(post).toHaveBeenCalledTimes(1);
    expect(store.get('a')).toMatchObject({
      status: EHeadlessBuyOrderStatus.Processing,
      lastCheckOk: false,
      lastCheckedAt: T0 + 1000,
    });
    expect(store.get('b')).toMatchObject({
      lastCheckOk: false,
      lastCheckedAt: T0 + 1000,
    });

    // The 429 pauses every lookup on this device for a minute.
    post.mockClear();
    (Date.now as jest.Mock).mockReturnValue(T0 + 1000 + 59_000);
    await service.refreshHeadlessBuyOrders({ transactionIds: ['a'] });
    expect(post).not.toHaveBeenCalled();
    (Date.now as jest.Mock).mockReturnValue(T0 + 1000 + 61_000);
    await service.refreshHeadlessBuyOrders({ transactionIds: ['a'] });
    expect(post).toHaveBeenCalledTimes(1);
  });

  test('refreshHeadlessBuyOrders honours the recheck intervals, longer after a failure', async () => {
    const { service, post } = createService([
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
    post.mockImplementation(async (_path: string, body: ILookupBody) =>
      lookupResponse(body, {}),
    );
    await service.refreshHeadlessBuyOrders({});
    expect(requestedIds(post).toSorted()).toEqual(['failed-old', 'old-check']);
  });

  test('refreshHeadlessBuyOrders rechecks hidden and timed-out records rarely, visible orders first', async () => {
    const { service, post } = createService([
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
    post.mockImplementation(async (_path: string, body: ILookupBody) =>
      lookupResponse(body, {}),
    );
    await service.refreshHeadlessBuyOrders({});
    expect(requestedIds(post)).toEqual(['v2', 'v1', 'hidden-new']);

    // An explicit id (the detail page) is exempt from the low-priority
    // interval.
    post.mockClear();
    await service.refreshHeadlessBuyOrders({ transactionIds: ['timed-out'] });
    expect(requestedIds(post)).toEqual(['timed-out']);
    post.mockClear();
    (Date.now as jest.Mock).mockReturnValue(T0 + 1000 + 10 * 60_000);
    await service.refreshHeadlessBuyOrders({});
    expect(requestedIds(post).toSorted()).toEqual([
      'hidden-checked',
      'hidden-new',
      'timed-out',
      'v1',
      'v2',
    ]);
  });

  test('refreshHeadlessBuyOrders sends at most twenty ids per request, newest first, and no more requests than the budget allows', async () => {
    const { service, post } = createService(
      Array.from({ length: 25 }, (_, i) =>
        baseOrder({ transactionId: `v${i + 1}`, submittedAt: T0 + i + 1 }),
      ),
    );
    post.mockImplementation(async (_path: string, body: ILookupBody) =>
      lookupResponse(
        body,
        Object.fromEntries(
          body.transactions.map((t) => [
            t.transactionId,
            { status: 'pending' },
          ]),
        ),
      ),
    );
    const newestFirst = Array.from({ length: 25 }, (_, i) => `v${25 - i}`);
    // One page entry refreshes all 25 orders in two requests.
    await service.refreshHeadlessBuyOrders({});
    expect(post).toHaveBeenCalledTimes(2);
    expect(requestedIds(post)).toEqual(newestFirst);
    expect(
      (post.mock.calls[0][1] as ILookupBody).transactions.map(
        (t) => t.transactionId,
      ),
    ).toEqual(newestFirst.slice(0, 20));
    expect(
      (post.mock.calls[1][1] as ILookupBody).transactions.map(
        (t) => t.transactionId,
      ),
    ).toEqual(newestFirst.slice(20));

    // Three detail-page polls bring the minute's request count to five:
    // one slot is left for a general refresh, so only twenty ids go out.
    post.mockClear();
    (Date.now as jest.Mock).mockReturnValue(T0 + 1000 + 15_000);
    await service.refreshHeadlessBuyOrders({ transactionIds: ['v1'] });
    await service.refreshHeadlessBuyOrders({ transactionIds: ['v2'] });
    await service.refreshHeadlessBuyOrders({ transactionIds: ['v3'] });
    expect(requestedIds(post)).toEqual(['v1', 'v2', 'v3']);
    post.mockClear();
    await service.refreshHeadlessBuyOrders({});
    expect(post).toHaveBeenCalledTimes(1);
    expect(requestedIds(post)).toEqual(newestFirst.slice(0, 20));
  });

  test('refreshHeadlessBuyOrders spends at most six requests per minute on a general refresh and keeps two for explicit ids', async () => {
    const { service, post } = createService(
      Array.from({ length: 4 }, (_, i) =>
        baseOrder({ transactionId: `v${i + 1}`, submittedAt: T0 + i + 1 }),
      ),
    );
    post.mockImplementation(async (_path: string, body: ILookupBody) =>
      lookupResponse(
        body,
        Object.fromEntries(
          body.transactions.map((t) => [
            t.transactionId,
            { status: 'pending' },
          ]),
        ),
      ),
    );
    // Six page entries ten seconds apart: one request each.
    for (let i = 0; i < 6; i += 1) {
      (Date.now as jest.Mock).mockReturnValue(T0 + 1000 + i * 10_000);
      await service.refreshHeadlessBuyOrders({});
    }
    expect(post).toHaveBeenCalledTimes(6);
    // Inside the same minute a general refresh gets nothing more...
    post.mockClear();
    (Date.now as jest.Mock).mockReturnValue(T0 + 1000 + 55_000);
    await service.refreshHeadlessBuyOrders({});
    expect(post).not.toHaveBeenCalled();
    // ...while the detail page's poll still has the two reserved slots
    // (the first entry has left the window by now, freeing a third).
    (Date.now as jest.Mock).mockReturnValue(T0 + 1000 + 61_000);
    await service.refreshHeadlessBuyOrders({ transactionIds: ['v1'] });
    await service.refreshHeadlessBuyOrders({ transactionIds: ['v2'] });
    await service.refreshHeadlessBuyOrders({ transactionIds: ['v3'] });
    await service.refreshHeadlessBuyOrders({ transactionIds: ['v4'] });
    expect(requestedIds(post)).toEqual(['v1', 'v2', 'v3']);
    // The whole budget is spent now: a general refresh must not go negative
    // and leak requests.
    post.mockClear();
    await service.refreshHeadlessBuyOrders({});
    expect(post).not.toHaveBeenCalled();
    // Once the window has cleared the page entry gets its request again.
    (Date.now as jest.Mock).mockReturnValue(T0 + 1000 + 125_000);
    await service.refreshHeadlessBuyOrders({});
    expect(post).toHaveBeenCalledTimes(1);
    expect(requestedIds(post)).toEqual(['v4', 'v3', 'v2', 'v1']);
  });

  test('refreshHeadlessBuyOrders shares one in-flight request per id and only sends the new ids', async () => {
    const { service, store, post } = createService([
      baseOrder({ transactionId: 'a', submittedAt: T0 }),
      baseOrder({ transactionId: 'b', submittedAt: T0 }),
    ]);
    const release: ((value: unknown) => void)[] = [];
    const bodies: ILookupBody[] = [];
    post.mockImplementation(
      (_path: string, body: ILookupBody) =>
        new Promise((resolve) => {
          bodies.push(body);
          release.push(resolve);
        }),
    );
    const first = service.refreshHeadlessBuyOrders({ transactionIds: ['a'] });
    await flushPromises();
    // `a` is still in flight: the general round joins it and asks for `b`.
    const second = service.refreshHeadlessBuyOrders({});
    await flushPromises();
    expect(post).toHaveBeenCalledTimes(2);
    expect(bodies.map((body) => requestedIdsOf(body))).toEqual([['a'], ['b']]);
    release[0](lookupResponse(bodies[0], { a: { status: 'pending' } }));
    release[1](lookupResponse(bodies[1], { b: { status: 'completed' } }));
    await Promise.all([first, second]);
    expect(post).toHaveBeenCalledTimes(2);
    expect(store.get('a')).toMatchObject({ rawStatus: 'pending' });
    expect(store.get('b')).toMatchObject({
      status: EHeadlessBuyOrderStatus.Delivered,
    });
  });

  test('refreshHeadlessBuyOrders merges a status into a record the checkout updated meanwhile', async () => {
    const { service, store, post } = createService([baseOrder()]);
    post.mockImplementation(async (_path: string, body: ILookupBody) => {
      // `completed` + `paymentAuthorized` land while the lookup is in flight.
      store.set('01M3', {
        ...baseOrder(),
        submittedAt: T0 + 900,
        paymentSeen: true,
      });
      return lookupResponse(body, { '01M3': { status: 'new' } });
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
    const { service, store, post } = createService([
      baseOrder({ transactionId: 'mock-1', submittedAt: T0 }),
      baseOrder({ transactionId: 'local-1', submittedAt: T0 }),
      baseOrder({ transactionId: 'a', submittedAt: T0 }),
    ]);
    post.mockImplementation(async (_path: string, body: ILookupBody) =>
      lookupResponse(body, { a: { status: 'pending' } }),
    );
    await service.refreshHeadlessBuyOrders({});
    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][1]).toEqual({
      transactions: [{ transactionId: 'a', source: 'headless' }],
    });
    expect(store.get('mock-1')?.lastCheckedAt).toBeUndefined();
    expect(store.get('local-1')?.lastCheckedAt).toBeUndefined();
    expect(store.get('a')).toMatchObject({
      paymentSeen: true,
      lastCheckOk: true,
    });
  });
});
