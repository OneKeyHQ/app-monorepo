import {
  ESwapDirectionType,
  ESwapTabSwitchType,
  type ISwapNetwork,
  type ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import {
  buildSwapStockSelectableNetworks,
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

function buildSwapNetwork({
  isAllNetworks,
  networkId,
  supportStock,
}: {
  isAllNetworks?: boolean;
  networkId: string;
  supportStock?: boolean;
}): ISwapNetwork {
  return {
    isAllNetworks,
    networkId,
    supportStock,
  } as ISwapNetwork;
}

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

  it('does not insert unsupported default networks into Stock selector', () => {
    const stockNetworksBase = [
      buildSwapNetwork({ isAllNetworks: true, networkId: 'onekeyall--0' }),
      buildSwapNetwork({ networkId: 'evm--56', supportStock: true }),
    ];

    expect(
      buildSwapStockSelectableNetworks({
        isSwapStockSelectTarget: true,
        rawSwapNetworks: [
          buildSwapNetwork({ networkId: 'evm--1', supportStock: false }),
          buildSwapNetwork({ networkId: 'evm--56', supportStock: true }),
        ],
        stockSelectDefaultNetworkId: 'evm--1',
        swapNetworksIncludeAllNetworkBase: stockNetworksBase,
      }),
    ).toBe(stockNetworksBase);
  });

  it('inserts supported Stock default networks after All Networks', () => {
    const allNetwork = buildSwapNetwork({
      isAllNetworks: true,
      networkId: 'onekeyall--0',
    });
    const bscNetwork = buildSwapNetwork({
      networkId: 'evm--56',
      supportStock: true,
    });
    const polygonNetwork = buildSwapNetwork({
      networkId: 'evm--137',
      supportStock: true,
    });

    expect(
      buildSwapStockSelectableNetworks({
        isSwapStockSelectTarget: true,
        rawSwapNetworks: [bscNetwork, polygonNetwork],
        stockSelectDefaultNetworkId: 'evm--137',
        swapNetworksIncludeAllNetworkBase: [allNetwork, bscNetwork],
      }),
    ).toEqual([allNetwork, polygonNetwork, bscNetwork]);
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
