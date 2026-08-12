import {
  isLatestTransactionConfirmationRequest,
  selectCurrentTransactionConfirmation,
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
