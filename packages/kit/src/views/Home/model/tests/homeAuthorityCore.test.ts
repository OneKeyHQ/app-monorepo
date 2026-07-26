import type { IHomeRuntimeOwnerScope } from '@onekeyhq/shared/src/types/homeRuntime';

import { buildHomeOwnerScopeKey } from '../core/homeIdentity';
import {
  createInitialHomeLifecycleSessionState,
  transitionHomeSession,
} from '../lifecycle/homeSessionMachine';

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

  it('keeps a same owner and creates a fresh A -> B -> A session', () => {
    const initial = createInitialHomeLifecycleSessionState({
      appEpoch: 'epoch-a',
      clientInstanceId: 'client-a',
      mode: 'wallet',
      runtimeInstanceId: 'runtime-a',
    });
    const firstA = transitionHomeSession(initial, {
      type: 'ownerChanged',
      owner: owner('wallet-a'),
    }).state;
    const sameA = transitionHomeSession(firstA, {
      type: 'ownerChanged',
      owner: owner('wallet-a'),
    }).state;
    const ownerB = transitionHomeSession(sameA, {
      type: 'ownerChanged',
      owner: owner('wallet-b'),
    }).state;
    const secondA = transitionHomeSession(ownerB, {
      type: 'ownerChanged',
      owner: owner('wallet-a'),
    }).state;

    expect(sameA.ownerToken).toBe(firstA.ownerToken);
    expect(secondA.ownerToken?.scopeKey).toBe(firstA.ownerToken?.scopeKey);
    expect(secondA.ownerToken?.sessionId).not.toBe(
      firstA.ownerToken?.sessionId,
    );
  });
});
