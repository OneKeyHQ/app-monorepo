import { getWrappedTaskInterruption } from './interruption';
import { createDepositTask } from './state';

import type { IDepositTaskStepStatus } from './state';

const task = createDepositTask({
  taskId: 'task',
  identity: {
    accountId: 'account',
    accountAddress: 'owner',
    networkId: 'network',
    provider: 'provider',
    vault: 'vault',
    inputTokenAddress: 'input',
    depositTokenAddress: 'deposit',
    amount: '1',
    spenderAddress: 'spender',
  },
  steps: [
    { id: 'wrap', kind: 'wrap' },
    { id: 'approve', kind: 'approve' },
    { id: 'deposit', kind: 'deposit' },
  ],
});

it.each<[IDepositTaskStepStatus, 'submitted' | 'unknown' | undefined]>([
  [{ type: 'ready' }, undefined],
  [{ type: 'cancelled' }, undefined],
  [{ type: 'failed', stage: 'beforeSend' }, undefined],
  [{ type: 'failed', stage: 'onChain', txid: 'tx' }, undefined],
  [{ type: 'sending' }, 'unknown'],
  [{ type: 'confirming', txid: 'tx' }, 'unknown'],
  [{ type: 'verifying', txid: 'tx' }, 'unknown'],
  [{ type: 'unknown', chainConfirmed: false }, 'unknown'],
  [{ type: 'succeeded', txid: 'tx' }, 'submitted'],
])(
  'derives interruption feedback from the wrap step: %s',
  (status, expected) => {
    expect(
      getWrappedTaskInterruption({
        ...task,
        steps: [{ ...task.steps[0], status }, ...task.steps.slice(1)],
      }),
    ).toBe(expected);
  },
);

it('does not report a wrap when there is no active task', () => {
  expect(getWrappedTaskInterruption(undefined)).toBeUndefined();
});

it('does not suggest wrapped funds remain after the deposit was submitted', () => {
  expect(
    getWrappedTaskInterruption({
      ...task,
      steps: [
        { ...task.steps[0], status: { type: 'succeeded', txid: 'wrap-tx' } },
        task.steps[1],
        { ...task.steps[2], status: { type: 'handedOff', txid: 'deposit-tx' } },
      ],
    }),
  ).toBeUndefined();
});
