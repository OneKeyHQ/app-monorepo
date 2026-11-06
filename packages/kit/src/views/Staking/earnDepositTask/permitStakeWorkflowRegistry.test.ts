import { createPermitStakeWorkflow } from './permitStakeWorkflow';
import {
  createPermitStakeWorkflowRegistry,
  getPermitStakeWorkflowKey,
} from './permitStakeWorkflowRegistry';

it('uses chain-aware address comparison for a reservation resource', () => {
  const identity = {
    networkId: 'evm--1',
    accountAddress: '0xAa',
    provider: 'Morpho',
    vault: '0xBb',
  };
  expect(getPermitStakeWorkflowKey(identity)).toBe(
    getPermitStakeWorkflowKey({
      ...identity,
      accountAddress: '0xaa',
      vault: '0xbb',
      provider: 'morpho',
    }),
  );
  expect(
    getPermitStakeWorkflowKey({ ...identity, networkId: 'sol--101' }),
  ).not.toBe(
    getPermitStakeWorkflowKey({
      ...identity,
      networkId: 'sol--101',
      accountAddress: '0xaa',
    }),
  );
});

it('exposes only a conflict to a different account and restricts owner operations', () => {
  const registry = createPermitStakeWorkflowRegistry();
  const workflow = createPermitStakeWorkflow({
    taskId: 'task',
    identity: {
      accountId: 'owner',
      networkId: 'evm--1',
      accountAddress: '0xowner',
      provider: 'morpho',
      action: 'stake',
      intent: {
        amount: '1',
        symbol: 'USDC',
        inputTokenAddress: '0xtoken',
        protocolVault: '0xvault',
        spenderAddress: '0xspender',
      },
    },
    sign: async () => 'signature',
    submit: async () => undefined,
    isCurrent: () => true,
    isResultCurrent: () => true,
    onSubmitted: jest.fn(),
    onAsyncError: jest.fn(),
  });
  const token = registry.reserve('chain-resource', 'owner', workflow);
  expect(token).toBeDefined();
  if (!token) return;
  expect(registry.find('chain-resource', 'other')).toEqual({
    kind: 'conflict',
  });
  expect(registry.reserve('chain-resource', 'other', workflow)).toBeUndefined();
  expect(registry.release('chain-resource', 'other', token)).toBe(false);
  expect(
    registry.acquireRecovery('chain-resource', 'other', token),
  ).toBeUndefined();
  const lease = registry.acquireRecovery('chain-resource', 'owner', token);
  expect(lease).toBeDefined();
  if (!lease) return;
  expect(
    registry.releaseRecovery('chain-resource', 'other', token, lease),
  ).toBe(false);
  expect(
    registry.releaseRecovery('chain-resource', 'owner', token, lease),
  ).toBe(true);
  expect(registry.release('chain-resource', 'owner', token)).toBe(true);
});
