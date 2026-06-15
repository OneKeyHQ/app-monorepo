import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

import { getVisibleSwapTabSwitchUpdate } from './swapTypeUtils';

describe('swapTypeUtils', () => {
  it('updates cached raw Bridge state to visible Swap', () => {
    expect(
      getVisibleSwapTabSwitchUpdate({
        currentSwapType: ESwapTabSwitchType.BRIDGE,
        nextSwapType: ESwapTabSwitchType.BRIDGE,
      }),
    ).toEqual({
      nextVisibleSwapType: ESwapTabSwitchType.SWAP,
      shouldUpdate: true,
    });

    expect(
      getVisibleSwapTabSwitchUpdate({
        currentSwapType: ESwapTabSwitchType.BRIDGE,
        nextSwapType: ESwapTabSwitchType.SWAP,
      }),
    ).toEqual({
      nextVisibleSwapType: ESwapTabSwitchType.SWAP,
      shouldUpdate: true,
    });
  });

  it('does not rewrite visible Swap just because execution is Bridge', () => {
    expect(
      getVisibleSwapTabSwitchUpdate({
        currentSwapType: ESwapTabSwitchType.SWAP,
        nextSwapType: ESwapTabSwitchType.BRIDGE,
      }),
    ).toEqual({
      nextVisibleSwapType: ESwapTabSwitchType.SWAP,
      shouldUpdate: false,
    });
  });

  it('updates when the visible tab changes', () => {
    expect(
      getVisibleSwapTabSwitchUpdate({
        currentSwapType: ESwapTabSwitchType.LIMIT,
        nextSwapType: ESwapTabSwitchType.SWAP,
      }),
    ).toEqual({
      nextVisibleSwapType: ESwapTabSwitchType.SWAP,
      shouldUpdate: true,
    });
  });
});
