export function buildTokenSelectorDappTokenFilterParams({
  lpToken,
}: {
  lpToken: boolean;
}) {
  // Keep aligned with server-service-swap `/v1/tokens`: lpToken=true keeps
  // dApp/DeFi tokens by excluding wallet tokens from the wallet token API.
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
