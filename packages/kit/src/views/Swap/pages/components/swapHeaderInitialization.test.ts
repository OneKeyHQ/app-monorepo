import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

import { shouldInitializeSwapTypeFromRoute } from './swapHeaderInitialization';

describe('shouldInitializeSwapTypeFromRoute', () => {
  it('does not let a stale Swap route override a prepared Pro handoff', () => {
    expect(
      shouldInitializeSwapTypeFromRoute({
        defaultSwapType: ESwapTabSwitchType.SWAP,
        hasPreparedSwapProEntry: true,
      }),
    ).toBe(false);
  });

  it('still applies an explicit route when there is no Pro handoff', () => {
    expect(
      shouldInitializeSwapTypeFromRoute({
        defaultSwapType: ESwapTabSwitchType.LIMIT,
        hasPreparedSwapProEntry: false,
      }),
    ).toBe(true);
  });
});
