import {
  ESwapDirectionType,
  ESwapTabSwitchType,
  type ISwapNetwork,
  type ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import {
  buildSwapTokenSelectorDisableNetworks,
  getSwapStockTokenDisplayName,
  isSwapStockMetadataPending,
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

  it('keeps stock token rows pending until matching metadata is ready', () => {
    expect(
      isSwapStockMetadataPending({
        isSwapStockSelectTarget: true,
        stockMetadataTokenKey: 'evm--56:0x123',
        stockMetadataLoading: false,
        resolvedStockMetadataTokenKey: '',
      }),
    ).toBe(true);

    expect(
      isSwapStockMetadataPending({
        isSwapStockSelectTarget: true,
        stockMetadataTokenKey: 'evm--56:0x123',
        stockMetadataLoading: true,
        resolvedStockMetadataTokenKey: 'evm--56:0x123',
      }),
    ).toBe(true);

    expect(
      isSwapStockMetadataPending({
        isSwapStockSelectTarget: true,
        stockMetadataTokenKey: 'evm--56:0x123',
        stockMetadataLoading: false,
        resolvedStockMetadataTokenKey: 'evm--56:0x123',
      }),
    ).toBe(false);
  });

  it('uses stock subtitle before token source suffix fallback', () => {
    expect(
      getSwapStockTokenDisplayName({
        stock: { subtitle: '罗宾汉' },
        tokenName: 'Robinhood (Ondo Tokenized)',
      }),
    ).toBe('罗宾汉');

    expect(
      getSwapStockTokenDisplayName({
        tokenName: 'Robinhood (Ondo Tokenized)',
      }),
    ).toBe('Robinhood');
  });
});
