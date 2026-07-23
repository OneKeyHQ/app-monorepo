import { ENFTType, type IAccountNFT } from '@onekeyhq/shared/types/nft';

import { HomeSectionCoordinator } from '../sections/homeSectionCoordinator';
import {
  buildHomeNFTCoverage,
  projectHomeNFTSectionSource,
} from '../sections/nft/homeNFTSectionPolicy';
import {
  HOME_NFT_SOURCE_REVISION,
  adaptHomeNFTSourceSnapshot,
  createHomeNFTSourceIdentity,
  getHomeNFTItemRowId,
  getHomeNFTRowIds,
} from '../sections/nft/homeNFTSourceAdapter';

import type {
  IHomeNFTLegacyPayload,
  IHomeNFTSourceParams,
} from '../sections/nft/homeNFTSourceAdapter';

const owner = { scopeKey: 'account:account-a', sessionId: 'session-a' };
const params: IHomeNFTSourceParams = {
  accountId: 'account-a',
  indexedAccountId: 'indexed-a',
  networkId: 'evm--1',
  networkMode: 'singleNetwork',
  walletId: 'wallet-a',
};

function createIdentity() {
  return createHomeNFTSourceIdentity({
    owner,
    params,
    producerInstanceId: 'producer-a',
  });
}

function nft({
  collectionAddress,
  itemId,
  networkId = 'evm--1',
}: {
  collectionAddress: string;
  itemId: string;
  networkId?: string;
}): IAccountNFT {
  return {
    amount: '1',
    collectionAddress,
    collectionName: `Collection ${collectionAddress}`,
    collectionSymbol: 'NFT',
    collectionType: ENFTType.ERC721,
    itemId,
    networkId,
    accountId: owner.scopeKey,
  };
}

function payload(id: string): IHomeNFTLegacyPayload {
  return {
    data: [
      nft({
        collectionAddress: `0x${id}`,
        itemId: '1',
      }),
    ],
  };
}

