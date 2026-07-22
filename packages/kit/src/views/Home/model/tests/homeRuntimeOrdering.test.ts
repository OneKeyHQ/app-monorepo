import { createInitialHomeStoreState } from '../store/homeStoreInitialState';
import {
  applyHomeStorePatchToState,
  reduceHomeStore,
} from '../store/homeStoreReducer';

import {
  phase0HomeEventScenarios,
  phase0HomeFailureBaseline,
  phase0NativeRevisionGapOracle,
} from './fixtures/homeEventFixtures';

const owner = {
  walletId: 'wallet-runtime-ordering',
  accountId: 'account-runtime-ordering',
  network: { kind: 'singleNetwork', networkId: 'evm-1' },
} as const;
const ownerToken = {
  scopeKey: 'scope-runtime-ordering',
  sessionId: 'session-runtime-ordering',
};

function applyTransition(
  state: ReturnType<typeof createInitialHomeStoreState>,
  event: Parameters<typeof reduceHomeStore>[1],
) {
  const transition = reduceHomeStore(state, event);
  return {
    state: applyHomeStorePatchToState(state, transition.patch.mutations),
    transition,
  };
}

describe('Home Phase 0 runtime ordering oracle', () => {
  it('records the supplied iOS failure evidence without treating defects as expectations', () => {
    expect(phase0HomeFailureBaseline.captureKind).toBe('userSupplied');
    expect(phase0HomeFailureBaseline.sha256).toHaveLength(64);
    expect(phase0HomeFailureBaseline.provenance).toEqual({
      repository: 'unavailable',
      metroBundle: 'unavailable',
    });
    expect(phase0HomeFailureBaseline.video.framesPerSecond).toBe(60);
    expect(phase0HomeFailureBaseline.defects).toContain(
      'Header amount alternates between 11.61 and 11.62 for fixed source data.',
    );
    expect(phase0HomeFailureBaseline.expectedAfterMigration).not.toEqual(
      phase0HomeFailureBaseline.defects,
    );
    expect(phase0HomeFailureBaseline.controlledOracle).toEqual({
      rapidTabInputCount: 5,
      rapidTabAcceptedCount: 5,
      rapidTabRejectedCount: 0,
      ownerReplacementEventCount: 2,
      nativeRevisionGapEventCount: 2,
      expectedNativeResyncCount: 1,
    });
  });

  it('retires the complete previous owner state in one event', () => {
    const finalState = phase0HomeEventScenarios.ownerReplacement.reduce(
      (state, event) => {
        const transition = reduceHomeStore(state, event);
        return applyHomeStorePatchToState(state, transition.patch.mutations);
      },
      createInitialHomeStoreState(),
    );
    expect(finalState.session.owner?.accountId).toBe('account-home-phase0-b');
    expect(finalState.session.ownerToken?.sessionId).toBe(
      'home-session-phase0-b',
    );
    expect(finalState.resources.defi.kind).toBe('idle');
    expect(finalState.interaction.preferredTabId).toBeUndefined();
  });

  it('accepts rapid tabs synchronously against one applicability revision', () => {
    const finalState = phase0HomeEventScenarios.rapidTabs.reduce(
      (state, event) => {
        const transition = reduceHomeStore(state, event);
        return applyHomeStorePatchToState(state, transition.patch.mutations);
      },
      createInitialHomeStoreState(),
    );

    expect(finalState.navigation.value).toMatchObject({
      kind: 'ready',
      selectedTabId: 'defi',
    });
    expect(finalState.interaction.acceptedIntentIds).toHaveLength(5);
    expect(finalState.diagnostics.rejectedEventCount).toBe(0);
  });

  it('binds the native revision-gap baseline to the protocol resync oracle', () => {
    expect(phase0HomeEventScenarios.nativeRevisionGap).toHaveLength(2);
    expect(phase0NativeRevisionGapOracle).toMatchObject({
      initialTransportRevision: 1,
      receivedBaseTransportRevision: 2,
      expected: { kind: 'needSnapshot', reason: 'revisionGap' },
    });
  });

  it('rejects an old producer response after runtime authority changes', () => {
    let state = createInitialHomeStoreState();
    state = applyTransition(state, {
      type: 'ownerChanged',
      owner,
      ownerToken,
      topology: 'split',
    }).state;
    state = applyTransition(state, {
      type: 'runtimeChanged',
      runtime: {
        topology: 'split',
        connection: 'ready',
        producerInstanceId: 'producer-before-restart',
        protocolVersion: 1,
      },
    }).state;
    const token = {
      protocolVersion: 1,
      clientInstanceId: 'client-runtime-ordering',
      producerInstanceId: 'producer-before-restart',
      sessionId: ownerToken.sessionId,
      sourceKey: {
        scopeKey: ownerToken.scopeKey,
        sourceId: 'portfolio',
        paramsFingerprint: 'portfolio-params',
        dataSchemaVersion: 1,
      },
      requestSeq: 1,
    } as const;
    state = applyTransition(state, { type: 'sourceRequested', token }).state;
    state = applyTransition(state, {
      type: 'runtimeChanged',
      runtime: {
        topology: 'split',
        connection: 'ready',
        producerInstanceId: 'producer-after-restart',
        protocolVersion: 1,
      },
    }).state;

    const rejected = applyTransition(state, {
      type: 'sourceResponded',
      envelope: {
        token,
        result: {
          kind: 'success',
          data: { payload: 'stale' },
          coverageFingerprint: 'coverage-stale',
        },
      },
    });

    expect(rejected.transition.effects).toContainEqual({
      kind: 'traceReject',
      reason: 'producerMismatch',
      intentId: undefined,
    });
    expect(rejected.state.resources.portfolio.kind).toBe('loading');
  });

  it('resets a section and its resource atomically', () => {
    let state = applyTransition(createInitialHomeStoreState(), {
      type: 'ownerChanged',
      owner,
      ownerToken,
      topology: 'single',
    }).state;
    state = applyTransition(state, {
      type: 'sectionSourceChanged',
      ownerToken,
      sectionId: 'portfolio',
      result: {
        kind: 'ready',
        rowIds: ['row-1'],
        data: { rows: ['row-1'] },
        freshness: 'live',
        refresh: 'idle',
      },
    }).state;

    state = applyTransition(state, {
      type: 'sectionReset',
      ownerToken,
      sectionId: 'portfolio',
    }).state;

    expect(state.sections.portfolio.value.kind).toBe('loading');
    expect(state.resources.portfolio.kind).toBe('idle');
  });

  it('expires row commands when a section replaces its row identity set', () => {
    let state = applyTransition(createInitialHomeStoreState(), {
      type: 'ownerChanged',
      owner,
      ownerToken,
      topology: 'single',
    }).state;
    state = applyTransition(state, {
      type: 'sectionSourceChanged',
      ownerToken,
      sectionId: 'portfolio',
      result: {
        kind: 'ready',
        rowIds: ['row-before'],
        data: { rows: ['row-before'] },
        freshness: 'live',
        refresh: 'idle',
      },
    }).state;
    const staleRevision = state.sections.portfolio.sectionCommandRevision;
    state = applyTransition(state, {
      type: 'sectionSourceChanged',
      ownerToken,
      sectionId: 'portfolio',
      result: {
        kind: 'ready',
        rowIds: ['row-after'],
        data: { rows: ['row-after'] },
        freshness: 'live',
        refresh: 'idle',
      },
    }).state;

    const rejected = applyTransition(state, {
      type: 'intentReceived',
      intent: {
        type: 'sectionActionInvoked',
        actionId: 'home.asset.open',
        authority: {
          kind: 'sectionCommands',
          sectionId: 'portfolio',
          revision: staleRevision,
        },
        intentId: 'intent-stale-row',
        itemId: 'row-before',
        owner,
        sectionId: 'portfolio',
        sessionId: ownerToken.sessionId,
      },
    });

    expect(state.sections.portfolio.sectionCommandRevision).toBeGreaterThan(
      staleRevision,
    );
    expect(rejected.state.diagnostics.lastRejectReason).toBe(
      'intentAuthorityExpired',
    );
  });

  it('accepts only current row targets from the matching command authority', () => {
    let state = applyTransition(createInitialHomeStoreState(), {
      type: 'ownerChanged',
      owner,
      ownerToken,
      topology: 'single',
    }).state;
    state = applyTransition(state, {
      type: 'sectionSourceChanged',
      ownerToken,
      sectionId: 'portfolio',
      result: {
        kind: 'ready',
        rowIds: ['row-current'],
        data: { rows: ['row-current'] },
        freshness: 'live',
        refresh: 'idle',
      },
    }).state;
    const authority = {
      kind: 'sectionCommands' as const,
      sectionId: 'portfolio' as const,
      revision: state.sections.portfolio.sectionCommandRevision,
    };
    const createIntent = (actionId: string, itemId: string) => ({
      type: 'intentReceived' as const,
      intent: {
        type: 'sectionActionInvoked' as const,
        actionId,
        authority,
        execution: 'controller' as const,
        intentId: `intent-${actionId}-${itemId}`,
        itemId,
        owner,
        sectionId: 'portfolio' as const,
        sessionId: ownerToken.sessionId,
      },
    });

    const staleTarget = applyTransition(
      state,
      createIntent('home.asset.open', 'row-stale'),
    );
    expect(staleTarget.state.diagnostics.lastRejectReason).toBe(
      'intentTargetUnavailable',
    );

    const wrongAuthority = applyTransition(
      state,
      createIntent('home.market.openToken', 'row-current'),
    );
    expect(wrongAuthority.state.diagnostics.lastRejectReason).toBe(
      'intentTargetUnavailable',
    );

    const accepted = applyTransition(
      state,
      createIntent('home.asset.open', 'row-current'),
    );
    expect(accepted.state.interaction.pendingSectionCommands).toHaveLength(1);
    expect(accepted.state.diagnostics.lastRejectReason).toBeUndefined();
  });
});
