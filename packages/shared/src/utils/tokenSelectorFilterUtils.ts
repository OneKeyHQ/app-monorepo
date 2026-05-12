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
