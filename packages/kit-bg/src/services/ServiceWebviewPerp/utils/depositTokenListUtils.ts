import BigNumber from 'bignumber.js';

import { PERPS_NETWORK_ID } from '@onekeyhq/shared/src/consts/perp';
import { USDC_TOKEN_INFO } from '@onekeyhq/shared/types/hyperliquid/perp.constants';
import type {
  IAccountToken,
  IFetchAccountTokensResp,
  ITokenFiat,
} from '@onekeyhq/shared/types/token';

import type { IPerpsDepositToken } from '../../../states/jotai/atoms';

type IBuildPerpsDepositTokensFromWalletTokenResponsesParams = {
  responses: IFetchAccountTokensResp[];
  networkLogoURIByNetworkId: Record<string, string | undefined>;
};

function normalizeTokenAddress(address?: string) {
  return (address ?? '').toLowerCase();
}

function splitTokenFiatKey(key: string) {
  return key.toLowerCase().split(/[:_]/).filter(Boolean);
}

function getTokenFiat({
  token,
  tokenMap,
}: {
  token: IAccountToken;
  tokenMap: Record<string, ITokenFiat>;
}) {
  const normalizedAddress = normalizeTokenAddress(token.address);
  const candidates = [
    token.$key,
    token.$key && token.$key.toLowerCase(),
    token.networkId && `${token.networkId}_${token.address}`,
    token.networkId && `${token.networkId}_${normalizedAddress}`,
  ].filter(Boolean);

  for (const key of candidates) {
    const fiat = tokenMap[key];
    if (fiat) {
      return fiat;
    }
  }

  if (token.networkId && normalizedAddress) {
    const normalizedNetworkId = token.networkId.toLowerCase();
    const matchedEntry = Object.entries(tokenMap).find(([key]) => {
      const keyParts = splitTokenFiatKey(key);
      return (
        keyParts.includes(normalizedNetworkId) &&
        keyParts.includes(normalizedAddress)
      );
    });
    if (matchedEntry) {
      return matchedEntry[1];
    }
  }

  return undefined;
}

function toOptionalString(value: string | number | undefined) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  return String(value);
}

function hasPositiveFiatValue(token: IPerpsDepositToken) {
  const fiatValue = new BigNumber(token.fiatValue ?? '');
  return fiatValue.isFinite() && fiatValue.gt(0);
}

export function filterPerpsDepositTokensWithPositiveFiatValue(
  tokens: IPerpsDepositToken[],
) {
  return tokens.filter(hasPositiveFiatValue);
}

export function filterPerpsDepositTokensByNetworkWithPositiveFiatValue(
  tokensByNetwork: Record<string, IPerpsDepositToken[]>,
) {
  return Object.fromEntries(
    Object.entries(tokensByNetwork).map(([networkId, tokens]) => [
      networkId,
      filterPerpsDepositTokensWithPositiveFiatValue(tokens),
    ]),
  );
}

function mapWalletTokenToPerpsDepositToken({
  token,
  fiat,
  networkLogoURI,
}: {
  token: IAccountToken;
  fiat?: ITokenFiat;
  networkLogoURI?: string;
}): IPerpsDepositToken | undefined {
  if (!token.networkId) {
    return undefined;
  }

  return {
    networkId: token.networkId,
    contractAddress: token.address ?? '',
    name: token.name,
    symbol: token.symbol,
    decimals: token.decimals,
    networkLogoURI: networkLogoURI ?? '',
    price: toOptionalString(fiat?.price),
    balanceParsed: fiat?.balanceParsed,
    fiatValue: fiat?.fiatValue,
    isNative: token.isNative,
    logoURI: token.logoURI,
  };
}

export function buildPerpsDepositTokensFromWalletTokenResponses({
  responses,
  networkLogoURIByNetworkId,
}: IBuildPerpsDepositTokensFromWalletTokenResponsesParams): IPerpsDepositToken[] {
  const tokens: IPerpsDepositToken[] = [];

  for (const response of responses) {
    for (const walletToken of response.tokens.data) {
      const token = mapWalletTokenToPerpsDepositToken({
        token: walletToken,
        fiat: getTokenFiat({
          token: walletToken,
          tokenMap: response.tokens.map,
        }),
        networkLogoURI: walletToken.networkId
          ? networkLogoURIByNetworkId[walletToken.networkId]
          : undefined,
      });
      if (token) {
        tokens.push(token);
      }
    }
  }

  return sortPerpsDepositTokensByFiatValue(
    filterPerpsDepositTokensWithPositiveFiatValue(tokens),
  );
}

export function sortPerpsDepositTokensByFiatValue(
  tokens: IPerpsDepositToken[],
) {
  return tokens
    .map((token, index) => ({ index, token }))
    .toSorted((a, b) => {
      const valueCompare = new BigNumber(b.token.fiatValue ?? '0').comparedTo(
        new BigNumber(a.token.fiatValue ?? '0'),
      );
      if (valueCompare !== 0) {
        return valueCompare;
      }
      return a.index - b.index;
    })
    .map((item) => item.token);
}

