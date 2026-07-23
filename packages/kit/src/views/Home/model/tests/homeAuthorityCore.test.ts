import type { IHomeRuntimeOwnerScope } from '@onekeyhq/shared/src/types/homeRuntime';

import { buildHomeOwnerScopeKey } from '../core/homeIdentity';
import { HomeSessionCoordinator } from '../lifecycle/homeSessionCoordinator';
import { SingleRuntimeHomeAdapter } from '../runtime/singleRuntimeHomeAdapter';

const owner = (
  walletId: string,
  accountId = 'account-1',
): IHomeRuntimeOwnerScope => ({
  walletId,
  accountId,
  network: { kind: 'singleNetwork', networkId: 'evm-1' },
});

describe('Home authority core', () => {
  it('uses collision-safe canonical owner keys', () => {
    expect(buildHomeOwnerScopeKey(owner('ab', 'c'))).not.toBe(
      buildHomeOwnerScopeKey(owner('a', 'bc')),
    );
    expect(buildHomeOwnerScopeKey(owner('a|b', 'c'))).not.toBe(
      buildHomeOwnerScopeKey(owner('a', 'b|c')),
    );
  });

  it('keeps one session for a same-scope rerender and creates a fresh A -> B -> A session', () => {
    const ids = ['session-a1', 'session-b', 'session-a2'];
    const coordinator = new HomeSessionCoordinator({
      adapter: new SingleRuntimeHomeAdapter({
        clientInstanceId: 'client-1',
        producerInstanceId: 'producer-1',
      }),
      createSessionId: () => ids.shift() ?? 'unexpected-session',
    });
    const firstA = coordinator.setOwner(owner('wallet-a'));
    expect(coordinator.setOwner(owner('wallet-a'))).toBe(firstA);
    coordinator.setOwner(owner('wallet-b'));
    const secondA = coordinator.setOwner(owner('wallet-a'));
    expect(secondA?.ownerToken.sessionId).toBe('session-a2');
    expect(secondA).not.toBe(firstA);
  });

  it('creates a fresh same-owner session after a producer runtime restart', () => {
    const ids = ['session-before-restart', 'session-after-restart'];
    const coordinator = new HomeSessionCoordinator({
      adapter: new SingleRuntimeHomeAdapter({
        clientInstanceId: 'client-1',
        producerInstanceId: 'producer-1',
      }),
      createSessionId: () => ids.shift() ?? 'unexpected-session',
    });
    const before = coordinator.setOwner(owner('wallet-a'));
    const after = coordinator.restartCurrent();

    expect(before?.getSnapshot().status).toBe('stopped');
    expect(after?.ownerToken.scopeKey).toBe(before?.ownerToken.scopeKey);
    expect(after?.ownerToken.sessionId).toBe('session-after-restart');
  });
});
