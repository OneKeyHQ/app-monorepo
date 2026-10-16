import type { ISwapInputAmountDraft } from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { getMarketSwapDefaultPair } from '@onekeyhq/kit/src/views/Swap/utils/marketSwapDefaultPair';
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
    (!swapToken.isStock ||
      inputDraft.fromToken.networkId === importToToken.networkId) &&
    !equalTokenNoCaseSensitive({
      token1: inputDraft.fromToken,
      token2: importToToken,
    })
      ? inputDraft.fromToken
      : undefined;
  const defaultPair = getMarketSwapDefaultPair({ token: importToToken });
  const importFromToken =
    draftFromToken ??
    (swapToken.isStock
      ? defaultTokens.find(
          (token) =>
            !equalTokenNoCaseSensitive({
              token1: token,
              token2: importToToken,
            }),
        )
      : defaultPair.fromToken);

  if (!importFromToken && swapToken.isStock) {
    return undefined;
  }

  let swapTabSwitchType = ESwapTabSwitchType.SWAP;
  if (importToToken.isStock) {
    swapTabSwitchType = ESwapTabSwitchType.STOCK;
  } else if (
    importFromToken &&
    importFromToken.networkId !== importToToken.networkId
  ) {
    swapTabSwitchType = ESwapTabSwitchType.BRIDGE;
  }
  return {
    importFromToken,
    importNetworkId: importFromToken?.networkId,
    importToToken,
    swapSource: ESwapSource.MARKET,
    marketSwapDirection:
      !swapToken.isStock && !draftFromToken ? 'to' : undefined,
    swapTabSwitchType,
  };
}
