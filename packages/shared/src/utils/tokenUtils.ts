import BigNumber from 'bignumber.js';
import { forEach, isNil, uniqBy } from 'lodash';

import { wrappedTokens } from '../../types/swap/SwapProvider.constants';
import { SEARCH_KEY_MIN_LENGTH } from '../consts/walletConsts';

import networkUtils from './networkUtils';

import type {
  IAccountToken,
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
  };
}

export function getFilteredTokenBySearchKey({
  tokens,
  searchKey,
  searchAll,
  searchTokenList,
  allowEmptyWhenBelowMinLength,
}: {
  tokens: IAccountToken[];
  searchKey: string;
  searchAll?: boolean;
  searchTokenList?: IAccountToken[];
  allowEmptyWhenBelowMinLength?: boolean;
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
    return allowEmptyWhenBelowMinLength ? [] : mergedTokens;
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
  sortDirection = 'desc',
}: {
  tokens: IAccountToken[];
  map?: {
    [key: string]: ITokenFiat;
  };
  sortDirection?: 'desc' | 'asc';
}) {
  return [...tokens].sort((a, b) => {
    const aFiat = new BigNumber(map[a.$key]?.fiatValue ?? 0);
    const bFiat = new BigNumber(map[b.$key]?.fiatValue ?? 0);

    if (sortDirection === 'desc') {
      return new BigNumber(bFiat.isNaN() ? 0 : bFiat).comparedTo(
        new BigNumber(aFiat.isNaN() ? 0 : aFiat),
      );
    }

    return new BigNumber(aFiat.isNaN() ? 0 : aFiat).comparedTo(
      new BigNumber(bFiat.isNaN() ? 0 : bFiat),
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
  if (mergeDeriveAssets) {
    forEach(sourceMap, (value, key) => {
      const keyArr = key.split('_');
      const groupDeriveKey = `${keyArr[0]}_${keyArr[keyArr.length - 1]}`;
      const mergedToken = targetMap[groupDeriveKey];

      if (mergedToken && !targetMap[key]) {
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
  };

  return {
    tokenList,
    smallBalanceTokenList,
    riskyTokenList,
    tokenListMap,
    smallBalanceTokenListMap,
    riskyTokenListMap,
    allTokenList,
    allTokenListMap,
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
