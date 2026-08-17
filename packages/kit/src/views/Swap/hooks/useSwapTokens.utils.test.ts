import { releaseSwapTokenListFetchEffectKey } from './useSwapTokens.utils';

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
