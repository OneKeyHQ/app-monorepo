import {
  ARC_ERC20_USDC_CONTRACT_ADDRESS,
  ARC_NETWORK_ID,
  getSwapBridgeDefaultToToken,
  swapDefaultSetTokens,
} from '../../types/swap/SwapProvider.constants';
import { getNetworkIdsMap } from '../config/networkIds';

import { equalTokenNoCaseSensitive } from './tokenUtils';

import type { ISwapNetwork, ISwapToken } from '../../types/swap/types';

type ISwapEntryTokenIdentity = {
  networkId?: string;
  contractAddress?: string;
  isNative?: boolean;
};

// Arc's ERC-20 USDC spends the same balance as its native gas token.
// Keep the ERC-20 identity for quoting, approvals and transaction building.
export function shouldReserveSwapGas(token?: ISwapEntryTokenIdentity) {
  return Boolean(
    token?.isNative ||
    (token?.networkId === ARC_NETWORK_ID &&
      token?.contractAddress?.toLowerCase() ===
        ARC_ERC20_USDC_CONTRACT_ADDRESS),
  );
}

export function isSwapEntryDisabledToken(token: ISwapEntryTokenIdentity) {
  if (token.networkId !== ARC_NETWORK_ID) {
    return false;
  }

  // Arc exposes one USDC balance through native and ERC-20 identities, but
  // Swap providers and transaction builders support only the ERC-20 identity.
  return token.isNative === true || token.contractAddress === '';
}

export function getSwapConfiguredDefaultToToken(
  fromToken: ISwapToken,
  swapNetworks: ISwapNetwork[] = [],
): ISwapToken | undefined {
  if (fromToken.networkId !== ARC_NETWORK_ID) {
    return undefined;
  }

  const defaultTokens =
    getSwapNetworkDefaultTokenPair(
      swapNetworks.find((network) => network.networkId === fromToken.networkId),
    ) ?? swapDefaultSetTokens[fromToken.networkId];
  if (
    !defaultTokens?.fromToken ||
    !equalTokenNoCaseSensitive({
      token1: fromToken,
      token2: defaultTokens.fromToken,
    })
  ) {
    return undefined;
  }

  return defaultTokens.toToken;
}

export function getSwapNetworkDefaultTokenPair(network?: ISwapNetwork) {
  const fromToken = network?.defaultSelectTokenDetail?.from;
  const toToken = network?.defaultSelectTokenDetail?.to;
  if (
    !network ||
    !fromToken ||
    !toToken ||
    fromToken.networkId !== network.networkId ||
    toToken.networkId !== network.networkId ||
    !fromToken.symbol ||
    !toToken.symbol ||
    typeof fromToken.contractAddress !== 'string' ||
    typeof toToken.contractAddress !== 'string' ||
    !Number.isFinite(fromToken.decimals) ||
    !Number.isFinite(toToken.decimals) ||
    equalTokenNoCaseSensitive({ token1: fromToken, token2: toToken })
  ) {
    return undefined;
  }
  return { fromToken, toToken };
}

export function getSwapDefaultCounterpartToken({
  fromToken,
  swapNetworks = [],
}: {
  fromToken: ISwapToken;
  swapNetworks?: ISwapNetwork[];
}) {
  const backend = getSwapNetworkDefaultTokenPair(
    swapNetworks.find((network) => network.networkId === fromToken.networkId),
  );
  const local = swapDefaultSetTokens[fromToken.networkId];
  // Changing the default source must preserve ordinary token-to-native behavior.
  const candidates = fromToken.isNative
    ? [backend?.toToken, backend?.fromToken, local?.toToken]
    : [backend?.fromToken, backend?.toToken, local?.fromToken];
  return candidates.find(
    (candidate) =>
      candidate &&
      Boolean(candidate.isNative) !== Boolean(fromToken.isNative) &&
      !equalTokenNoCaseSensitive({ token1: candidate, token2: fromToken }),
  );
}

export function getSwapEntryDefaultToToken({
  fromToken,
  swapNetworks = [],
  isSupportSwap,
  isSupportCrossChain,
}: {
  fromToken: ISwapToken;
  swapNetworks?: ISwapNetwork[];
  isSupportSwap?: boolean;
  isSupportCrossChain?: boolean;
}) {
  const configuredToken = getSwapConfiguredDefaultToToken(
    fromToken,
    swapNetworks,
  );
  if (configuredToken) {
    return configuredToken;
  }
  if (
    (fromToken.networkId === getNetworkIdsMap().btc && fromToken.isNative) ||
    (!isSupportSwap && isSupportCrossChain)
  ) {
    return getSwapBridgeDefaultToToken(fromToken);
  }
  // Unknown capabilities can preview a default; execution still validates support.
  return isSupportSwap !== false
    ? getSwapDefaultCounterpartToken({ fromToken, swapNetworks })
    : undefined;
}
