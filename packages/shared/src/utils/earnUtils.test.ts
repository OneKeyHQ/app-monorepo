import earnUtils from './earnUtils';

describe('earnUtils', () => {
  it('resolves Aave provider names from backend lowercase wire values', () => {
    expect(earnUtils.getEarnProviderName({ providerName: 'aave' })).toBe(
      'Aave',
    );
  });
});
