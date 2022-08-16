import { useMemo } from 'react';

import { Token } from '@onekeyhq/engine/src/types/token';

import { useAppSelector } from './redux';

export function useAccountTokens(networkId?: string, accountId?: string) {
  const accountTokens = useAppSelector((s) => s.tokens.accountTokens);
  return useMemo(() => {
    if (!networkId || !accountId) {
      return [];
    }
    return accountTokens[networkId]?.[accountId] ?? [];
  }, [networkId, accountId, accountTokens]);
}

export function useAccountTokenLoading(networkId: string, accountId: string) {
  const accountTokens = useAppSelector((s) => s.tokens.accountTokens);
  return useMemo(
    () => typeof accountTokens[networkId]?.[accountId] === 'undefined',
    [networkId, accountId, accountTokens],
  );
}

export function useAccountTokensBalance(
  networkId?: string,
  accountId?: string,
) {
  const balances = useAppSelector((s) => s.tokens.accountTokensBalance);
  return useMemo(() => {
    if (!networkId || !accountId) {
      return {};
    }
    return balances[networkId]?.[accountId] ?? {};
  }, [networkId, accountId, balances]);
}

export function useNetworkTokens(networkId?: string) {
  const tokens = useAppSelector((s) => s.tokens.tokens);
  return useMemo(() => {
    if (!networkId) {
      return [];
    }
    return tokens[networkId] ?? [];
  }, [networkId, tokens]);
}

export function useNetworkTokensPrice(networkId?: string) {
  const tokensPrice = useAppSelector((s) => s.tokens.tokensPrice);
  return useMemo(() => {
    if (!networkId) {
      return {};
    }
    return tokensPrice[networkId] ?? {};
  }, [networkId, tokensPrice]);
}

export function useNetworkTokensChart(networkId: string) {
  const charts = useAppSelector((s) => s.tokens.charts);
  return useMemo(() => charts?.[networkId] ?? {}, [networkId, charts]);
}

export function useNativeToken(
  networkId?: string,
  accountId?: string,
): Token | undefined {
  const tokens = useAccountTokens(networkId, accountId);
  return useMemo(
    () => tokens.filter((token) => !token.tokenIdOnNetwork),
    [tokens],
  )[0];
}
