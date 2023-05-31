import { useCallback, useContext, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { isEmpty } from 'lodash';

import { getBalanceKey } from '@onekeyhq/engine/src/managers/token';
import type { Token } from '@onekeyhq/engine/src/types/token';

import { useAccountTokens, useAppSelector } from '../../../../hooks';
import { useCachedBalances } from '../../hooks/useSwapTokenUtils';
import { formatAmount } from '../../utils';

import { OutputCrosschainTokenSelectorContext } from './context';

export function useContextTokenList(networkId?: string) {
  const { tokenList } = useContext(OutputCrosschainTokenSelectorContext);
  return useMemo(() => {
    if (!tokenList) {
      return [];
    }
    let activeNetworkId = networkId;
    if (!activeNetworkId) {
      activeNetworkId = 'All';
    }
    const data = tokenList.find((item) => item.networkId === activeNetworkId);
    return data?.tokens ?? [];
  }, [tokenList, networkId]);
}

export function useContextAccountTokens(
  networkId?: string,
  accountId?: string,
) {
  const presetTokens = useContextTokenList(networkId);
  const accountTokens = useAccountTokens(networkId, accountId);
  const balances = useCachedBalances(networkId, accountId);

  const prices = useAppSelector((s) => s.tokens.tokenPriceMap);
  const selectedFiatMoneySymbol = useAppSelector(
    (s) => s.settings.selectedFiatMoneySymbol,
  );

  const getPrice = useCallback(
    (token: Token) => {
      const priceInfo =
        prices[
          `${token.networkId}${token.address ? '-' : ''}${
            token.tokenIdOnNetwork ?? ''
          }`
        ];
      const value = priceInfo?.[selectedFiatMoneySymbol] ?? 0;
      return value;
    },
    [prices, selectedFiatMoneySymbol],
  );

  return useMemo(() => {
    const tokens = [...presetTokens, ...accountTokens];
    const set = new Set();
    const getKey = (token: Token) =>
      `${token.networkId}${token.tokenIdOnNetwork}`;
    const items = tokens.filter((token) => {
      if (set.has(getKey(token))) {
        return false;
      }
      set.add(getKey(token));
      return true;
    });

    const tokenHasBalance = (t: Token) => {
      const key = getBalanceKey(t);
      return Boolean(
        balances[key] &&
          Number(formatAmount(balances[key]?.balance ?? '0', 6)) > 0,
      );
    };

    if (isEmpty(balances)) {
      return items;
    }
    const a = items.filter((o) => tokenHasBalance(o));

    a.sort((prev, next) => {
      const prevKey = getBalanceKey(prev);
      const nextKey = getBalanceKey(next);
      const prevBalance = balances[prevKey];
      const nextBalance = balances[nextKey];
      const prevValue = new BigNumber(prevBalance?.balance ?? '0').multipliedBy(
        getPrice(prev),
      );
      const nextValue = new BigNumber(nextBalance?.balance ?? '0').multipliedBy(
        getPrice(next),
      );
      return prevValue.isLessThan(nextValue) ? 1 : -1;
    });

    const b = items.filter((o) => !tokenHasBalance(o));

    return a.concat(b);
  }, [presetTokens, accountTokens, balances, getPrice]);
}