export function buildPerpsDepositTokensByNetwork(tokens: IPerpsDepositToken[]) {
  return tokens.reduce<Record<string, IPerpsDepositToken[]>>((memo, token) => {
    memo[token.networkId] = memo[token.networkId] ?? [];
    memo[token.networkId].push(token);
    return memo;
  }, {});
}

function getPerpsDepositTokenIdentity(token: IPerpsDepositToken) {
  return `${token.networkId.toLowerCase()}:${normalizeTokenAddress(
    token.contractAddress,
  )}`;
}

export function mergePerpsDepositTokensWithServerTokens({
  walletTokens,
  serverTokens,
}: {
  walletTokens: IPerpsDepositToken[];
  serverTokens?: IPerpsDepositToken[];
}) {
  const serverTokensByIdentity = new Map(
    (serverTokens ?? []).map((token) => [
      getPerpsDepositTokenIdentity(token),
      token,
    ]),
  );
  const usedServerTokenIdentities = new Set<string>();
  const mergedWalletTokens = walletTokens.map((walletToken) => {
    const identity = getPerpsDepositTokenIdentity(walletToken);
    const serverToken = serverTokensByIdentity.get(identity);
    if (!serverToken) {
      return walletToken;
    }
    usedServerTokenIdentities.add(identity);
    return {
      ...serverToken,
      ...walletToken,
      isDefault: serverToken.isDefault || walletToken.isDefault || undefined,
    };
  });
  const missingServerTokens = (serverTokens ?? [])
    .filter(
      (token) =>
        !usedServerTokenIdentities.has(getPerpsDepositTokenIdentity(token)),
    )
    .map((token) => ({
      ...token,
      balanceParsed: token.balanceParsed ?? '0',
      fiatValue: token.fiatValue ?? '0',
    }));
  return [...mergedWalletTokens, ...missingServerTokens];
}

function findMatchedPerpsDepositToken({
  tokens,
  targetToken,
}: {
  tokens: IPerpsDepositToken[];
  targetToken?: IPerpsDepositToken;
}) {
  if (!targetToken) {
    return undefined;
  }
  return tokens.find(
    (token) =>
      token.networkId === targetToken.networkId &&
      normalizeTokenAddress(token.contractAddress) ===
        normalizeTokenAddress(targetToken.contractAddress),
  );
}

function getHighestPositiveFiatValuePerpsDepositToken(
  tokens: IPerpsDepositToken[],
) {
  let matchedToken: IPerpsDepositToken | undefined;
  let matchedValue = new BigNumber(0);

  for (const token of tokens) {
    if (token.fiatValue !== undefined) {
      const fiatValue = new BigNumber(token.fiatValue);
      if (
        fiatValue.isFinite() &&
        fiatValue.gt(0) &&
        (!matchedToken || fiatValue.gt(matchedValue))
      ) {
        matchedToken = token;
        matchedValue = fiatValue;
      }
    }
  }

  return matchedToken;
}

export function getDefaultPerpsDepositToken({
  tokens,
  defaultTokens,
}: {
  tokens: IPerpsDepositToken[];
  defaultTokens?: IPerpsDepositToken[];
}) {
  const highestFiatValueToken =
    getHighestPositiveFiatValuePerpsDepositToken(tokens);
  if (highestFiatValueToken) {
    return highestFiatValueToken;
  }

  const markedDefaultToken = tokens.find((token) => token.isDefault);
  if (markedDefaultToken) {
    return markedDefaultToken;
  }
  for (const defaultToken of defaultTokens ?? []) {
    const matchedDefaultToken = findMatchedPerpsDepositToken({
      tokens,
      targetToken: defaultToken,
    });
    if (matchedDefaultToken) {
      return matchedDefaultToken;
    }
  }
  return (
    tokens.find(
      (token) =>
        token.networkId === PERPS_NETWORK_ID &&
        normalizeTokenAddress(token.contractAddress) ===
          normalizeTokenAddress(USDC_TOKEN_INFO.address),
    ) ?? tokens[0]
  );
}

export function resolvePerpsDepositSelectedToken({
  tokens,
  currentToken,
  defaultTokens,
  preserveCurrentToken = false,
}: {
  tokens: IPerpsDepositToken[];
  currentToken?: IPerpsDepositToken;
  defaultTokens?: IPerpsDepositToken[];
  preserveCurrentToken?: boolean;
}) {
  const matchedCurrentToken = findMatchedPerpsDepositToken({
    tokens,
    targetToken: currentToken,
  });
  const highestFiatValueToken =
    getHighestPositiveFiatValuePerpsDepositToken(tokens);
  if (
    matchedCurrentToken &&
    (preserveCurrentToken ||
      !highestFiatValueToken ||
      currentToken?.fiatValue !== undefined)
  ) {
    return matchedCurrentToken;
  }
  if (preserveCurrentToken && currentToken) {
    return currentToken;
  }
  if (highestFiatValueToken) {
    return highestFiatValueToken;
  }

  return getDefaultPerpsDepositToken({ tokens, defaultTokens });
}
