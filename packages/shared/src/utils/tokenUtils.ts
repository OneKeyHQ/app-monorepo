import BigNumber from 'bignumber.js';
import { forEach, isNil, uniqBy } from 'lodash';

import { wrappedTokens } from '../../types/swap/SwapProvider.constants';
import { getNetworkIdsMap } from '../config/networkIds';
import { AGGREGATE_TOKEN_MOCK_NETWORK_ID } from '../consts/networkConsts';
import { SEARCH_KEY_MIN_LENGTH } from '../consts/walletConsts';

import accountUtils from './accountUtils';
import networkUtils from './networkUtils';

import type {
  IAccountToken,
  IAggregateToken,
  IFetchAccountTokensResp,
  ITokenData,
  ITokenFiat,
} from '../../types/token';

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
    aggregateTokenListMap: {},
    aggregateTokenMap: {},
  };
}

export function getFilteredTokenBySearchKey({
  tokens,
  searchKey,
  searchAll,
  searchTokenList,
  allowEmptyWhenBelowMinLength,
  aggregateTokenListMap,
  searchKeyLengthThreshold,
}: {
  tokens: IAccountToken[];
  searchKey: string;
  searchAll?: boolean;
  searchTokenList?: IAccountToken[];
  allowEmptyWhenBelowMinLength?: boolean;
  aggregateTokenListMap?: Record<string, { tokens: IAccountToken[] }>;
  searchKeyLengthThreshold?: number;
}) {
  let mergedTokens = tokens;

  if (searchAll && searchTokenList) {
    const aggregateTokens = Object.values(aggregateTokenListMap ?? {}).flatMap(
      (token) => token.tokens,
    );

    const filteredSearchTokenList = searchTokenList.filter(
      (token) =>
        !aggregateTokens.find(
          (t) => t.address === token.address && t.networkId === token.networkId,
        ),
    );

    mergedTokens = mergedTokens.concat(filteredSearchTokenList);
    mergedTokens = uniqBy(
      mergedTokens,
      (token) => `${token.address}_${token.networkId ?? ''}`,
    );
  }
  if (
    !searchKey ||
    searchKey.length < (searchKeyLengthThreshold ?? SEARCH_KEY_MIN_LENGTH)
  ) {
    return allowEmptyWhenBelowMinLength ? [] : mergedTokens;
  }

  // eslint-disable-next-line no-param-reassign
  searchKey = searchKey.trim().toLowerCase();

  const filteredTokens = mergedTokens.filter((token) => {
    if (token.isAggregateToken) {
      const aggregateTokenList = aggregateTokenListMap?.[token.$key];
      if (
        aggregateTokenList?.tokens?.some(
          (t) => t.address?.toLowerCase() === searchKey,
        )
      ) {
        return true;
      }
      return (
        token.name?.toLowerCase().includes(searchKey) ||
        token.symbol?.toLowerCase().includes(searchKey) ||
        token.commonSymbol?.toLowerCase().includes(searchKey)
      );
    }
    return (
      token.name?.toLowerCase().includes(searchKey) ||
      token.symbol?.toLowerCase().includes(searchKey) ||
      token.address?.toLowerCase() === searchKey
    );
  });

  return filteredTokens;
}

export function sortTokensByFiatValue({
  tokens = [],
  map = {},
  sortDirection = 'desc',
}: {
  tokens: IAccountToken[];
  map?: {
    [key: string]: ITokenFiat;
  };
  sortDirection?: 'desc' | 'asc';
}) {
  return [...tokens].sort((a, b) => {
    const aFiat = new BigNumber(map[a.$key]?.fiatValue ?? -1);
    const bFiat = new BigNumber(map[b.$key]?.fiatValue ?? -1);

    if (sortDirection === 'desc') {
      return new BigNumber(bFiat.isNaN() ? -1 : bFiat).comparedTo(
        new BigNumber(aFiat.isNaN() ? -1 : aFiat),
      );
    }

    return new BigNumber(aFiat.isNaN() ? -1 : aFiat).comparedTo(
      new BigNumber(bFiat.isNaN() ? -1 : bFiat),
    );
  });
}

