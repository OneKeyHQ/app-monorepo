import type { ISwapNetwork } from '@onekeyhq/shared/types/swap/types';

import {
  isSwapNetworkCacheCompatible,
  isSwapNetworkCacheReadyForBasicList,
} from './swapNetworkCacheUtils';

const baseNetwork = {
  networkId: 'evm--1',
  name: 'Ethereum',
  symbol: 'ETH',
  supportCrossChainSwap: true,
  supportSingleSwap: true,
  supportLimit: true,
} satisfies ISwapNetwork;

describe('swap network cache utils', () => {
  it('allows old network cache as a basic list before backendIndex is refreshed', () => {
    expect(isSwapNetworkCacheReadyForBasicList([baseNetwork])).toBe(true);
    expect(isSwapNetworkCacheCompatible([baseNetwork])).toBe(false);
  });

  it('rejects cache entries without a valid network id for the basic list', () => {
    expect(
      isSwapNetworkCacheReadyForBasicList([
        {
          ...baseNetwork,
          networkId: '',
        },
      ]),
    ).toBe(false);
  });
});
