import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

export function getMarketSwapDefaultPair({
  token,
  direction = 'to',
  defaultTokens,
  isSupported,
}: {
  token: ISwapToken;
  direction?: 'from' | 'to';
  defaultTokens: ISwapToken[];
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
  const sameToken = (candidate: ISwapToken) =>
    equalTokenNoCaseSensitive({ token1: candidate, token2: token });
  const getSwapType = (candidate?: ISwapToken) =>
    candidate && candidate.networkId !== token.networkId
      ? ESwapTabSwitchType.BRIDGE
      : ESwapTabSwitchType.SWAP;
  // Market candidates retain the configured server order.
  const counterpart = defaultTokens.find(
    (candidate) =>
      candidate &&
      !candidate.isNative &&
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
