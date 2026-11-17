/* cspell:ignore Infini */
import { resolvePrimeInfiniPaymentReloadCommit } from './primeInfiniPaymentReload';

describe('resolvePrimeInfiniPaymentReloadCommit', () => {
  it('waits until the requested loader result has committed', () => {
    expect(
      resolvePrimeInfiniPaymentReloadCommit({
        request: {
          minimumLoadAttempt: 3,
          previousBindingId: 'binding-1',
        },
        committedLoadAttempt: 2,
        committedBindingId: 'binding-1',
      }),
    ).toBe('wait');
  });

  it('does not explicitly remount when the fresh session has a new binding', () => {
    expect(
      resolvePrimeInfiniPaymentReloadCommit({
        request: {
          minimumLoadAttempt: 3,
          previousBindingId: 'binding-1',
        },
        committedLoadAttempt: 3,
        committedBindingId: 'binding-2',
      }),
    ).toBe('settled');
  });

  it('remounts once when the committed session keeps the same binding', () => {
    expect(
      resolvePrimeInfiniPaymentReloadCommit({
        request: {
          minimumLoadAttempt: 3,
          previousBindingId: 'binding-1',
        },
        committedLoadAttempt: 3,
        committedBindingId: 'binding-1',
      }),
    ).toBe('remount');
  });

  it('treats a removed session as a natural key change', () => {
    expect(
      resolvePrimeInfiniPaymentReloadCommit({
        request: {
          minimumLoadAttempt: 3,
          previousBindingId: 'binding-1',
        },
        committedLoadAttempt: 4,
        committedBindingId: undefined,
      }),
    ).toBe('settled');
  });
});
