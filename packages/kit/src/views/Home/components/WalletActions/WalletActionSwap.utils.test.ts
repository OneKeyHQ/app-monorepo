import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { ESwapSource } from '@onekeyhq/shared/types/swap/types';

import { buildWalletHomeSwapInitParams } from './WalletActionSwap.utils';

describe('buildWalletHomeSwapInitParams', () => {
  it('omits the aggregate All Networks context', () => {
    expect(
      buildWalletHomeSwapInitParams({
        isExtPopupOrSidePanel: false,
        networkId: getNetworkIdsMap().onekeyall,
      }),
    ).toEqual({
      swapSource: ESwapSource.WALLET_HOME,
    });
  });

  it('imports a concrete Home network', () => {
    expect(
      buildWalletHomeSwapInitParams({
        isExtPopupOrSidePanel: false,
        networkId: 'evm--1',
      }),
    ).toEqual({
      importNetworkId: 'evm--1',
      swapSource: ESwapSource.WALLET_HOME,
    });
  });

  it('preserves extension resume behavior', () => {
    expect(
      buildWalletHomeSwapInitParams({
        isExtPopupOrSidePanel: true,
        networkId: 'evm--1',
      }),
    ).toEqual({
      swapSource: ESwapSource.WALLET_HOME,
    });
  });
});
