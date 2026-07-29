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
        evidence: completeEvidence,
      }),
    ).toEqual({ kind: 'loading' });
    expect(
      projectHomeNFTSectionSource({
        authorityReady: true,
        scopeMatches: false,
        evidence: {
          kind: 'confirmedCache',
          data,
          rowIds,
          refresh: 'idle',
        },
      }),
    ).toEqual({ kind: 'loading' });
  });

  it('maps confirmed cache to a seed event and preserves the payload reference', () => {
    const identity = createIdentity();
    const data = payload('cached');
    const rowIds = getHomeNFTRowIds(data);
    const snapshot = projectHomeNFTSectionSource({
      authorityReady: true,
      scopeMatches: true,
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
      priority: 0,
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
        evidence: {
          kind: 'complete',
          confirmedEmpty: true,
          coverageFingerprint: buildHomeNFTCoverage({
            rowCount: 0,
            source: 'allNetworks',
          }),
          data: undefined,
          rowIds: [],
        },
      }),
    ).toEqual({
      kind: 'complete',
      coverageFingerprint: buildHomeNFTCoverage({
        rowCount: 0,
        source: 'allNetworks',
      }),
      result: { kind: 'empty' },
    });
    expect(
      projectHomeNFTSectionSource({
        authorityReady: true,
        scopeMatches: true,
        evidence: {
          kind: 'complete',
          confirmedEmpty: false,
          coverageFingerprint: buildHomeNFTCoverage({
            rowCount: rowIds.length,
            source: 'singleNetwork',
          }),
          data,
          rowIds,
        },
      }),
    ).toEqual({
      kind: 'complete',
      coverageFingerprint: buildHomeNFTCoverage({
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
        evidence: {
          kind: 'complete',
          confirmedEmpty: false,
          coverageFingerprint: buildHomeNFTCoverage({
            rowCount: 1,
            source: 'singleNetwork',
          }),
          data: undefined,
          rowIds: ['evm--1:0xmissing-rows:1'],
        },
      }),
    ).toEqual({ kind: 'loading' });
    expect(
      projectHomeNFTSectionSource({
        authorityReady: true,
        scopeMatches: true,
        evidence: {
          kind: 'complete',
          confirmedEmpty: false,
          coverageFingerprint: buildHomeNFTCoverage({
            rowCount: 0,
            source: 'singleNetwork',
          }),
          data,
          rowIds: [],
        },
      }),
    ).toEqual({ kind: 'loading' });
  });

  it('keeps network rows during refresh states', () => {
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
          coverageFingerprint: buildHomeNFTCoverage({
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
          snapshot: { kind: 'loading' },
        }),
      ),
    ).toMatchObject({
      semantic: {
        kind: 'ready',
        rowIds,
        priority: 1,
        refresh: 'refreshing',
      },
      authoritative: { kind: 'live', data: live },
    });
    expect(
      coordinator.dispatch(
        adaptHomeNFTSourceSnapshot({
          identity,
          snapshot: {
            kind: 'partial',
            coverageFingerprint: 'nft:singleNetwork:partial',
          },
        }),
      ),
    ).toMatchObject({
      semantic: {
        kind: 'ready',
        rowIds,
        priority: 1,
        refresh: 'refreshing',
      },
    });
    expect(
      coordinator.dispatch(
        adaptHomeNFTSourceSnapshot({
          identity,
          snapshot: {
            kind: 'error',
            errorKind: 'transport',
          },
        }),
      ),
    ).toMatchObject({
      semantic: {
        kind: 'ready',
        rowIds,
        priority: 1,
        refresh: 'failed',
      },
      authoritative: { kind: 'live', data: live },
    });
  });

  it('accepts later same-source responses but rejects a different owner', () => {
    const identity = createIdentity();
    const coordinator = new HomeSectionCoordinator<IHomeNFTLegacyPayload>(
      identity,
    );
    const current = payload('current');
    const later = payload('later');
    const rowIds = getHomeNFTRowIds(current);

    coordinator.dispatch(
      adaptHomeNFTSourceSnapshot({
        identity,
        snapshot: {
          kind: 'complete',
          coverageFingerprint: buildHomeNFTCoverage({
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
            coverageFingerprint: buildHomeNFTCoverage({
              rowCount: 1,
              source: 'singleNetwork',
            }),
            result: {
              kind: 'success',
              data: later,
              rowIds: ['evm--1:0xstale:1'],
            },
          },
        }),
      ),
    ).toMatchObject({ accepted: true });

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
            coverageFingerprint: buildHomeNFTCoverage({
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
      data: later,
    });
  });
});
