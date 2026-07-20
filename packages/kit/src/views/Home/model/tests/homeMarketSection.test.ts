import { adaptHomeLegacyMarketSection } from '../compatibility/homeLegacyMarketSectionAdapter';
import { HomeSectionCoordinator } from '../sections/homeSectionCoordinator';
import {
  buildHomeMarketCoverage,
  buildHomeMarketPartialCoverage,
  projectHomeMarketSectionSource,
} from '../sections/market/homeMarketSectionPolicy';
import {
  HOME_MARKET_SOURCE_REVISION,
  adaptHomeMarketSourceSnapshot,
  createHomeMarketSourceIdentity,
  getHomeMarketRowIds,
  getHomeMarketTokenRowId,
} from '../sections/market/homeMarketSourceAdapter';

import type {
  IHomeMarketLegacyPayload,
  IHomeMarketSourceParams,
  IHomeMarketTokenRow,
} from '../sections/market/homeMarketSourceAdapter';

const owner = { scopeKey: 'native-home-market', sessionId: 'session-a' };
const params: IHomeMarketSourceParams = {
  favoriteMode: 'favorites',
  homeTabConfigKey: 'tabs:favorites|trending|stocks',
  minLiquidity: 100,
  perpsHotEnabled: false,
  prefetchCategoryIds: ['trending', 'stocks'],
  resolvedCategoryId: 'trending',
  selectedCategoryId: 'trending',
  watchListContentKey: 'evm--1:0xabc:1000',
};

function createIdentity(nextParams = params) {
  return createHomeMarketSourceIdentity({
    owner,
    params: nextParams,
    producerInstanceId: 'producer-a',
  });
}

function spotToken({
  chainId = 'evm--1',
  contractAddress = '0xabc',
  isNative = false,
}: {
  chainId?: string;
  contractAddress?: string;
  isNative?: boolean;
} = {}): IHomeMarketTokenRow {
  return { chainId, contractAddress, isNative };
}

function payload(
  rows: readonly IHomeMarketTokenRow[],
): IHomeMarketLegacyPayload<IHomeMarketTokenRow> {
  return {
    favoriteMode: params.favoriteMode,
    prefetchCategoryIds: params.prefetchCategoryIds,
    prefetchedRowsByRequestKey: {},
    resolvedCategoryId: params.resolvedCategoryId,
    rows,
    selectedCategoryId: params.selectedCategoryId,
    totalFavorites: 1,
    watchListContentKey: params.watchListContentKey,
  };
}

