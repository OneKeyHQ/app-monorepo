import {
  getFreshWithdrawPathPreview,
  getWithdrawFormTips,
  getWithdrawPathPreviewKey,
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

describe('withdraw path display previews', () => {
  const request = {
    accountId: 'account-a',
    accountAddress: '0xabc',
    networkId: 'evm--1',
    provider: 'provider',
    vault: 'vault',
    identity: 'position',
    inputTokenAddress: 'input',
    outputTokenAddress: 'output',
    amount: '1',
    amountUnit: 'shares',
    slippage: 1,
    claimRefreshKey: 0,
  };
  it('keeps account, network, assets, amount and path isolated', () => {
    const original = getWithdrawPathPreviewKey(request, 'instant');
    for (const changed of [
      { accountId: 'account-b' },
      { accountAddress: '0xdef' },
      { networkId: 'evm--2' },
      { provider: 'other' },
      { vault: 'other' },
      { identity: 'other' },
      { inputTokenAddress: 'other' },
      { outputTokenAddress: 'other' },
      { amount: '2' },
      { amountUnit: 'underlying' },
      { slippage: 2 },
      { claimRefreshKey: 1 },
    ])
      expect(
        getWithdrawPathPreviewKey({ ...request, ...changed }, 'instant'),
      ).not.toBe(original);
    expect(getWithdrawPathPreviewKey(request, 'queued')).not.toBe(original);
  });
  it('uses only an exact match for less than 30 seconds', () => {
    const key = getWithdrawPathPreviewKey(request, 'instant');
    const cache = new Map([[key, { at: 1000, confirmation: 'preview' }]]);
    expect(getFreshWithdrawPathPreview(cache, key, 30_999)).toBe('preview');
    expect(getFreshWithdrawPathPreview(cache, key, 31_000)).toBeUndefined();
    expect(getFreshWithdrawPathPreview(cache, key, 999)).toBeUndefined();
    expect(
      getFreshWithdrawPathPreview(
        cache,
        getWithdrawPathPreviewKey(request, 'queued'),
        1000,
      ),
    ).toBeUndefined();
  });
});
