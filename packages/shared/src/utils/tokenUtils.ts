import type { ITokenData } from '../../types/token';

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
