import type { IAllNetworkAccountInfo } from '@onekeyhq/kit-bg/src/services/ServiceAllNetwork/ServiceAllNetwork';
import { isAddressLikeTokenSearchKeywords } from '@onekeyhq/shared/src/utils/tokenSelectorCrossNetworkUtils';
import { swapStockTokenListMaxCount } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import {
  ESwapTabSwitchType,
  type IFetchTokensParams,
} from '@onekeyhq/shared/types/swap/types';

// A pasted contract address searches every network, because users often do
// not know which chain the address belongs to. The selected network is kept
// for name/symbol searches and for Stock, whose network scope is curated.
export function resolveSwapTokenSearchNetworkId({
  selectedNetworkId,
  keywords,
  swapType,
  allNetworksId,
}: {
  selectedNetworkId?: string;
  keywords?: string;
  swapType?: ESwapTabSwitchType;
  allNetworksId?: string;
}) {
  if (
    !allNetworksId ||
    swapType === ESwapTabSwitchType.STOCK ||
    !isAddressLikeTokenSearchKeywords(keywords)
  ) {
    return selectedNetworkId;
  }
  return allNetworksId;
}

export function buildSwapTokenFetchParams({
  currentNetworkId,
  currentSelectNetworkId,
  keywords,
  swapType,
  lpToken,
  requestCurrency,
  matchedAccount,
  shouldUseCurrentAccountAddress,
  currentAccountAddress,
  currentAccountNetworkId,
  currentAccountId,
}: {
  currentNetworkId?: string;
  currentSelectNetworkId?: string;
  keywords?: string;
  swapType?: ESwapTabSwitchType;
  lpToken?: boolean;
  requestCurrency?: string;
  matchedAccount?: IAllNetworkAccountInfo;
  shouldUseCurrentAccountAddress: boolean;
  currentAccountAddress?: string;
  currentAccountNetworkId?: string;
  currentAccountId?: string;
}): IFetchTokensParams {
  const targetNetworkId = currentSelectNetworkId ?? currentNetworkId;
  const baseParams: IFetchTokensParams = {
    protocol: swapType,
    networkId: targetNetworkId,
    keywords,
    lpToken,
    currency: requestCurrency,
    ...(keywords && !lpToken ? { onlySwapTokens: true } : {}),
    // Stock selection needs the complete server-backed list for both the
    // all-network and a concrete-network selector. The service defaults to
    // 50 items; that silently makes later stocks impossible to pick on
    // mobile, where the selector has no pagination affordance.
    ...(swapType === ESwapTabSwitchType.STOCK
      ? { limit: swapStockTokenListMaxCount }
      : {}),
  };

  if (matchedAccount?.apiAddress) {
    return {
      ...baseParams,
      accountAddress: matchedAccount.apiAddress,
      accountNetworkId: matchedAccount.networkId,
      accountId: matchedAccount.accountId,
    };
  }

  if (shouldUseCurrentAccountAddress) {
    return {
      ...baseParams,
      accountAddress: currentAccountAddress,
      accountNetworkId: currentAccountNetworkId,
      accountId: currentAccountId,
    };
  }

  return baseParams;
}