describe('home NFT section authority', () => {
  it('builds a stable NFT source identity from owner source params and revision', () => {
    const first = createIdentity();
    const same = createIdentity();
    const changedParams = createHomeNFTSourceIdentity({
      owner,
      params: { ...params, networkId: 'evm--137' },
      producerInstanceId: 'producer-a',
    });
    const changedOwner = createHomeNFTSourceIdentity({
      owner: { scopeKey: 'account:account-b', sessionId: 'session-b' },
      params,
      producerInstanceId: 'producer-a',
    });

    expect(first).toEqual(same);
    expect(first).toMatchObject({
      owner,
      sectionId: 'nft',
      sourceId: 'nft',
      producerInstanceId: 'producer-a',
      sourceRevision: HOME_NFT_SOURCE_REVISION,
    });
    expect(first.sourceKeyIdentity).not.toBe(changedParams.sourceKeyIdentity);
    expect(changedOwner.sourceKeyIdentity).not.toBe(first.sourceKeyIdentity);
  });

  it('projects loading when authority is not ready or account scope mismatches', () => {
    const data = payload('old');
    const rowIds = getHomeNFTRowIds(data);
    const completeEvidence = {
      kind: 'complete' as const,
      confirmedEmpty: false,
      coverageFingerprint: buildHomeNFTCoverage({
        requestSeq: 1,
        rowCount: rowIds.length,
        source: 'singleNetwork',
      }),
      data,
      rowIds,
    };

    expect(
      projectHomeNFTSectionSource({
        authorityReady: false,
        scopeMatches: true,
        requestSeq: 1,
        evidence: completeEvidence,
      }),
    ).toEqual({ kind: 'loading', requestSeq: 1 });
    expect(
      projectHomeNFTSectionSource({
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
    const rowIds = getHomeNFTRowIds(data);
    const snapshot = projectHomeNFTSectionSource({
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
    const event = adaptHomeNFTSourceSnapshot({ identity, snapshot });

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

    const resolution = new HomeSectionCoordinator<IHomeNFTLegacyPayload>(
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

  it('uses real NFT row IDs from network collection and item', () => {
    const first = nft({
      collectionAddress: '0xabc',
      itemId: '42',
      networkId: 'evm--1',
    });
    const second = nft({
      collectionAddress: '0xabc',
      itemId: '42',
      networkId: 'evm--137',
    });

    expect(getHomeNFTItemRowId(first)).toBe('evm--1:0xabc:42');
    expect(getHomeNFTItemRowId(second)).toBe('evm--137:0xabc:42');
    expect(getHomeNFTRowIds({ data: [first, second] })).toEqual([
      'evm--1:0xabc:42',
      'evm--137:0xabc:42',
    ]);
  });

  it('projects complete empty and complete success with row IDs', () => {
    const data = payload('live');
    const rowIds = getHomeNFTRowIds(data);

    expect(
      projectHomeNFTSectionSource({
        authorityReady: true,
        scopeMatches: true,
        requestSeq: 4,
        evidence: {
          kind: 'complete',
          confirmedEmpty: true,
          coverageFingerprint: buildHomeNFTCoverage({
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
      coverageFingerprint: buildHomeNFTCoverage({
        requestSeq: 4,
        rowCount: 0,
        source: 'allNetworks',
      }),
      result: { kind: 'empty' },
    });
    expect(
      projectHomeNFTSectionSource({
        authorityReady: true,
        scopeMatches: true,
        requestSeq: 5,
        evidence: {
          kind: 'complete',
          confirmedEmpty: false,
          coverageFingerprint: buildHomeNFTCoverage({
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
      coverageFingerprint: buildHomeNFTCoverage({
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
      projectHomeNFTSectionSource({
        authorityReady: true,
        scopeMatches: true,
        requestSeq: 6,
        evidence: {
          kind: 'complete',
          confirmedEmpty: false,
          coverageFingerprint: buildHomeNFTCoverage({
            requestSeq: 6,
            rowCount: 1,
            source: 'singleNetwork',
          }),
          data: undefined,
          rowIds: ['evm--1:0xmissing-rows:1'],
        },
      }),
    ).toEqual({ kind: 'loading', requestSeq: 6 });
    expect(
      projectHomeNFTSectionSource({
        authorityReady: true,
        scopeMatches: true,
        requestSeq: 7,
        evidence: {
          kind: 'complete',
          confirmedEmpty: false,
          coverageFingerprint: buildHomeNFTCoverage({
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
    const snapshot = projectHomeNFTSectionSource({
      authorityReady: true,
      scopeMatches: true,
      requestSeq: 8,
      evidence: {
        kind: 'error',
        errorKind: 'runtimeUnavailable',
      },
    });
    const event = adaptHomeNFTSourceSnapshot({ identity, snapshot });

    expect(event).toMatchObject({
      ...identity,
      kind: 'error',
      requestSeq: 8,
      errorKind: 'runtimeUnavailable',
    });
    expect(
      new HomeSectionCoordinator<IHomeNFTLegacyPayload>(identity).dispatch(
        event,
      ),
    ).toMatchObject({
      accepted: true,
      semantic: { kind: 'error', errorState: 'nft' },
      authoritative: { kind: 'none' },
    });
  });

  it('keeps cached rows during loading partial and error refresh states', () => {
    const identity = createIdentity();
    const coordinator = new HomeSectionCoordinator<IHomeNFTLegacyPayload>(
      identity,
    );
    const live = payload('live');
    const rowIds = getHomeNFTRowIds(live);

    coordinator.dispatch(
      adaptHomeNFTSourceSnapshot({
        identity,
        snapshot: {
          kind: 'complete',
          requestSeq: 1,
          coverageFingerprint: buildHomeNFTCoverage({
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
        adaptHomeNFTSourceSnapshot({
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
        adaptHomeNFTSourceSnapshot({
          identity,
          snapshot: {
            kind: 'partial',
            requestSeq: 3,
            coverageFingerprint: 'nft:singleNetwork:3:partial',
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
        adaptHomeNFTSourceSnapshot({
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
    const coordinator = new HomeSectionCoordinator<IHomeNFTLegacyPayload>(
      identity,
    );
    const current = payload('current');
    const rowIds = getHomeNFTRowIds(current);

    coordinator.dispatch(
      adaptHomeNFTSourceSnapshot({
        identity,
        snapshot: {
          kind: 'complete',
          requestSeq: 2,
          coverageFingerprint: buildHomeNFTCoverage({
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
        adaptHomeNFTSourceSnapshot({
          identity,
          snapshot: {
            kind: 'complete',
            requestSeq: 1,
            coverageFingerprint: buildHomeNFTCoverage({
              requestSeq: 1,
              rowCount: 1,
              source: 'singleNetwork',
            }),
            result: {
              kind: 'success',
              data: payload('stale'),
              rowIds: ['evm--1:0xstale:1'],
            },
          },
        }),
      ),
    ).toMatchObject({ accepted: false, staleReason: 'requestStale' });

    const changedOwnerIdentity = createHomeNFTSourceIdentity({
      owner: { scopeKey: 'account:account-b', sessionId: 'session-b' },
      params: { ...params, accountId: 'account-b' },
      producerInstanceId: 'producer-a',
    });
    expect(
      coordinator.dispatch(
        adaptHomeNFTSourceSnapshot({
          identity: changedOwnerIdentity,
          snapshot: {
            kind: 'complete',
            requestSeq: 3,
            coverageFingerprint: buildHomeNFTCoverage({
              requestSeq: 3,
              rowCount: 1,
              source: 'singleNetwork',
            }),
            result: {
              kind: 'success',
              data: payload('wrong-owner'),
              rowIds: ['evm--1:0xwrong-owner:1'],
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
    const coordinator = new HomeSectionCoordinator<IHomeNFTLegacyPayload>(
      identity,
    );
    const complete = payload('complete');
    const rowIds = getHomeNFTRowIds(complete);

    expect(
      coordinator.dispatch(
        adaptHomeNFTSourceSnapshot({
          identity,
          snapshot: {
            kind: 'complete',
            requestSeq: 9,
            coverageFingerprint: buildHomeNFTCoverage({
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
        adaptHomeNFTSourceSnapshot({
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
});
