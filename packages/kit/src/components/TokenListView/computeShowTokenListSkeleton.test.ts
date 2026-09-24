import { computeShowTokenListSkeleton } from './computeShowTokenListSkeleton';

import type { IComputeShowTokenListSkeletonParams } from './computeShowTokenListSkeleton';

// Baseline = home, first load in progress, nothing else special.
function baseHomeFirstLoad(): IComputeShowTokenListSkeletonParams {
  return {
    showActiveAccountTokenList: false,
    activeAccountTokenListInitialized: false,
    activeAccountTokenListIsRefreshing: false,
    isTokenSelector: false,
    searchAll: false,
    tokenSelectorSearchKeyLength: 0,
    searchKeyLengthThreshold: 2,
    tokenSelectorSearchTokenListSearchKey: '',
    tokenSelectorSearchKey: '',
    filteredTokensLength: 0,
    ownerMismatch: false,
    tokenSelectorInitialized: false,
    tokenSelectorSearchTokenStateIsSearching: false,
    searchTokenStateIsSearching: false,
    isHomeProjectionPath: true,
    tokenListInitialized: false,
    tokenListIsRefreshing: true,
    displayCount: 0,
  };
}

describe('computeShowTokenListSkeleton — cold-start regression', () => {
  it('home first load with NO data shows the skeleton', () => {
    expect(computeShowTokenListSkeleton(baseHomeFirstLoad())).toBe(true);
  });

  it('keeps an unknown Home list pending after its first request fails', () => {
    expect(
      computeShowTokenListSkeleton({
        ...baseHomeFirstLoad(),
        tokenListIsRefreshing: false,
      }),
    ).toBe(true);
  });

  it('keeps cached rows visible after a refresh fails', () => {
    expect(
      computeShowTokenListSkeleton({
        ...baseHomeFirstLoad(),
        tokenListIsRefreshing: false,
        displayCount: 3,
      }),
    ).toBe(false);
  });

  it('allows a confirmed empty Home frame to render its empty state', () => {
    expect(
      computeShowTokenListSkeleton({
        ...baseHomeFirstLoad(),
        tokenListInitialized: true,
        tokenListIsRefreshing: false,
      }),
    ).toBe(false);
  });

  it('preserves the request-based gate outside the Home projection', () => {
    expect(
      computeShowTokenListSkeleton({
        ...baseHomeFirstLoad(),
        isHomeProjectionPath: false,
        tokenListIsRefreshing: false,
      }),
    ).toBe(false);
  });

  it('home first load WITH cold-painted rows (displayCount>0) does NOT skeleton — rows show immediately', () => {
    // The crux: !initialized && isRefreshing but the cold paint already gave us
    // 50 rows. Before the fix this returned true and hid the cold paint.
    expect(
      computeShowTokenListSkeleton({
        ...baseHomeFirstLoad(),
        displayCount: 50,
      }),
    ).toBe(false);
  });

  it('home first load with hideZero-filtered-to-empty (displayCount=0) still skeletons', () => {
    expect(
      computeShowTokenListSkeleton({
        ...baseHomeFirstLoad(),
        displayCount: 0,
      }),
    ).toBe(true);
  });
});

describe('computeShowTokenListSkeleton — other branches unchanged', () => {
  it('owner switch (ownerMismatch) always skeletons, even with stale rows', () => {
    expect(
      computeShowTokenListSkeleton({
        ...baseHomeFirstLoad(),
        ownerMismatch: true,
        displayCount: 50,
        tokenListInitialized: true,
        tokenListIsRefreshing: false,
      }),
    ).toBe(true);
  });

  it('active-account first refresh skeletons', () => {
    expect(
      computeShowTokenListSkeleton({
        ...baseHomeFirstLoad(),
        showActiveAccountTokenList: true,
        activeAccountTokenListInitialized: false,
        activeAccountTokenListIsRefreshing: true,
      }),
    ).toBe(true);
  });

  it('active-account refresh with cached rows does NOT skeleton', () => {
    expect(
      computeShowTokenListSkeleton({
        ...baseHomeFirstLoad(),
        showActiveAccountTokenList: true,
        activeAccountTokenListInitialized: false,
        activeAccountTokenListIsRefreshing: true,
        displayCount: 3,
      }),
    ).toBe(false);
  });

  it('active-account owner switch skeletons even with cached rows', () => {
    expect(
      computeShowTokenListSkeleton({
        ...baseHomeFirstLoad(),
        showActiveAccountTokenList: true,
        activeAccountTokenListInitialized: false,
        activeAccountTokenListIsRefreshing: true,
        ownerMismatch: true,
        displayCount: 3,
      }),
    ).toBe(true);
  });

  it('selector not yet initialized skeletons', () => {
    expect(
      computeShowTokenListSkeleton({
        ...baseHomeFirstLoad(),
        isTokenSelector: true,
        tokenSelectorInitialized: false,
      }),
    ).toBe(true);
  });

  it('selector not yet initialized with cached rows does NOT skeleton', () => {
    expect(
      computeShowTokenListSkeleton({
        ...baseHomeFirstLoad(),
        isTokenSelector: true,
        tokenSelectorInitialized: false,
        displayCount: 3,
      }),
    ).toBe(false);
  });

  it('selector owner switch skeletons even with cached rows', () => {
    expect(
      computeShowTokenListSkeleton({
        ...baseHomeFirstLoad(),
        isTokenSelector: true,
        tokenSelectorInitialized: false,
        ownerMismatch: true,
        displayCount: 3,
      }),
    ).toBe(true);
  });

  it('initialized home that is merely refreshing does NOT skeleton (no flash over existing data)', () => {
    expect(
      computeShowTokenListSkeleton({
        ...baseHomeFirstLoad(),
        tokenListInitialized: true,
        tokenListIsRefreshing: true,
        displayCount: 12,
      }),
    ).toBe(false);
  });

  it('active search shows skeleton on the home path', () => {
    expect(
      computeShowTokenListSkeleton({
        ...baseHomeFirstLoad(),
        searchTokenStateIsSearching: true,
        tokenListInitialized: true,
        tokenListIsRefreshing: false,
      }),
    ).toBe(true);
  });
});
