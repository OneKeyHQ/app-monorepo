export function buildTokenSelectorDappTokenFilterParams({
  lpToken,
}: {
  lpToken: boolean;
}) {
  return lpToken
    ? {
        withoutWalletToken: true,
      }
    : {
        withoutDappToken: true,
      };
}

export function buildSwapAllNetworkTokenListCacheKey({
  accountId,
  lpToken,
}: {
  accountId: string;
  lpToken?: boolean;
}) {
  return lpToken ? `${accountId}__lpToken` : accountId;
}

export const SWAP_LP_TOKEN_FILTER_SERVER_SUPPORTED = false;

export function shouldSendSwapLpTokenParam(lpToken?: boolean) {
  return SWAP_LP_TOKEN_FILTER_SERVER_SUPPORTED && !!lpToken;
}
