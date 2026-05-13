export function buildTokenSelectorDappTokenFilterParams({
  lpToken,
}: {
  lpToken: boolean;
}) {
  return lpToken
    ? {
        withoutDappToken: false,
        withoutWalletToken: true,
      }
    : {
        withoutDappToken: true,
        withoutWalletToken: false,
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

export const SWAP_LP_TOKEN_FILTER_SERVER_SUPPORTED = true;

export function shouldSendSwapLpTokenParam(lpToken?: boolean) {
  return SWAP_LP_TOKEN_FILTER_SERVER_SUPPORTED && typeof lpToken === 'boolean';
}
