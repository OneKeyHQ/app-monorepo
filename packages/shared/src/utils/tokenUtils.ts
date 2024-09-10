import BigNumber from 'bignumber.js';
import { forEach, isNil, uniqBy } from 'lodash';

import { SEARCH_KEY_MIN_LENGTH } from '../consts/walletConsts';

import networkUtils from './networkUtils';

import type { IAccountToken, ITokenData, ITokenFiat } from '../../types/token';

export const caseSensitiveNetworkImpl = [
  'sol',
  'stc',
  'tron',
  'aptos',
  'sui',
  'ton',
];

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
  searchAll,
  searchTokenList,
}: {
  tokens: IAccountToken[];
  searchKey: string;
  searchAll?: boolean;
  searchTokenList?: IAccountToken[];
}) {
  let mergedTokens = tokens;

  if (searchAll && searchTokenList) {
    mergedTokens = mergedTokens.concat(searchTokenList);
    mergedTokens = uniqBy(
      mergedTokens,
      (token) => `${token.address}_${token.networkId ?? ''}`,
    );
  }
  if (!searchKey || searchKey.length < SEARCH_KEY_MIN_LENGTH) {
    return mergedTokens;
  }

  // eslint-disable-next-line no-param-reassign
  searchKey = searchKey.trim().toLowerCase();

  const filteredTokens = mergedTokens.filter(
    (token) =>
      token.name?.toLowerCase().includes(searchKey) ||
      token.symbol?.toLowerCase().includes(searchKey) ||
      token.address?.toLowerCase() === searchKey,
  );

  return filteredTokens;
}

export function sortTokensByFiatValue({
  tokens,
  map = {},
}: {
  tokens: IAccountToken[];
  map?: {
    [key: string]: ITokenFiat;
  };
}) {
  return tokens.sort((a, b) => {
    const aFiat = map[a.$key]?.fiatValue ?? 0;
    const bFiat = map[b.$key]?.fiatValue ?? 0;

    return new BigNumber(bFiat).comparedTo(aFiat);
  });
}

export function sortTokensByOrder({ tokens }: { tokens: IAccountToken[] }) {
  return tokens.sort((a, b) => {
    if (!isNil(a.order) && !isNil(b.order)) {
      return new BigNumber(a.order).comparedTo(b.order);
    }
    if (isNil(a.order) && !isNil(b.order)) {
      return 1;
    }
    if (!isNil(a.order) && isNil(b.order)) {
      return -1;
    }

    return 0;
  });
}

export function mergeDeriveTokenListMap({
  sourceMap,
  targetMap,
  mergeDeriveAssets,
}: {
  sourceMap: {
    [key: string]: ITokenFiat;
  };
  targetMap: {
    [key: string]: ITokenFiat;
  };
  mergeDeriveAssets?: boolean;
}) {
  if (mergeDeriveAssets) {
    forEach(sourceMap, (value, key) => {
      const keyArr = key.split('_');
      const groupDeriveKey = `${keyArr[0]}_${keyArr[keyArr.length - 1]}`;
      const mergedToken = targetMap[groupDeriveKey];

      if (mergedToken && !targetMap[key]) {
        mergedToken.balance = new BigNumber(mergedToken.balance)
          .plus(value.balance)
          .toFixed();
        mergedToken.balanceParsed = new BigNumber(mergedToken.balanceParsed)
          .plus(value.balanceParsed)
          .toFixed();
        mergedToken.frozenBalance = new BigNumber(
          mergedToken.frozenBalance ?? 0,
        )
          .plus(value.frozenBalance ?? 0)
          .toFixed();

        mergedToken.frozenBalanceParsed = new BigNumber(
          mergedToken.frozenBalanceParsed ?? 0,
        )
          .plus(value.frozenBalanceParsed ?? 0)
          .toFixed();

        mergedToken.totalBalance = new BigNumber(mergedToken.totalBalance ?? 0)
          .plus(value.totalBalance ?? 0)
          .toFixed();

        mergedToken.totalBalanceParsed = new BigNumber(
          mergedToken.totalBalanceParsed ?? 0,
        )
          .plus(value.totalBalanceParsed ?? 0)
          .toFixed();

        mergedToken.fiatValue = new BigNumber(mergedToken.fiatValue)
          .plus(value.fiatValue)
          .toFixed();

        mergedToken.frozenBalanceFiatValue = new BigNumber(
          mergedToken.frozenBalanceFiatValue ?? 0,
        )
          .plus(value.frozenBalanceFiatValue ?? 0)
          .toFixed();

        mergedToken.totalBalanceFiatValue = new BigNumber(
          mergedToken.totalBalanceFiatValue ?? 0,
        )
          .plus(value.totalBalanceFiatValue ?? 0)
          .toFixed();

        targetMap[groupDeriveKey] = {
          ...mergedToken,
        };
      } else {
        targetMap[groupDeriveKey] = {
          ...value,
        };
      }
    });
  }

  return {
    ...targetMap,
    ...sourceMap,
  };
}

export function mergeDeriveTokenList({
  sourceTokens,
  targetTokens,
  mergeDeriveAssets,
}: {
  sourceTokens: IAccountToken[];
  targetTokens: IAccountToken[];
  mergeDeriveAssets?: boolean;
}) {
  let newTokens = targetTokens;

  if (mergeDeriveAssets) {
    forEach(sourceTokens, (token) => {
      const keyArr = token.$key.split('_');
      const mergedDeriveKey = `${keyArr[0]}_${keyArr[keyArr.length - 1]}`;

      if (!token.mergeAssets) {
        newTokens.push(token);
      } else if (!newTokens.find((item) => item.$key === mergedDeriveKey)) {
        newTokens.push({
          ...token,
          $key: mergedDeriveKey,
        });
      }
    });
  } else {
    newTokens = newTokens.concat(sourceTokens);
  }

  return newTokens;
}

export function equalTokenNoCaseSensitive({
  token1,
  token2,
}: {
  token1?: { networkId?: string; contractAddress?: string };
  token2?: { networkId?: string; contractAddress?: string };
}) {
  if (!token1 || !token2 || !token1.networkId || !token2.networkId) {
    return false;
  }
  if (token1?.networkId !== token2?.networkId) return false;
  const impl = networkUtils.getNetworkImpl({ networkId: token1.networkId });
  if (caseSensitiveNetworkImpl.includes(impl)) {
    return token1?.contractAddress === token2?.contractAddress;
  }
  return (
    token1?.contractAddress?.toLowerCase() ===
    token2?.contractAddress?.toLowerCase()
  );
}
