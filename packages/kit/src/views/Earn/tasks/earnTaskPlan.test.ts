import {
  type IDepositTaskIdentity,
  type IDepositTaskStep,
  createDepositTask,
} from '../../Staking/earnDepositTask/state';

import {
  type IEarnTask,
  type IEarnTaskIdentity,
  type IEarnTaskStep,
  getEarnTaskStepIdentityError,
} from './earnTaskPlan';

const scope = {
  accountId: 'account-1',
  accountAddress: '0x1111111111111111111111111111111111111111',
  networkId: 'evm--1',
  provider: 'EtherFi',
};

describe('Earn task contract', () => {
  it('accepts the existing deposit task directly without copying its identity or changing its shape', () => {
    const identity: IDepositTaskIdentity = {
      ...scope,
      vault: 'vault',
      inputTokenAddress: '',
      depositTokenAddress: 'weth',
      amount: '1',
      spenderAddress: 'router',
    };
    const depositTask = createDepositTask({
      taskId: 'task-1',
      identity,
      steps: [
        { id: 'wrap', kind: 'wrap' },
        { id: 'approve', kind: 'approve' },
        { id: 'deposit', kind: 'deposit' },
      ],
    });
    const sharedTask: IEarnTask<IDepositTaskIdentity, IDepositTaskStep> =
      depositTask;
    expect(sharedTask).toBe(depositTask);
    expect(sharedTask.identity).toBe(depositTask.identity);
    expect(sharedTask.steps.map((step) => step.kind)).toEqual([
      'wrap',
      'approve',
      'deposit',
    ]);
    expect(getEarnTaskStepIdentityError(sharedTask.steps)).toBeUndefined();
  });

  it('represents a native Pendle buy as a single protocol step', () => {
    type IPendleIntent = Readonly<{
      amount: string;
      inputTokenAddress: string;
      outputTokenAddress: string;
      vault: string;
      slippage: number;
    }>;
    type IStatus = { type: 'ready' } | { type: 'waiting' };
    const task: IEarnTask<
      IEarnTaskIdentity<'buy', IPendleIntent>,
      IEarnTaskStep<'protocol', IStatus>
    > = {
      taskId: 'task-2',
      identity: {
        ...scope,
        networkId: 'evm--8453',
        provider: 'Pendle',
        action: 'buy',
        intent: {
          amount: '0',
          inputTokenAddress: '',
          outputTokenAddress: 'pt',
          vault: 'pendle-market',
          slippage: 0.5,
        },
      },
      steps: [{ id: 'buy', kind: 'protocol', status: { type: 'ready' } }],
      currentStepIndex: 0,
    };
    expect(task.identity.intent.amount).toBe('0');
    expect(task.steps.map((step) => step.kind)).toEqual(['protocol']);
    expect(getEarnTaskStepIdentityError(task.steps)).toBeUndefined();
  });

  it('reports missing and exactly duplicated step IDs without changing caller semantics', () => {
    expect(getEarnTaskStepIdentityError([])).toBe('empty');
    expect(getEarnTaskStepIdentityError([{ id: '' }])).toBe('empty');
    expect(getEarnTaskStepIdentityError([{ id: 'a' }, { id: 'a' }])).toBe(
      'duplicate',
    );
    expect(
      getEarnTaskStepIdentityError([{ id: ' ' }, { id: 'a' }]),
    ).toBeUndefined();
    expect(getEarnTaskStepIdentityError([{ id: '' }, { id: '' }])).toBe(
      'empty',
    );
  });
});
