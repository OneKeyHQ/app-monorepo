import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import {
  getSwapBridgeDefaultToToken,
  swapDefaultSetTokens,
} from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

export function getMarketSwapDefaultPair({
  token,
  direction = 'to',
  isSupported,
}: {
  token: ISwapToken;
  direction?: 'from' | 'to';
  isSupported?: (token: ISwapToken, type: ESwapTabSwitchType) => boolean;
}) {
  if (
    isSupported &&
    !isSupported(token, ESwapTabSwitchType.SWAP) &&
    !isSupported(token, ESwapTabSwitchType.BRIDGE)
  ) {
    return {
      fromToken: undefined,
      toToken: undefined,
      swapType: ESwapTabSwitchType.SWAP,
    };
  }
  const defaults = swapDefaultSetTokens[token.networkId];
  // Reuse Trade's configured pair, including non-USDC trading tokens such as KAT.
  const preferred = defaults?.[defaults.marketDefaultToken ?? 'toToken'];
  const sameToken = (candidate: ISwapToken) =>
    equalTokenNoCaseSensitive({ token1: candidate, token2: token });
  const sameChainSupported =
    !isSupported || isSupported(token, ESwapTabSwitchType.SWAP);
  let configuredToken = swapDefaultSetTokens['evm--1'].toToken;
  if (preferred && sameChainSupported) {
    configuredToken = sameToken(preferred)
      ? [defaults?.fromToken, defaults?.toToken].find(
          (candidate) => candidate && !sameToken(candidate),
        )
      : preferred;
  }
  const getSwapType = (candidate?: ISwapToken) =>
    candidate && candidate.networkId !== token.networkId
      ? ESwapTabSwitchType.BRIDGE
      : ESwapTabSwitchType.SWAP;
  const counterpart = [
    configuredToken,
    getSwapBridgeDefaultToToken(token),
  ].find(
    (candidate) =>
      candidate &&
      !sameToken(candidate) &&
      (!isSupported ||
        (isSupported(token, getSwapType(candidate)) &&
          isSupported(candidate, getSwapType(candidate)))),
  );
  return {
    fromToken: direction === 'from' ? token : counterpart,
    toToken: direction === 'to' ? token : counterpart,
    swapType: getSwapType(counterpart),
  };
}