export function sortTokensByPrice({
  tokens,
  map = {},
  sortDirection = 'desc',
}: {
  tokens: IAccountToken[];
  map?: {
    [key: string]: ITokenFiat;
  };
  sortDirection?: 'desc' | 'asc';
}) {
  return [...tokens].sort((a, b) => {
    const aPrice = new BigNumber(map[a.$key]?.price ?? 0);
    const bPrice = new BigNumber(map[b.$key]?.price ?? 0);

    if (sortDirection === 'desc') {
      return new BigNumber(bPrice.isNaN() ? 0 : bPrice).comparedTo(
        new BigNumber(aPrice.isNaN() ? 0 : aPrice),
      );
    }

    return new BigNumber(aPrice.isNaN() ? 0 : aPrice).comparedTo(
      new BigNumber(bPrice.isNaN() ? 0 : bPrice),
    );
  });
}

export function sortTokensByName({
  tokens,
  sortDirection = 'desc',
}: {
  tokens: IAccountToken[];
  sortDirection?: 'desc' | 'asc';
}): IAccountToken[] {
  return [...tokens].sort((a, b) => {
    const aName = a.name?.toLowerCase() ?? '';
    const bName = b.name?.toLowerCase() ?? '';

    if (sortDirection === 'desc') {
      return bName.localeCompare(aName);
    }

    return aName.localeCompare(bName);
  });
}

