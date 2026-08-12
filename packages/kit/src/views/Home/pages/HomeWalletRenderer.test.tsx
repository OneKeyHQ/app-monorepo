import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { HomeWalletRenderer } from './HomeWalletRenderer';

describe('Home Wallet renderer fallback', () => {
  it('returns Legacy Home on the default platform path', () => {
    const legacy = 'legacy-home';

    expect(
      HomeWalletRenderer({
        eligible: true,
        legacy,
        sceneName: EAccountSelectorSceneName.home,
      }),
    ).toBe(legacy);
  });
});
