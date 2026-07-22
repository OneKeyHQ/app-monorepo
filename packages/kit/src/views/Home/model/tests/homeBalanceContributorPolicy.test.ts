import {
  isHomeBalanceContributorRefreshing,
  shouldIncludeHomeBalanceOptionalContributor,
} from '../balance/homeBalanceContributorPolicy';

describe('Home balance contributor policy', () => {
  it('keeps an optional source out of the required set until capability is confirmed', () => {
    expect(
      shouldIncludeHomeBalanceOptionalContributor({
        capabilityReady: false,
        supported: true,
      }),
    ).toBe(false);
    expect(
      shouldIncludeHomeBalanceOptionalContributor({
        capabilityReady: true,
        supported: true,
      }),
    ).toBe(true);
  });

  it('holds the confirmed balance while any settled source is refreshing', () => {
    expect(
      isHomeBalanceContributorRefreshing({
        kind: 'ready',
        refresh: 'refreshing',
      }),
    ).toBe(true);
    expect(
      isHomeBalanceContributorRefreshing({
        kind: 'empty',
        refresh: 'refreshing',
      }),
    ).toBe(true);
    expect(
      isHomeBalanceContributorRefreshing({ kind: 'ready', refresh: 'idle' }),
    ).toBe(false);
  });
});