export function sortTokensByOrder({ tokens }: { tokens: IAccountToken[] }) {
  return [...tokens].sort((a, b) => {
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
  const newTargetMap = { ...targetMap };
  const newSourceMap = { ...sourceMap };
  if (mergeDeriveAssets) {
    forEach(newSourceMap, (value, key) => {
      const keyArr = key.split('_');
      const groupDeriveKey = `${keyArr[0]}_${keyArr[keyArr.length - 1]}`;
      const mergedToken = newTargetMap[groupDeriveKey];

      if (mergedToken && !newTargetMap[key]) {
        mergedToken.balance = new BigNumber(mergedToken.balance)
          .plus(value.balance)
          .toFixed();
        mergedToken.balanceParsed = new BigNumber(
          mergedToken.balanceParsed ?? 0,
        )
          .plus(value.balanceParsed ?? 0)
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

        newTargetMap[groupDeriveKey] = {
          ...mergedToken,
        };
      } else {
        newTargetMap[groupDeriveKey] = {
          ...value,
        };
      }
    });
  }

  return {
    ...newTargetMap,
    ...newSourceMap,
  };
}

export function mergeAggregateTokenMap({
  sourceMap,
  targetMap,
}: {
  sourceMap: {
    [key: string]: ITokenFiat;
  };
  targetMap: {
    [key: string]: ITokenFiat;
  };
}) {
  const newTargetMap = { ...targetMap };

  forEach(sourceMap, (value, key) => {
    const mergedToken = newTargetMap[key];
    if (mergedToken) {
      mergedToken.balance = new BigNumber(mergedToken.balance)
        .plus(value.balance)
        .toFixed();
      mergedToken.balanceParsed = new BigNumber(mergedToken.balanceParsed ?? 0)
        .plus(value.balanceParsed ?? 0)
        .toFixed();
      mergedToken.frozenBalance = new BigNumber(mergedToken.frozenBalance ?? 0)
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
      newTargetMap[key] = mergedToken;
    } else {
      newTargetMap[key] = value;
    }
  });

  return newTargetMap;
}

export function mergeAggregateTokenListMap({
  sourceMap,
  targetMap,
}: {
  sourceMap: {
    [key: string]: {
      tokens: IAccountToken[];
    };
  };
  targetMap: {
    [key: string]: {
      tokens: IAccountToken[];
    };
  };
}) {
  const newTargetMap = { ...targetMap };

  forEach(sourceMap, (value, key) => {
    const mergedTokenList = newTargetMap[key];
    if (mergedTokenList && mergedTokenList.tokens) {
      mergedTokenList.tokens = uniqBy(
        [...mergedTokenList.tokens, ...value.tokens],
        (token) => token.$key,
      );
    } else {
      newTargetMap[key] = {
        tokens: value.tokens,
      };
    }
  });

  return newTargetMap;
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

export function normalizeTokenContractAddress({
  networkId,
  contractAddress,
}: {
  networkId: string;
  contractAddress: string | undefined;
}): string | undefined {
  const impl = networkUtils.getNetworkImpl({ networkId });
  if (caseSensitiveNetworkImpl.includes(impl)) {
    return contractAddress;
  }
  return contractAddress?.toLowerCase();
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
  const token1ContractAddress = normalizeTokenContractAddress({
    networkId: token1.networkId,
    contractAddress: token1.contractAddress,
  });
  const token2ContractAddress = normalizeTokenContractAddress({
    networkId: token2.networkId,
    contractAddress: token2.contractAddress,
  });
  return token1ContractAddress === token2ContractAddress;
}

export const checkWrappedTokenPair = ({
  fromToken,
  toToken,
}: {
  fromToken?: {
    networkId: string;
    contractAddress: string;
    isNative?: boolean;
  };
  toToken?: { networkId: string; contractAddress: string; isNative?: boolean };
}) => {
  if (
    !fromToken ||
    !toToken ||
    fromToken.networkId !== toToken.networkId ||
    fromToken.contractAddress === toToken.contractAddress
  ) {
    return false;
  }

  const fromTokenIsWrapped = wrappedTokens.find(
    ({ networkId, address }) =>
      networkId === fromToken.networkId &&
      (address.toLowerCase() === fromToken.contractAddress.toLowerCase() ||
        fromToken.isNative),
  );
  const toTokenIsWrapped = wrappedTokens.find(
    ({ networkId, address }) =>
      networkId === toToken.networkId &&
      (address.toLowerCase() === toToken.contractAddress.toLowerCase() ||
        toToken.isNative),
  );
  return !!fromTokenIsWrapped && !!toTokenIsWrapped;
};

export function getMergedDeriveTokenData(params: {
  data: IFetchAccountTokensResp[];
  mergeDeriveAssetsEnabled: boolean;
}) {
  const { data, mergeDeriveAssetsEnabled } = params;

  let aggregateTokenMap: Record<string, ITokenFiat> = {};
  let aggregateTokenListMap: Record<
    string,
    {
      tokens: IAccountToken[];
    }
  > = {};

  const tokenList: {
    tokens: IAccountToken[];
    keys: string;
    fiatValue: string;
  } = {
    tokens: [],
    keys: '',
    fiatValue: '0',
  };

  const smallBalanceTokenList: {
    smallBalanceTokens: IAccountToken[];
    keys: string;
    fiatValue: string;
  } = {
    smallBalanceTokens: [],
    keys: '',
    fiatValue: '0',
  };

  const riskyTokenList: {
    riskyTokens: IAccountToken[];
    keys: string;
    fiatValue: string;
  } = {
    riskyTokens: [],
    keys: '',
    fiatValue: '0',
  };

  let tokenListMap: {
    [key: string]: ITokenFiat;
  } = {};

  let smallBalanceTokenListMap: {
    [key: string]: ITokenFiat;
  } = {};

  let riskyTokenListMap: {
    [key: string]: ITokenFiat;
  } = {};

  const allTokenList: {
    tokens: IAccountToken[];
    keys: string;
    fiatValue: string;
  } = {
    tokens: [],
    keys: '',
    fiatValue: '0',
  };
  let allTokenListMap: {
    [key: string]: ITokenFiat;
  } = {};
  data.forEach((r) => {
    tokenList.fiatValue = new BigNumber(tokenList.fiatValue)
      .plus(r.tokens.fiatValue ?? '0')
      .toFixed();
    smallBalanceTokenList.fiatValue = new BigNumber(
      smallBalanceTokenList.fiatValue ?? '0',
    )
      .plus(r.smallBalanceTokens.fiatValue ?? '0')
      .toFixed();
    riskyTokenList.fiatValue = new BigNumber(riskyTokenList.fiatValue ?? '0')
      .plus(r.riskTokens.fiatValue ?? '0')
      .toFixed();

    tokenList.tokens = mergeDeriveTokenList({
      sourceTokens: r.tokens.data,
      targetTokens: tokenList.tokens,
      mergeDeriveAssets: mergeDeriveAssetsEnabled,
    });

    tokenList.keys = `${tokenList.keys}_${r.tokens.keys}`;

    tokenListMap = mergeDeriveTokenListMap({
      sourceMap: r.tokens.map,
      targetMap: tokenListMap,
      mergeDeriveAssets: mergeDeriveAssetsEnabled,
    });

    smallBalanceTokenList.smallBalanceTokens = mergeDeriveTokenList({
      sourceTokens: r.smallBalanceTokens.data,
      targetTokens: smallBalanceTokenList.smallBalanceTokens,
      mergeDeriveAssets: mergeDeriveAssetsEnabled,
    });

    smallBalanceTokenList.keys = `${smallBalanceTokenList.keys}_${r.smallBalanceTokens.keys}`;

    smallBalanceTokenListMap = mergeDeriveTokenListMap({
      sourceMap: r.smallBalanceTokens.map,
      targetMap: smallBalanceTokenListMap,
      mergeDeriveAssets: mergeDeriveAssetsEnabled,
    });

    riskyTokenList.riskyTokens = mergeDeriveTokenList({
      sourceTokens: r.riskTokens.data,
      targetTokens: riskyTokenList.riskyTokens,
      mergeDeriveAssets: mergeDeriveAssetsEnabled,
    });

    riskyTokenList.riskyTokens = riskyTokenList.riskyTokens.concat(
      r.riskTokens.data,
    );
    riskyTokenList.keys = `${riskyTokenList.keys}_${r.riskTokens.keys}`;

    riskyTokenListMap = mergeDeriveTokenListMap({
      sourceMap: r.riskTokens.map,
      targetMap: riskyTokenListMap,
      mergeDeriveAssets: mergeDeriveAssetsEnabled,
    });

    if (r.aggregateTokenMap) {
      aggregateTokenMap = mergeAggregateTokenMap({
        sourceMap: r.aggregateTokenMap,
        targetMap: aggregateTokenMap,
      });
    }

    if (r.aggregateTokenListMap) {
      aggregateTokenListMap = mergeAggregateTokenListMap({
        sourceMap: r.aggregateTokenListMap,
        targetMap: aggregateTokenListMap,
      });
    }
  });

  allTokenList.tokens = [
    ...tokenList.tokens,
    ...smallBalanceTokenList.smallBalanceTokens,
    ...riskyTokenList.riskyTokens,
  ];
  allTokenList.keys = `${tokenList.keys}_${smallBalanceTokenList.keys}_${riskyTokenList.keys}`;

  allTokenList.fiatValue = new BigNumber(allTokenList.fiatValue)
    .plus(tokenList.fiatValue)
    .plus(smallBalanceTokenList.fiatValue)
    .plus(riskyTokenList.fiatValue)
    .toFixed();

  allTokenListMap = {
    ...tokenListMap,
    ...smallBalanceTokenListMap,
    ...riskyTokenListMap,
    ...aggregateTokenMap,
  };

  return {
    tokenList,
    smallBalanceTokenList,
    riskyTokenList,
    tokenListMap,
    smallBalanceTokenListMap,
    riskyTokenListMap,
    aggregateTokenMap,
    allTokenList,
    allTokenListMap,
    aggregateTokenListMap,
  };
}

export function getTokenPriceChangeStyle({
  priceChange,
}: {
  priceChange: number;
}) {
  let changeColor = '$textSubdued';
  let showPlusMinusSigns = false;
  const priceChangeBN = new BigNumber(priceChange);
  if (priceChangeBN.isGreaterThan(0)) {
    changeColor = '$textSuccess';
    showPlusMinusSigns = true;
  } else if (priceChangeBN.isLessThan(0)) {
    changeColor = '$textCritical';
    showPlusMinusSigns = true;
  }
  return {
    changeColor,
    showPlusMinusSigns,
  };
}

export function buildTokenListMapKey(params: {
  networkId: string;
  accountAddress: string;
  tokenAddress: string;
}) {
  const { networkId, accountAddress, tokenAddress } = params;
  return `${networkId}_${accountAddress}_${tokenAddress}`;
}

export function buildAggregateTokenMapKeyForAggregateConfig(params: {
  networkId: string;
  tokenAddress: string;
}) {
  const { networkId, tokenAddress } = params;
  return `${networkId}_${tokenAddress.toLowerCase()}`;
}

export function buildAggregateTokenListMapKeyForTokenList(params: {
  commonSymbol: string;
  networkId?: string;
}) {
  const { commonSymbol, networkId } = params;
  return `aggregate_${commonSymbol}_${networkId ?? ''}`;
}

export function buildAggregateTokenListData(params: {
  networkId: string;
  accountId: string;
  token: IAccountToken;
  tokenMap: Record<string, ITokenFiat>;
  aggregateTokenListMap: Record<
    string,
    {
      commonToken: IAccountToken;
      tokens: IAccountToken[];
    }
  >;
  aggregateTokenMap: Record<string, ITokenFiat>;
  aggregateTokenConfigMapRawData: Record<string, IAggregateToken>;
  networkName: string;
}) {
  const {
    networkId,
    accountId,
    tokenMap,
    aggregateTokenListMap,
    aggregateTokenMap,
    token,
    aggregateTokenConfigMapRawData,
    networkName,
  } = params;

  const newAggregateTokenListMap = { ...aggregateTokenListMap };
  const newAggregateTokenMap = { ...aggregateTokenMap };
  let isAggregateToken = false;

  const aggregateToken =
    aggregateTokenConfigMapRawData[
      buildAggregateTokenMapKeyForAggregateConfig({
        networkId,
        tokenAddress: token.address,
      })
    ];

  if (aggregateToken) {
    isAggregateToken = true;
    const aggregateTokenListMapKey = buildAggregateTokenListMapKeyForTokenList({
      commonSymbol: aggregateToken.commonSymbol ?? '',
    });

    if (!newAggregateTokenListMap[aggregateTokenListMapKey]) {
      newAggregateTokenListMap[aggregateTokenListMapKey] = {
        commonToken: {
          ...token,
          accountId,
          networkId: AGGREGATE_TOKEN_MOCK_NETWORK_ID,
          address: aggregateTokenListMapKey,
          $key: aggregateTokenListMapKey,
          isAggregateToken: true,
          commonSymbol: aggregateToken.commonSymbol,
          logoURI: aggregateToken.logoURI,
          name: aggregateToken.name,
        },
        tokens: [
          {
            ...token,
            accountId,
            networkId,
            order: aggregateToken.order,
            commonSymbol: aggregateToken.commonSymbol,
            networkName,
            logoURI: aggregateToken.logoURI,
          },
        ],
      };
    } else {
      newAggregateTokenListMap[aggregateTokenListMapKey].tokens.push(token);
    }

    newAggregateTokenMap[aggregateTokenListMapKey] = {
      ...tokenMap[token.$key],
    };
  }

  return {
    isAggregateToken,
    aggregateTokenListMap: newAggregateTokenListMap,
    aggregateTokenMap: newAggregateTokenMap,
  };
}

export function buildLocalAggregateTokenMapKey({
  networkId,
  accountId,
}: {
  networkId: string;
  accountId: string;
}) {
  return `${networkId}_${accountId}`;
}

export function buildHomeDefaultTokenMapKey({
  networkId,
  symbol,
}: {
  networkId: string;
  symbol: string;
}) {
  const networkIdKey =
    networkId === getNetworkIdsMap().onekeyall
      ? AGGREGATE_TOKEN_MOCK_NETWORK_ID
      : networkId;

  return `${networkIdKey}_${symbol}`;
}

export function sortTokensCommon({
  tokens = [],
  tokenListMap = {},
}: {
  tokens: IAccountToken[];
  tokenListMap: {
    [key: string]: ITokenFiat;
  };
}) {
  // sort tokens by Fiat Value
  let sortedTokens = sortTokensByFiatValue({
    tokens,
    map: tokenListMap,
  });

  const negativeIndex = sortedTokens.findIndex((t) =>
    new BigNumber(tokenListMap[t.$key]?.fiatValue ?? -1).isNegative(),
  );

  const zeroIndex = sortedTokens.findIndex((t) =>
    new BigNumber(tokenListMap[t.$key]?.fiatValue ?? -1).isZero(),
  );

  // sort zero/none fiat value tokens by order
  if (negativeIndex > -1 || zeroIndex > -1) {
    let tokensWithNonZeroBalance: IAccountToken[] = [];
    let tokensWithZeroBalance: IAccountToken[] = [];
    let tokensWithoutBalance: IAccountToken[] = [];

    if (negativeIndex > -1) {
      const tokensWithBalance = sortedTokens.slice(0, negativeIndex);
      tokensWithoutBalance = sortedTokens.slice(negativeIndex);
      if (zeroIndex > -1) {
        tokensWithNonZeroBalance = tokensWithBalance.slice(0, zeroIndex);
        tokensWithZeroBalance = tokensWithBalance.slice(zeroIndex);
      } else {
        tokensWithNonZeroBalance = tokensWithBalance;
      }
    } else if (zeroIndex > -1) {
      tokensWithNonZeroBalance = sortedTokens.slice(0, zeroIndex);
      tokensWithZeroBalance = sortedTokens.slice(zeroIndex);
    }

    tokensWithZeroBalance = sortTokensByOrder({
      tokens: tokensWithZeroBalance,
    });

    tokensWithoutBalance = sortTokensByOrder({
      tokens: tokensWithoutBalance,
    });

    sortedTokens = [
      ...tokensWithNonZeroBalance,
      ...tokensWithZeroBalance,
      ...tokensWithoutBalance,
    ];
  }

  return sortedTokens;
}

export function checkIsOnlyOneTokenHasBalance({
  aggregateTokenList,
  allAggregateTokenList,
  tokenMap,
}: {
  tokenMap: Record<string, ITokenFiat>;
  aggregateTokenList: IAccountToken[];
  allAggregateTokenList: IAccountToken[];
}) {
  let tokenHasBalance: IAccountToken | undefined;
  let tokenHasBalanceCount = 0;

  if (
    tokenMap &&
    aggregateTokenList.length > 1 &&
    allAggregateTokenList.length === 0
  ) {
    aggregateTokenList.forEach((t) => {
      if (new BigNumber(tokenMap[t.$key]?.fiatValue ?? -1).gt(0)) {
        tokenHasBalance = t;
        tokenHasBalanceCount += 1;
      }
    });
  }

  return {
    tokenHasBalance: tokenHasBalanceCount > 1 ? undefined : tokenHasBalance,
    tokenHasBalanceCount,
  };
}

export function filterAccountTokenListByLimit({
  tokenList,
  smallBalanceTokenList,
  riskyTokenList,
  limit,
  tokenListMap,
}: {
  tokenList: IAccountToken[];
  smallBalanceTokenList: IAccountToken[];
  riskyTokenList: IAccountToken[];
  limit: number;
  tokenListMap: Record<string, ITokenFiat>;
}) {
  let filteredTokenList = tokenList;
  let filteredSmallBalanceTokenList = smallBalanceTokenList;
  let filteredRiskyTokenList = riskyTokenList;
  let filteredTokenListMap: Record<string, ITokenFiat> = {};

  const totalTokens =
    tokenList.length + smallBalanceTokenList.length + riskyTokenList.length;
  if (totalTokens > limit) {
    const trimList = (
      list: IAccountToken[],
      removeCount: number,
    ): [IAccountToken[], number] => {
      if (removeCount <= 0 || list.length === 0) {
        return [list, 0];
      }
      const remainingLength = Math.max(list.length - removeCount, 0);
      const trimmedList = list.slice(0, remainingLength);
      return [trimmedList, list.length - trimmedList.length];
    };

    let tokensToRemove = totalTokens - limit;
    let removedCount = 0;

    [filteredRiskyTokenList, removedCount] = trimList(
      filteredRiskyTokenList,
      tokensToRemove,
    );
    tokensToRemove -= removedCount;

    [filteredSmallBalanceTokenList, removedCount] = trimList(
      filteredSmallBalanceTokenList,
      tokensToRemove,
    );
    tokensToRemove -= removedCount;

    [filteredTokenList, removedCount] = trimList(
      filteredTokenList,
      tokensToRemove,
    );

    filteredTokenListMap = {};
    const retainedTokens = [
      ...filteredTokenList,
      ...filteredSmallBalanceTokenList,
      ...filteredRiskyTokenList,
    ];
    for (const token of retainedTokens) {
      filteredTokenListMap[token.$key] = tokenListMap[token.$key] ?? {};
    }
  } else {
    filteredTokenListMap = tokenListMap;
  }
  return {
    filteredTokenList,
    filteredSmallBalanceTokenList,
    filteredRiskyTokenList,
    filteredTokenListMap,
  };
}

export function calculateAccountTokensValue({
  accountId,
  networkId,
  tokensWorth,
  mergeDeriveAssetsEnabled,
}: {
  accountId: string;
  networkId: string;
  tokensWorth: {
    worth: Record<string, string>;
    createAtNetworkWorth: string;
    accountId: string;
    initialized: boolean;
    updateAll?: boolean;
  };
  mergeDeriveAssetsEnabled: boolean;
}) {
  if (networkUtils.isAllNetwork({ networkId })) {
    const allWorth = Object.values(tokensWorth.worth).reduce(
      (acc: string, cur: string) => new BigNumber(acc).plus(cur).toFixed(),
      '0',
    );
    return allWorth;
  }

  if (mergeDeriveAssetsEnabled) {
    const allWorth = Object.values(tokensWorth.worth).reduce(
      (acc: string, cur: string) => new BigNumber(acc).plus(cur).toFixed(),
      '0',
    );
    return allWorth;
  }

  return (
    tokensWorth.worth[
      accountUtils.buildAccountValueKey({
        accountId,
        networkId,
      })
    ] ??
    Object.values(tokensWorth.worth)[0] ??
    '0'
  );
}
