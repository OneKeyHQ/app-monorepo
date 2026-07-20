import { createIdleHomeSourceFacts } from '../facts/homeFacts';
import { projectHomeSemanticModel } from '../semantic/homeSemanticProjector';

import {
  type IHomeBehaviorOracleVectorId,
  REQUIRED_HOME_BEHAVIOR_ORACLE_VECTOR_IDS,
  homeBehaviorOracleFixtures,
} from './fixtures/homeBehaviorOracleFixtures';

import type { IHomeFacts } from '../facts/homeFacts';

type IPhase2GoldenBinding =
  | { kind: 'projected' }
  | {
      kind: 'notComparable';
      reason:
        | 'blockedFixture'
        | 'currentObservationUnavailable'
        | 'normalizedFactUnavailable'
        | 'runtimeNotReady';
    };

const phase2GoldenBindings = {
  newUnbackedWallet: { kind: 'projected' },
  backedZeroWallet: { kind: 'projected' },
  fundedAllNetworks: { kind: 'projected' },
  fundedBitcoin: { kind: 'projected' },
  scopeSwitchWithExactCache: { kind: 'projected' },
  scopeSwitchWithoutCache: { kind: 'projected' },
  backgroundNotReady: { kind: 'projected' },
  partialPortfolioResponse: { kind: 'projected' },
  staleDefiResponse: {
    kind: 'notComparable',
    reason: 'normalizedFactUnavailable',
  },
  stalePerpsResponse: {
    kind: 'notComparable',
    reason: 'normalizedFactUnavailable',
  },
  historyEmpty: { kind: 'projected' },
  nftError: {
    kind: 'notComparable',
    reason: 'currentObservationUnavailable',
  },
  marketLoading: {
    kind: 'notComparable',
    reason: 'currentObservationUnavailable',
  },
  capabilityChanged: { kind: 'projected' },
  sameScopeRequestTwoFinishesBeforeOne: {
    kind: 'notComparable',
    reason: 'normalizedFactUnavailable',
  },
  producerRestartWithOldResponse: {
    kind: 'notComparable',
    reason: 'runtimeNotReady',
  },
  partialPositiveWithExactZeroCache: { kind: 'projected' },
  aggregationRequiredSetChanged: {
    kind: 'notComparable',
    reason: 'normalizedFactUnavailable',
  },
  nativeRevisionGap: { kind: 'notComparable', reason: 'blockedFixture' },
  snapshotSlotOwnerMismatch: {
    kind: 'notComparable',
    reason: 'blockedFixture',
  },
  staleNativeIntent: { kind: 'notComparable', reason: 'blockedFixture' },
} as const satisfies Record<IHomeBehaviorOracleVectorId, IPhase2GoldenBinding>;

function facts(): IHomeFacts {
  return {
    owner: {
      walletId: 'wallet-a',
      accountId: 'account-a',
      network: { kind: 'allNetworks' },
    },
    ownerToken: { scopeKey: 'scope-a', sessionId: 'session-a' },
    wallet: {
      ready: true,
      hasNetworkAccount: true,
      backupStatus: 'complete',
      accountType: 'hd',
    },
    environment: { currency: 'USD', locale: 'en-US', theme: 'light' },
    runtime: {
      topology: 'split',
      connection: 'ready',
      producerInstanceId: 'producer-a',
      protocolVersion: 1,
    },
    capabilityInputs: {
      ready: true,
      networkFamily: 'allNetworks',
      accountType: 'hd',
      allNetworks: true,
      serverConfig: {
        perps: true,
        defi: true,
        nft: true,
        history: true,
        market: true,
      },
      productAvailability: {
        perps: true,
        defi: true,
        nft: true,
        history: true,
        market: true,
      },
    },
    sources: createIdleHomeSourceFacts(),
    confirmed: {},
  };
}

