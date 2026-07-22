import { getHomeSourceKeyIdentity } from '../../core/homeIdentity';
import { adaptCurrentHomeBalanceFacts } from '../../facts/currentHomeBalanceFactsAdapter';
import { createIdleHomeSourceFacts } from '../../facts/homeFacts';
import { createInitialHomeStoreState } from '../homeStoreInitialState';
import {
  applyHomeStorePatchToState,
  reduceHomeStore,
} from '../homeStoreReducer';

import type { IHomeFacts } from '../../facts/homeFacts';
import type {
  IHomeStoreEvent,
  IHomeStoreRequestToken,
  IHomeStoreState,
} from '../homeStoreTypes';

const owner = {
  walletId: 'wallet-a',
  accountId: 'account-a',
  network: { kind: 'allNetworks' as const },
};
const ownerToken = { scopeKey: 'owner-a', sessionId: 'session-a' };

function dispatch(
  state: IHomeStoreState,
  event: IHomeStoreEvent,
): IHomeStoreState {
  return applyHomeStorePatchToState(
    state,
    reduceHomeStore(state, event).patch.mutations,
  );
}

function createOwnedState(): IHomeStoreState {
  return dispatch(createInitialHomeStoreState(), {
    type: 'ownerChanged',
    owner,
    ownerToken,
    topology: 'split',
  });
}

function createBaseFacts(): IHomeFacts {
  return {
    owner,
    ownerToken,
    wallet: {
      ready: true,
      hasNetworkAccount: true,
      backupStatus: 'complete',
      accountType: 'hd',
    },
    environment: { theme: 'light' },
    runtime: {
      topology: 'split',
      connection: 'ready',
      protocolVersion: 1,
    },
    capabilityInputs: createInitialHomeStoreState().capabilityInputs,
    sources: createIdleHomeSourceFacts(),
    confirmed: {},
  };
}

function withCapability(
  state: IHomeStoreState,
  perpsDestination: 'inline' | 'web',
): IHomeStoreState {
  const available = {
    defi: 'available' as const,
    history: 'available' as const,
    market: 'available' as const,
    nft: 'unavailable' as const,
    perps: 'available' as const,
  };
  return dispatch(state, {
    type: 'capabilityChanged',
    facts: {
      ownerToken,
      sourceKeyIdentity: `capability-${perpsDestination}`,
      resource: {
        kind: 'complete',
        coverageFingerprint: `coverage-${perpsDestination}`,
        context: {
          accountType: 'hd',
          allNetworks: true,
          networkFamily: 'allNetworks',
          perpsDestination,
          productAvailability: available,
          serverConfig: available,
        },
      },
    },
  });
}

function createToken(requestSeq: number): IHomeStoreRequestToken<'defi'> {
  return {
    protocolVersion: 1,
    clientInstanceId: 'client-a',
    producerInstanceId: 'producer-a',
    sessionId: ownerToken.sessionId,
    requestSeq,
    sourceKey: {
      scopeKey: ownerToken.scopeKey,
      sourceId: 'defi',
      paramsFingerprint: 'defi-a',
      dataSchemaVersion: 1,
    },
  };
}

