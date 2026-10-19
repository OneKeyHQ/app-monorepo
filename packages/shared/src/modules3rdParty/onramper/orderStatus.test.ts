import {
  EHeadlessBuyOrderStatus,
  type IHeadlessBuyOrder,
} from '@onekeyhq/shared/types/fiatCrypto';

import {
  HEADLESS_BUY_ORDER_DELAYED_MS,
  HEADLESS_BUY_ORDER_TIMEOUT_MS,
  applyHeadlessBuyOrderTimeRules,
  applyOnramperTransactionStatus,
  getHeadlessBuyFailureKind,
  isHeadlessBuyOrderDelayed,
  isTerminalHeadlessBuyOrder,
  mapOnramperStatus,
  selectHeadlessBuyOrders,
} from './orderStatus';

const T0 = 1_700_000_000_000;

function order(overrides: Partial<IHeadlessBuyOrder> = {}): IHeadlessBuyOrder {
  return {
    transactionId: '01M3',
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

describe('mapOnramperStatus', () => {
  it('folds raw statuses into the four UI statuses', () => {
    const processing = EHeadlessBuyOrderStatus.Processing;
    expect(mapOnramperStatus('new')).toEqual({
      status: processing,
      paymentSeen: false,
    });
    expect(mapOnramperStatus('init')).toEqual({
      status: processing,
      paymentSeen: false,
    });
    expect(mapOnramperStatus('pending')).toEqual({
      status: processing,
      paymentSeen: true,
    });
    expect(mapOnramperStatus('paid')).toEqual({
      status: processing,
      paymentSeen: true,
    });
    expect(mapOnramperStatus('completed').status).toBe(
      EHeadlessBuyOrderStatus.Delivered,
    );
    expect(mapOnramperStatus('failed').status).toBe(
      EHeadlessBuyOrderStatus.Failed,
    );
    expect(mapOnramperStatus('canceled').status).toBe(
      EHeadlessBuyOrderStatus.Failed,
    );
    expect(mapOnramperStatus('cancelled').status).toBe(
      EHeadlessBuyOrderStatus.Failed,
    );
    expect(mapOnramperStatus('refunded').status).toBe(
      EHeadlessBuyOrderStatus.Refunded,
    );
    expect(mapOnramperStatus('COMPLETED').status).toBe(
      EHeadlessBuyOrderStatus.Delivered,
    );
    expect(mapOnramperStatus('something_new').status).toBe(processing);
    expect(mapOnramperStatus(undefined).status).toBe(processing);
  });
});

describe('applyOnramperTransactionStatus', () => {
  it('records a successful lookup and promotes to Delivered', () => {
    const next = applyOnramperTransactionStatus(
      order({ submittedAt: T0 }),
      {
        transactionId: '01M3',
        status: 'completed',
        outAmount: 0.05,
        transactionHash: '0xhash',
      },
      T0 + 1000,
    );
    expect(next).toMatchObject({
      status: EHeadlessBuyOrderStatus.Delivered,
      rawStatus: 'completed',
      outAmount: 0.05,
      transactionHash: '0xhash',
      lastCheckOk: true,
      lastCheckedAt: T0 + 1000,
      timedOut: false,
    });
  });

  it('makes a hidden order visible once the backend sees payment', () => {
    const statusDate = '2023-11-14T22:13:20.000Z';
    const next = applyOnramperTransactionStatus(
      order(),
      { transactionId: '01M3', status: 'paid', statusDate },
      T0 + 5000,
    );
    expect(next?.submittedAt).toBe(Date.parse(statusDate));
    expect(next?.paymentSeen).toBe(true);
    expect(next?.status).toBe(EHeadlessBuyOrderStatus.Processing);
  });

  it('falls back to now when the status date is unparsable', () => {
    const next = applyOnramperTransactionStatus(
      order(),
      { transactionId: '01M3', status: 'pending', statusDate: 'garbage' },
      T0 + 5000,
    );
    expect(next?.submittedAt).toBe(T0 + 5000);
  });

  it('keeps a hidden order hidden while the backend still says new', () => {
    const next = applyOnramperTransactionStatus(
      order(),
      { transactionId: '01M3', status: 'new' },
      T0 + 5000,
    );
    expect(next?.submittedAt).toBeUndefined();
    expect(next?.lastCheckOk).toBe(true);
  });

  it('drops a hidden order the backend reports failed or canceled', () => {
    expect(
      applyOnramperTransactionStatus(
        order(),
        { transactionId: '01M3', status: 'canceled' },
        T0,
      ),
    ).toBeUndefined();
    expect(
      applyOnramperTransactionStatus(
        order(),
        { transactionId: '01M3', status: 'failed' },
        T0,
      ),
    ).toBeUndefined();
  });

  it('keeps a visible order the backend reports failed', () => {
    const next = applyOnramperTransactionStatus(
      order({ submittedAt: T0 }),
      { transactionId: '01M3', status: 'failed', statusReason: 'Declined' },
      T0,
    );
    expect(next).toMatchObject({
      status: EHeadlessBuyOrderStatus.Failed,
      statusReason: 'Declined',
      timedOut: false,
    });
  });

  it('flips a timed-out order back when it completes late', () => {
    const next = applyOnramperTransactionStatus(
      order({
        submittedAt: T0,
        status: EHeadlessBuyOrderStatus.Failed,
        timedOut: true,
      }),
      { transactionId: '01M3', status: 'completed' },
      T0,
    );
    expect(next?.status).toBe(EHeadlessBuyOrderStatus.Delivered);
    expect(next?.timedOut).toBe(false);
  });

  it('returns a timed-out order to processing once payment is seen', () => {
    const next = applyOnramperTransactionStatus(
      order({
        submittedAt: T0,
        status: EHeadlessBuyOrderStatus.Failed,
        timedOut: true,
      }),
      { transactionId: '01M3', status: 'pending' },
      T0,
    );
    expect(next?.status).toBe(EHeadlessBuyOrderStatus.Processing);
    expect(next?.timedOut).toBe(false);
  });

  it('keeps a timed-out order failed while the backend still says init', () => {
    const next = applyOnramperTransactionStatus(
      order({
        submittedAt: T0,
        status: EHeadlessBuyOrderStatus.Failed,
        timedOut: true,
      }),
      { transactionId: '01M3', status: 'init' },
      T0,
    );
    expect(next?.status).toBe(EHeadlessBuyOrderStatus.Failed);
    expect(next?.timedOut).toBe(true);
  });

  it('keeps existing fields when the payload omits them', () => {
    const next = applyOnramperTransactionStatus(
      order({
        submittedAt: T0,
        rawStatus: 'pending',
        transactionHash: '0xold',
      }),
      { transactionId: '01M3' },
      T0,
    );
    expect(next).toMatchObject({
      rawStatus: 'pending',
      transactionHash: '0xold',
      lastCheckOk: true,
    });
  });
});

describe('applyHeadlessBuyOrderTimeRules', () => {
  it('deletes a hidden order with no progress after 24 h', () => {
    expect(
      applyHeadlessBuyOrderTimeRules(
        order(),
        T0 + HEADLESS_BUY_ORDER_TIMEOUT_MS,
      ),
    ).toBeUndefined();
    const fresh = order();
    expect(
      applyHeadlessBuyOrderTimeRules(
        fresh,
        T0 + HEADLESS_BUY_ORDER_TIMEOUT_MS - 1,
      ),
    ).toBe(fresh);
  });

  it('keeps a hidden order whose backend status shows progress', () => {
    const paid = order({ rawStatus: 'paid', paymentSeen: true });
    expect(
      applyHeadlessBuyOrderTimeRules(
        paid,
        T0 + 2 * HEADLESS_BUY_ORDER_TIMEOUT_MS,
      ),
    ).toBe(paid);
  });

  it('fails a visible order with no payment sign after 24 h', () => {
    const next = applyHeadlessBuyOrderTimeRules(
      order({ submittedAt: T0, rawStatus: 'new' }),
      T0 + HEADLESS_BUY_ORDER_TIMEOUT_MS,
    );
    expect(next).toMatchObject({
      status: EHeadlessBuyOrderStatus.Failed,
      timedOut: true,
    });
  });

  it('never fails an order that is already in payment', () => {
    const paid = order({
      submittedAt: T0,
      rawStatus: 'pending',
      paymentSeen: true,
    });
    expect(
      applyHeadlessBuyOrderTimeRules(
        paid,
        T0 + 2 * HEADLESS_BUY_ORDER_TIMEOUT_MS,
      ),
    ).toBe(paid);
    const authorized = order({ submittedAt: T0, paymentSeen: true });
    expect(
      applyHeadlessBuyOrderTimeRules(
        authorized,
        T0 + 2 * HEADLESS_BUY_ORDER_TIMEOUT_MS,
      ),
    ).toBe(authorized);
  });

  it('leaves terminal orders alone', () => {
    const delivered = order({
      submittedAt: T0,
      status: EHeadlessBuyOrderStatus.Delivered,
    });
    expect(
      applyHeadlessBuyOrderTimeRules(
        delivered,
        T0 + 2 * HEADLESS_BUY_ORDER_TIMEOUT_MS,
      ),
    ).toBe(delivered);
  });
});

describe('terminal / delayed / failure kind', () => {
  it('treats backend failures as terminal but keeps refreshing timeouts', () => {
    expect(
      isTerminalHeadlessBuyOrder(
        order({ status: EHeadlessBuyOrderStatus.Delivered }),
      ),
    ).toBe(true);
    expect(
      isTerminalHeadlessBuyOrder(
        order({ status: EHeadlessBuyOrderStatus.Refunded }),
      ),
    ).toBe(true);
    expect(
      isTerminalHeadlessBuyOrder(
        order({ status: EHeadlessBuyOrderStatus.Failed }),
      ),
    ).toBe(true);
    expect(
      isTerminalHeadlessBuyOrder(
        order({ status: EHeadlessBuyOrderStatus.Failed, timedOut: true }),
      ),
    ).toBe(false);
    expect(isTerminalHeadlessBuyOrder(order())).toBe(false);
  });

  it('flags processing orders older than an hour as delayed', () => {
    expect(
      isHeadlessBuyOrderDelayed(
        order({ submittedAt: T0 }),
        T0 + HEADLESS_BUY_ORDER_DELAYED_MS,
      ),
    ).toBe(true);
    expect(
      isHeadlessBuyOrderDelayed(
        order({ submittedAt: T0 }),
        T0 + HEADLESS_BUY_ORDER_DELAYED_MS - 1,
      ),
    ).toBe(false);
    expect(
      isHeadlessBuyOrderDelayed(
        order({
          submittedAt: T0,
          status: EHeadlessBuyOrderStatus.Delivered,
        }),
        T0 + 2 * HEADLESS_BUY_ORDER_DELAYED_MS,
      ),
    ).toBe(false);
  });

  it('classifies failures by reason', () => {
    expect(
      getHeadlessBuyFailureKind(order({ statusReason: 'Refund issued' })),
    ).toBe('refund');
    expect(
      getHeadlessBuyFailureKind(order({ statusReason: 'Card declined' })),
    ).toBe('notCharged');
    expect(
      getHeadlessBuyFailureKind(order({ timedOut: true, statusReason: 'x' })),
    ).toBe('unknown');
    expect(getHeadlessBuyFailureKind(order())).toBe('unknown');
  });
});

describe('selectHeadlessBuyOrders', () => {
  it('splits visible / processing / unseen failed, newest first', () => {
    const hidden = order({ transactionId: 'hidden' });
    const older = order({ transactionId: 'older', submittedAt: T0 + 1 });
    const newer = order({ transactionId: 'newer', submittedAt: T0 + 2 });
    const failed = order({
      transactionId: 'failed',
      submittedAt: T0 + 3,
      status: EHeadlessBuyOrderStatus.Failed,
    });
    const seenFailed = order({
      transactionId: 'seen',
      submittedAt: T0 + 4,
      status: EHeadlessBuyOrderStatus.Failed,
      failureViewedAt: T0,
    });
    const result = selectHeadlessBuyOrders([
      hidden,
      older,
      failed,
      newer,
      seenFailed,
    ]);
    expect(result.visibleOrders.map((o) => o.transactionId)).toEqual([
      'seen',
      'failed',
      'newer',
      'older',
    ]);
    expect(result.processingOrders.map((o) => o.transactionId)).toEqual([
      'newer',
      'older',
    ]);
    expect(result.unseenFailedOrder?.transactionId).toBe('failed');
  });
});
