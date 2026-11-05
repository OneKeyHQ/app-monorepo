import type { useSignatureConfirm } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { UserCancel } from '@onekeyhq/shared/src/errors/errors/hardwareErrors';

import { createDepositTaskController } from './controller';
import { createDepositTask } from './state';
import { waitForEarnTransactionConfirm } from './transactionConfirm';

type INavigate = ReturnType<
  typeof useSignatureConfirm
>['navigationToTxConfirm'];
type IParams = Parameters<INavigate>[0];

function captureNavigation() {
  let params: IParams | undefined;
  const navigate: INavigate = async (value) => {
    params = value;
  };
  return { navigate, getParams: () => params };
}

describe('Earn transaction confirmation', () => {
  it('waits for the confirmation callback, not the navigation promise', async () => {
    const { navigate, getParams } = captureNavigation();
    const submitted = jest.fn();
    const result = waitForEarnTransactionConfirm({
      navigationToTxConfirm: navigate,
      expiredMessage: 'expired',
      onSubmitted: submitted,
    });
    await Promise.resolve();
    expect(submitted).not.toHaveBeenCalled();
    await getParams()?.onBeforeSend?.();
    getParams()?.onSuccess?.([]);
    await expect(result).resolves.toEqual({ status: 'success', data: [] });
    expect(submitted).toHaveBeenCalledTimes(1);
    expect(submitted).toHaveBeenCalledWith([], { lateAfterSettlement: false });
  });

  it('keeps a task pending after a safe pre-send failure and accepts a retry', async () => {
    const { navigate, getParams } = captureNavigation();
    const submitted = jest.fn();
    const uncertain = jest.fn();
    const result = waitForEarnTransactionConfirm({
      navigationToTxConfirm: navigate,
      expiredMessage: 'expired',
      onSubmitted: submitted,
      onUncertainFailure: uncertain,
    });
    getParams()?.onSafePreSendFail?.(new Error('precheck unavailable'));
    await getParams()?.onBeforeSend?.();
    getParams()?.onSuccess?.([]);
    await expect(result).resolves.toEqual({ status: 'success', data: [] });
    expect(submitted).toHaveBeenCalledTimes(1);
    expect(uncertain).not.toHaveBeenCalled();
  });

  it('treats abort before send as cancellation and blocks the stale confirmation', async () => {
    const { navigate, getParams } = captureNavigation();
    const controller = new AbortController();
    const unknown = jest.fn();
    const result = waitForEarnTransactionConfirm({
      navigationToTxConfirm: navigate,
      expiredMessage: 'expired',
      signal: controller.signal,
      onUncertainFailure: unknown,
    });
    controller.abort();
    await expect(result).resolves.toEqual({ status: 'cancel' });
    expect(unknown).not.toHaveBeenCalled();
    expect(() => getParams()?.onBeforeSend?.()).toThrow('expired');
  });

  it('preserves a late submitted result after cancellation following send', async () => {
    const { navigate, getParams } = captureNavigation();
    const controller = new AbortController();
    const unknown = jest.fn();
    const submitted = jest.fn();
    const result = waitForEarnTransactionConfirm({
      navigationToTxConfirm: navigate,
      expiredMessage: 'expired',
      signal: controller.signal,
      onUncertainFailure: unknown,
      onSubmitted: submitted,
    });
    await getParams()?.onBeforeSend?.();
    controller.abort();
    await expect(result).resolves.toEqual({ status: 'cancel' });
    expect(unknown).toHaveBeenCalledTimes(1);
    getParams()?.onSuccess?.([]);
    getParams()?.onSuccess?.([]);
    expect(submitted).toHaveBeenCalledTimes(2);
  });

  it.each(['cancel', 'fail'] as const)(
    'marks success after %s following send-start as late',
    async (exit) => {
      const { navigate, getParams } = captureNavigation();
      const submitted = jest.fn();
      const result = waitForEarnTransactionConfirm({
        navigationToTxConfirm: navigate,
        expiredMessage: 'expired',
        onSubmitted: submitted,
      });
      const outcome = result.catch((error: unknown) => error);
      await getParams()?.onBeforeSend?.();
      if (exit === 'cancel') {
        getParams()?.onCancel?.();
        await expect(outcome).resolves.toEqual({ status: 'cancel' });
      } else {
        getParams()?.onFail?.(new OneKeyLocalError('send failed'));
        await expect(outcome).resolves.toEqual(
          expect.objectContaining({ message: 'send failed' }),
        );
      }
      expect(submitted).not.toHaveBeenCalled();
      getParams()?.onSuccess?.([]);
      expect(submitted).toHaveBeenCalledTimes(1);
      expect(submitted).toHaveBeenCalledWith([], { lateAfterSettlement: true });
    },
  );

  it('does not report a success arriving after cancellation before send-start', async () => {
    const { navigate, getParams } = captureNavigation();
    const submitted = jest.fn();
    const result = waitForEarnTransactionConfirm({
      navigationToTxConfirm: navigate,
      expiredMessage: 'expired',
      onSubmitted: submitted,
    });
    getParams()?.onCancel?.();
    await expect(result).resolves.toEqual({ status: 'cancel' });
    getParams()?.onSuccess?.([]);
    expect(submitted).not.toHaveBeenCalled();
  });

  it('blocks sending when scope becomes stale inside the send-start callback', async () => {
    const { navigate, getParams } = captureNavigation();
    const controller = new AbortController();
    const result = waitForEarnTransactionConfirm({
      navigationToTxConfirm: navigate,
      expiredMessage: 'expired',
      signal: controller.signal,
      onSendStarted: () => controller.abort(),
    });
    expect(() => getParams()?.onBeforeSend?.()).toThrow('expired');
    await expect(result).resolves.toEqual({ status: 'cancel' });
  });

  it('waits for the send guard and rechecks the scope before allowing a send', async () => {
    const { navigate, getParams } = captureNavigation();
    let resolveGuard: () => void = () => undefined;
    const guard = new Promise<void>((resolve) => {
      resolveGuard = resolve;
    });
    let current = true;
    const started = jest.fn();
    const result = waitForEarnTransactionConfirm({
      navigationToTxConfirm: navigate,
      expiredMessage: 'expired',
      isNavigationCurrent: () => current,
      beforeSendGuard: async () => guard,
      onSendStarted: started,
    });
    const beforeSend = getParams()?.onBeforeSend?.();
    expect(started).not.toHaveBeenCalled();
    current = false;
    resolveGuard();
    await expect(beforeSend).rejects.toThrow('expired');
    expect(started).not.toHaveBeenCalled();
    getParams()?.onCancel?.();
    await expect(result).resolves.toEqual({ status: 'cancel' });
  });

  it('blocks sending when permission changes while the async guard is pending', async () => {
    const { navigate, getParams } = captureNavigation();
    let finishGuard: () => void = () => undefined;
    const pendingGuard = new Promise<void>((resolve) => {
      finishGuard = resolve;
    });
    let allowed = true;
    const started = jest.fn();
    const canSendNow = jest.fn(() => allowed);
    const result = waitForEarnTransactionConfirm({
      navigationToTxConfirm: navigate,
      expiredMessage: 'expired',
      beforeSendGuard: async () => pendingGuard,
      canSendNow,
      onSendStarted: started,
    });
    const beforeSend = getParams()?.onBeforeSend?.();
    expect(canSendNow).not.toHaveBeenCalled();
    allowed = false;
    finishGuard();
    await expect(beforeSend).rejects.toThrow('expired');
    expect(canSendNow).toHaveBeenCalledTimes(1);
    expect(started).not.toHaveBeenCalled();
    getParams()?.onCancel?.();
    await expect(result).resolves.toEqual({ status: 'cancel' });
  });

  it('does not enter the send phase when the synchronous check rejects', async () => {
    const { navigate, getParams } = captureNavigation();
    const started = jest.fn();
    const result = waitForEarnTransactionConfirm({
      navigationToTxConfirm: navigate,
      expiredMessage: 'expired',
      canSendNow: () => false,
      onSendStarted: started,
    });
    expect(() => getParams()?.onBeforeSend?.()).toThrow('expired');
    expect(started).not.toHaveBeenCalled();
    getParams()?.onCancel?.();
    await expect(result).resolves.toEqual({ status: 'cancel' });
  });

  it('enters the send phase and reports submission when the check allows it', async () => {
    const { navigate, getParams } = captureNavigation();
    const started = jest.fn();
    const submitted = jest.fn();
    const result = waitForEarnTransactionConfirm({
      navigationToTxConfirm: navigate,
      expiredMessage: 'expired',
      beforeSendGuard: async () => undefined,
      canSendNow: () => true,
      onSendStarted: started,
      onSubmitted: submitted,
    });
    await getParams()?.onBeforeSend?.();
    expect(started).toHaveBeenCalledTimes(1);
    getParams()?.onSuccess?.([]);
    await expect(result).resolves.toEqual({ status: 'success', data: [] });
    expect(submitted).toHaveBeenCalledTimes(1);
  });

  it.each(['guard', 'abort', 'callback throws'] as const)(
    'keeps a transaction retryable when %s blocks before sending',
    async (block) => {
      let allowed = true;
      const actualSend = jest.fn();
      const navigate: INavigate = async (params) => {
        try {
          await params.onBeforeSend?.();
          actualSend();
        } catch (error) {
          params.onFail?.(
            error instanceof Error ? error : new OneKeyLocalError('expired'),
          );
        }
      };
      const controller = createDepositTaskController({
        task: createDepositTask({
          taskId: 'task',
          identity: {
            accountId: 'account',
            accountAddress: 'owner',
            networkId: 'network',
            provider: 'provider',
            vault: 'vault',
            inputTokenAddress: 'token',
            depositTokenAddress: 'token',
            amount: '1',
            spenderAddress: 'spender',
          },
          steps: [{ id: 'deposit', kind: 'deposit' }],
        }),
        isCurrent: () => true,
        onChange: () => undefined,
        adapter: {
          prepare: async () => ({ type: 'confirm', prepared: undefined }),
          confirm: async ({ onBeforeSend, onSendBlocked, signal }) => {
            await waitForEarnTransactionConfirm({
              navigationToTxConfirm: navigate,
              expiredMessage: 'expired',
              canSendNow: () => allowed,
              onSendBlocked,
              signal,
              onSendStarted: () => {
                onBeforeSend();
                if (block === 'guard') allowed = false;
                if (block === 'abort') controller.cancel();
                if (block === 'callback throws')
                  throw new OneKeyLocalError('start callback failed');
              },
            });
            return { type: 'submitted' };
          },
          waitForFinalStatus: async () => 'unknown',
          verify: async () => false,
        },
      });
      await controller.run();
      expect(actualSend).not.toHaveBeenCalled();
      expect(controller.getTask().steps[0].status).toEqual({
        type: 'failed',
        stage: 'beforeSend',
      });
    },
  );

  it('does not treat a second send attempt as unsent after the first was allowed', async () => {
    const { navigate, getParams } = captureNavigation();
    const blocked = jest.fn();
    const controller = new AbortController();
    const result = waitForEarnTransactionConfirm({
      navigationToTxConfirm: navigate,
      expiredMessage: 'expired',
      signal: controller.signal,
      onSendBlocked: blocked,
    });
    await getParams()?.onBeforeSend?.();
    expect(() => getParams()?.onBeforeSend?.()).toThrow('expired');
    expect(blocked).not.toHaveBeenCalled();
    controller.abort();
    await expect(result).resolves.toEqual({ status: 'cancel' });
  });

  it('does not treat a concurrently prepared second send as unsent', async () => {
    const { navigate, getParams } = captureNavigation();
    let releaseGuard: () => void = () => undefined;
    const guard = new Promise<void>((resolve) => {
      releaseGuard = resolve;
    });
    const blocked = jest.fn();
    const controller = new AbortController();
    const result = waitForEarnTransactionConfirm({
      navigationToTxConfirm: navigate,
      expiredMessage: 'expired',
      signal: controller.signal,
      beforeSendGuard: () => guard,
      onSendBlocked: blocked,
    });
    const first = getParams()?.onBeforeSend?.();
    const second = getParams()?.onBeforeSend?.();
    releaseGuard();
    await expect(first).resolves.toBeUndefined();
    await expect(second).rejects.toThrow('expired');
    expect(blocked).not.toHaveBeenCalled();
    controller.abort();
    await expect(result).resolves.toEqual({ status: 'cancel' });
  });

  it('rejects a reentrant send check without marking the active attempt unsent', async () => {
    const { navigate, getParams } = captureNavigation();
    const blocked = jest.fn();
    const controller = new AbortController();
    const result = waitForEarnTransactionConfirm({
      navigationToTxConfirm: navigate,
      expiredMessage: 'expired',
      signal: controller.signal,
      onSendBlocked: blocked,
      onSendStarted: () => {
        expect(() => getParams()?.onBeforeSend?.()).toThrow('expired');
      },
    });
    await getParams()?.onBeforeSend?.();
    expect(blocked).not.toHaveBeenCalled();
    controller.abort();
    await expect(result).resolves.toEqual({ status: 'cancel' });
  });

  it('settles success even if the submission observer throws', async () => {
    const { navigate, getParams } = captureNavigation();
    const result = waitForEarnTransactionConfirm({
      navigationToTxConfirm: navigate,
      expiredMessage: 'expired',
      onSubmitted: () => {
        throw new OneKeyLocalError('observer failed');
      },
    });
    expect(() => getParams()?.onSuccess?.([])).toThrow('observer failed');
    await expect(result).resolves.toEqual({ status: 'success', data: [] });
  });

  it('settles the original failure even if the uncertainty observer throws', async () => {
    const { navigate, getParams } = captureNavigation();
    const result = waitForEarnTransactionConfirm({
      navigationToTxConfirm: navigate,
      expiredMessage: 'expired',
      onUncertainFailure: () => {
        throw new OneKeyLocalError('observer failed');
      },
    });
    expect(() =>
      getParams()?.onFail?.(new OneKeyLocalError('original failure')),
    ).toThrow('observer failed');
    await expect(result).rejects.toThrow('original failure');
  });

  it('reports failure after send as uncertain and settles once', async () => {
    const { navigate, getParams } = captureNavigation();
    const unknown = jest.fn();
    const result = waitForEarnTransactionConfirm({
      navigationToTxConfirm: navigate,
      expiredMessage: 'expired',
      onUncertainFailure: unknown,
    });
    await getParams()?.onBeforeSend?.();
    getParams()?.onFail?.(new Error('send failed'));
    getParams()?.onCancel?.();
    await expect(result).rejects.toThrow('send failed');
    expect(unknown).toHaveBeenCalledTimes(1);
  });

  it('marks an explicit device rejection retryable before broadcasting', async () => {
    const { navigate, getParams } = captureNavigation();
    const blocked = jest.fn();
    const uncertain = jest.fn();
    const result = waitForEarnTransactionConfirm({
      navigationToTxConfirm: navigate,
      expiredMessage: 'expired',
      allowDeviceRejectionRetry: true,
      onSendBlocked: blocked,
      onUncertainFailure: uncertain,
    });
    const outcome = result.catch((error: unknown) => error);
    await getParams()?.onBeforeSend?.();
    getParams()?.onFail?.(new UserCancel());
    getParams()?.onCancel?.();
    expect(await outcome).toBeInstanceOf(UserCancel);
    expect(blocked).toHaveBeenCalledTimes(1);
    expect(uncertain).not.toHaveBeenCalled();
  });

  it('keeps a device rejection uncertain without a verified transaction policy', async () => {
    const { navigate, getParams } = captureNavigation();
    const blocked = jest.fn();
    const uncertain = jest.fn();
    const result = waitForEarnTransactionConfirm({
      navigationToTxConfirm: navigate,
      expiredMessage: 'expired',
      onSendBlocked: blocked,
      onUncertainFailure: uncertain,
    });
    const outcome = result.catch((error: unknown) => error);
    await getParams()?.onBeforeSend?.();
    getParams()?.onFail?.(new UserCancel());
    expect(await outcome).toBeInstanceOf(UserCancel);
    expect(blocked).not.toHaveBeenCalled();
    expect(uncertain).toHaveBeenCalledTimes(1);
  });
});
