import { PendleRouterContract } from '@onekeyhq/shared/src/consts/addresses';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { createDepositTaskRegistry } from './registry';
import { createDepositTask, createDepositTaskState } from './state';

import type { IDepositTaskIdentity } from './state';

function makeState(
  taskId: string,
  overrides: Partial<IDepositTaskIdentity> = {},
) {
  return createDepositTaskState(
    createDepositTask({
      taskId,
      identity: {
        accountId: 'account',
        accountAddress: '0xOwner',
        networkId: 'evm--1',
        provider: 'pendle',
        vault: '0xVault1',
        inputTokenAddress: '0xToken',
        depositTokenAddress: '0xToken',
        amount: '1',
        spenderAddress: PendleRouterContract,
        ...overrides,
      },
      steps: [
        { id: 'approve', kind: 'approve' },
        { id: 'deposit', kind: 'deposit' },
      ],
    }),
  );
}

function makeDepositOnlyState(
  taskId: string,
  overrides: Partial<IDepositTaskIdentity> = {},
) {
  const { identity } = makeState(taskId, overrides).getTask();
  return createDepositTaskState(
    createDepositTask({
      taskId,
      identity,
      steps: [{ id: 'deposit', kind: 'deposit' }],
    }),
  );
}

it.each(['pendle', 'other'])(
  'blocks two vaults from concurrently approving the same allowance resource for %s',
  (provider) => {
    const registry = createDepositTaskRegistry();
    expect(registry.reserve('first', makeState('first'))).toBeDefined();
    expect(
      registry.reserve(
        'second',
        makeState('second', {
          accountId: 'alias',
          accountAddress: '0xowner',
          provider,
          vault: '0xVault2',
          depositTokenAddress: '0xtoken',
          spenderAddress: PendleRouterContract.toUpperCase(),
        }),
      ),
    ).toBeUndefined();
  },
);

it('allows the same allowance resource after a cancelled task is released', () => {
  const registry = createDepositTaskRegistry();
  const first = makeState('first');
  const token = registry.reserve('first', first);
  if (!token) throw new OneKeyLocalError('Missing reservation');
  first.dispatch({
    taskId: 'first',
    stepId: 'approve',
    attemptId: 'attempt',
    type: 'start',
  });
  first.dispatch({
    taskId: 'first',
    stepId: 'approve',
    attemptId: 'attempt',
    type: 'cancel',
  });
  expect(first.getTask().steps[0].status.type).toBe('cancelled');
  expect(registry.release('first', token)).toBe(true);
  expect(
    registry.reserve('second', makeState('second', { vault: '0xVault2' })),
  ).toBeDefined();
});

it.each([
  ['token', { depositTokenAddress: '0xOtherToken' }],
  ['spender', { spenderAddress: '0xOtherSpender' }],
  ['network', { networkId: 'evm--10' }],
  ['owner', { accountId: 'other', accountAddress: '0xOther' }],
] as const)(
  'does not block another vault with a different %s',
  (_label, different) => {
    const registry = createDepositTaskRegistry();
    expect(registry.reserve('first', makeState('first'))).toBeDefined();
    expect(
      registry.reserve(
        'second',
        makeState('second', {
          provider: 'other',
          vault: '0xVault2',
          ...different,
        }),
      ),
    ).toBeDefined();
  },
);

it.each([true, false])(
  'does not block when only one task can approve: firstCanApprove=%s',
  (firstCanApprove) => {
    const registry = createDepositTaskRegistry();
    const first = firstCanApprove
      ? makeState('first')
      : makeDepositOnlyState('first');
    const second = firstCanApprove
      ? makeDepositOnlyState('second', { vault: '0xVault2' })
      : makeState('second', { vault: '0xVault2' });
    expect(registry.reserve('first', first)).toBeDefined();
    expect(registry.reserve('second', second)).toBeDefined();
  },
);
