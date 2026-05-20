import type { IServerNetwork } from '../../types';

export const TOKEN_SELECTOR_LP_TOKEN_FILTER_ENABLED = true;

export function isTokenSelectorDappTokenFilterSupportedNetwork({
  network,
}: {
  network?: Pick<
    IServerNetwork,
    'id' | 'isAllNetworks' | 'backendIndex'
  > | null;
}) {
  if (!TOKEN_SELECTOR_LP_TOKEN_FILTER_ENABLED || !network) {
    return false;
  }
  if (network.isAllNetworks) {
    return true;
  }
  return network.backendIndex === true;
}

export function filterTokenSelectorTokensByBackendIndexedNetworks<
  T extends { networkId?: string },
>({
  tokens,
  backendIndexedNetworkIds,
}: {
  tokens: T[];
  backendIndexedNetworkIds: string[];
}) {
  const backendIndexedNetworkIdSet = new Set(backendIndexedNetworkIds);
  return tokens.filter(
    (token) =>
      !!token.networkId && backendIndexedNetworkIdSet.has(token.networkId),
  );
}

export function buildTokenSelectorDappTokenFilterParams({
  lpToken,
}: {
  lpToken: boolean;
}) {
  if (!TOKEN_SELECTOR_LP_TOKEN_FILTER_ENABLED) {
    return {};
  }
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

export function isTokenSelectorDappToken({
  dappName,
}: {
  dappName?: string | null;
}) {
  return Boolean(dappName?.trim());
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

export const SWAP_LP_TOKEN_FILTER_SERVER_SUPPORTED =
  TOKEN_SELECTOR_LP_TOKEN_FILTER_ENABLED;

export function shouldSendSwapLpTokenParam(lpToken?: boolean) {
  return SWAP_LP_TOKEN_FILTER_SERVER_SUPPORTED && typeof lpToken === 'boolean';
}
