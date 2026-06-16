import {
  ESwapDirectionType,
  ESwapTabSwitchType,
  type ISwapNetwork,
  type ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

export function isSwapNetworkBridgeOnly(
  network?: Pick<ISwapNetwork, 'supportCrossChainSwap' | 'supportSingleSwap'>,
) {
  return Boolean(network?.supportCrossChainSwap && !network.supportSingleSwap);
}

export function isSwapTokenSelectorFromNetworkBridgeOnly({
  fromTokenNetworkId,
  swapNetworksIncludeAllNetwork,
}: {
  fromTokenNetworkId?: string;
  swapNetworksIncludeAllNetwork: ISwapNetwork[];
}) {
  if (!fromTokenNetworkId) {
    return false;
  }

  return isSwapNetworkBridgeOnly(
    swapNetworksIncludeAllNetwork.find(
      (network) => network.networkId === fromTokenNetworkId,
    ),
  );
}

export function buildSwapTokenSelectorDisableNetworks({
  type,
  swapTypeSwitch,
  fromToken,
  swapNetworksIncludeAllNetwork,
}: {
  type: ESwapDirectionType;
  swapTypeSwitch: ESwapTabSwitchType;
  fromToken?: ISwapToken;
  swapNetworksIncludeAllNetwork: ISwapNetwork[];
}) {
  const networkIds = swapNetworksIncludeAllNetwork.map(
    (network) => network.networkId,
  );

  if (swapTypeSwitch !== ESwapTabSwitchType.SWAP) {
    if (
      swapTypeSwitch === ESwapTabSwitchType.LIMIT &&
      type === ESwapDirectionType.TO &&
      fromToken?.networkId
    ) {
      return networkIds.filter(
        (networkId) => networkId !== fromToken.networkId,
      );
    }

    return [];
  }

  if (
    type === ESwapDirectionType.TO &&
    fromToken?.networkId &&
    isSwapTokenSelectorFromNetworkBridgeOnly({
      fromTokenNetworkId: fromToken.networkId,
      swapNetworksIncludeAllNetwork,
    })
  ) {
    return [fromToken.networkId];
  }

  return [];
}
