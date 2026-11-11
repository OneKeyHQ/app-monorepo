import { createEtherFiLegacyRevokeTask } from './etherFiLegacyRevokeTask';

it('retains the revoke identity and only retries a known pre-broadcast rejection', async () => {
  const task = createEtherFiLegacyRevokeTask({
    accountId: 'account',
    accountAddress: '0xowner',
    networkId: 'evm--1',
    vault: 'vault',
    tokenAddress: 'token',
    spenderAddress: 'spender',
  });
  expect(task.getTask().identity).toMatchObject({
    accountId: 'account',
    accountAddress: '0xowner',
    action: 'revokeLegacyApproval',
    intent: { tokenAddress: 'token', spenderAddress: 'spender', amount: '0' },
  });
  await task.run({
    prepare: async () => ({ type: 'confirm', prepared: undefined }),
    navigate: async () => undefined,
  });
  task.beginSend();
  const firstAttempt = task.getTask().steps[0].attemptId;
  task.fail(true);
  expect(task.getTask().steps[0].status).toEqual({
    type: 'failed',
    stage: 'beforeSend',
  });
  task.beginSend();
  expect(task.getTask().steps[0].attemptId).not.toBe(firstAttempt);
  task.fail(false);
  expect(task.getTask().steps[0].status.type).toBe('unknown');
  task.beginSend();
  expect(task.getTask().steps[0].status.type).toBe('unknown');
  expect(task.submit('0xaccepted')).toBe(true);
  expect(task.getTask().steps[0].status).toMatchObject({
    type: 'unknown',
    txid: '0xaccepted',
  });
});

it('retains a broadcast reported after confirmation was cancelled', async () => {
  const task = createEtherFiLegacyRevokeTask({
    accountId: 'account',
    networkId: 'evm--1',
    tokenAddress: 'token',
    spenderAddress: 'spender',
  });
  await task.run({
    prepare: async () => ({ type: 'confirm', prepared: undefined }),
    navigate: async () => undefined,
  });
  task.cancel();
  expect(task.submit('0xaccepted')).toBe(true);
  expect(task.getTask().steps[0].status).toMatchObject({
    type: 'unknown',
    txid: '0xaccepted',
  });
});
