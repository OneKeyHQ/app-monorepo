import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { createDepositTaskRegistry } from './registry';
import { createDepositTask, createDepositTaskState } from './state';

import type { IDepositTaskIdentity } from './state';

function makeState(
  id: string,
  identity: Partial<IDepositTaskIdentity> = {},
  wrap = false,
) {
  return createDepositTaskState(
    createDepositTask({
      taskId: id,
      identity: {
        accountId: 'account-a',
        accountAddress: '0xAbC',
        networkId: 'evm--1',
        provider: 'etherfi',
        vault: '0xVaUlT',
        inputTokenAddress: '',
        depositTokenAddress: '0xWeth',
        amount: '1',
        spenderAddress: '0xSpender',
        ...identity,
      },
      steps: [
        ...(wrap ? [{ id: 'wrap', kind: 'wrap' as const }] : []),
        { id: 'deposit', kind: 'deposit' },
      ],
    }),
  );
}

describe('deposit task registry', () => {
  it('reserves atomically across account aliases and keeps the same state', () => {
    const registry = createDepositTaskRegistry();
    const first = makeState('first');
    const token = registry.reserve('first-owner', first);
    expect(token).toBeDefined();
    expect(registry.reserve('first-owner', first)).toBe(token);
    expect(registry.find('first-owner')?.state).toBe(first);
    expect(
      registry.reserve(
        'alias',
        makeState('second', {
          accountId: 'account-alias',
          accountAddress: '0xabc',
          provider: 'ETHERFI',
          vault: '0xvault',
        }),
      ),
    ).toBeUndefined();
  });

  it('blocks concurrent wraps for one account even across vaults', () => {
    const registry = createDepositTaskRegistry();
    registry.reserve('first', makeState('first', {}, true));
    expect(
      registry.reserve(
        'other',
        makeState('other', { provider: 'other', vault: '0xother' }, true),
      ),
    ).toBeUndefined();
    expect(
      registry.reserve(
        'unrelated',
        makeState('unrelated', { provider: 'other', vault: '0xother' }),
      ),
    ).toBeDefined();
  });

  it('does not fold non-EVM account addresses and requires the reservation token to release', () => {
    const registry = createDepositTaskRegistry();
    const token = registry.reserve(
      'first',
      makeState('first', { networkId: 'sol--101', accountAddress: 'AbC' }),
    );
    if (!token) throw new OneKeyLocalError('Expected a reservation');
    expect(
      registry.reserve(
        'second',
        makeState('second', {
          accountId: 'account-b',
          networkId: 'sol--101',
          accountAddress: 'abc',
        }),
      ),
    ).toBeDefined();
    expect(registry.release('first', Symbol('stale'))).toBe(false);
    expect(registry.find('first')).toBeDefined();
    expect(registry.release('first', token)).toBe(true);
  });
});
