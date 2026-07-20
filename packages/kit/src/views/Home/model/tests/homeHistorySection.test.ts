import type { IAddressBadge } from '@onekeyhq/shared/types/address';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import { EDecodedTxStatus, type IDecodedTx } from '@onekeyhq/shared/types/tx';

import { adaptHomeLegacyHistorySection } from '../compatibility/homeLegacyHistorySectionAdapter';
import {
  buildHomeHistoryCoverage,
  projectHomeHistorySectionSource,
} from '../sections/history/homeHistorySectionPolicy';
import {
  HOME_HISTORY_SOURCE_REVISION,
  adaptHomeHistorySourceSnapshot,
  createHomeHistorySourceIdentity,
  getHomeHistoryRowIds,
} from '../sections/history/homeHistorySourceAdapter';
import { HomeSectionCoordinator } from '../sections/homeSectionCoordinator';

import type {
  IHomeHistoryLegacyPayload,
  IHomeHistorySourceParams,
} from '../sections/history/homeHistorySourceAdapter';

const owner = { scopeKey: 'account:account-a', sessionId: 'session-a' };
const params: IHomeHistorySourceParams = {
  accountId: 'account-a',
  accountOwnerId: 'account-owner-a',
  filterLowValue: true,
  filterScam: true,
  indexedAccountId: 'indexed-a',
  mergeDerive: false,
  networkId: 'evm--1',
  networkMode: 'singleNetwork',
  sourceCurrencyId: 'usd',
  walletId: 'wallet-a',
};

function createIdentity() {
  return createHomeHistorySourceIdentity({
    owner,
    params,
    producerInstanceId: 'producer-a',
  });
}

function decodedTx(id: string): IDecodedTx {
  return {
    accountId: params.accountId,
    actions: [],
    extraInfo: null,
    networkId: params.networkId,
    nonce: 1,
    owner: owner.scopeKey,
    signer: '0xsender',
    status: EDecodedTxStatus.Confirmed,
    txid: `0x${id}`,
  };
}

function historyTx(id: string): IAccountHistoryTx {
  return {
    id,
    decodedTx: decodedTx(id),
  };
}

function payload(id: string): IHomeHistoryLegacyPayload {
  const addressMap: Record<string, IAddressBadge> = {
    '0xsender': { label: 'Sender', type: 'default' },
  };
  return {
    addressMap,
    data: [historyTx(`history-${id}`)],
  };
}

