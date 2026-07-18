import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import {
  runTxConfirmBatchSignAndSendWithPreflight,
  runTxConfirmExclusiveSubmit,
  runTxConfirmPreflight,
  runTxConfirmSignAndSendWithPreflight,
} from './txConfirmPreflight';

describe('TxConfirm live preflight', () => {
  it('keeps one submit lease across the full async attempt', async () => {
    const inFlightRef = { current: false };
    let releaseFirst: (() => void) | undefined;
    const firstDeferred = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const submit = jest
      .fn<Promise<string>, []>()
      .mockImplementationOnce(async () => {
        await firstDeferred;
        return 'first';
      })
      .mockResolvedValueOnce('third');

    const first = runTxConfirmExclusiveSubmit({ inFlightRef, submit });
    const second = runTxConfirmExclusiveSubmit({ inFlightRef, submit });

    expect(inFlightRef.current).toBe(true);
    await expect(second).resolves.toEqual({ executed: false });
    expect(submit).toHaveBeenCalledTimes(1);

    releaseFirst?.();
    await expect(first).resolves.toEqual({ executed: true, result: 'first' });
    expect(inFlightRef.current).toBe(false);
    await expect(
      runTxConfirmExclusiveSubmit({ inFlightRef, submit }),
    ).resolves.toEqual({ executed: true, result: 'third' });
    expect(submit).toHaveBeenCalledTimes(2);
  });

  it('releases the submit lease after a terminal error', async () => {
    const inFlightRef = { current: false };
    const error = new OneKeyLocalError('submit failed');

    await expect(
      runTxConfirmExclusiveSubmit({
        inFlightRef,
        submit: async () => Promise.reject(error),
      }),
    ).rejects.toBe(error);
    expect(inFlightRef.current).toBe(false);
  });

  it('does not reopen a component after its first attempt becomes terminal', async () => {
    const inFlightRef = { current: false };
    const terminalRef = { current: false };
    const submit = jest.fn(async () => {
      terminalRef.current = true;
      return 'sent';
    });

    await expect(
      runTxConfirmExclusiveSubmit({ inFlightRef, submit, terminalRef }),
    ).resolves.toEqual({ executed: true, result: 'sent' });
    await expect(
      runTxConfirmExclusiveSubmit({ inFlightRef, submit, terminalRef }),
    ).resolves.toEqual({ executed: false });
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it('checks the lease before the irreversible sign-and-send action', async () => {
    const callOrder: string[] = [];
    const beforeConfirm = jest.fn(async (phase: 'submit' | 'sign') => {
      callOrder.push(phase);
    });
    const serviceSend = {
      batchSignAndSendTransaction: jest.fn(async () => {
        callOrder.push('sign-and-send');
        return 'sent';
      }),
    };
    const onPreflightError = jest.fn();

    await runTxConfirmPreflight(beforeConfirm, 'submit');
    await expect(
      runTxConfirmBatchSignAndSendWithPreflight({
        beforeConfirm,
        onPreflightError,
        request: { accountId: 'account-1' },
        serviceSend,
      }),
    ).resolves.toEqual({ executed: true, result: 'sent' });

    expect(callOrder).toEqual(['submit', 'sign', 'sign-and-send']);
    expect(beforeConfirm.mock.calls).toEqual([['submit'], ['sign']]);
    expect(serviceSend.batchSignAndSendTransaction).toHaveBeenCalledWith({
      accountId: 'account-1',
    });
    expect(onPreflightError).not.toHaveBeenCalled();
  });

  it('does not sign or send when the final market check is explicitly closed', async () => {
    const error = new OneKeyLocalError('market is closed');
    const beforeConfirm = jest.fn(async (phase: 'submit' | 'sign') => {
      if (phase === 'sign') {
        throw error;
      }
    });
    const serviceSend = {
      batchSignAndSendTransaction: jest.fn(async () => 'sent'),
    };
    const onPreflightError = jest.fn();

    await expect(
      runTxConfirmBatchSignAndSendWithPreflight({
        beforeConfirm,
        onPreflightError,
        request: { accountId: 'account-1' },
        serviceSend,
      }),
    ).resolves.toEqual({ executed: false });

    expect(beforeConfirm).toHaveBeenCalledTimes(1);
    expect(beforeConfirm).toHaveBeenCalledWith('sign');
    expect(onPreflightError).toHaveBeenCalledWith(error);
    expect(serviceSend.batchSignAndSendTransaction).not.toHaveBeenCalled();
  });

  it('rechecks a lease that changed during async transaction preparation', async () => {
    let isCurrent = true;
    const beforeConfirm = jest.fn(async () => {
      if (!isCurrent) {
        throw new OneKeyLocalError('quote became stale during preparation');
      }
    });
    const serviceSend = {
      batchSignAndSendTransaction: jest.fn(async () => 'sent'),
    };
    const onPreflightError = jest.fn();

    await runTxConfirmPreflight(beforeConfirm, 'submit');
    isCurrent = false;

    await expect(
      runTxConfirmBatchSignAndSendWithPreflight({
        beforeConfirm,
        onPreflightError,
        request: { accountId: 'account-1' },
        serviceSend,
      }),
    ).resolves.toEqual({ executed: false });
    expect(beforeConfirm).toHaveBeenCalledTimes(2);
    expect(beforeConfirm.mock.calls).toEqual([['submit'], ['sign']]);
    expect(onPreflightError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'quote became stale during preparation',
      }),
    );
    expect(serviceSend.batchSignAndSendTransaction).not.toHaveBeenCalled();
  });

  it('does not start signing after the active attempt is cancelled during preflight', async () => {
    let isAttemptActive = true;
    let resolvePreflight: (() => void) | undefined;
    const beforeConfirm = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolvePreflight = resolve;
        }),
    );
    const signAndSend = jest.fn(async () => 'sent');
    const resultPromise = runTxConfirmSignAndSendWithPreflight({
      beforeConfirm,
      isAttemptActive: () => isAttemptActive,
      onPreflightError: jest.fn(),
      signAndSend,
    });

    await Promise.resolve();
    expect(beforeConfirm).toHaveBeenCalledWith('sign');
    isAttemptActive = false;
    resolvePreflight?.();

    await expect(resultPromise).resolves.toEqual({ executed: false });
    expect(signAndSend).not.toHaveBeenCalled();
  });

  it('keeps the common TxConfirm path unchanged without a preflight', async () => {
    const serviceSend = {
      batchSignAndSendTransaction: jest.fn(async () => 'sent'),
    };
    const onPreflightError = jest.fn();
    const resultPromise = runTxConfirmBatchSignAndSendWithPreflight({
      onPreflightError,
      request: { accountId: 'account-1' },
      serviceSend,
    });

    expect(serviceSend.batchSignAndSendTransaction).toHaveBeenCalledTimes(1);
    await expect(resultPromise).resolves.toEqual({
      executed: true,
      result: 'sent',
    });
    expect(onPreflightError).not.toHaveBeenCalled();
  });

  it('does not swallow ordinary sign-and-send failures', async () => {
    const error = new OneKeyLocalError('broadcast failed');
    const onPreflightError = jest.fn();
    const signAndSend = jest.fn(async () => Promise.reject(error));

    await expect(
      runTxConfirmSignAndSendWithPreflight({
        onPreflightError,
        signAndSend,
      }),
    ).rejects.toBe(error);
    expect(onPreflightError).not.toHaveBeenCalled();
  });
});
