import type { IServerNetwork } from '../../types';

export const TOKEN_SELECTOR_LP_TOKEN_FILTER_ENABLED = true;

export function isTokenSelectorDappTokenFilterSupportedNetworkBase({
  backendIndex,
  isDeFiEnabled,
}: {
  backendIndex?: boolean;
  isDeFiEnabled?: boolean;
}) {
  return backendIndex === true && isDeFiEnabled === true;
}

export function isTokenSelectorDappTokenFilterSupportedNetwork({
  network,
  isDeFiEnabled,
}: {
  network?: Pick<
    IServerNetwork,
    'id' | 'isAllNetworks' | 'backendIndex'
  > | null;
  isDeFiEnabled?: boolean;
}) {
  if (!TOKEN_SELECTOR_LP_TOKEN_FILTER_ENABLED || !network) {
    return false;
  }
  if (network.isAllNetworks) {
    return true;
  }
  return isTokenSelectorDappTokenFilterSupportedNetworkBase({
    backendIndex: network.backendIndex,
    isDeFiEnabled,
  });
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
  currency,
}: {
  accountId: string;
  lpToken?: boolean;
  currency?: string;
}) {
  const currencyKey = currency ? `__${currency}` : '';
  return `${accountId}${lpToken ? '__lpToken' : ''}${currencyKey}`;
}

export const SWAP_LP_TOKEN_FILTER_SERVER_SUPPORTED =
  TOKEN_SELECTOR_LP_TOKEN_FILTER_ENABLED;

export function shouldSendSwapLpTokenParam(lpToken?: boolean) {
  return SWAP_LP_TOKEN_FILTER_SERVER_SUPPORTED && typeof lpToken === 'boolean';
}
