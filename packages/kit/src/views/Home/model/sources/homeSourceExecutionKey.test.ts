import {
  buildHomeSourceExecutionKey,
  normalizeHomePortfolioLpCacheControl,
} from './homeSourceExecutionKey';

describe('Home source execution identity', () => {
  it('does not reuse a cache identity across sessions', () => {
    const sourceKey = 'owner-a|banner|params';

    expect(
      buildHomeSourceExecutionKey({ sessionId: 'session-a:1', sourceKey }),
    ).not.toBe(
      buildHomeSourceExecutionKey({ sessionId: 'session-a:2', sourceKey }),
    );
  });

  it('encodes the session boundary without delimiter ambiguity', () => {
    expect(
      buildHomeSourceExecutionKey({
        sessionId: 'a:b',
        sourceKey: 'c',
      }),
    ).not.toBe(
      buildHomeSourceExecutionKey({
        sessionId: 'a',
        sourceKey: 'b:c',
      }),
    );
  });
});

describe('Home portfolio cache control identity', () => {
  it('uses one cache identity before and after persisted false hydrates', () => {
    expect(normalizeHomePortfolioLpCacheControl(undefined)).toBe(false);
    expect(normalizeHomePortfolioLpCacheControl(false)).toBe(false);
  });

  it('keeps enabled LP mode in its own cache identity', () => {
    expect(normalizeHomePortfolioLpCacheControl(true)).toBe(true);
  });
});
