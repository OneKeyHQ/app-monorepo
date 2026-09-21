import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import {
  FinalizeWalletSetupAttempts,
  resolveOperationReleaseForAttempt,
} from './finalizeWalletSetupOperationUtils';

const ownOperation = {
  vendor: EHardwareVendor.ledger,
  operationId: 'op-1',
};

describe('resolveOperationReleaseForAttempt', () => {
  it('releases and clears the shared operation when the attempt still owns it', () => {
    expect(
      resolveOperationReleaseForAttempt({
        attempt: 1,
        activeOperation: { ...ownOperation, attempt: 1 },
        ownOperation,
      }),
    ).toEqual({
      operationToRelease: { ...ownOperation, attempt: 1 },
      shouldClearActiveOperation: true,
    });
  });

  it('keeps a newer attempt operation and releases only its own', () => {
    const newerOperation = {
      vendor: EHardwareVendor.ledger,
      operationId: 'op-2',
      attempt: 2,
    };
    expect(
      resolveOperationReleaseForAttempt({
        attempt: 1,
        activeOperation: newerOperation,
        ownOperation,
      }),
    ).toEqual({
      operationToRelease: ownOperation,
      shouldClearActiveOperation: false,
    });
  });

  it('releases its own operation when a newer attempt has not connected yet', () => {
    expect(
      resolveOperationReleaseForAttempt({
        attempt: 1,
        activeOperation: undefined,
        ownOperation,
      }),
    ).toEqual({
      operationToRelease: ownOperation,
      shouldClearActiveOperation: false,
    });
  });

  it('releases nothing when a superseded attempt never opened an operation', () => {
    expect(
      resolveOperationReleaseForAttempt({
        attempt: 1,
        activeOperation: {
          vendor: EHardwareVendor.trezor,
          operationId: 'op-2',
          attempt: 2,
        },
        ownOperation: undefined,
      }),
    ).toEqual({
      operationToRelease: undefined,
      shouldClearActiveOperation: false,
    });
  });

  it('releases nothing when no operation was ever opened', () => {
    expect(
      resolveOperationReleaseForAttempt({
        attempt: 3,
        activeOperation: undefined,
        ownOperation: undefined,
      }),
    ).toEqual({
      operationToRelease: undefined,
      shouldClearActiveOperation: false,
    });
  });
});

describe('FinalizeWalletSetupAttempts', () => {
  it('does not let an old completion hide the current first contact', () => {
    const attempts = new FinalizeWalletSetupAttempts();
    const first = attempts.begin();
    attempts.startFirstContact(first);
    const second = attempts.begin();
    attempts.startFirstContact(second);
    attempts.finishFirstContact(first);
    expect(attempts.isCurrent(first)).toBe(false);
    expect(attempts.isCurrent(second)).toBe(true);
    expect(attempts.invalidate()).toBe(true);
    expect(attempts.isCurrent(second)).toBe(false);
  });

  it('does not cancel a newer operation after its first contact completed', () => {
    const attempts = new FinalizeWalletSetupAttempts();
    const first = attempts.begin();
    const second = attempts.begin();
    attempts.startFirstContact(second);
    attempts.finishFirstContact(second);
    attempts.startFirstContact(first);
    expect(attempts.invalidate()).toBe(false);
  });

  it('invalidates late results after unmount without cancelling completed work', () => {
    const attempts = new FinalizeWalletSetupAttempts();
    const first = attempts.begin();
    attempts.startFirstContact(first);
    attempts.finishFirstContact(first);
    expect(attempts.invalidate()).toBe(false);
    expect(attempts.isCurrent(first)).toBe(false);
  });
});
