import {
  getSwapTokenSearchResults,
  releaseSwapTokenListFetchEffectKey,
} from './useSwapTokens.utils';

describe('releaseSwapTokenListFetchEffectKey', () => {
  it('releases the active key so a cancelled request can restart', () => {
    expect(
      releaseSwapTokenListFetchEffectKey({
        effectKey: 'request-1',
        latestEffectKey: 'request-1',
      }),
    ).toBe('');
  });

  it('does not release a newer request', () => {
    expect(
      releaseSwapTokenListFetchEffectKey({
        effectKey: 'request-1',
        latestEffectKey: 'request-2',
      }),
    ).toBe('request-2');
  });
});

describe('getSwapTokenSearchResults', () => {
  it('uses matching local results while the remote search is pending', () => {
    expect(
      getSwapTokenSearchResults({
        isTokenListFetchSettled: false,
        remoteTokens: [],
        searchLocalTokens: () => ['local-match'],
        useLocalSearchFallback: true,
      }),
    ).toEqual(['local-match']);
  });

  it('keeps the list empty when neither local nor remote search matches', () => {
    expect(
      getSwapTokenSearchResults({
        isTokenListFetchSettled: false,
        remoteTokens: [],
        searchLocalTokens: () => [],
        useLocalSearchFallback: true,
      }),
    ).toEqual([]);
  });

  it('uses remote results without evaluating the local fallback', () => {
    const searchLocalTokens = jest.fn(() => ['local-match']);

    expect(
      getSwapTokenSearchResults({
        isTokenListFetchSettled: false,
        remoteTokens: ['remote-match'],
        searchLocalTokens,
        useLocalSearchFallback: true,
      }),
    ).toEqual(['remote-match']);
    expect(searchLocalTokens).not.toHaveBeenCalled();
  });

  it('keeps an authoritative empty remote result after the request settles', () => {
    const searchLocalTokens = jest.fn(() => ['stale-local-match']);

    expect(
      getSwapTokenSearchResults({
        isTokenListFetchSettled: true,
        remoteTokens: [],
        searchLocalTokens,
        useLocalSearchFallback: true,
      }),
    ).toEqual([]);
    expect(searchLocalTokens).not.toHaveBeenCalled();
  });
});
