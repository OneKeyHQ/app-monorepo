/* cspell:ignore Infini */
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { startPrimeInfiniPaymentSendExitRecovery } from './primeInfiniPaymentSendExitRecovery';

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

describe('startPrimeInfiniPaymentSendExitRecovery', () => {
  it('restores the payment UI before durable session reconciliation finishes', () => {
    const deferred = createDeferred<boolean>();
    const onImmediate = jest.fn();
    const onSettled = jest.fn();

    void startPrimeInfiniPaymentSendExitRecovery({
      immediatePhase: 'selecting',
      fallbackPhase: 'selecting',
      resolveDidBroadcastStart: () => deferred.promise,
      shouldApply: () => true,
      onImmediate,
      onSettled,
      onRejected: jest.fn(),
    });

    expect(onImmediate).toHaveBeenCalledWith('selecting');
    expect(onSettled).not.toHaveBeenCalled();
  });

  it('corrects an optimistically cancelled payment when broadcast already started', async () => {
    const onSettled = jest.fn();

    await startPrimeInfiniPaymentSendExitRecovery({
      immediatePhase: 'selecting',
      fallbackPhase: 'selecting',
      resolveDidBroadcastStart: async () => true,
      shouldApply: () => true,
      onImmediate: jest.fn(),
      onSettled,
      onRejected: jest.fn(),
    });

    expect(onSettled).toHaveBeenCalledWith({
      didBroadcastStart: true,
      phase: 'polling',
    });
  });

  it('does not overwrite a newer payment attempt', async () => {
    const onSettled = jest.fn();

    await startPrimeInfiniPaymentSendExitRecovery({
      immediatePhase: 'polling',
      fallbackPhase: 'failed',
      resolveDidBroadcastStart: async () => false,
      shouldApply: () => false,
      onImmediate: jest.fn(),
      onSettled,
      onRejected: jest.fn(),
    });

    expect(onSettled).not.toHaveBeenCalled();
  });

  it('fails closed without restoring the exit lock when reconciliation fails', async () => {
    const onRejected = jest.fn();

    await startPrimeInfiniPaymentSendExitRecovery({
      immediatePhase: 'selecting',
      fallbackPhase: 'selecting',
      resolveDidBroadcastStart: async () => {
        throw new OneKeyLocalError('background unavailable');
      },
      shouldApply: () => true,
      onImmediate: jest.fn(),
      onSettled: jest.fn(),
      onRejected,
    });

    expect(onRejected).toHaveBeenCalledWith('polling');
  });
});