describe('home History section authority', () => {
  it('builds a stable History source identity from owner source params and revision', () => {
    const first = createIdentity();
    const same = createIdentity();
    const changedParams = createHomeHistorySourceIdentity({
      owner,
      params: { ...params, networkId: 'evm--137' },
      producerInstanceId: 'producer-a',
    });
    const changedOwner = createHomeHistorySourceIdentity({
      owner: { scopeKey: 'account:account-b', sessionId: 'session-b' },
      params,
      producerInstanceId: 'producer-a',
    });

    expect(first).toEqual(same);
    expect(first).toMatchObject({
      owner,
      sectionId: 'history',
      sourceId: 'history',
      producerInstanceId: 'producer-a',
      sourceRevision: HOME_HISTORY_SOURCE_REVISION,
    });
    expect(first.sourceKeyIdentity).not.toBe(changedParams.sourceKeyIdentity);
    expect(changedOwner.sourceKeyIdentity).not.toBe(first.sourceKeyIdentity);
  });

  it('projects loading when authority is not ready or account scope mismatches', () => {
    const data = payload('old');
    const rowIds = getHomeHistoryRowIds(data);
    const completeEvidence = {
      kind: 'complete' as const,
      confirmedEmpty: false,
      coverageFingerprint: buildHomeHistoryCoverage({
        requestSeq: 1,
        rowCount: rowIds.length,
        source: 'singleNetwork',
      }),
      data,
      rowIds,
    };

    expect(
      projectHomeHistorySectionSource({
        authorityReady: false,
        scopeMatches: true,
        requestSeq: 1,
        evidence: completeEvidence,
      }),
    ).toEqual({ kind: 'loading', requestSeq: 1 });
    expect(
      projectHomeHistorySectionSource({
        authorityReady: true,
        scopeMatches: false,
        requestSeq: 2,
        evidence: {
          kind: 'confirmedCache',
          data,
          rowIds,
          refresh: 'idle',
        },
      }),
    ).toEqual({ kind: 'loading', requestSeq: 2 });
  });

  it('maps confirmed cache to a seed event and preserves the payload reference', () => {
    const identity = createIdentity();
    const data = payload('cached');
    const rowIds = getHomeHistoryRowIds(data);
    const snapshot = projectHomeHistorySectionSource({
      authorityReady: true,
      scopeMatches: true,
      requestSeq: 3,
      evidence: {
        kind: 'confirmedCache',
        data,
        rowIds,
        refresh: 'refreshing',
      },
    });
    const event = adaptHomeHistorySourceSnapshot({ identity, snapshot });

    expect(event).toMatchObject({
      ...identity,
      kind: 'seedConfirmed',
      requestSeq: 3,
      rowIds,
      refresh: 'refreshing',
    });
    if (event.kind === 'seedConfirmed') {
      expect(event.data).toBe(data);
    }

    const resolution = new HomeSectionCoordinator<IHomeHistoryLegacyPayload>(
      identity,
    ).dispatch(event);
    expect(resolution.semantic).toEqual({
      kind: 'ready',
      rowIds,
      freshness: 'confirmedCache',
      refresh: 'refreshing',
    });
    expect(resolution.authoritative).toEqual({
      kind: 'confirmedCache',
      data,
    });
  });

  it('uses real history transaction IDs as row IDs', () => {
    expect(
      getHomeHistoryRowIds({
        addressMap: {},
        data: [historyTx('tx-a'), historyTx('tx-b')],
      }),
    ).toEqual(['tx-a', 'tx-b']);
  });

  it('projects complete empty and complete success with row IDs', () => {
    const data = payload('live');
    const rowIds = getHomeHistoryRowIds(data);

    expect(
      projectHomeHistorySectionSource({
        authorityReady: true,
        scopeMatches: true,
        requestSeq: 4,
        evidence: {
          kind: 'complete',
          confirmedEmpty: true,
          coverageFingerprint: buildHomeHistoryCoverage({
            requestSeq: 4,
            rowCount: 0,
            source: 'allNetworks',
          }),
          data: undefined,
          rowIds: [],
        },
      }),
    ).toEqual({
      kind: 'complete',
      requestSeq: 4,
      coverageFingerprint: buildHomeHistoryCoverage({
        requestSeq: 4,
        rowCount: 0,
        source: 'allNetworks',
      }),
      result: { kind: 'empty' },
    });
    expect(
      projectHomeHistorySectionSource({
        authorityReady: true,
        scopeMatches: true,
        requestSeq: 5,
        evidence: {
          kind: 'complete',
          confirmedEmpty: false,
          coverageFingerprint: buildHomeHistoryCoverage({
            requestSeq: 5,
            rowCount: rowIds.length,
            source: 'singleNetwork',
          }),
          data,
          rowIds,
        },
      }),
    ).toEqual({
      kind: 'complete',
      requestSeq: 5,
      coverageFingerprint: buildHomeHistoryCoverage({
        requestSeq: 5,
        rowCount: rowIds.length,
        source: 'singleNetwork',
      }),
      result: {
        kind: 'success',
        data,
        rowIds,
      },
    });
  });

  it('downgrades incomplete complete evidence without data or row IDs to loading', () => {
    const data = payload('missing-rows');

    expect(
      projectHomeHistorySectionSource({
        authorityReady: true,
        scopeMatches: true,
        requestSeq: 6,
        evidence: {
          kind: 'complete',
          confirmedEmpty: false,
          coverageFingerprint: buildHomeHistoryCoverage({
            requestSeq: 6,
            rowCount: 1,
            source: 'singleNetwork',
          }),
          data: undefined,
          rowIds: ['history-missing-rows'],
        },
      }),
    ).toEqual({ kind: 'loading', requestSeq: 6 });
    expect(
      projectHomeHistorySectionSource({
        authorityReady: true,
        scopeMatches: true,
        requestSeq: 7,
        evidence: {
          kind: 'complete',
          confirmedEmpty: false,
          coverageFingerprint: buildHomeHistoryCoverage({
            requestSeq: 7,
            rowCount: 0,
            source: 'singleNetwork',
          }),
          data,
          rowIds: [],
        },
      }),
    ).toEqual({ kind: 'loading', requestSeq: 7 });
  });

  it('passes error kind through to the coordinator event and cold error semantic', () => {
    const identity = createIdentity();
    const snapshot = projectHomeHistorySectionSource({
      authorityReady: true,
      scopeMatches: true,
      requestSeq: 8,
      evidence: {
        kind: 'error',
        errorKind: 'runtimeUnavailable',
      },
    });
    const event = adaptHomeHistorySourceSnapshot({ identity, snapshot });

    expect(event).toMatchObject({
      ...identity,
      kind: 'error',
      requestSeq: 8,
      errorKind: 'runtimeUnavailable',
    });
    expect(
      new HomeSectionCoordinator<IHomeHistoryLegacyPayload>(identity).dispatch(
        event,
      ),
    ).toMatchObject({
      accepted: true,
      semantic: { kind: 'error', errorState: 'history' },
      authoritative: { kind: 'none' },
    });
  });

  it('keeps cached rows during loading partial and error refresh states', () => {
    const identity = createIdentity();
    const coordinator = new HomeSectionCoordinator<IHomeHistoryLegacyPayload>(
      identity,
    );
    const live = payload('live');
    const rowIds = getHomeHistoryRowIds(live);

    coordinator.dispatch(
      adaptHomeHistorySourceSnapshot({
        identity,
        snapshot: {
          kind: 'complete',
          requestSeq: 1,
          coverageFingerprint: buildHomeHistoryCoverage({
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
        adaptHomeHistorySourceSnapshot({
          identity,
          snapshot: { kind: 'loading', requestSeq: 2 },
        }),
      ),
    ).toMatchObject({
      semantic: {
        kind: 'ready',
        rowIds,
        freshness: 'confirmedCache',
        refresh: 'refreshing',
      },
      authoritative: { kind: 'confirmedCache', data: live },
    });
    expect(
      coordinator.dispatch(
        adaptHomeHistorySourceSnapshot({
          identity,
          snapshot: {
            kind: 'partial',
            requestSeq: 3,
            coverageFingerprint: 'history:singleNetwork:3:partial',
          },
        }),
      ),
    ).toMatchObject({
      semantic: {
        kind: 'ready',
        rowIds,
        freshness: 'confirmedCache',
        refresh: 'refreshing',
      },
    });
    expect(
      coordinator.dispatch(
        adaptHomeHistorySourceSnapshot({
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
        rowIds,
        freshness: 'confirmedCache',
        refresh: 'failed',
      },
      authoritative: { kind: 'confirmedCache', data: live },
    });
  });

  it('rejects stale terminal and owner responses without A-B-A contamination', () => {
    const identity = createIdentity();
    const coordinator = new HomeSectionCoordinator<IHomeHistoryLegacyPayload>(
      identity,
    );
    const current = payload('current');
    const rowIds = getHomeHistoryRowIds(current);

    coordinator.dispatch(
      adaptHomeHistorySourceSnapshot({
        identity,
        snapshot: {
          kind: 'complete',
          requestSeq: 2,
          coverageFingerprint: buildHomeHistoryCoverage({
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
        adaptHomeHistorySourceSnapshot({
          identity,
          snapshot: {
            kind: 'complete',
            requestSeq: 1,
            coverageFingerprint: buildHomeHistoryCoverage({
              requestSeq: 1,
              rowCount: 1,
              source: 'singleNetwork',
            }),
            result: {
              kind: 'success',
              data: payload('stale'),
              rowIds: ['history-stale'],
            },
          },
        }),
      ),
    ).toMatchObject({ accepted: false, staleReason: 'requestStale' });

    const changedOwnerIdentity = createHomeHistorySourceIdentity({
      owner: { scopeKey: 'account:account-b', sessionId: 'session-b' },
      params: { ...params, accountId: 'account-b' },
      producerInstanceId: 'producer-a',
    });
    expect(
      coordinator.dispatch(
        adaptHomeHistorySourceSnapshot({
          identity: changedOwnerIdentity,
          snapshot: {
            kind: 'complete',
            requestSeq: 3,
            coverageFingerprint: buildHomeHistoryCoverage({
              requestSeq: 3,
              rowCount: 1,
              source: 'singleNetwork',
            }),
            result: {
              kind: 'success',
              data: payload('wrong-owner'),
              rowIds: ['history-wrong-owner'],
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

  it('treats terminal events as final for their request phase', () => {
    const identity = createIdentity();
    const coordinator = new HomeSectionCoordinator<IHomeHistoryLegacyPayload>(
      identity,
    );
    const complete = payload('complete');
    const rowIds = getHomeHistoryRowIds(complete);

    expect(
      coordinator.dispatch(
        adaptHomeHistorySourceSnapshot({
          identity,
          snapshot: {
            kind: 'complete',
            requestSeq: 9,
            coverageFingerprint: buildHomeHistoryCoverage({
              requestSeq: 9,
              rowCount: rowIds.length,
              source: 'singleNetwork',
            }),
            result: {
              kind: 'success',
              data: complete,
              rowIds,
            },
          },
        }),
      ),
    ).toMatchObject({ accepted: true });
    expect(
      coordinator.dispatch(
        adaptHomeHistorySourceSnapshot({
          identity,
          snapshot: {
            kind: 'error',
            requestSeq: 9,
            errorKind: 'transport',
          },
        }),
      ),
    ).toMatchObject({ accepted: false, staleReason: 'requestStale' });
    expect(coordinator.getSnapshot().authoritative).toEqual({
      kind: 'live',
      data: complete,
    });
  });

  it('adapts legacy semantic loading empty error and ready payload reference', () => {
    const identity = createIdentity();
    const coordinator = new HomeSectionCoordinator<IHomeHistoryLegacyPayload>(
      identity,
    );

    expect(adaptHomeLegacyHistorySection({})).toEqual({
      kind: 'loading',
      viewState: 'loading',
    });
    expect(
      adaptHomeLegacyHistorySection({
        resolution: coordinator.dispatch(
          adaptHomeHistorySourceSnapshot({
            identity,
            snapshot: {
              kind: 'complete',
              requestSeq: 1,
              coverageFingerprint: buildHomeHistoryCoverage({
                requestSeq: 1,
                rowCount: 0,
                source: 'singleNetwork',
              }),
              result: { kind: 'empty' },
            },
          }),
        ),
      }),
    ).toEqual({ kind: 'empty', viewState: 'empty' });

    const errorCoordinator =
      new HomeSectionCoordinator<IHomeHistoryLegacyPayload>(identity);
    expect(
      adaptHomeLegacyHistorySection({
        resolution: errorCoordinator.dispatch(
          adaptHomeHistorySourceSnapshot({
            identity,
            snapshot: {
              kind: 'error',
              requestSeq: 1,
              errorKind: 'transport',
            },
          }),
        ),
      }),
    ).toEqual({ kind: 'error', refresh: 'failed', viewState: 'empty' });

    const ready = payload('ready');
    const readyRows = getHomeHistoryRowIds(ready);
    const readyState = adaptHomeLegacyHistorySection({
      resolution: coordinator.dispatch(
        adaptHomeHistorySourceSnapshot({
          identity,
          snapshot: {
            kind: 'complete',
            requestSeq: 2,
            coverageFingerprint: buildHomeHistoryCoverage({
              requestSeq: 2,
              rowCount: readyRows.length,
              source: 'singleNetwork',
            }),
            result: { kind: 'success', data: ready, rowIds: readyRows },
          },
        }),
      ),
    });

    expect(readyState).toMatchObject({
      kind: 'ready',
      freshness: 'live',
      refresh: 'idle',
      viewState: 'ready',
    });
    if (readyState.kind === 'ready') {
      expect(readyState.payload).toBe(ready);
    }
  });
});
