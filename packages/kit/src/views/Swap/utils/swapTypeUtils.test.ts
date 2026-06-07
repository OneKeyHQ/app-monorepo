import {
  EProtocolOfExchange,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

import { getSwapExecutionType } from './swapTypeUtils';

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
});
