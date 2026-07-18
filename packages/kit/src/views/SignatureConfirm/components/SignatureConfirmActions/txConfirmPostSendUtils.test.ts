import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import {
  runTxConfirmPostSendTask,
  syncBatchSendSuccessfullySentTxsFromError,
} from './txConfirmPostSendUtils';

describe('TxConfirm post-send irreversible boundary', () => {
  it('restores background batch checkpoints after cross-runtime error cloning', () => {
    const successfullySentTxs = ['tx-0'];

    syncBatchSendSuccessfullySentTxsFromError({
      error: {
        data: {
          batchSendSuccessfullySentTxs: ['tx-0', 'tx-1', '', 123, 'tx-1'],
        },
      },
      successfullySentTxs,
    });

    expect(successfullySentTxs).toEqual(['tx-0', 'tx-1']);
  });

  it('does not turn an after-send hook failure into a retryable send failure', async () => {
    const error = new OneKeyLocalError('after-send failed');
    const action = jest.fn().mockRejectedValue(error);
    const onError = jest.fn();

    await expect(
      runTxConfirmPostSendTask({
        hasBroadcastReceipt: true,
        action,
        onError,
      }),
    ).resolves.toBeUndefined();

    expect(action).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(error);
  });

  it('does not reopen a broadcast when after-send error logging also fails', async () => {
    const action = jest
      .fn()
      .mockRejectedValue(new OneKeyLocalError('after-send failed'));
    const onError = jest.fn(() => {
      throw new OneKeyLocalError('logging failed');
    });

    await expect(
      runTxConfirmPostSendTask({
        hasBroadcastReceipt: true,
        action,
        onError,
      }),
    ).resolves.toBeUndefined();

    expect(action).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('runs the after-send hook once on success', async () => {
    const action = jest.fn().mockResolvedValue(undefined);
    const onError = jest.fn();

    await runTxConfirmPostSendTask({
      hasBroadcastReceipt: true,
      action,
      onError,
    });

    expect(action).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it('continues to onSuccess when analytics and Toast throw after broadcast', async () => {
    const completed: string[] = [];
    const onError = jest.fn();
    const tasks = [
      async () => {
        completed.push('analytics');
        throw new OneKeyLocalError('analytics failed');
      },
      async () => {
        completed.push('toast');
        throw new OneKeyLocalError('toast failed');
      },
      async () => {
        completed.push('onSuccess');
      },
    ];

    for (const action of tasks) {
      await runTxConfirmPostSendTask({
        hasBroadcastReceipt: true,
        action,
        onError,
      });
    }

    expect(completed).toEqual(['analytics', 'toast', 'onSuccess']);
    expect(onError).toHaveBeenCalledTimes(2);
  });

  it('preserves post-sign failure semantics without a broadcast receipt', async () => {
    const error = new OneKeyLocalError('sign-only settlement failed');
    const action = jest.fn().mockRejectedValue(error);
    const onError = jest.fn();

    await expect(
      runTxConfirmPostSendTask({
        hasBroadcastReceipt: false,
        action,
        onError,
      }),
    ).rejects.toBe(error);

    expect(onError).not.toHaveBeenCalled();
  });
});