describe('home Market section authority', () => {
  it('builds source identity from category, prefetch, liquidity, watchlist, tabs, perps config, and revision', () => {
    const first = createIdentity();
    const changedCategory = createIdentity({
      ...params,
      resolvedCategoryId: 'stocks',
      selectedCategoryId: 'stocks',
    });
    const changedPrefetch = createIdentity({
      ...params,
      prefetchCategoryIds: ['stocks', 'trending'],
    });
    const changedWatchlist = createIdentity({
      ...params,
      watchListContentKey: 'perps:BTC',
    });
    const changedHomeTab = createIdentity({
      ...params,
      homeTabConfigKey: 'tabs:favorites|trending|stocks|perps',
    });
    const changedPerpsHot = createIdentity({
      ...params,
      perpsHotEnabled: true,
    });

    expect(first).toMatchObject({
      owner,
      sectionId: 'market',
      sourceId: 'market',
      producerInstanceId: 'producer-a',
      sourceRevision: HOME_MARKET_SOURCE_REVISION,
    });
    expect(first.sourceKeyIdentity).not.toBe(changedCategory.sourceKeyIdentity);
    expect(first.sourceKeyIdentity).not.toBe(changedPrefetch.sourceKeyIdentity);
    expect(first.sourceKeyIdentity).not.toBe(
      changedWatchlist.sourceKeyIdentity,
    );
    expect(first.sourceKeyIdentity).not.toBe(changedHomeTab.sourceKeyIdentity);
    expect(first.sourceKeyIdentity).not.toBe(changedPerpsHot.sourceKeyIdentity);
  });

  it('uses real spot native/contract and perps coin row IDs', () => {
    expect(getHomeMarketTokenRowId(spotToken())).toBe('spot:evm--1:0xabc');
    expect(
      getHomeMarketTokenRowId(
        spotToken({ chainId: 'btc--0', contractAddress: '', isNative: true }),
      ),
    ).toBe('spot:btc--0:native');
    expect(
      getHomeMarketTokenRowId({
        chainId: '',
        contractAddress: '',
        perpsCoin: 'BTC',
      }),
    ).toBe('perps:BTC');
  });

  it('seeds confirmed cache and keeps cached rows through partial refreshes', () => {
    const identity = createIdentity();
    const coordinator = new HomeSectionCoordinator<
      IHomeMarketLegacyPayload<IHomeMarketTokenRow>
    >(identity);
    const cached = payload([spotToken()]);
    const cachedRows = getHomeMarketRowIds(cached);

    const seed = projectHomeMarketSectionSource({
      authorityReady: true,
      scopeMatches: true,
      requestSeq: 1,
      evidence: {
        kind: 'confirmedCache',
        data: cached,
        rowIds: cachedRows,
        refresh: 'idle',
      },
    });
    expect(
      coordinator.dispatch(
        adaptHomeMarketSourceSnapshot({ identity, snapshot: seed }),
      ),
    ).toMatchObject({
      semantic: {
        kind: 'ready',
        rowIds: cachedRows,
        freshness: 'confirmedCache',
        refresh: 'idle',
      },
    });

    const partial = projectHomeMarketSectionSource({
      authorityReady: true,
      scopeMatches: true,
      requestSeq: 2,
      evidence: {
        kind: 'partial',
        coverageFingerprint: buildHomeMarketPartialCoverage({
          prefetchCount: 2,
          requestSeq: 2,
          resolvedCategoryId: params.resolvedCategoryId,
          settledCount: 1,
        }),
      },
    });
    const resolution = coordinator.dispatch(
      adaptHomeMarketSourceSnapshot({ identity, snapshot: partial }),
    );
    expect(resolution.semantic).toMatchObject({
      kind: 'ready',
      rowIds: cachedRows,
      freshness: 'confirmedCache',
      refresh: 'refreshing',
    });
    expect(adaptHomeLegacyMarketSection({ resolution })).toMatchObject({
      kind: 'ready',
      viewState: 'ready',
      refresh: 'refreshing',
    });
  });

  it('projects complete success, confirmed empty, and incomplete success without fake rows', () => {
    const live = payload([spotToken({ contractAddress: '0xlive' })]);
    const liveRows = getHomeMarketRowIds(live);
    expect(
      projectHomeMarketSectionSource({
        authorityReady: true,
        scopeMatches: true,
        requestSeq: 3,
        evidence: {
          kind: 'complete',
          confirmedEmpty: false,
          coverageFingerprint: buildHomeMarketCoverage({
            favoriteMode: 'favorites',
            requestSeq: 3,
            resolvedCategoryId: params.resolvedCategoryId,
            rowCount: liveRows.length,
            selectedCategoryId: params.selectedCategoryId,
          }),
          data: live,
          rowIds: liveRows,
        },
      }),
    ).toMatchObject({ kind: 'complete', result: { kind: 'success' } });

    expect(
      projectHomeMarketSectionSource({
        authorityReady: true,
        scopeMatches: true,
        requestSeq: 4,
        evidence: {
          kind: 'complete',
          confirmedEmpty: true,
          coverageFingerprint: buildHomeMarketCoverage({
            favoriteMode: 'favorites',
            requestSeq: 4,
            resolvedCategoryId: params.resolvedCategoryId,
            rowCount: 0,
            selectedCategoryId: params.selectedCategoryId,
          }),
          data: undefined,
          rowIds: [],
        },
      }),
    ).toEqual({
      kind: 'complete',
      requestSeq: 4,
      coverageFingerprint: buildHomeMarketCoverage({
        favoriteMode: 'favorites',
        requestSeq: 4,
        resolvedCategoryId: params.resolvedCategoryId,
        rowCount: 0,
        selectedCategoryId: params.selectedCategoryId,
      }),
      result: { kind: 'empty' },
    });

    expect(
      projectHomeMarketSectionSource({
        authorityReady: true,
        scopeMatches: true,
        requestSeq: 5,
        evidence: {
          kind: 'complete',
          confirmedEmpty: false,
          coverageFingerprint: buildHomeMarketCoverage({
            favoriteMode: 'favorites',
            requestSeq: 5,
            resolvedCategoryId: params.resolvedCategoryId,
            rowCount: 0,
            selectedCategoryId: params.selectedCategoryId,
          }),
          data: payload([]),
          rowIds: [],
        },
      }),
    ).toEqual({ kind: 'loading', requestSeq: 5 });
  });

  it('does not turn errors into permanent empty while confirmed cache exists', () => {
    const identity = createIdentity();
    const coordinator = new HomeSectionCoordinator<
      IHomeMarketLegacyPayload<IHomeMarketTokenRow>
    >(identity);
    const live = payload([spotToken({ contractAddress: '0xlive' })]);
    const rowIds = getHomeMarketRowIds(live);
    coordinator.dispatch(
      adaptHomeMarketSourceSnapshot({
        identity,
        snapshot: {
          kind: 'complete',
          requestSeq: 1,
          coverageFingerprint: buildHomeMarketCoverage({
            favoriteMode: 'favorites',
            requestSeq: 1,
            resolvedCategoryId: params.resolvedCategoryId,
            rowCount: rowIds.length,
            selectedCategoryId: params.selectedCategoryId,
          }),
          result: { kind: 'success', data: live, rowIds },
        },
      }),
    );

    const failed = coordinator.dispatch(
      adaptHomeMarketSourceSnapshot({
        identity,
        snapshot: { kind: 'error', requestSeq: 2, errorKind: 'transport' },
      }),
    );
    expect(failed.semantic).toEqual({
      kind: 'ready',
      rowIds,
      freshness: 'confirmedCache',
      refresh: 'failed',
    });

    const coldError = new HomeSectionCoordinator<
      IHomeMarketLegacyPayload<IHomeMarketTokenRow>
    >(identity).dispatch(
      adaptHomeMarketSourceSnapshot({
        identity,
        snapshot: { kind: 'error', requestSeq: 1, errorKind: 'transport' },
      }),
    );
    expect(coldError.semantic).toEqual({
      kind: 'error',
      errorState: 'market',
    });
  });
});
