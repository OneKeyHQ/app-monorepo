import { buildReferralUrl } from './appConfig';

import type { IReferralShareSource } from './appConfig';

describe('buildReferralUrl', () => {
  test.each<{ source: IReferralShareSource; expected: string }>([
    { source: 'Earn', expected: 'app.onekey.so/r/CODE1/app/defi' },
    { source: 'Perps', expected: 'app.onekey.so/r/CODE1/app/perps' },
    { source: 'Swap', expected: 'app.onekey.so/r/CODE1/app/swap' },
  ])('points $source share links at $expected', ({ source, expected }) => {
    expect(buildReferralUrl({ code: 'CODE1', source })).toBe(expected);
  });

  it('uses the test host for non prod env', () => {
    expect(
      buildReferralUrl({ code: 'CODE1', source: 'Swap', env: 'test' }),
    ).toBe('app.onekeytest.com/r/CODE1/app/swap');
  });
});
