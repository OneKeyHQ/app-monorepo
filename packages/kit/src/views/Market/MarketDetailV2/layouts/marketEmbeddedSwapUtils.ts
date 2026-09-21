import type { ISwapInputAmountDraft } from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type {
  ISwapInitParams,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';
import {
  ESwapSource,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

function isSameSwapToken(token1?: ISwapToken, token2?: ISwapToken) {
  return Boolean(
    token1 &&
    token2 &&
    equalTokenNoCaseSensitive({
      token1,
      token2,
    }),
  );
}

/**
 * A retained draft may seed the ticket as-is only while it still describes this
 * Market asset's trade: both sides are resolved, the pair is not degenerate, and
 * the Market token is still one of them. Restoring such a pair keeps both sides
 * as the user left them — including a pay token on another network, which
 * otherwise gets replaced by a channel default while the entered amount stays
 * behind on the new token.
 */
export function isMarketDraftPairForToken(
  inputDraft: ISwapInputAmountDraft | undefined,
  swapToken: ISwapToken,
): inputDraft is ISwapInputAmountDraft & {
  fromToken: ISwapToken;
  toToken: ISwapToken;
} {
  const { fromToken, toToken } = inputDraft ?? {};
  if (!fromToken || !toToken || swapToken.isStock) {
    return false;
  }
  if (isSameSwapToken(fromToken, toToken)) {
    return false;
  }
  return (
    isSameSwapToken(fromToken, swapToken) || isSameSwapToken(toToken, swapToken)
  );
}

/**
 * A resolved pair that lost the Market token belongs to an older identity, so
 * neither of its tokens nor its amount may seed this ticket. Stock pairs are
 * exempt: their target is owned by Market's selectedTokenVariant, not by the
 * draft.
 */
export function isStaleMarketDraftPair(
  inputDraft: ISwapInputAmountDraft | undefined,
  swapToken: ISwapToken,
) {
  return (
    !swapToken.isStock &&
    Boolean(inputDraft?.fromToken && inputDraft?.toToken) &&
    !isMarketDraftPairForToken(inputDraft, swapToken)
  );
}

/**
 * A draft that is not a resolved pair only contributes a pay token, and only
 * from the target's own network.
 */
function getSameNetworkDraftFromToken({
  inputDraft,
  importToToken,
}: {
  inputDraft?: ISwapInputAmountDraft;
  importToToken: ISwapToken;
}) {
  const draftFromToken = inputDraft?.fromToken;
  if (
    !draftFromToken ||
    isSameSwapToken(draftFromToken, importToToken) ||
    draftFromToken.networkId !== importToToken.networkId
  ) {
    return undefined;
  }
  return draftFromToken;
}

export function buildMarketEmbeddedSwapInitParams({
  defaultTokens,
  inputDraft,
  swapToken,
}: {
  defaultTokens: ISwapToken[];
  inputDraft?: ISwapInputAmountDraft;
  swapToken: ISwapToken;
}): ISwapInitParams | undefined {
  // The stock variant is controlled by Market's selectedTokenVariant, so a stock
  // ticket always targets the latest variant token when the selection changes
  // while the embedded Swap remains mounted.
  const shouldRestoreDraftPair = isMarketDraftPairForToken(
    inputDraft,
    swapToken,
  );
  const importToToken = shouldRestoreDraftPair ? inputDraft.toToken : swapToken;
  let draftFromToken: ISwapToken | undefined;
  if (shouldRestoreDraftPair) {
    draftFromToken = inputDraft.fromToken;
  } else if (!isStaleMarketDraftPair(inputDraft, swapToken)) {
    draftFromToken = getSameNetworkDraftFromToken({
      inputDraft,
      importToToken,
    });
  }
  const importFromToken =
    draftFromToken ??
    defaultTokens.find((token) => !isSameSwapToken(token, importToToken));

  if (!importFromToken) {
    return undefined;
  }

  return {
    importFromToken,
    importNetworkId: importFromToken.networkId,
    importToToken,
    swapSource: ESwapSource.MARKET,
    swapTabSwitchType: importToToken.isStock
      ? ESwapTabSwitchType.STOCK
      : ESwapTabSwitchType.SWAP,
  };
}
