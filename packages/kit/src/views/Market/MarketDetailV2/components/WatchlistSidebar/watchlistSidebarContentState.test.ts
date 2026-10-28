import { getWatchlistSidebarContentState } from './watchlistSidebarContentState';

const base = {
  isMounted: true,
  storedCount: 2,
  isLoading: false,
  isError: false,
  hasLoadedAllSources: true,
  rowCount: 0,
  filter: 'all',
} as const;

it('waits on the skeleton until favorites storage is ready', () => {
  expect(getWatchlistSidebarContentState({ ...base, isMounted: false })).toBe(
    'skeleton',
  );
});

it('shows recommendations when nothing is stored', () => {
  expect(
    getWatchlistSidebarContentState({
      ...base,
      storedCount: 0,
      hasLoadedAllSources: false,
    }),
  ).toBe('recommendations');
});

it('shows rows whenever any resolved, including cached rows while loading', () => {
  expect(
    getWatchlistSidebarContentState({ ...base, rowCount: 3, isLoading: true }),
  ).toBe('rows');
});

it('keeps the skeleton while stored favorites are still loading', () => {
  expect(
    getWatchlistSidebarContentState({
      ...base,
      isLoading: true,
      hasLoadedAllSources: false,
    }),
  ).toBe('skeleton');
});

it('offers a retry when a desktop or web request failed without isError', () => {
  expect(
    getWatchlistSidebarContentState({ ...base, hasLoadedAllSources: false }),
  ).toBe('loadFailed');
});

it('offers a retry when the request reports an error', () => {
  expect(getWatchlistSidebarContentState({ ...base, isError: true })).toBe(
    'loadFailed',
  );
});

it('shows recommendations when every source loaded but no favorite resolved', () => {
  expect(getWatchlistSidebarContentState(base)).toBe('recommendations');
});

it('reads as an empty list under the Stocks and Perps filters', () => {
  for (const filter of ['stocks', 'perps'] as const) {
    expect(getWatchlistSidebarContentState({ ...base, filter })).toBe(
      'noResults',
    );
    expect(
      getWatchlistSidebarContentState({ ...base, filter, storedCount: 0 }),
    ).toBe('noResults');
  }
});

it('keeps the recommendations under the Spot filter', () => {
  expect(getWatchlistSidebarContentState({ ...base, filter: 'spot' })).toBe(
    'recommendations',
  );
});

it('keeps a loaded empty state through a background refresh', () => {
  expect(getWatchlistSidebarContentState({ ...base, isLoading: true })).toBe(
    'recommendations',
  );
  expect(
    getWatchlistSidebarContentState({
      ...base,
      isLoading: true,
      filter: 'stocks',
    }),
  ).toBe('noResults');
});
