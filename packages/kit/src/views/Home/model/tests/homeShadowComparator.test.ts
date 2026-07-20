import {
  compareHomeSemanticShadow,
  createHomeShadowTrace,
} from '../semantic/homeShadowComparator';

import type { IHomeSemanticModel } from '../semantic/homeSemanticTypes';

function model(): IHomeSemanticModel {
  return {
    owner: {
      scopeKey: 'sensitive-wallet-account-scope',
      sessionId: 'session-secret',
    },
    shell: { kind: 'loading' },
    navigation: { kind: 'hidden' },
    sections: {
      portfolio: { kind: 'loading', placeholder: 'portfolio' },
      perps: { kind: 'hidden', reason: 'notApplicable' },
      defi: { kind: 'hidden', reason: 'notApplicable' },
      nft: { kind: 'hidden', reason: 'notApplicable' },
      history: { kind: 'hidden', reason: 'notApplicable' },
      market: { kind: 'hidden', reason: 'notApplicable' },
    },
  };
}

describe('Home shadow comparator', () => {
  it('uses the exact comparison status boundary', () => {
    const shadow = model();
    expect(compareHomeSemanticShadow({ shadow, current: model() }).status).toBe(
      'equal',
    );
    const current = model();
    current.shell = { kind: 'backupRequired', commandId: 'backupWallet' };
    expect(compareHomeSemanticShadow({ shadow, current })).toMatchObject({
      status: 'unclassifiedDifference',
      mismatchReasons: ['shellKindMismatch'],
    });
    expect(
      compareHomeSemanticShadow({
        shadow,
        current,
        classification: 'historicalDrift',
      }),
    ).toMatchObject({
      status: 'classifiedDifference',
      classification: 'historicalDrift',
    });
    expect(
      compareHomeSemanticShadow({
        shadow,
        notComparableReason: 'runtimeNotReady',
      }),
    ).toMatchObject({
      status: 'notComparable',
      notComparableReason: 'runtimeNotReady',
    });
  });

  it('reports typed navigation and section mismatch reasons', () => {
    const shadow = model();
    shadow.navigation = {
      kind: 'ready',
      tabs: ['portfolio', 'history'],
      selectedTabId: 'portfolio',
    };
    shadow.sections = {
      ...shadow.sections,
      history: {
        kind: 'ready',
        rowIds: ['row-a'],
        freshness: 'live',
        refresh: 'idle',
      },
    };
    const current = model();
    current.navigation = {
      kind: 'ready',
      tabs: ['portfolio'],
      selectedTabId: 'portfolio',
    };
    current.sections = {
      ...current.sections,
      history: {
        kind: 'ready',
        rowIds: ['row-b'],
        freshness: 'confirmedCache',
        refresh: 'failed',
      },
    };
    expect(
      compareHomeSemanticShadow({ shadow, current }).mismatchReasons,
    ).toEqual([
      'tabSetOrOrderMismatch',
      'sectionRowsMismatch',
      'sectionFreshnessMismatch',
    ]);
  });

  it('redacts sensitive owner/session and never serializes semantic payloads', () => {
    const comparison = compareHomeSemanticShadow({
      shadow: model(),
      notComparableReason: 'currentObservationUnavailable',
      vectorId: 'fundedAllNetworks',
    });
    const trace = createHomeShadowTrace({
      comparison,
      durationMs: 3,
      ownerScopeKey: 'sensitive-wallet-account-scope',
      sessionId: 'session-secret',
      sourceId: 'portfolio',
    });
    const serialized = JSON.stringify(trace);
    expect(serialized).not.toContain('sensitive-wallet-account-scope');
    expect(serialized).not.toContain('session-secret');
    expect(serialized).not.toContain('balance');
    expect(trace.ownerHash).toMatch(/^[a-f0-9]{16}$/);
  });
});
