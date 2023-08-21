/* eslint-disable @typescript-eslint/no-unused-vars */
import BigNumber from 'bignumber.js';
import { isNil } from 'lodash';

import { getBalanceKey } from '@onekeyhq/engine/src/managers/token';
import type {
  IToken,
  ITokenFiatValuesInfo,
} from '@onekeyhq/engine/src/types/token';
import {
  freezedEmptyArray,
  freezedEmptyObject,
} from '@onekeyhq/shared/src/consts/sharedConsts';

import { getPreBaseValue } from '../../utils/priceUtils';

import { buildCrossHooks, buildCrossHooksWithOptions } from './buildCrossHooks';

import type {
  IAccountTokensBalanceMap,
  IAmountValue,
  ITokenBalanceInfo,
  ITokenPriceInfo,
  ITokensPricesMap,
} from '../../store/reducers/tokens';
import type { IReduxHooksQueryToken } from '../../views/Overview/types';

export const {
  use: useReduxAccountTokensList,
  //
  get: getReduxAccountTokensList,
} = buildCrossHooksWithOptions<
  IToken[],
  {
    accountId: string;
    networkId: string;
  }
>((selector, { options }) => {
  const accountId = options?.accountId || '';
  const networkId = options?.networkId || '';

  const tokensList =
    selector((s) => s.tokens.accountTokens?.[networkId]?.[accountId]) ??
    freezedEmptyArray;
  return tokensList;
});

export const {
  use: useReduxAccountTokenBalancesMap,
  //
  get: getReduxAccountTokenBalancesMap,
} = buildCrossHooksWithOptions<
  IAccountTokensBalanceMap,
  {
    accountId?: string;
    networkId?: string;
  }
>((selector, { options }) => {
  const accountId = options.accountId || '';
  const networkId = options.networkId || '';
  const balances =
    selector((s) => s.tokens.accountTokensBalance?.[networkId]?.[accountId]) ??
    freezedEmptyObject;
  return balances;
});

export const {
  use: useReduxTokenPricesMap,
  //
  get: getReduxTokenPricesMap,
} = buildCrossHooks<ITokensPricesMap>((selector) => {
  const prices = selector((s) => s.tokens.tokenPriceMap) ?? freezedEmptyObject;
  return prices;
});

export const {
  use: useReduxSingleTokenPrice,
  //
  get: getReduxSingleTokenPrice,
} = buildCrossHooksWithOptions<
  ITokenPriceInfo,
  {
    prices: ITokensPricesMap;
    token: IReduxHooksQueryToken;
  }
>((_, { options }) => {
  const tokenNetworkId = options?.token?.networkId;
  const tokenAddress = options?.token?.address;
  const priceKey = [tokenNetworkId, tokenAddress].filter(Boolean).join('-');
  const priceRawInfo = options?.prices[priceKey];
  const price = priceRawInfo?.usd; // ?? 0;
  const price24h = priceRawInfo?.usd_24h_change; // ?? 0;
  const result: ITokenPriceInfo = {
    priceKey,
    priceRawInfo,
    price,
    price24h,
  };
  return result;
});
export function useReduxSingleTokenPriceSimple({
  token,
}: {
  token: IReduxHooksQueryToken;
}) {
  const prices = useReduxTokenPricesMap();
  const priceInfo = useReduxSingleTokenPrice({
    prices,
    token,
  });
  return priceInfo;
}

export const {
  use: useReduxSingleTokenBalance,
  //
  get: getReduxSingleTokenBalance,
} = buildCrossHooksWithOptions<
  ITokenBalanceInfo,
  {
    balances: IAccountTokensBalanceMap;
    token: IReduxHooksQueryToken;
  }
>((_, { options }) => {
  const balancekey = getBalanceKey(options?.token);
  const balanceInfo = options?.balances[balancekey];
  const result: ITokenBalanceInfo = isNil(balanceInfo)
    ? {
        balance: balanceInfo,
        blockHeight: undefined,
      }
    : balanceInfo;
  return result;
});

export function useReduxSingleTokenBalanceSimple({
  token,
}: {
  token: IReduxHooksQueryToken;
}) {
  const balances = useReduxAccountTokenBalancesMap({
    accountId: token.accountId,
    networkId: token.networkId,
  });
  const balanceInfo = useReduxSingleTokenBalance({
    balances,
    token,
  });
  return balanceInfo;
}

export const {
  use: useReduxSingleTokenFiatValues,
  //
  get: getReduxSingleTokenFiatValues,
} = buildCrossHooksWithOptions<
  ITokenFiatValuesInfo,
  {
    balanceInfo: ITokenBalanceInfo;
    priceInfo: ITokenPriceInfo;
    token: IReduxHooksQueryToken;
  }
>((_, { options }) => {
  const { priceInfo, balanceInfo } = options;
  const { price, price24h, priceRawInfo } = priceInfo;
  const { balance, transferBalance, availableBalance } = balanceInfo;

  let value: IAmountValue;
  let usdValue: IAmountValue;
  let value24h: IAmountValue;
  if (typeof price !== 'undefined' && !isNil(balance)) {
    value = new BigNumber(price || 0).multipliedBy(balance).toFixed();
    usdValue = value;
  }
  const baseValue24h = getPreBaseValue({
    priceInfo: priceRawInfo,
    vsCurrency: 'usd',
  }).usd;
  if (!isNil(balance) && !isNil(baseValue24h)) {
    value24h = new BigNumber(balance).multipliedBy(baseValue24h).toFixed();
  }

  const valuesInfo: ITokenFiatValuesInfo = {
    price,
    price24h,
    balance,
    transferBalance,
    availableBalance,
    value,
    usdValue,
    value24h,
  };
  return valuesInfo;
});
export function useReduxSingleTokenFiatValuesSimple({
  token,
}: {
  token: IReduxHooksQueryToken;
}) {
  const priceInfo = useReduxSingleTokenPriceSimple({
    token,
  });
  const balanceInfo = useReduxSingleTokenBalanceSimple({
    token,
  });
  const valuesInfo = useReduxSingleTokenFiatValues({
    priceInfo,
    balanceInfo,
    token,
  });
  return valuesInfo;
}
