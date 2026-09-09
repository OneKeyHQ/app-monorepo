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
  const importToToken = inputDraft?.toToken ?? swapToken;
  const draftFromToken =
    inputDraft?.fromToken &&
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
    swapTabSwitchType: ESwapTabSwitchType.SWAP,
  };
}
