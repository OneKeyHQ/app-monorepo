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
    tokens: {
      data: mergedTokens,
      keys: mergedKeys,
      map: mergedTokenMap,
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

export function getEmptyTokenData() {
  return {
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
  if (!searchKey) {
    return tokens;
  }

  const filteredTokens = tokens.filter(
    (token) =>
      token.name.toLowerCase().includes(searchKey.toLowerCase()) ||
      token.symbol.toLowerCase().includes(searchKey.toLowerCase()) ||
      token.address.toLowerCase().includes(searchKey.toLowerCase()),
  );

  return filteredTokens;
}
