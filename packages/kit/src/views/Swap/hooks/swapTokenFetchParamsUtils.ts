import type { IAllNetworkAccountInfo } from '@onekeyhq/kit-bg/src/services/ServiceAllNetwork/ServiceAllNetwork';
import type {
  ESwapTabSwitchType,
  IFetchTokensParams,
} from '@onekeyhq/shared/types/swap/types';

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
