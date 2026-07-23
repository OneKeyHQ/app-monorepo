import type {
  IDeFiProtocol,
  IProtocolSummary,
} from '@onekeyhq/shared/types/defi';

import {
  buildHomeDeFiCoverage,
  projectHomeDeFiSectionSource,
} from '../sections/defi/homeDeFiSectionPolicy';
import {
  HOME_DEFI_SOURCE_REVISION,
  adaptHomeDeFiSourceSnapshot,
  createHomeDeFiSourceIdentity,
  getHomeDeFiProtocolRowIds,
} from '../sections/defi/homeDeFiSourceAdapter';
import { HomeSectionCoordinator } from '../sections/homeSectionCoordinator';

import type {
  IHomeDeFiLegacyPayload,
  IHomeDeFiSourceParams,
} from '../sections/defi/homeDeFiSourceAdapter';

const owner = { scopeKey: 'account:account-a', sessionId: 'session-a' };
const params: IHomeDeFiSourceParams = {
  accountId: 'account-a',
  indexedAccountId: 'indexed-a',
  networkId: 'evm--1',
  networkMode: 'singleNetwork',
  sourceCurrencyId: 'usd',
  targetCurrencyId: 'usd',
  walletId: 'wallet-a',
};

function createIdentity() {
  return createHomeDeFiSourceIdentity({
    owner,
    params,
    producerInstanceId: 'producer-a',
  });
}

function protocol({
  networkId = 'evm--1',
  protocolId,
}: {
  networkId?: string;
  protocolId: string;
}): IDeFiProtocol {
  return {
    categories: [],
    networkId,
    owner: '0xowner',
    positions: [],
    protocol: protocolId,
  };
}

function summary(protocolId: string): IProtocolSummary {
  return {
    netWorth: 1,
    networkIds: ['evm--1'],
    positionCount: 1,
    positionIndices: [],
    protocol: protocolId,
    protocolLogo: '',
    protocolName: protocolId,
    protocolUrl: '',
    totalDebt: 0,
    totalReward: 0,
    totalValue: 1,
  };
}

function payload(id: string): IHomeDeFiLegacyPayload {
  const item = protocol({ protocolId: id });
  const key = `${item.networkId}-${item.protocol}`;
  return {
    currency: 'usd',
    overview: {
      totalValue: 1,
      totalDebt: 0,
      totalReward: 0,
      netWorth: 1,
    },
    protocolMap: { [key]: summary(id) },
    protocols: [item],
    supportedActions: [],
  };
}

