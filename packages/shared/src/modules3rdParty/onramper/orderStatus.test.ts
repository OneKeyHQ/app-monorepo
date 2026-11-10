import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EHeadlessBuyOrderStatus,
  type IHeadlessBuyOrder,
} from '@onekeyhq/shared/types/fiatCrypto';

import {
  HEADLESS_BUY_ORDER_DELAYED_MS,
  HEADLESS_BUY_ORDER_TIMEOUT_MS,
  applyHeadlessBuyCheckoutEvent,
  applyHeadlessBuyOrderTimeRules,
  applyHeadlessBuyPaidOutcome,
  applyOnramperTransactionStatus,
  getHeadlessBuyAbandonReason,
  getHeadlessBuyFailureKind,
  getHeadlessBuyOrderSentenceId,
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
    // `pending` is what a provider order gets at creation — before the
    // payment page is even ready — so it proves nothing about a payment.
    expect(mapOnramperStatus('pending')).toEqual({
      status: processing,
      paymentSeen: false,
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
      { transactionId: '01M3', status: 'paid', statusDate: 'garbage' },
      T0 + 5000,
    );
    expect(next?.submittedAt).toBe(T0 + 5000);
  });

  it('keeps a hidden order hidden while the backend only says pending', () => {
    // Device-observed 2026-11-06 (Coinbase): the transaction was `pending`
    // from creation, the payment authorization then failed and nothing was
    // charged. Surfacing on `pending` would show a never-paid order.
    const next = applyOnramperTransactionStatus(
      order(),
      {
        transactionId: '01M3',
        status: 'pending',
        statusDate: '2023-11-14T22:13:20.000Z',
      },
      T0 + 5000,
    );
    expect(next?.submittedAt).toBeUndefined();
    expect(next?.paymentSeen).toBe(false);
    expect(next).toMatchObject({ rawStatus: 'pending', lastCheckOk: true });
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

  it('surfaces a hidden order that fails after the payment was authorized', () => {
    const statusDate = '2023-11-14T22:13:20.000Z';
    const next = applyOnramperTransactionStatus(
      order({ paymentSeen: true }),
      {
        transactionId: '01M3',
        status: 'failed',
        statusReason: 'Declined',
        statusDate,
      },
      T0 + 5000,
    );
    expect(next).toMatchObject({
      submittedAt: Date.parse(statusDate),
      status: EHeadlessBuyOrderStatus.Failed,
      statusReason: 'Declined',
      paymentSeen: true,
      lastCheckOk: true,
    });
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
      { transactionId: '01M3', status: 'paid' },
      T0,
    );
    expect(next?.status).toBe(EHeadlessBuyOrderStatus.Processing);
    expect(next?.timedOut).toBe(false);
  });

  it('keeps a timed-out order failed while the backend only says pending', () => {
    const next = applyOnramperTransactionStatus(
      order({
        submittedAt: T0,
        status: EHeadlessBuyOrderStatus.Failed,
        timedOut: true,
      }),
      { transactionId: '01M3', status: 'pending' },
      T0,
    );
    expect(next?.status).toBe(EHeadlessBuyOrderStatus.Failed);
    expect(next?.timedOut).toBe(true);
  });

  it('forgets the viewed failure when a timed-out order recovers, so a later failure shows again', () => {
    const recovered = applyOnramperTransactionStatus(
      order({
        submittedAt: T0,
        status: EHeadlessBuyOrderStatus.Failed,
        timedOut: true,
        failureViewedAt: T0,
      }),
      { transactionId: '01M3', status: 'paid' },
      T0,
    );
    expect(recovered?.status).toBe(EHeadlessBuyOrderStatus.Processing);
    expect(recovered?.failureViewedAt).toBeUndefined();
    const failedAgain =
      recovered &&
      applyOnramperTransactionStatus(
        recovered,
        {
          transactionId: '01M3',
          status: 'failed',
          statusReason: 'Refund issued',
        },
        T0,
      );
    expect(failedAgain?.status).toBe(EHeadlessBuyOrderStatus.Failed);
    expect(
      selectHeadlessBuyOrders(failedAgain ? [failedAgain] : [])
        .unseenFailedOrder?.transactionId,
    ).toBe('01M3');
    // A failure that stays failed keeps its mark.
    const stillFailed = applyOnramperTransactionStatus(
      order({
        submittedAt: T0,
        status: EHeadlessBuyOrderStatus.Failed,
        failureViewedAt: T0,
      }),
      { transactionId: '01M3', status: 'failed' },
      T0,
    );
    expect(stillFailed?.failureViewedAt).toBe(T0);
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

  it('surfaces a hidden payment-seen record as timed out instead of deleting it', () => {
    const hidden = order({ paymentSeen: true });
    expect(
      applyHeadlessBuyOrderTimeRules(
        hidden,
        T0 + HEADLESS_BUY_ORDER_TIMEOUT_MS - 1,
      ),
    ).toBe(hidden);
    const next = applyHeadlessBuyOrderTimeRules(
      hidden,
      T0 + HEADLESS_BUY_ORDER_TIMEOUT_MS,
    );
    expect(next).toEqual({
      ...hidden,
      submittedAt: T0,
      status: EHeadlessBuyOrderStatus.Failed,
      timedOut: true,
    });
    // Stable afterwards, still refreshed, and the failure copy stays
    // non-committal about the money.
    expect(
      applyHeadlessBuyOrderTimeRules(
        next as IHeadlessBuyOrder,
        T0 + 3 * HEADLESS_BUY_ORDER_TIMEOUT_MS,
      ),
    ).toBe(next);
    expect(isTerminalHeadlessBuyOrder(next as IHeadlessBuyOrder)).toBe(false);
    expect(getHeadlessBuyFailureKind(next as IHeadlessBuyOrder)).toBe(
      'unknown',
    );
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

  it('fails a visible order the backend left pending with no payment evidence after 24 h', () => {
    const stuck = order({ submittedAt: T0, rawStatus: 'pending' });
    expect(
      applyHeadlessBuyOrderTimeRules(
        stuck,
        T0 + HEADLESS_BUY_ORDER_TIMEOUT_MS - 1,
      ),
    ).toBe(stuck);
    expect(
      applyHeadlessBuyOrderTimeRules(stuck, T0 + HEADLESS_BUY_ORDER_TIMEOUT_MS),
    ).toMatchObject({
      status: EHeadlessBuyOrderStatus.Failed,
      timedOut: true,
    });
  });

  it('deletes a hidden order the backend left pending with no payment evidence after 24 h', () => {
    expect(
      applyHeadlessBuyOrderTimeRules(
        order({ rawStatus: 'pending' }),
        T0 + HEADLESS_BUY_ORDER_TIMEOUT_MS,
      ),
    ).toBeUndefined();
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

  it('classifies failures by reason and payment evidence', () => {
    expect(
      getHeadlessBuyFailureKind(order({ statusReason: 'Refund issued' })),
    ).toBe('refund');
    expect(
      getHeadlessBuyFailureKind(order({ statusReason: 'Card declined' })),
    ).toBe('notCharged');
    // A payment was authorized or seen by the backend: never promise that
    // the card was not charged.
    expect(
      getHeadlessBuyFailureKind(
        order({ statusReason: 'Card declined', paymentSeen: true }),
      ),
    ).toBe('unknown');
    expect(
      getHeadlessBuyFailureKind(
        order({ statusReason: 'Refund issued', paymentSeen: true }),
      ),
    ).toBe('refund');
    expect(
      getHeadlessBuyFailureKind(order({ timedOut: true, statusReason: 'x' })),
    ).toBe('unknown');
    expect(getHeadlessBuyFailureKind(order())).toBe('unknown');
    // SDK 1.3 `providerFailed`: the payment surface failed without confirming
    // the outcome. A later backend failure reason must not turn that into
    // "you were not charged"; the refund reason still wins.
    expect(
      getHeadlessBuyFailureKind(
        order({ statusReason: 'Card declined', paymentOutcomeUnknown: true }),
      ),
    ).toBe('unknown');
    expect(
      getHeadlessBuyFailureKind(
        order({ statusReason: 'Refund issued', paymentOutcomeUnknown: true }),
      ),
    ).toBe('refund');
  });
});

describe('getHeadlessBuyAbandonReason', () => {
  it('reads a Coinbase commit error as a failed authorization, not an unknown outcome', () => {
    // SDK 1.3.1 reports Coinbase's `commit_error` (payment authorization
    // failed) under the "outcome unknown" code; the page reason settles it.
    expect(
      getHeadlessBuyAbandonReason({
        errorCode: 'providerFailed',
        providerReason: 'onramp_api.commit_error',
      }),
    ).toBe('authorizationFailed');
  });

  it('keeps any other provider failure as outcome unknown', () => {
    expect(getHeadlessBuyAbandonReason({ errorCode: 'providerFailed' })).toBe(
      'providerFailed',
    );
    expect(
      getHeadlessBuyAbandonReason({
        errorCode: 'providerFailed',
        providerReason: 'onramp_api.polling_error',
      }),
    ).toBe('providerFailed');
  });

  it('treats every other error code as a plain failure', () => {
    expect(getHeadlessBuyAbandonReason({ errorCode: 'networkError' })).toBe(
      'failed',
    );
    expect(getHeadlessBuyAbandonReason({})).toBe('failed');
    // A provider-confirmed failure keeps its own handling whatever the page
    // reason was.
    expect(
      getHeadlessBuyAbandonReason({
        errorCode: 'paymentFailed',
        providerReason: 'onramp_api.commit_error',
      }),
    ).toBe('failed');
  });

  // Device-observed 2026-11-09 on Paybis: the web view failed on an SSL
  // error (supportCode `providerFailed:NSURLErrorDomain/-1200`) with no
  // `providerReady` before it.
  it('reads a web view that never came up as a page load failure', () => {
    expect(
      getHeadlessBuyAbandonReason({
        errorCode: 'providerFailed',
        progress: { renderType: 'webview', paymentSurfaceReached: false },
      }),
    ).toBe('pageLoadFailed');
    // The provider's page saying so itself changes nothing.
    expect(
      getHeadlessBuyAbandonReason({
        errorCode: 'providerFailed',
        providerReason: 'onramp_api.load_error',
        progress: { renderType: 'webview', paymentSurfaceReached: false },
      }),
    ).toBe('pageLoadFailed');
  });

  it('keeps the outcome unknown once the payment surface came up', () => {
    expect(
      getHeadlessBuyAbandonReason({
        errorCode: 'providerFailed',
        progress: { renderType: 'webview', paymentSurfaceReached: true },
      }),
    ).toBe('providerFailed');
    expect(
      getHeadlessBuyAbandonReason({
        errorCode: 'providerFailed',
        providerReason: 'onramp_api.load_error',
        progress: { renderType: 'webview', paymentSurfaceReached: true },
      }),
    ).toBe('providerFailed');
  });

  it('keeps the outcome unknown when nothing proves the page did not load', () => {
    // No render event on record, or a surface that is not a web view.
    expect(
      getHeadlessBuyAbandonReason({
        errorCode: 'providerFailed',
        progress: { paymentSurfaceReached: false },
      }),
    ).toBe('providerFailed');
    expect(
      getHeadlessBuyAbandonReason({
        errorCode: 'providerFailed',
        progress: { renderType: 'deeplink', paymentSurfaceReached: false },
      }),
    ).toBe('providerFailed');
    // A page reason we do not know.
    expect(
      getHeadlessBuyAbandonReason({
        errorCode: 'providerFailed',
        providerReason: 'onramp_api.polling_error',
        progress: { renderType: 'webview', paymentSurfaceReached: false },
      }),
    ).toBe('providerFailed');
  });

  it('still reads a commit error as a failed authorization on a loaded page', () => {
    expect(
      getHeadlessBuyAbandonReason({
        errorCode: 'providerFailed',
        providerReason: 'onramp_api.commit_error',
        progress: { renderType: 'webview', paymentSurfaceReached: true },
      }),
    ).toBe('authorizationFailed');
  });
});

describe('applyHeadlessBuyCheckoutEvent', () => {
  it('records the render type and whether the payment surface came up', () => {
    const rendering = applyHeadlessBuyCheckoutEvent(undefined, {
      type: 'renderingStarted',
      renderType: 'webview',
    });
    expect(rendering).toEqual({
      renderType: 'webview',
      paymentSurfaceReached: false,
    });
    const ready = applyHeadlessBuyCheckoutEvent(rendering, {
      type: 'providerReady',
    });
    expect(ready).toEqual({
      renderType: 'webview',
      paymentSurfaceReached: true,
    });
    // Nothing un-reaches the surface, and an event that adds nothing keeps
    // the reference.
    expect(
      applyHeadlessBuyCheckoutEvent(ready, { type: 'providerError' }),
    ).toBe(ready);
  });

  it('counts a payment event as proof of the surface, not a page error', () => {
    for (const type of [
      'paymentAuthorized',
      'paymentProcessing',
      'completed',
    ]) {
      expect(
        applyHeadlessBuyCheckoutEvent(undefined, { type })
          .paymentSurfaceReached,
      ).toBe(true);
    }
    for (const type of ['checkoutFinalized', 'providerError', 'cancelled']) {
      expect(
        applyHeadlessBuyCheckoutEvent(undefined, { type })
          .paymentSurfaceReached,
      ).toBe(false);
    }
  });
});

describe('authorization-failed orders', () => {
  const authorizationFailed = (overrides: Partial<IHeadlessBuyOrder> = {}) =>
    order({
      submittedAt: T0,
      status: EHeadlessBuyOrderStatus.Failed,
      authorizationFailed: true,
      ...overrides,
    });

  it('keeps being refreshed, like a timed-out order', () => {
    expect(isTerminalHeadlessBuyOrder(authorizationFailed())).toBe(false);
  });

  it('stays failed while the backend shows no payment', () => {
    for (const status of ['pending', 'init', 'new']) {
      const next = applyOnramperTransactionStatus(
        authorizationFailed(),
        { transactionId: '01M3', status },
        T0 + 1000,
      );
      expect(next).toMatchObject({
        status: EHeadlessBuyOrderStatus.Failed,
        authorizationFailed: true,
        rawStatus: status,
        lastCheckOk: true,
      });
    }
  });

  it('returns to processing once the backend proves a payment', () => {
    const paid = applyOnramperTransactionStatus(
      authorizationFailed({ failureViewedAt: T0 }),
      { transactionId: '01M3', status: 'paid' },
      T0 + 1000,
    );
    expect(paid?.status).toBe(EHeadlessBuyOrderStatus.Processing);
    expect(paid?.authorizationFailed).toBeUndefined();
    expect(paid?.paymentSeen).toBe(true);
    expect(paid?.failureViewedAt).toBeUndefined();
    const delivered = applyOnramperTransactionStatus(
      authorizationFailed(),
      { transactionId: '01M3', status: 'completed', outAmount: 0.05 },
      T0 + 1000,
    );
    expect(delivered?.status).toBe(EHeadlessBuyOrderStatus.Delivered);
    expect(delivered?.authorizationFailed).toBeUndefined();
  });

  it('becomes a settled backend failure once the backend confirms it', () => {
    const next = applyOnramperTransactionStatus(
      authorizationFailed(),
      { transactionId: '01M3', status: 'failed', statusReason: 'Declined' },
      T0 + 1000,
    );
    expect(next?.status).toBe(EHeadlessBuyOrderStatus.Failed);
    expect(next?.authorizationFailed).toBeUndefined();
    expect(isTerminalHeadlessBuyOrder(next as IHeadlessBuyOrder)).toBe(true);
    expect(getHeadlessBuyFailureKind(next as IHeadlessBuyOrder)).toBe(
      'notCharged',
    );
  });

  // Onramper confirmed (2026-11-06, 2026-11-09) that a Coinbase commit error
  // takes no charge.
  it('says the card was not charged', () => {
    expect(getHeadlessBuyFailureKind(authorizationFailed())).toBe('notCharged');
    expect(getHeadlessBuyOrderSentenceId(authorizationFailed(), T0)).toBe(
      ETranslations.buy_order_failed_not_charged__desc,
    );
  });

  it('does not say so once anything showed a payment or left its outcome unknown', () => {
    expect(
      getHeadlessBuyFailureKind(authorizationFailed({ paymentSeen: true })),
    ).toBe('unknown');
    expect(
      getHeadlessBuyFailureKind(
        authorizationFailed({ paymentOutcomeUnknown: true }),
      ),
    ).toBe('unknown');
    // A timed-out order still knows nothing.
    expect(
      getHeadlessBuyFailureKind(
        order({
          submittedAt: T0,
          status: EHeadlessBuyOrderStatus.Failed,
          timedOut: true,
        }),
      ),
    ).toBe('unknown');
  });

  it('is left alone by the time rules', () => {
    const failed = authorizationFailed();
    expect(
      applyHeadlessBuyOrderTimeRules(
        failed,
        T0 + 3 * HEADLESS_BUY_ORDER_TIMEOUT_MS,
      ),
    ).toBe(failed);
  });
});

describe('applyHeadlessBuyPaidOutcome', () => {
  it('puts an order the client had failed on its own back to processing', () => {
    for (const clientFailure of [
      { authorizationFailed: true },
      { timedOut: true },
    ]) {
      const next = applyHeadlessBuyPaidOutcome(
        order({
          submittedAt: T0,
          status: EHeadlessBuyOrderStatus.Failed,
          failureViewedAt: T0,
          ...clientFailure,
        }),
      );
      expect(next.status).toBe(EHeadlessBuyOrderStatus.Processing);
      expect(next.paymentSeen).toBe(true);
      expect(next.authorizationFailed).toBeUndefined();
      expect(next.timedOut).toBeFalsy();
      // The banner's "unseen failure" mark belonged to that failure.
      expect(next.failureViewedAt).toBeUndefined();
      // Still refreshed, and never failed by the 24 h rule again.
      expect(isTerminalHeadlessBuyOrder(next)).toBe(false);
      expect(
        applyHeadlessBuyOrderTimeRules(
          next,
          T0 + 3 * HEADLESS_BUY_ORDER_TIMEOUT_MS,
        ),
      ).toBe(next);
    }
  });

  it('leaves a failure the backend reported alone, noting only the payment evidence', () => {
    const next = applyHeadlessBuyPaidOutcome(
      order({
        submittedAt: T0,
        status: EHeadlessBuyOrderStatus.Failed,
        statusReason: 'Declined',
      }),
    );
    expect(next.status).toBe(EHeadlessBuyOrderStatus.Failed);
    expect(next.paymentSeen).toBe(true);
  });

  it('notes the payment evidence on an order that is still processing', () => {
    const next = applyHeadlessBuyPaidOutcome(order({ submittedAt: T0 }));
    expect(next).toMatchObject({
      status: EHeadlessBuyOrderStatus.Processing,
      paymentSeen: true,
    });
  });

  it('returns the same record when there is nothing to change', () => {
    const processing = order({ submittedAt: T0, paymentSeen: true });
    expect(applyHeadlessBuyPaidOutcome(processing)).toBe(processing);
    const delivered = order({
      submittedAt: T0,
      paymentSeen: true,
      status: EHeadlessBuyOrderStatus.Delivered,
    });
    expect(applyHeadlessBuyPaidOutcome(delivered)).toBe(delivered);
  });
});

describe('getHeadlessBuyOrderSentenceId', () => {
  it('swaps the processing sentence for the delayed one after an hour', () => {
    const processing = order({ submittedAt: T0 });
    expect(getHeadlessBuyOrderSentenceId(processing, T0)).toBe(
      ETranslations.buy_order_processing__desc,
    );
    expect(
      getHeadlessBuyOrderSentenceId(
        processing,
        T0 + HEADLESS_BUY_ORDER_DELAYED_MS - 1,
      ),
    ).toBe(ETranslations.buy_order_processing__desc);
    // One sentence only: the delayed copy replaces, never stacks on, the
    // plain processing copy.
    expect(
      getHeadlessBuyOrderSentenceId(
        processing,
        T0 + HEADLESS_BUY_ORDER_DELAYED_MS,
      ),
    ).toBe(ETranslations.buy_order_delayed__desc);
  });

  it('says nothing under a delivered order', () => {
    expect(
      getHeadlessBuyOrderSentenceId(
        order({ status: EHeadlessBuyOrderStatus.Delivered, submittedAt: T0 }),
        T0 + 2 * HEADLESS_BUY_ORDER_DELAYED_MS,
      ),
    ).toBeUndefined();
  });

  it('picks the failure and refund sentences from the failure kind', () => {
    const failed = (overrides: Partial<IHeadlessBuyOrder>) =>
      order({ status: EHeadlessBuyOrderStatus.Failed, ...overrides });
    expect(
      getHeadlessBuyOrderSentenceId(
        failed({ statusReason: 'Card declined' }),
        T0,
      ),
    ).toBe(ETranslations.buy_order_failed_not_charged__desc);
    expect(
      getHeadlessBuyOrderSentenceId(
        failed({ statusReason: 'Refund issued' }),
        T0,
      ),
    ).toBe(ETranslations.buy_order_failed_refund__desc);
    expect(getHeadlessBuyOrderSentenceId(failed({ timedOut: true }), T0)).toBe(
      ETranslations.buy_order_failed_unknown__desc,
    );
    expect(
      getHeadlessBuyOrderSentenceId(
        order({ status: EHeadlessBuyOrderStatus.Refunded }),
        T0,
      ),
    ).toBe(ETranslations.buy_order_refunded__desc);
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
