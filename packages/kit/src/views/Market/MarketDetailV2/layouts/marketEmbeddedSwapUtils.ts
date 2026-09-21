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
 * A retained draft pair may be restored as-is while it is a resolved,
 * non-degenerate pair. A pair that no longer holds the Market token is still
 * restorable: under the same inputDraftKey it can only come from the user's own
 * token selection on this asset, while a real asset change resets the draft
 * (`inputDraftKey`). Restoring both sides verbatim is also what keeps a payment
 * token on another network from being replaced by a channel default.
 */
export function isRestorableMarketDraftPair(
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
  return !isSameSwapToken(fromToken, toToken);
}

/**
 * An amount belongs to the pair that produced it. The shared Swap ticket only
 * consumes the retained amount; both of its tokens come from the seeded params
 * (`SwapMainLand` -> `initialSelectedTokensOnInit`), so the amount may only be
 * forwarded while the seeded pair is exactly the draft's pair. Otherwise a
 * fallback pay token or a stock variant switch would receive an amount typed for
 * another token.
 */
export function isDraftAmountRestorable(
  inputDraft: ISwapInputAmountDraft | undefined,
  params: ISwapInitParams | undefined,
) {
  if (!inputDraft?.fromToken || !inputDraft?.toToken || !params) {
    return false;
  }
  return (
    isSameSwapToken(inputDraft.fromToken, params.importFromToken) &&
    isSameSwapToken(inputDraft.toToken, params.importToToken)
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
  const shouldRestoreDraftPair = isRestorableMarketDraftPair(
    inputDraft,
    swapToken,
  );
  const importToToken = shouldRestoreDraftPair ? inputDraft.toToken : swapToken;
  const draftFromToken = shouldRestoreDraftPair
    ? inputDraft.fromToken
    : getSameNetworkDraftFromToken({
        inputDraft,
        importToToken,
      });
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
