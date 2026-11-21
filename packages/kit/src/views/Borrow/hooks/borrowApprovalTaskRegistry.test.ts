import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { createEarnWorkflowTask } from '../../Earn/tasks/earnWorkflowTaskState';

import { createBorrowApprovalTaskRegistry } from './borrowApprovalTaskRegistry';

it('reserves one live task per account, chain, address and approval target', () => {
  const registry = createBorrowApprovalTaskRegistry();
  const scope = {
    accountId: 'account',
    networkId: 'evm--1',
    accountAddress: '0xAB',
    kind: 'token' as const,
    target: '0xCD',
    asset: '0xEF',
  };
  const task = createEarnWorkflowTask({
    taskId: 'task',
    identity: {
      accountId: scope.accountId,
      networkId: scope.networkId,
      provider: 'aave',
    },
    steps: [{ id: 'approve', kind: 'approve', lateSubmitted: 'unknown' }],
  });
  const controller = { getTask: () => task, recordRecovery: () => true };
  const token = registry.reserve(scope, controller);
  expect(token).toBeDefined();
  expect(
    registry.reserve(
      { ...scope, accountAddress: '0xab', target: '0xcd', asset: '0xef' },
      controller,
    ),
  ).toBeUndefined();
  const ownerEntry = registry.find(scope);
  expect(ownerEntry?.type).toBe('owned');
  if (ownerEntry?.type !== 'owned')
    throw new OneKeyLocalError('missing owner entry');
  expect(ownerEntry.controller).toBe(controller);
  const alias = {
    ...scope,
    accountId: 'other-account',
    accountAddress: '0xab',
  };
  expect(registry.find(alias)).toEqual({ type: 'conflict' });
  expect(registry.reserve(alias, controller)).toBeUndefined();
  if (!token) throw new OneKeyLocalError('missing reservation');
  expect(registry.release(alias, token)).toBe(false);
  expect(registry.acquireRecovery(alias, token)).toBeUndefined();
  expect(
    registry.reserve({ ...scope, accountAddress: '0x99' }, controller),
  ).toBeDefined();
  expect(
    registry.reserve({ ...scope, target: '0x12' }, controller),
  ).toBeDefined();
  expect(
    registry.reserve({ ...scope, networkId: 'evm--2' }, controller),
  ).toBeDefined();
  expect(registry.release(scope, Symbol('wrong'))).toBe(false);
  const lease = registry.acquireRecovery(scope, token);
  expect(lease).toBeDefined();
  expect(registry.acquireRecovery(scope, token)).toBeUndefined();
  if (!lease) throw new OneKeyLocalError('missing recovery lease');
  expect(registry.releaseRecovery(alias, token, lease)).toBe(false);
  expect(registry.releaseRecovery(scope, token, Symbol('wrong'))).toBe(false);
  expect(registry.releaseRecovery(scope, token, lease)).toBe(true);
  expect(registry.acquireRecovery(scope, token)).toBeDefined();
  expect(registry.release(scope, token)).toBe(true);
  expect(registry.find(scope)).toBeUndefined();
});

it('keeps case-sensitive chain addresses distinct', () => {
  const registry = createBorrowApprovalTaskRegistry();
  const scope = {
    accountId: 'account',
    networkId: 'sol--101',
    accountAddress: 'AbC',
    kind: 'delegation' as const,
    target: 'Market',
    asset: 'Asset',
  };
  const task = createEarnWorkflowTask({
    taskId: 'task',
    identity: {
      accountId: scope.accountId,
      networkId: scope.networkId,
      provider: 'kamino',
    },
    steps: [{ id: 'approve', kind: 'approve', lateSubmitted: 'unknown' }],
  });
  const controller = { getTask: () => task, recordRecovery: () => true };
  expect(registry.reserve(scope, controller)).toBeDefined();
  expect(
    registry.reserve({ ...scope, accountAddress: 'abc' }, controller),
  ).toBeDefined();
});
