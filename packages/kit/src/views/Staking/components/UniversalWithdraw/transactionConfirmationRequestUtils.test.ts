import {
  getWithdrawFormTips,
  isLatestTransactionConfirmationRequest,
  selectCurrentTransactionConfirmation,
  shouldShowPendleSummaryTip,
} from './transactionConfirmationRequestUtils';

describe('transaction confirmation request guards', () => {
  it('hides a confirmation resolved for an older request identity', () => {
    const snapshot = { withdrawType: 'instant' };

    expect(
      selectCurrentTransactionConfirmation({
        snapshot,
        currentRequestKey: 'amount:2|type:queued',
        resolvedRequestKey: 'amount:1|type:instant',
        requiresCurrentRequest: true,
      }),
    ).toBeUndefined();
    expect(
      selectCurrentTransactionConfirmation({
        snapshot,
        currentRequestKey: 'amount:1|type:instant',
        resolvedRequestKey: 'amount:1|type:instant',
        requiresCurrentRequest: true,
      }),
    ).toBe(snapshot);
  });

  it('accepts only the latest request generation and identity', () => {
    expect(
      isLatestTransactionConfirmationRequest({
        requestId: 1,
        requestKey: 'amount:1',
        latestRequestId: 2,
        latestRequestKey: 'amount:2',
      }),
    ).toBe(false);
    expect(
      isLatestTransactionConfirmationRequest({
        requestId: 2,
        requestKey: 'amount:1',
        latestRequestId: 2,
        latestRequestKey: 'amount:2',
      }),
    ).toBe(false);
    expect(
      isLatestTransactionConfirmationRequest({
        requestId: 2,
        requestKey: 'amount:2',
        latestRequestId: 2,
        latestRequestKey: 'amount:2',
      }),
    ).toBe(true);
  });
});

describe('withdraw form tips', () => {
  const cooldownTip = {
    type: 'info',
    text: { text: 'Withdrawn funds can be claimed after the 7-day cooldown.' },
  };
  const restartTip = {
    type: 'warning',
    text: { text: 'The full unclaimed amount starts a new 7-day cooldown.' },
  };
  const queued = {
    title: { text: 'Queued withdrawal' },
    description: { text: '1.5 USDu' },
  };
  const withdrawPath = { type: 'withdrawPath' };

  it('shows both notices inline for an additional USDT redemption', () => {
    expect(
      getWithdrawFormTips(
        {
          tip: cooldownTip,
          withdrawPath: {
            ...withdrawPath,
            data: { confirmBoxes: [{ ...queued, tip: restartTip }] },
          },
        },
        0,
      ),
    ).toEqual({ formTip: cooldownTip, inlinePathTip: restartTip });
  });

  it('keeps the general cooldown notice for a single path without a warning', () => {
    expect(
      getWithdrawFormTips(
        {
          tip: cooldownTip,
          withdrawPath: {
            ...withdrawPath,
            data: { confirmBoxes: [queued] },
          },
        },
        0,
      ),
    ).toEqual({ formTip: cooldownTip, inlinePathTip: undefined });
  });

  it('keeps path-specific notices in the selector when several paths exist', () => {
    const confirmation = {
      tip: cooldownTip,
      withdrawPath: {
        ...withdrawPath,
        data: {
          confirmBoxes: [
            { ...queued, title: { text: 'Instant withdrawal' } },
            { ...queued, tip: restartTip },
          ],
        },
      },
    };
    expect(getWithdrawFormTips(confirmation, 1)).toEqual({
      formTip: undefined,
      inlinePathTip: undefined,
    });
    expect(getWithdrawFormTips(confirmation, 0)).toEqual({
      formTip: cooldownTip,
      inlinePathTip: undefined,
    });
  });
});

describe('Pendle withdrawal summary tip', () => {
  const transactionTip = {
    type: 'info',
    text: { text: 'Matured' },
    description: { text: 'Details' },
  };

  it('hides the summary copy when the form displays the same tip', () => {
    expect(
      shouldShowPendleSummaryTip({
        formTip: transactionTip,
        transactionTip,
      }),
    ).toBe(false);
  });

  it('keeps the summary tip when the form displays a different path tip', () => {
    expect(
      shouldShowPendleSummaryTip({
        formTip: { ...transactionTip },
        transactionTip,
      }),
    ).toBe(true);
  });

  it('keeps the summary tip when the form tip is not shown', () => {
    expect(
      shouldShowPendleSummaryTip({
        formTip: undefined,
        transactionTip,
      }),
    ).toBe(true);
  });
});
