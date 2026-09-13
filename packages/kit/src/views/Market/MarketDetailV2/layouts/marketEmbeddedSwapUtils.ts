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

export function buildMarketEmbeddedSwapInitParams({
  defaultTokens,
  inputDraft,
  swapToken,
}: {
  defaultTokens: ISwapToken[];
  inputDraft?: ISwapInputAmountDraft;
  swapToken: ISwapToken;
}): ISwapInitParams | undefined {
  // The stock variant is controlled by Market's selectedTokenVariant. Keep
  // the user's amount draft, but always use the latest variant token when the
  // selection changes while the embedded Swap remains mounted.
  const importToToken = swapToken.isStock
    ? swapToken
    : (inputDraft?.toToken ?? swapToken);
  const draftFromToken =
    inputDraft?.fromToken &&
    inputDraft.fromToken.networkId === importToToken.networkId &&
    !equalTokenNoCaseSensitive({
      token1: inputDraft.fromToken,
      token2: importToToken,
    })
      ? inputDraft.fromToken
      : undefined;
  const importFromToken =
    draftFromToken ??
    defaultTokens.find(
      (token) =>
        !equalTokenNoCaseSensitive({
          token1: token,
          token2: importToToken,
        }),
    );

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
