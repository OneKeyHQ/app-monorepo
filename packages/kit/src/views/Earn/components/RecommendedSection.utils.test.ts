import type { IRecommendAsset } from '@onekeyhq/shared/types/staking';

import { shouldShowRecommendedBalance } from './RecommendedSection.utils';

function buildToken(
  protocols: Pick<IRecommendAsset, 'protocols'>['protocols'],
) {
  return { protocols };
}

describe('RecommendedSection utils', () => {
  it('hides balance when all protocols are on the same network', () => {
    expect(
      shouldShowRecommendedBalance(
        buildToken([
          { networkId: 'sol--101', provider: 'provider-a' },
          { networkId: 'sol--101', provider: 'provider-b' },
        ]),
      ),
    ).toBe(false);
  });

  it('hides balance for a single-network recommendation', () => {
    expect(
      shouldShowRecommendedBalance(
        buildToken([{ networkId: 'sol--101', provider: 'provider-a' }]),
      ),
    ).toBe(false);
  });

  it('shows balance when protocols span multiple networks', () => {
    expect(
      shouldShowRecommendedBalance(
        buildToken([
          { networkId: 'evm--1', provider: 'provider-a' },
          { networkId: 'evm--8453', provider: 'provider-b' },
        ]),
      ),
    ).toBe(true);
  });

  it('keeps the existing balance display when protocol network data is missing', () => {
    expect(
      shouldShowRecommendedBalance(
        buildToken([{ networkId: '', provider: 'provider-a' }]),
      ),
    ).toBe(true);
    expect(shouldShowRecommendedBalance(buildToken([]))).toBe(true);
  });
});
