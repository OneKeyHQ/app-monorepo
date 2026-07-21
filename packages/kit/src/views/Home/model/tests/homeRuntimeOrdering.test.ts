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
});
