import {
  EProtocolOfExchange,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

import {
  getSwapExecutionType,
  getSwapNetworkSupportTabSwitchTypes,
  getSwapSupportCheckType,
  getVisibleSwapTabSwitchType,
} from './swapTypeUtils';

describe('swapTypeUtils', () => {
  it('derives bridge execution type from cross-network tokens', () => {
    expect(
      getSwapExecutionType({
        protocol: EProtocolOfExchange.SWAP,
        fromNetworkId: 'evm--1',
        toNetworkId: 'sol--101',
      }),
    ).toBe(ESwapTabSwitchType.BRIDGE);
  });

  it('keeps limit protocol distinct from cross-network bridge', () => {
    expect(
      getSwapExecutionType({
        protocol: EProtocolOfExchange.LIMIT,
        fromNetworkId: 'evm--1',
        toNetworkId: 'sol--101',
      }),
    ).toBe(ESwapTabSwitchType.LIMIT);
  });

  it('keeps bridge as a support-check intent while showing the swap tab', () => {
    expect(getVisibleSwapTabSwitchType(ESwapTabSwitchType.BRIDGE)).toBe(
      ESwapTabSwitchType.SWAP,
    );
    expect(getSwapSupportCheckType(ESwapTabSwitchType.BRIDGE)).toBe(
      ESwapTabSwitchType.BRIDGE,
    );
  });

  it('does not mark single-swap-only networks as bridge-capable', () => {
    expect(
      getSwapNetworkSupportTabSwitchTypes({
        supportSingleSwap: true,
        supportCrossChainSwap: false,
      }),
    ).toEqual([ESwapTabSwitchType.SWAP]);
  });

  it('keeps cross-chain networks eligible for visible swap and bridge intent', () => {
    expect(
      getSwapNetworkSupportTabSwitchTypes({
        supportSingleSwap: false,
        supportCrossChainSwap: true,
      }),
    ).toEqual([ESwapTabSwitchType.SWAP, ESwapTabSwitchType.BRIDGE]);
  });
});
