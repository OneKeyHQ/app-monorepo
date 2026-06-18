import {
  ESwapDirectionType,
  ESwapTabSwitchType,
  type ISwapNetwork,
  type ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import {
  buildSwapTokenSelectorDisableNetworks,
  isSwapTokenSelectorFromNetworkBridgeOnly,
} from './SwapTokenSelectModal.utils';

const fromToken = {
  networkId: 'evm--1',
} as ISwapToken;

const swapNetworksIncludeAllNetwork = [
  {
    networkId: 'onekeyall--0',
    isAllNetworks: true,
  },
  {
    networkId: 'evm--1',
    supportCrossChainSwap: true,
    supportSingleSwap: false,
  },
  {
    networkId: 'evm--137',
    supportCrossChainSwap: true,
    supportSingleSwap: true,
  },
] as ISwapNetwork[];

describe('SwapTokenSelectModal.utils', () => {
  it('detects bridge-only source networks', () => {
    expect(
      isSwapTokenSelectorFromNetworkBridgeOnly({
        fromTokenNetworkId: 'evm--1',
        swapNetworksIncludeAllNetwork,
      }),
    ).toBe(true);

    expect(
      isSwapTokenSelectorFromNetworkBridgeOnly({
        fromTokenNetworkId: 'evm--137',
        swapNetworksIncludeAllNetwork,
      }),
    ).toBe(false);
  });

  it('disables the source network for Swap To selection when the source only supports Bridge', () => {
    expect(
      buildSwapTokenSelectorDisableNetworks({
        type: ESwapDirectionType.TO,
        swapTypeSwitch: ESwapTabSwitchType.SWAP,
        fromToken,
        swapNetworksIncludeAllNetwork,
      }),
    ).toEqual(['evm--1']);
  });

  it('keeps Limit To selection on the source network only', () => {
    expect(
      buildSwapTokenSelectorDisableNetworks({
        type: ESwapDirectionType.TO,
        swapTypeSwitch: ESwapTabSwitchType.LIMIT,
        fromToken,
        swapNetworksIncludeAllNetwork,
      }),
    ).toEqual(['onekeyall--0', 'evm--137']);
  });

  it('keeps Stock To selection on the source network only', () => {
    expect(
      buildSwapTokenSelectorDisableNetworks({
        type: ESwapDirectionType.TO,
        swapTypeSwitch: ESwapTabSwitchType.STOCK,
        fromToken,
        swapNetworksIncludeAllNetwork,
      }),
    ).toEqual(['onekeyall--0', 'evm--137']);
  });
});
