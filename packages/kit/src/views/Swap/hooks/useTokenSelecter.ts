import type { Context } from 'react';
import { useCallback, useContext, useEffect, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { isEmpty } from 'lodash';

import { getBalanceKey } from '@onekeyhq/engine/src/managers/token';
import { type Token, TokenRiskLevel } from '@onekeyhq/engine/src/types/token';
import { isBTCNetwork } from '@onekeyhq/shared/src/engine/engineConsts';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAccountTokensOnChain, useAppSelector } from '../../../hooks';
import { formatAmount } from '../utils';

import { useCachedBalances } from './useSwapTokenUtils';

import type { TokenListItem } from '../typings';

export type NetworkOption = {
  networkId?: string;
  name: string;
  logoURI: string;
};

interface TokenSelectorContext {
  tokenList?: TokenListItem[];
  networkId?: string;
  accountId?: string;
}

export function createTokenSelectorUtils(
  context: Context<TokenSelectorContext>,
) {
  function useTokenList(networkId?: string) {
    const { tokenList } = useContext(context);
    return useMemo(() => {
      if (!tokenList) {
        return [];
      }
      const activeNetworkId = networkId || 'All';
      const data = tokenList.find((item) => item.networkId === activeNetworkId);
      return data?.tokens ?? [];
    }, [tokenList, networkId]);
  }

  function useAccountTokens(networkId?: string, accountId?: string) {
    const presetTokens = useTokenList(networkId);
    const accountTokens = useAccountTokensOnChain(networkId, accountId);
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
      let tokens = [...presetTokens, ...accountTokens];
      if (isBTCNetwork(networkId)) {
        tokens = tokens.filter((i) => i.isNative);
      }
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

      const getTokenScore = (token: Token): number => {
        if (token.riskLevel === TokenRiskLevel.VERIFIED) {
          return -1;
        }
        return token.riskLevel ?? TokenRiskLevel.UNKNOWN;
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
        const prevValue = new BigNumber(
          prevBalance?.balance ?? '0',
        ).multipliedBy(getPrice(prev));
        const nextValue = new BigNumber(
          nextBalance?.balance ?? '0',
        ).multipliedBy(getPrice(next));

        if (prevValue.isZero() && nextValue.isZero()) {
          return getTokenScore(prev) - getTokenScore(next);
        }
        return prevValue.isLessThan(nextValue) ? 1 : -1;
      });

      const b = items.filter((o) => !tokenHasBalance(o));

      return a.concat(b);
    }, [presetTokens, accountTokens, balances, getPrice, networkId]);
  }

  function Observer() {
    const { networkId, accountId } = useContext(context);
    const tokens = useAccountTokens(networkId, accountId);
    const vsCurrency = useAppSelector(
      (s) => s.settings.selectedFiatMoneySymbol,
    );
    useEffect(() => {
      if (networkId && accountId) {
        backgroundApiProxy.servicePrice.fetchSimpleTokenPrice({
          accountId,
          networkId,
          tokenIds: tokens.map((item) => item.tokenIdOnNetwork),
          vsCurrency,
        });
      }
    }, [tokens, networkId, accountId, vsCurrency]);
    return null;
  }

  return { useTokenList, useAccountTokens, Observer };
}
