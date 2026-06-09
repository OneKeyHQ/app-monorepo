import {
  EProtocolOfExchange,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';
import type {
  IFetchQuoteResult,
  ISwapNetwork,
} from '@onekeyhq/shared/types/swap/types';

export {
  getSwapSupportCheckType,
  getVisibleSwapTabSwitchType,
} from '@onekeyhq/shared/src/utils/swapTypeUtils';

export function getSwapNetworkSupportTabSwitchTypes({
  supportSingleSwap,
  supportCrossChainSwap,
  supportLimit,
}: {
  supportSingleSwap?: boolean;
  supportCrossChainSwap?: boolean;
  supportLimit?: boolean;
}) {
  const supportTypes: ESwapTabSwitchType[] = [];
  if (supportSingleSwap || supportCrossChainSwap) {
    supportTypes.push(ESwapTabSwitchType.SWAP);
  }
  if (supportCrossChainSwap) {
    supportTypes.push(ESwapTabSwitchType.BRIDGE);
  }
  if (supportLimit) {
    supportTypes.push(ESwapTabSwitchType.LIMIT);
  }
  return supportTypes;
}

export function getSwapExecutionType({
  protocol,
  fromNetworkId,
  toNetworkId,
}: {
  protocol?: EProtocolOfExchange;
  fromNetworkId?: string;
  toNetworkId?: string;
}) {
  if (protocol === EProtocolOfExchange.LIMIT) {
    return ESwapTabSwitchType.LIMIT;
  }
  if (fromNetworkId && toNetworkId && fromNetworkId !== toNetworkId) {
    return ESwapTabSwitchType.BRIDGE;
  }
  return ESwapTabSwitchType.SWAP;
}

export function getSwapExecutionTypeFromQuoteResult(
  quoteResult?: IFetchQuoteResult,
) {
  return getSwapExecutionType({
    protocol: quoteResult?.protocol,
    fromNetworkId: quoteResult?.fromTokenInfo.networkId,
    toNetworkId: quoteResult?.toTokenInfo.networkId,
  });
}

export function getSwapDisabledNetworkIdsForPairToken({
  networks,
  pairedNetworkId,
}: {
  networks: ISwapNetwork[];
  pairedNetworkId?: string;
}) {
  if (!pairedNetworkId) {
    return [];
  }

  const pairedNetwork = networks.find(
    (network) => network.networkId === pairedNetworkId,
  );

  return networks
    .filter((network) => {
      if (network.isAllNetworks) {
        return false;
      }
      if (network.networkId === pairedNetworkId) {
        return !pairedNetwork?.supportSingleSwap;
      }
      return !(
        pairedNetwork?.supportCrossChainSwap && network.supportCrossChainSwap
      );
    })
    .map((network) => network.networkId);
}