describe('Home Store reducer', () => {
  it('is idempotent for an identical owner event', () => {
    const state = createOwnedState();
    const transition = reduceHomeStore(state, {
      type: 'ownerChanged',
      owner,
      ownerToken,
      topology: 'split',
    });
    expect(transition.patch.mutations).toHaveLength(0);
    expect(applyHomeStorePatchToState(state, transition.patch.mutations)).toBe(
      state,
    );
  });

  it('keeps Navigation and Sections stable for a wallet-input Shell change', () => {
    const state = createOwnedState();
    const next = dispatch(state, {
      type: 'factsChanged',
      facts: {
        owner,
        ownerToken,
        wallet: {
          ready: true,
          hasNetworkAccount: false,
          backupStatus: 'complete',
          accountType: 'hd',
        },
        environment: { theme: 'light' },
        runtime: {
          topology: 'split',
          connection: 'ready',
          protocolVersion: 1,
        },
        capabilityInputs: state.capabilityInputs,
        sources: createIdleHomeSourceFacts(),
        confirmed: {},
      },
    });
    expect(next.shell).not.toBe(state.shell);
    expect(next.navigation).toBe(state.navigation);
    expect(next.sections).toBe(state.sections);
    expect(next.resources).toBe(state.resources);
  });

  it('holds one confirmed Header amount while an incomplete round churns', () => {
    let state = createOwnedState();
    const publishBalance = (amount: string, observedAt: number) => {
      const base = createBaseFacts();
      const balance = adaptCurrentHomeBalanceFacts({
        bannerAvailable: false,
        compatibilityConfirmedAmount: amount,
        contributors: [
          {
            coverageFingerprint: 'portfolio-refreshing',
            expectedSourceScopeKey: ownerToken.scopeKey,
            id: 'portfolio',
            included: true,
            positiveEvidence: true,
            sourceIdentity: 'portfolio-v1',
            sourceScopeKey: ownerToken.scopeKey,
            status: 'partial',
          },
        ],
        ownerToken,
        quoteBasis: { currency: 'usd', pricingRevision: 'rates-1' },
        requiredSetRevision: 'portfolio:v1',
      });
      state = dispatch(state, {
        type: 'balanceChanged',
        facts: { ...base, balance },
        observedAt,
      });
    };

    publishBalance('11.61', 1);
    const stableShell = state.shell;
    publishBalance('11.62', 2);

    expect(state.confirmedBalance?.amount).toBe('11.61');
    expect(state.shell).toBe(stableShell);
    expect(state.shell.value).toMatchObject({
      kind: 'portfolio',
      presentation: { header: { balance: { amount: '11.61' } } },
    });
  });

  it('does not expire command authority for display-only Section changes', () => {
    let state = createOwnedState();
    state = dispatch(state, {
      type: 'sectionSourceChanged',
      ownerToken,
      sectionId: 'defi',
      result: {
        kind: 'ready',
        rowIds: ['row-a'],
        freshness: 'live',
        refresh: 'idle',
      },
    });
    const authorityRevision = state.sections.defi.sectionCommandRevision;
    state = dispatch(state, {
      type: 'sectionSourceChanged',
      ownerToken,
      sectionId: 'defi',
      result: {
        kind: 'ready',
        rowIds: ['row-a'],
        freshness: 'live',
        refresh: 'refreshing',
      },
    });
    expect(state.sections.defi.presentationRevision).toBe(2);
    expect(state.sections.defi.sectionCommandRevision).toBe(authorityRevision);
  });

  it('updates one Section control without touching resources or Section projections', () => {
    const state = createOwnedState();
    const transition = reduceHomeStore(state, {
      type: 'intentReceived',
      intent: {
        type: 'sectionControlChanged',
        intentId: 'market-category-trending',
        owner,
        sessionId: ownerToken.sessionId,
        sectionId: 'market',
        controlId: 'home.market.selectedCategory',
        value: 'trending',
        authority: {
          kind: 'sectionCommands',
          sectionId: 'market',
          revision: state.sections.market.sectionCommandRevision,
        },
      },
    });
    const next = applyHomeStorePatchToState(state, transition.patch.mutations);

    expect(
      transition.patch.mutations.map((mutation) => mutation.slice),
    ).toEqual(['interaction', 'diagnostics']);
    expect(next.interaction.sectionControls.market).toEqual({
      'home.market.selectedCategory': 'trending',
    });
    expect(next.resources).toBe(state.resources);
    expect(next.sections).toBe(state.sections);
    expect(next.shell).toBe(state.shell);
    expect(next.navigation).toBe(state.navigation);
    expect(transition.effects).toEqual([]);
  });

  it('accepts rapid tab intents against one applicability revision', () => {
    let state = withCapability(createOwnedState(), 'inline');
    const authorityRevision = state.navigation.tabApplicabilityRevision;
    for (const [intentId, tabId] of [
      ['intent-perps', 'perps'],
      ['intent-defi', 'defi'],
    ] as const) {
      state = dispatch(state, {
        type: 'intentReceived',
        intent: {
          type: 'tabSelected',
          intentId,
          owner,
          sessionId: ownerToken.sessionId,
          tabId,
          authority: {
            kind: 'tabApplicability',
            revision: authorityRevision,
          },
        },
      });
    }
    expect(state.navigation.value).toMatchObject({ selectedTabId: 'defi' });
    expect(state.navigation.tabApplicabilityRevision).toBe(authorityRevision);
    expect(state.diagnostics.rejectedEventCount).toBe(0);
  });

  it('executes only the currently applicable Perps handoff command', () => {
    const state = withCapability(createOwnedState(), 'web');
    const authority = {
      kind: 'tabApplicability' as const,
      revision: state.navigation.tabApplicabilityRevision,
    };
    const accepted = reduceHomeStore(state, {
      type: 'intentReceived',
      intent: {
        type: 'tabHandoffInvoked',
        intentId: 'handoff-current',
        owner,
        sessionId: ownerToken.sessionId,
        tabId: 'perps',
        actionId: 'home.perps.openWeb',
        authority,
      },
    });

    expect(accepted.effects).toEqual([
      {
        kind: 'executeCommand',
        intent: expect.objectContaining({ intentId: 'handoff-current' }),
      },
    ]);
    const rejected = reduceHomeStore(state, {
      type: 'intentReceived',
      intent: {
        type: 'tabHandoffInvoked',
        intentId: 'handoff-wrong-command',
        owner,
        sessionId: ownerToken.sessionId,
        tabId: 'perps',
        actionId: 'home.perps.openOther',
        authority,
      },
    });
    expect(rejected.effects).toEqual([
      expect.objectContaining({ reason: 'intentTargetUnavailable' }),
    ]);
  });

  it('keeps ready DeFi visible during same-owner refresh', () => {
    let state = createOwnedState();
    const firstToken = createToken(1);
    state = dispatch(state, { type: 'sourceRequested', token: firstToken });
    state = dispatch(state, {
      type: 'sourceResponded',
      envelope: {
        token: firstToken,
        result: {
          kind: 'success',
          data: {
            payload: { rows: [{ id: 'defi-a' }] },
            section: {
              kind: 'ready',
              rowIds: ['defi-a'],
              freshness: 'live',
              refresh: 'idle',
            },
          },
          coverageFingerprint: 'defi-complete-a',
        },
      },
    });
    const beforeRefresh = state;
    const transition = reduceHomeStore(state, {
      type: 'sourceRequested',
      token: createToken(2),
    });
    state = applyHomeStorePatchToState(state, transition.patch.mutations);
    expect(state.resources.defi).toMatchObject({
      kind: 'ready',
      refresh: 'refreshing',
      data: { payload: { rows: [{ id: 'defi-a' }] } },
    });
    expect(state.sections.defi.value).toEqual({
      kind: 'ready',
      rowIds: ['defi-a'],
      freshness: 'live',
      refresh: 'refreshing',
    });
    expect(
      transition.patch.mutations.map((mutation) => mutation.slice),
    ).toEqual(expect.arrayContaining(['resource', 'section']));
    expect(state.commitIdentity.storeCommitId).toBe(
      beforeRefresh.commitIdentity.storeCommitId + 1,
    );
  });

  it('commits a failed response with its Section state and preserves ready rows', () => {
    let state = createOwnedState();
    const request1 = createToken(1);
    state = dispatch(state, { type: 'sourceRequested', token: request1 });
    state = dispatch(state, {
      type: 'sourceResponded',
      envelope: {
        token: request1,
        result: {
          kind: 'success',
          data: {
            payload: { protocols: [{ id: 'defi-a' }] },
            section: {
              kind: 'ready',
              rowIds: ['defi-a'],
              freshness: 'live',
              refresh: 'idle',
            },
          },
          coverageFingerprint: 'defi-complete-a',
        },
      },
    });
    const request2 = createToken(2);
    state = dispatch(state, { type: 'sourceRequested', token: request2 });
    const beforeFailure = state;
    const transition = reduceHomeStore(state, {
      type: 'sourceResponded',
      envelope: {
        token: request2,
        result: { kind: 'error', errorKind: 'transport' },
      },
    });
    state = applyHomeStorePatchToState(state, transition.patch.mutations);

    expect(state.resources.defi).toMatchObject({
      kind: 'ready',
      refresh: 'failed',
    });
    expect(state.sections.defi.value).toEqual({
      kind: 'ready',
      rowIds: ['defi-a'],
      freshness: 'live',
      refresh: 'failed',
    });
    expect(
      transition.patch.mutations.map((mutation) => mutation.slice),
    ).toEqual(expect.arrayContaining(['resource', 'section']));
    expect(state.commitIdentity.storeCommitId).toBe(
      beforeFailure.commitIdentity.storeCommitId + 1,
    );
  });

  it('projects a first failed response to resource and Section errors atomically', () => {
    let state = createOwnedState();
    const token = createToken(1);
    state = dispatch(state, { type: 'sourceRequested', token });
    const transition = reduceHomeStore(state, {
      type: 'sourceResponded',
      envelope: {
        token,
        result: { kind: 'error', errorKind: 'source' },
      },
    });
    state = applyHomeStorePatchToState(state, transition.patch.mutations);

    expect(state.resources.defi).toMatchObject({
      kind: 'error',
      errorKind: 'source',
    });
    expect(state.sections.defi.value).toEqual({
      kind: 'error',
      errorState: 'defi',
    });
  });

  it('commits a source payload and its Section projection atomically', () => {
    let state = createOwnedState();
    const token = createToken(1);
    state = dispatch(state, { type: 'sourceRequested', token });
    const transition = reduceHomeStore(state, {
      type: 'sourceResponded',
      envelope: {
        token,
        result: {
          kind: 'success',
          data: {
            payload: { protocols: [{ id: 'defi-a' }] },
            section: {
              kind: 'ready',
              rowIds: ['defi-a'],
              freshness: 'live',
              refresh: 'idle',
            },
          },
          coverageFingerprint: 'defi-complete-a',
        },
      },
    });
    const next = applyHomeStorePatchToState(state, transition.patch.mutations);
    expect(next.resources.defi).toMatchObject({
      kind: 'ready',
      data: { payload: { protocols: [{ id: 'defi-a' }] } },
    });
    expect(next.sections.defi.value).toMatchObject({
      kind: 'ready',
      rowIds: ['defi-a'],
    });
    expect(next.sections.portfolio).toBe(state.sections.portfolio);
    expect(next.sections.perps).toBe(state.sections.perps);
    expect(next.navigation).toBe(state.navigation);
    expect(next.shell).toBe(state.shell);
    expect(next.commitIdentity.storeCommitId).toBe(
      state.commitIdentity.storeCommitId + 1,
    );
  });

  it('persists and hydrates section readiness through the scoped resource', () => {
    let state = createOwnedState();
    state = dispatch(state, {
      type: 'sectionSourceChanged',
      ownerToken,
      sectionId: 'defi',
      result: {
        kind: 'ready',
        rowIds: ['row-a', 'row-b'],
        freshness: 'live',
        refresh: 'idle',
      },
    });
    expect(state.resources.defi).toMatchObject({
      kind: 'ready',
      data: {
        section: { kind: 'ready', rowIds: ['row-a', 'row-b'] },
      },
    });

    const cachedPayload =
      state.resources.defi.kind === 'ready'
        ? state.resources.defi.data
        : undefined;
    let hydrated = createOwnedState();
    const hydrationToken = createToken(1);
    hydrated = dispatch(hydrated, {
      type: 'sourceRequested',
      token: hydrationToken,
    });
    hydrated = dispatch(hydrated, {
      type: 'confirmedSnapshotHydrated',
      ownerScopeKey: ownerToken.scopeKey,
      sessionId: ownerToken.sessionId,
      records: [
        {
          sourceId: 'defi',
          sourceKeyIdentity: getHomeSourceKeyIdentity(hydrationToken.sourceKey),
          dataSchemaVersion: 1,
          coverageFingerprint: '["row-a","row-b"]',
          quoteBasis: null,
          confirmedAt: 1,
          expiresAt: 2,
          payload: cachedPayload ?? null,
        },
      ],
    });
    expect(hydrated.sections.defi.value).toEqual({
      kind: 'ready',
      rowIds: ['row-a', 'row-b'],
      freshness: 'confirmedCache',
      refresh: 'refreshing',
    });
    hydrated = dispatch(hydrated, {
      type: 'sourceResponded',
      envelope: {
        token: hydrationToken,
        result: {
          kind: 'success',
          coverageFingerprint: '["row-live"]',
          data: {
            payload: null,
            section: {
              kind: 'ready',
              rowIds: ['row-live'],
              freshness: 'live',
              refresh: 'idle',
            },
          },
        },
      },
    });
    expect(hydrated.resources.defi).toMatchObject({
      kind: 'ready',
      coverageFingerprint: '["row-live"]',
      freshness: 'live',
      refresh: 'idle',
      token: hydrationToken,
    });
    expect(hydrated.sections.defi.value).toMatchObject({
      kind: 'ready',
      rowIds: ['row-live'],
      freshness: 'live',
    });
  });

  it('marks an exact cached fallback failed after a live error and still lets the same request replace it', () => {
    let state = createOwnedState();
    const request = createToken(1);
    state = dispatch(state, { type: 'sourceRequested', token: request });
    state = dispatch(state, {
      type: 'sourceResponded',
      envelope: {
        token: request,
        result: { kind: 'error', errorKind: 'source' },
      },
    });
    state = dispatch(state, {
      type: 'confirmedSnapshotHydrated',
      ownerScopeKey: ownerToken.scopeKey,
      sessionId: ownerToken.sessionId,
      records: [
        {
          sourceId: 'defi',
          sourceKeyIdentity: getHomeSourceKeyIdentity(request.sourceKey),
          dataSchemaVersion: request.sourceKey.dataSchemaVersion,
          coverageFingerprint: '["cached"]',
          quoteBasis: request.sourceKey.quoteBasis ?? null,
          confirmedAt: 1,
          expiresAt: 2,
          payload: {
            payload: { protocols: [{ id: 'cached' }] },
            section: {
              kind: 'ready',
              rowIds: ['cached'],
              freshness: 'live',
              refresh: 'idle',
            },
          },
        },
      ],
    });
    expect(state.resources.defi).toMatchObject({
      kind: 'ready',
      freshness: 'confirmedCache',
      refresh: 'failed',
      token: request,
    });

    state = dispatch(state, {
      type: 'sourceResponded',
      envelope: {
        token: request,
        result: {
          kind: 'success',
          coverageFingerprint: '["live"]',
          data: {
            payload: { protocols: [{ id: 'live' }] },
            section: {
              kind: 'ready',
              rowIds: ['live'],
              freshness: 'live',
              refresh: 'idle',
            },
          },
        },
      },
    });
    expect(state.resources.defi).toMatchObject({
      kind: 'ready',
      freshness: 'live',
      refresh: 'idle',
      coverageFingerprint: '["live"]',
    });
  });

  it('commits a normalized Section payload with its semantic slice', () => {
    const state = createOwnedState();
    const next = dispatch(state, {
      type: 'sectionSourceChanged',
      ownerToken,
      sectionId: 'defi',
      result: {
        kind: 'ready',
        rowIds: ['protocol-a'],
        freshness: 'live',
        refresh: 'idle',
        data: { protocols: [{ id: 'protocol-a' }] },
      },
    });
    expect(next.sections.defi.value).toMatchObject({
      kind: 'ready',
      rowIds: ['protocol-a'],
    });
    expect(next.resources.defi).toMatchObject({
      kind: 'ready',
      data: {
        payload: { protocols: [{ id: 'protocol-a' }] },
      },
    });
    expect(next.commitIdentity.storeCommitId).toBe(
      state.commitIdentity.storeCommitId + 1,
    );
  });

  it('rejects request 1 after request 2 has become authoritative', () => {
    let state = createOwnedState();
    const request1 = createToken(1);
    const request2 = createToken(2);
    state = dispatch(state, { type: 'sourceRequested', token: request1 });
    state = dispatch(state, { type: 'sourceRequested', token: request2 });
    state = dispatch(state, {
      type: 'sourceResponded',
      envelope: {
        token: request1,
        result: {
          kind: 'success',
          data: { rows: [{ id: 'stale' }] },
          coverageFingerprint: 'stale',
        },
      },
    });
    expect(state.resources.defi).toMatchObject({
      kind: 'loading',
      token: request2,
    });
    expect(state.diagnostics.lastRejectReason).toBe('requestSequenceStale');
  });

  it('keeps request 2 after its response arrives before request 1', () => {
    let state = createOwnedState();
    const request1 = createToken(1);
    const request2 = createToken(2);
    state = dispatch(state, { type: 'sourceRequested', token: request1 });
    state = dispatch(state, { type: 'sourceRequested', token: request2 });
    state = dispatch(state, {
      type: 'sourceResponded',
      envelope: {
        token: request2,
        result: {
          kind: 'success',
          data: {
            payload: { protocols: [{ id: 'fresh' }] },
            section: {
              kind: 'ready',
              rowIds: ['fresh'],
              freshness: 'live',
              refresh: 'idle',
            },
          },
          coverageFingerprint: 'fresh',
        },
      },
    });
    const request2State = state;
    state = dispatch(state, {
      type: 'sourceResponded',
      envelope: {
        token: request1,
        result: {
          kind: 'success',
          data: { payload: null, section: { kind: 'empty' } },
          coverageFingerprint: 'stale',
        },
      },
    });

    expect(state.resources.defi).toBe(request2State.resources.defi);
    expect(state.sections.defi).toBe(request2State.sections.defi);
    expect(state.resources.defi).toMatchObject({
      kind: 'ready',
      token: request2,
      data: { payload: { protocols: [{ id: 'fresh' }] } },
    });
    expect(state.diagnostics.lastRejectReason).toBe('requestSequenceStale');
  });

  it('rejects an older request sequence from the same owner and producer', () => {
    let state = createOwnedState();
    state = dispatch(state, {
      type: 'sourceRequested',
      token: createToken(2),
    });
    const staleTransition = reduceHomeStore(state, {
      type: 'sourceRequested',
      token: createToken(1),
    });
    const next = applyHomeStorePatchToState(
      state,
      staleTransition.patch.mutations,
    );

    expect(next.resources.defi).toBe(state.resources.defi);
    expect(next.diagnostics.lastRejectReason).toBe('requestSequenceStale');
    expect(staleTransition.effects).toEqual([
      expect.objectContaining({ reason: 'requestSequenceStale' }),
    ]);
  });

  it('atomically retires all owner-scoped data on replacement', () => {
    let state = createOwnedState();
    state = dispatch(state, {
      type: 'sectionSourceChanged',
      ownerToken,
      sectionId: 'nft',
      result: { kind: 'empty' },
    });
    const next = dispatch(state, {
      type: 'ownerChanged',
      owner: { ...owner, accountId: 'account-b' },
      ownerToken: { scopeKey: 'owner-b', sessionId: 'session-b' },
      topology: 'split',
    });
    expect(next.sections.nft.value).toEqual({
      kind: 'loading',
      placeholder: 'nft',
    });
    expect(next.resources.defi.kind).toBe('idle');
    expect(next.interaction.preferredTabId).toBeUndefined();
    expect(next.diagnostics).toMatchObject({
      acceptedEventCount: 1,
      rejectedEventCount: 0,
    });
  });
});
