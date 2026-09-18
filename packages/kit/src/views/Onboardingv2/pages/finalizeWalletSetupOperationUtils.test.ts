import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import { resolveOperationReleaseForAttempt } from './finalizeWalletSetupOperationUtils';

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