describe('home DeFi section authority', () => {
  it('builds a stable DeFi source identity from owner source params and revision', () => {
    const first = createIdentity();
    const same = createIdentity();
    const changedParams = createHomeDeFiSourceIdentity({
      owner,
      params: { ...params, networkId: 'evm--137' },
      producerInstanceId: 'producer-a',
    });
    const changedOwner = createHomeDeFiSourceIdentity({
      owner: { scopeKey: 'account:account-b', sessionId: 'session-b' },
      params,
      producerInstanceId: 'producer-a',
    });

    expect(first).toEqual(same);
    expect(first).toMatchObject({
      owner,
      sectionId: 'defi',
      sourceId: 'defi',
      producerInstanceId: 'producer-a',
      sourceRevision: HOME_DEFI_SOURCE_REVISION,
    });
    expect(first.sourceKeyIdentity).not.toBe(changedParams.sourceKeyIdentity);
    expect(changedOwner.sourceKeyIdentity).not.toBe(first.sourceKeyIdentity);
  });

  it('projects loading until authority and scope are exact', () => {
    const data = payload('aave');
    const rowIds = getHomeDeFiProtocolRowIds(data);
    const evidence = {
      kind: 'complete' as const,
      confirmedEmpty: false,
      coverageFingerprint: buildHomeDeFiCoverage({
        requestSeq: 1,
        rowCount: rowIds.length,
        source: 'singleNetwork',
      }),
      data,
      rowIds,
    };

    expect(
      projectHomeDeFiSectionSource({
        authorityReady: false,
        scopeMatches: true,
        requestSeq: 1,
        evidence,
      }),
    ).toEqual({ kind: 'loading', requestSeq: 1 });
    expect(
      projectHomeDeFiSectionSource({
        authorityReady: true,
        scopeMatches: false,
        requestSeq: 2,
        evidence,
      }),
    ).toEqual({ kind: 'loading', requestSeq: 2 });
  });

  it('requires authoritative payload rows for ready and preserves exact row ids', () => {
    const data = payload('compound');
    const rowIds = getHomeDeFiProtocolRowIds(data);

    expect(rowIds).toEqual(['evm--1-compound']);
    expect(
      projectHomeDeFiSectionSource({
        authorityReady: true,
        scopeMatches: true,
        requestSeq: 3,
        evidence: {
          kind: 'complete',
          confirmedEmpty: false,
          coverageFingerprint: buildHomeDeFiCoverage({
            requestSeq: 3,
            rowCount: rowIds.length,
            source: 'singleNetwork',
          }),
          data,
          rowIds,
        },
      }),
    ).toEqual({
      kind: 'complete',
      requestSeq: 3,
      coverageFingerprint: buildHomeDeFiCoverage({
        requestSeq: 3,
        rowCount: rowIds.length,
        source: 'singleNetwork',
      }),
      result: { kind: 'success', data, rowIds },
    });
    expect(
      projectHomeDeFiSectionSource({
        authorityReady: true,
        scopeMatches: true,
        requestSeq: 4,
        evidence: {
          kind: 'complete',
          confirmedEmpty: false,
          coverageFingerprint: buildHomeDeFiCoverage({
            requestSeq: 4,
            rowCount: 0,
            source: 'singleNetwork',
          }),
          data,
          rowIds: [],
        },
      }),
    ).toEqual({ kind: 'loading', requestSeq: 4 });
  });

  it('maps confirmed empty only from terminal empty evidence', () => {
    expect(
      projectHomeDeFiSectionSource({
        authorityReady: true,
        scopeMatches: true,
        requestSeq: 5,
        evidence: {
          kind: 'complete',
          confirmedEmpty: true,
          coverageFingerprint: buildHomeDeFiCoverage({
            requestSeq: 5,
            rowCount: 0,
            source: 'allNetworks',
          }),
          data: undefined,
          rowIds: [],
        },
      }),
    ).toEqual({
      kind: 'complete',
      requestSeq: 5,
      coverageFingerprint: buildHomeDeFiCoverage({
        requestSeq: 5,
        rowCount: 0,
        source: 'allNetworks',
      }),
      result: { kind: 'empty' },
    });
  });

  it('keeps cached DeFi rows through loading partial and error refresh states', () => {
    const identity = createIdentity();
    const coordinator = new HomeSectionCoordinator<IHomeDeFiLegacyPayload>(
      identity,
    );
    const live = payload('curve');
    const rowIds = getHomeDeFiProtocolRowIds(live);

    coordinator.dispatch(
      adaptHomeDeFiSourceSnapshot({
        identity,
        snapshot: {
          kind: 'complete',
          requestSeq: 1,
          coverageFingerprint: buildHomeDeFiCoverage({
            requestSeq: 1,
            rowCount: rowIds.length,
            source: 'singleNetwork',
          }),
          result: { kind: 'success', data: live, rowIds },
        },
      }),
    );
    expect(
      coordinator.dispatch(
        adaptHomeDeFiSourceSnapshot({
          identity,
          snapshot: { kind: 'loading', requestSeq: 2 },
        }),
      ),
    ).toMatchObject({
      semantic: {
        kind: 'ready',
        freshness: 'confirmedCache',
        refresh: 'refreshing',
      },
      authoritative: { kind: 'confirmedCache', data: live },
    });
    expect(
      coordinator.dispatch(
        adaptHomeDeFiSourceSnapshot({
          identity,
          snapshot: {
            kind: 'partial',
            requestSeq: 3,
            coverageFingerprint: 'defi:singleNetwork:3:partial',
            data: live,
          },
        }),
      ),
    ).toMatchObject({
      semantic: {
        kind: 'ready',
        freshness: 'confirmedCache',
        refresh: 'refreshing',
      },
    });
    expect(
      coordinator.dispatch(
        adaptHomeDeFiSourceSnapshot({
          identity,
          snapshot: {
            kind: 'error',
            requestSeq: 4,
            errorKind: 'transport',
          },
        }),
      ),
    ).toMatchObject({
      semantic: {
        kind: 'ready',
        freshness: 'confirmedCache',
        refresh: 'failed',
      },
      authoritative: { kind: 'confirmedCache', data: live },
    });
  });

  it('rejects stale owner and request responses without cross-owner contamination', () => {
    const identity = createIdentity();
    const coordinator = new HomeSectionCoordinator<IHomeDeFiLegacyPayload>(
      identity,
    );
    const current = payload('current');
    const rowIds = getHomeDeFiProtocolRowIds(current);

    coordinator.dispatch(
      adaptHomeDeFiSourceSnapshot({
        identity,
        snapshot: {
          kind: 'complete',
          requestSeq: 2,
          coverageFingerprint: buildHomeDeFiCoverage({
            requestSeq: 2,
            rowCount: rowIds.length,
            source: 'singleNetwork',
          }),
          result: { kind: 'success', data: current, rowIds },
        },
      }),
    );
    expect(
      coordinator.dispatch(
        adaptHomeDeFiSourceSnapshot({
          identity,
          snapshot: {
            kind: 'error',
            requestSeq: 1,
            errorKind: 'transport',
          },
        }),
      ),
    ).toMatchObject({ accepted: false, staleReason: 'requestStale' });

    const changedOwnerIdentity = createHomeDeFiSourceIdentity({
      owner: { scopeKey: 'account:account-b', sessionId: 'session-b' },
      params: { ...params, accountId: 'account-b' },
      producerInstanceId: 'producer-a',
    });
    expect(
      coordinator.dispatch(
        adaptHomeDeFiSourceSnapshot({
          identity: changedOwnerIdentity,
          snapshot: {
            kind: 'complete',
            requestSeq: 3,
            coverageFingerprint: buildHomeDeFiCoverage({
              requestSeq: 3,
              rowCount: 1,
              source: 'singleNetwork',
            }),
            result: {
              kind: 'success',
              data: payload('wrong-owner'),
              rowIds: ['evm--1-wrong-owner'],
            },
          },
        }),
      ),
    ).toMatchObject({ accepted: false, staleReason: 'ownerMismatch' });
    expect(coordinator.getSnapshot().authoritative).toEqual({
      kind: 'live',
      data: current,
    });
  });
});