describe('Phase 2 Home semantic golden bindings', () => {
  it('binds every one of the 21 Phase 0 vectors without guessing unsupported semantics', () => {
    expect(Object.keys(phase2GoldenBindings).toSorted()).toEqual(
      [...REQUIRED_HOME_BEHAVIOR_ORACLE_VECTOR_IDS].toSorted(),
    );
    expect(homeBehaviorOracleFixtures).toHaveLength(21);
    homeBehaviorOracleFixtures.forEach((fixture) => {
      expect(phase2GoldenBindings[fixture.id]).toBeDefined();
      expect([
        'intentional',
        'historicalDrift',
        'defect',
        'openDecision',
      ]).toContain(fixture.classification);
    });
  });

  it('projects backup, zero, funded, partial-positive, and empty-section semantics', () => {
    const input = facts();
    input.wallet.backupStatus = 'required';
    expect(projectHomeSemanticModel({ facts: input }).shell.kind).toBe(
      'backupRequired',
    );

    input.wallet.backupStatus = 'complete';
    input.sources.portfolio = {
      kind: 'complete',
      result: { kind: 'empty' },
      coverageFingerprint: 'complete-zero',
    };
    expect(projectHomeSemanticModel({ facts: input }).shell).toMatchObject({
      kind: 'portfolio',
      presentation: { kind: 'zero' },
    });

    input.sources.portfolio = {
      kind: 'complete',
      result: {
        kind: 'success',
        data: {
          amount: '125',
          currency: 'USD',
          positiveEvidence: true,
          requiredSetRevision: 'required-1',
        },
      },
      coverageFingerprint: 'complete-funded',
    };
    expect(projectHomeSemanticModel({ facts: input }).shell).toMatchObject({
      kind: 'portfolio',
      presentation: { kind: 'funded', header: { authority: 'live' } },
    });

    input.sources.portfolio = {
      kind: 'partial',
      data: {
        amount: '15',
        currency: 'USD',
        positiveEvidence: true,
        requiredSetRevision: 'required-1',
      },
      coverageFingerprint: 'partial-positive',
    };
    expect(projectHomeSemanticModel({ facts: input }).shell).toMatchObject({
      kind: 'portfolio',
      presentation: { kind: 'fundedPendingTotal' },
    });

    input.sources.history = {
      kind: 'complete',
      result: { kind: 'empty' },
      coverageFingerprint: 'history-empty',
    };
    expect(projectHomeSemanticModel({ facts: input }).sections.history).toEqual(
      { kind: 'empty', emptyState: 'history' },
    );
  });

  it.each([
    {
      name: 'loading',
      mutate: (input: IHomeFacts) => {
        input.wallet.ready = false;
      },
      shellKind: 'loading',
    },
    {
      name: 'backup required',
      mutate: (input: IHomeFacts) => {
        input.wallet.backupStatus = 'required';
      },
      shellKind: 'backupRequired',
    },
    {
      name: 'missing network account',
      mutate: (input: IHomeFacts) => {
        input.wallet.hasNetworkAccount = false;
      },
      shellKind: 'missingNetworkAccount',
    },
  ])('keeps the $name special shell exclusive', ({ mutate, shellKind }) => {
    const input = facts();
    mutate(input);
    const model = projectHomeSemanticModel({ facts: input });
    expect(model.shell.kind).toBe(shellKind);
    expect(model.navigation).toEqual({ kind: 'hidden' });
    expect(
      Object.values(model.sections).every(
        (section) => section.kind === 'hidden',
      ),
    ).toBe(true);
  });

  it('updates capability tabs and selected fallback as one projection', () => {
    const input = facts();
    expect(
      projectHomeSemanticModel({ facts: input, selectedTabId: 'defi' })
        .navigation,
    ).toMatchObject({ kind: 'ready', selectedTabId: 'defi' });
    input.capabilityInputs.serverConfig.defi = false;
    expect(
      projectHomeSemanticModel({ facts: input, selectedTabId: 'defi' })
        .navigation,
    ).toMatchObject({ kind: 'ready', selectedTabId: 'portfolio' });
  });
});
