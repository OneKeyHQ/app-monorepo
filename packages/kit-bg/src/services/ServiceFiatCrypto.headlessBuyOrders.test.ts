/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/unbound-method */
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  EHeadlessBuyOrderStatus,
  type IHeadlessBuyOrder,
} from '@onekeyhq/shared/types/fiatCrypto';

import ServiceFiatCrypto from './ServiceFiatCrypto';

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

function createService(orders: IHeadlessBuyOrder[]) {
  const store = new Map(orders.map((o) => [o.transactionId, o]));
  const simpleDb = {
    headlessBuyOrders: {
      getOrders: jest.fn(async () => [...store.values()]),
      getOrder: jest.fn(async ({ transactionId }: { transactionId: string }) =>
        store.get(transactionId),
      ),
      insertOrderIfAbsent: jest.fn(
        async ({ order }: { order: IHeadlessBuyOrder }) => {
          if (store.has(order.transactionId)) {
            return false;
          }
          store.set(order.transactionId, order);
          return true;
        },
      ),
      patchOrder: jest.fn(
        async ({
          transactionId,
          patch,
        }: {
          transactionId: string;
          patch: Partial<IHeadlessBuyOrder>;
        }) => {
          const existing = store.get(transactionId);
          if (!existing) {
            return undefined;
          }
          const next = { ...existing, ...patch };
          store.set(transactionId, next);
          return next;
        },
      ),
      mergeOrders: jest.fn(
        async ({
          updates,
        }: {
          updates: Record<string, IHeadlessBuyOrder | null>;
        }) => {
          for (const [id, o] of Object.entries(updates)) {
            if (o === null) {
              store.delete(id);
            } else {
              store.set(id, o);
            }
          }
        },
      ),
    },
  };
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
  return { service, store, get, simpleDb };
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
    expect(simpleDb.headlessBuyOrders.patchOrder).toHaveBeenCalledTimes(2);
  });

  test('discardHeadlessBuyOrder removes only hidden orders', async () => {
    const { service, store } = createService([
      baseOrder(),
      baseOrder({ transactionId: 'paid', submittedAt: T0 }),
    ]);
    await service.discardHeadlessBuyOrder({
      transactionId: '01M3',
      reason: 'cancelled',
    });
    await service.discardHeadlessBuyOrder({
      transactionId: 'paid',
      reason: 'failed',
    });
    expect(store.has('01M3')).toBe(false);
    expect(store.has('paid')).toBe(true);
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
  });

  test('refreshHeadlessBuyOrders skips orders checked successfully moments ago', async () => {
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
        lastCheckedAt: T0 + 1000 - 5000,
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
    expect(requested.toSorted()).toEqual(['failed-check', 'old-check']);
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
