import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import { swapDefaultSetTokens } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type {
  ISwapNetwork,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import { getSwapStableTokenKey } from './swapStableCoinUtils';

type ISwapCarryToken = Pick<
  ISwapToken,
  'networkId' | 'contractAddress' | 'isNative'
>;

function isStableToken(
  token: ISwapCarryToken | undefined,
  stableTokenKeys: ReadonlySet<string>,
) {
  const key = getSwapStableTokenKey(token);
  return Boolean(key && stableTokenKeys.has(key));
}

export function isSwapTokenSelectionCurrent({
  currentFromToken,
  currentToToken,
  selectedFromToken,
  selectedToToken,
}: {
  currentFromToken?: ISwapCarryToken;
  currentToToken?: ISwapCarryToken;
  selectedFromToken?: ISwapCarryToken;
  selectedToToken?: ISwapCarryToken;
}) {
  const areEqual = (
    token1: ISwapCarryToken | undefined,
    token2: ISwapCarryToken | undefined,
  ) =>
    token1 && token2
      ? equalTokenNoCaseSensitive({ token1, token2 })
      : token1 === token2;

  return (
    areEqual(currentFromToken, selectedFromToken) &&
    areEqual(currentToToken, selectedToToken)
  );
}

export function resolveSwapToProCarryToken<T extends ISwapCarryToken>({
  fromToken,
  proSupportedNetworkIds,
  stableTokenKeys,
  toToken,
}: {
  fromToken?: T;
  proSupportedNetworkIds: ReadonlySet<string>;
  stableTokenKeys: ReadonlySet<string>;
  toToken?: T;
}): T | undefined {
  const targetToken = isStableToken(toToken, stableTokenKeys)
    ? fromToken
    : toToken;
  if (
    !targetToken ||
    isStableToken(targetToken, stableTokenKeys) ||
    !proSupportedNetworkIds.has(targetToken.networkId)
  ) {
    return undefined;
  }
  return targetToken;
}

export function resolveProToSwapCarryPair<T extends ISwapToken>({
  fromToken,
  proToken,
  stableTokenKeys,
  swapNetworks,
}: {
  fromToken?: T;
  proToken?: T;
  stableTokenKeys: ReadonlySet<string>;
  swapNetworks: ISwapNetwork[];
}): { fromToken: ISwapToken; toToken: T } | undefined {
  if (
    !proToken ||
    isStableToken(proToken, stableTokenKeys) ||
    equalTokenNoCaseSensitive({ token1: fromToken, token2: proToken })
  ) {
    return undefined;
  }
  const targetNetwork = swapNetworks.find(
    (network) => network.networkId === proToken.networkId,
  );
  if (!targetNetwork?.supportSingleSwap) {
    return undefined;
  }

  if (fromToken?.networkId === proToken.networkId) {
    return { fromToken, toToken: proToken };
  }

  const nativeFromToken = swapDefaultSetTokens[proToken.networkId]?.fromToken;
  if (
    !nativeFromToken?.isNative ||
    equalTokenNoCaseSensitive({ token1: nativeFromToken, token2: proToken })
  ) {
    return undefined;
  }
  return { fromToken: nativeFromToken, toToken: proToken };
}

export type ISwapProTokenCarryUtils = {
  isSwapTokenSelectionCurrent: typeof isSwapTokenSelectionCurrent;
  resolveProToSwapCarryPair: typeof resolveProToSwapCarryPair;
  resolveSwapToProCarryToken: typeof resolveSwapToProCarryToken;
};

export const swapProTokenCarryUtils: ISwapProTokenCarryUtils = {
  isSwapTokenSelectionCurrent,
  resolveProToSwapCarryPair,
  resolveSwapToProCarryToken,
};
