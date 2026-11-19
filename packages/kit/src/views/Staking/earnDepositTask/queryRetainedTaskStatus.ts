import BigNumber from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { createDepositTaskController } from './controller';
import { isTaskAccountCurrent } from './taskAccount';
import { waitForDepositTaskTxStatus } from './waitForDepositTaskTxStatus';

import type { IDepositTaskState } from './state';

export async function queryRetainedTaskStatus({
  state,
  isCurrent,
  signal,
}: {
  state: IDepositTaskState;
  isCurrent: () => boolean;
  signal: AbortSignal;
}) {
  const task = state.getTask();
  const current = () => !signal.aborted && isCurrent();
  const checkAccount = async () => {
    if (
      !current() ||
      !(await isTaskAccountCurrent(task.identity)) ||
      !current()
    ) {
      throw new OneKeyLocalError('Task account changed');
    }
  };
  await checkAccount();
  let failure: unknown;
  const controller = createDepositTaskController({
    task,
    taskState: state,
    isCurrent: current,
    onChange: () => undefined,
    onError: (error) => {
      failure = error;
    },
    adapter: {
      prepare: async () => ({ type: 'cancelled' }),
      confirm: async () => ({ type: 'cancelled' }),
      waitForFinalStatus: async ({ txid, signal: taskSignal }) => {
        await checkAccount();
        const status = await waitForDepositTaskTxStatus({
          identity: task.identity,
          txid,
          signal: taskSignal,
        });
        await checkAccount();
        return status;
      },
      verify: async ({ step }) => {
        await checkAccount();
        if (step.kind === 'wrap') return true;
        if (step.kind !== 'approve' && step.kind !== 'resetApproval')
          return false;
        const response =
          await backgroundApiProxy.serviceStaking.fetchTokenAllowance({
            accountId: task.identity.accountId,
            networkId: task.identity.networkId,
            expectedAccountAddress: task.identity.accountAddress,
            tokenAddress: task.identity.depositTokenAddress,
            spenderAddress: task.identity.spenderAddress,
          });
        await checkAccount();
        const allowance = new BigNumber(response.allowanceParsed);
        if (!allowance.isFinite() || allowance.isNegative()) {
          throw new OneKeyLocalError('Invalid token allowance');
        }
        return step.kind === 'resetApproval'
          ? allowance.isZero()
          : allowance.gte(task.identity.amount);
      },
    },
  });
  const abort = () => controller.cancel();
  signal.addEventListener('abort', abort, { once: true });
  try {
    await controller.retryStatus();
    if (failure && current()) {
      throw failure instanceof Error
        ? failure
        : new OneKeyLocalError(String(failure));
    }
  } finally {
    signal.removeEventListener('abort', abort);
    controller.cancel();
  }
}
