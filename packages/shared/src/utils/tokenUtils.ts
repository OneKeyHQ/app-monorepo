import type { IAccountToken, ITokenData } from '../../types/token';

export function getMergedTokenData({
  tokens,
  smallBalanceTokens,
  riskTokens,
}: {
  tokens: ITokenData;
  smallBalanceTokens: ITokenData;
  riskTokens: ITokenData;
}) {
  const mergedTokens = [
    ...tokens.data,
    ...smallBalanceTokens.data,
    ...riskTokens.data,
  ];

  const mergedKeys = `${tokens.keys}_${smallBalanceTokens.keys}_${riskTokens.keys}`;

  const mergedTokenMap = {
    ...tokens.map,
    ...smallBalanceTokens.map,
    ...riskTokens.map,
  };

  return {
    allTokens: {
      data: mergedTokens,
      keys: mergedKeys,
      map: mergedTokenMap,
    },
    tokens,
    riskTokens,
    smallBalanceTokens,
  };
}

export function getEmptyTokenData() {
  return {
    allTokens: {
      data: [],
      keys: '',
      map: {},
    },
    tokens: {
      data: [],
      keys: '',
      map: {},
    },
    riskTokens: {
      data: [],
      keys: '',
      map: {},
    },
    smallBalanceTokens: {
      data: [],
      keys: '',
      map: {},
    },
  };
}

export function getFilteredTokenBySearchKey({
  tokens,
  searchKey,
}: {
  tokens: IAccountToken[];
  searchKey: string;
}) {
  if (!searchKey || tokens.length < 2) {
    return tokens;
  }

  // eslint-disable-next-line no-param-reassign
  searchKey = searchKey.trim().toLowerCase();

  const filteredTokens = tokens.filter(
    (token) =>
      token.name.toLowerCase().includes(searchKey) ||
      token.symbol.toLowerCase().includes(searchKey) ||
      token.address.toLowerCase().includes(searchKey),
  );

  return filteredTokens;
}
