import { ETokenDappType } from '../../types/token';

import type { IServerNetwork } from '../../types';
import type { ITokenDappType } from '../../types/token';

export const TOKEN_SELECTOR_LP_TOKEN_FILTER_ENABLED = true;

const TOKEN_SELECTOR_WALLET_DAPP_NAMES = new Set(['wallet', 'unknown']);

type ITokenSelectorDappTokenLike = {
  dappName?: string | null;
  dappType?: ITokenDappType;
  defiMarked?: boolean;
};

type ITokenSelectorDappTokenFilterParams = {
  withoutDappToken?: boolean;
  withoutWalletToken?: boolean;
};

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
  dappType,
  defiMarked,
}: ITokenSelectorDappTokenLike) {
  if (dappType === ETokenDappType.WalletToken) {
    return false;
  }
  if (dappType) {
    return true;
  }
  if (defiMarked) {
    return true;
  }

  const normalizedDappName = dappName
    ?.trim()
    .toLowerCase()
    .replace(/\s*\/\s*/g, '/');
  if (!normalizedDappName) {
    return false;
  }

  return !TOKEN_SELECTOR_WALLET_DAPP_NAMES.has(normalizedDappName);
}

export function filterTokenSelectorTokensByDappTokenFilterParams<
  T extends ITokenSelectorDappTokenLike,
>({
  tokens,
  tokenSelectorFilterParams,
}: {
  tokens: T[];
  tokenSelectorFilterParams: ITokenSelectorDappTokenFilterParams;
}) {
  if (
    tokenSelectorFilterParams.withoutDappToken &&
    tokenSelectorFilterParams.withoutWalletToken
  ) {
    return [];
  }
  if (tokenSelectorFilterParams.withoutDappToken) {
    return tokens.filter((token) => !isTokenSelectorDappToken(token));
  }
  if (tokenSelectorFilterParams.withoutWalletToken) {
    return tokens.filter((token) => isTokenSelectorDappToken(token));
  }
  return tokens;
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
