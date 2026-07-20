import type { IHomeRuntimeOwnerScope } from '@onekeyhq/shared/src/types/homeRuntime';

import {
  buildHomeOwnerScopeKey,
  createHomeSourceKey,
} from '../core/homeIdentity';
import { HomeSessionCoordinator } from '../lifecycle/homeSessionCoordinator';
import { HomeStaleTrace } from '../lifecycle/homeStaleTrace';
import { createHomeRuntimeEnvelope } from '../runtime/homeRuntimeAdapter';
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

  it('rejects an older same-source completion after request 2 starts', async () => {
    const adapter = new SingleRuntimeHomeAdapter({
      clientInstanceId: 'client-1',
      producerInstanceId: 'producer-1',
    });
    const coordinator = new HomeSessionCoordinator({
      adapter,
      createSessionId: () => 'session-1',
    });
    const session = coordinator.setOwner(owner('wallet-a'));
    await coordinator.connectCurrent();
    expect(session).toBeDefined();
    const sourceKey = createHomeSourceKey({
      ownerToken: session!.ownerToken,
      sourceId: 'portfolio',
      paramsFingerprint: 'params-1',
      dataSchemaVersion: 1,
    });
    const resource = session!.createResource<{ value: string }>(sourceKey);
    const firstToken = resource.beginRequest();
    const secondToken = resource.beginRequest();
    expect(
      resource.acceptResponse(
        createHomeRuntimeEnvelope(firstToken, {
          kind: 'success',
          data: { value: 'old' },
          coverageFingerprint: 'coverage-1',
        }),
      ),
    ).toBe(false);
    expect(
      resource.acceptResponse(
        createHomeRuntimeEnvelope(secondToken, {
          kind: 'success',
          data: { value: 'new' },
          coverageFingerprint: 'coverage-2',
        }),
      ),
    ).toBe(true);
    expect(resource.getState()).toMatchObject({
      status: 'success',
      data: { value: 'new' },
    });
  });

  it('rejects old-producer responses after an explicit producer restart', () => {
    const adapter = new SingleRuntimeHomeAdapter({
      clientInstanceId: 'client-1',
      producerInstanceId: 'producer-1',
    });
    const coordinator = new HomeSessionCoordinator({
      adapter,
      createSessionId: () => 'session-1',
    });
    const session = coordinator.setOwner(owner('wallet-a'))!;
    session.applyHandshake({
      protocolVersion: 1,
      producerInstanceId: 'producer-1',
    });
    const resource = session.createResource<{ value: string }>(
      createHomeSourceKey({
        ownerToken: session.ownerToken,
        sourceId: 'history',
        paramsFingerprint: 'params-1',
        dataSchemaVersion: 1,
      }),
    );
    const oldToken = resource.beginRequest();
    session.applyHandshake({
      protocolVersion: 1,
      producerInstanceId: 'producer-2',
    });
    expect(
      resource.acceptResponse(
        createHomeRuntimeEnvelope(oldToken, {
          kind: 'empty',
          coverageFingerprint: 'coverage-1',
        }),
      ),
    ).toBe(false);
    expect(session.staleTrace.getEntries().at(-1)?.reason).toBe(
      'producerMismatch',
    );
  });

  it('keeps only bounded, payload-free stale diagnostics', () => {
    const trace = new HomeStaleTrace(2);
    const sourceKey = {
      scopeKey: 'scope-1',
      sourceId: 'market' as const,
      paramsFingerprint: 'params-1',
      dataSchemaVersion: 1,
    };
    [1, 2, 3].forEach((requestSeq) =>
      trace.record({
        reason: 'requestSequenceMismatch',
        requestSeq,
        sessionId: 'session-1',
        sourceKey,
      }),
    );
    expect(trace.getEntries().map((entry) => entry.requestSeq)).toEqual([2, 3]);
    expect(JSON.stringify(trace.getEntries())).not.toContain('payload');
  });
});
