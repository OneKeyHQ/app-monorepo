import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { createEarnWorkflowTaskController } from './earnWorkflowTaskController';
import { createEarnWorkflowTask } from './earnWorkflowTaskState';

it.each([false, true])(
  'only explicitly retries a failed read-only wait in retained mode=%s',
  async (retained) => {
    const failure = new OneKeyLocalError('read failed');
    const read = jest
      .fn()
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce({ type: 'completed', context: {} });
    const task = createEarnWorkflowTask({
      taskId: 'task',
      identity: {
        accountId: 'account',
        networkId: 'network',
        provider: 'provider',
      },
      steps: [{ id: 'wait', kind: 'wait' }],
    });
    const controller = createEarnWorkflowTaskController({
      task,
      initialContext: {},
      retained,
      isCurrent: () => true,
      expiredMessage: 'expired',
      onAsyncError: jest.fn(),
      getAdapter: () => ({ kind: 'wait', run: read }),
    });
    const owner = retained ? controller.attachOwner(() => true) : undefined;
    await expect(controller.run(owner)).rejects.toBe(failure);
    const failed = controller.getTask().steps[0];
    expect(failed.status.type).toBe('failed');
    if (owner) {
      await expect(controller.tryRetryWait(owner)).resolves.toBe('started');
      expect(controller.getTask().steps[0].status.type).toBe('completed');
      expect(controller.getTask().steps[0].attemptId).not.toBe(
        failed.attemptId,
      );
      expect(read).toHaveBeenCalledTimes(2);
    } else {
      await controller.retryWait();
      expect(controller.getTask().steps[0]).toBe(failed);
      expect(read).toHaveBeenCalledTimes(1);
    }
  },
);
