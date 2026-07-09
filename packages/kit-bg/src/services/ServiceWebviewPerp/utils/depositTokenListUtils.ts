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
  const indexedTokens: Array<{ index: number; token: IPerpsDepositToken }> = [];
  let index = 0;

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
        indexedTokens.push({ index, token });
      }
      index += 1;
    }
  }

  return indexedTokens
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

export function getDefaultPerpsDepositToken({
  tokens,
  defaultTokens,
}: {
  tokens: IPerpsDepositToken[];
  defaultTokens?: IPerpsDepositToken[];
}) {
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
}: {
  tokens: IPerpsDepositToken[];
  currentToken?: IPerpsDepositToken;
  defaultTokens?: IPerpsDepositToken[];
}) {
  const matchedCurrentToken = findMatchedPerpsDepositToken({
    tokens,
    targetToken: currentToken,
  });
  if (matchedCurrentToken) {
    return matchedCurrentToken;
  }

  return getDefaultPerpsDepositToken({ tokens, defaultTokens });
}
