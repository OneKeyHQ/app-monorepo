import { useMemo } from 'react';

import { useAppSelector } from './redux';

export function useAccountTokens(networkId: string, accountId: string) {
  const accountTokens = useAppSelector((s) => s.tokens.accountTokens);
  return useMemo(
    () => accountTokens[networkId]?.[accountId] ?? [],
    [networkId, accountId, accountTokens],
  );
}

export function useAccountTokensBalance(networkId: string, accountId: string) {
  const balances = useAppSelector((s) => s.tokens.accountTokensBalance);
  return useMemo(
    () => balances[networkId]?.[accountId] ?? {},
    [networkId, accountId, balances],
  );
}

export function useNetworkTokens(networkId: string) {
  const tokens = useAppSelector((s) => s.tokens.tokens);
  return useMemo(() => tokens[networkId] ?? [], [networkId, tokens]);
}

export function useNetworkTokensPrice(networkId: string) {
  const tokensPrice = useAppSelector((s) => s.tokens.tokensPrice);
  return useMemo(() => tokensPrice[networkId] ?? {}, [networkId, tokensPrice]);
}

export function useNetworkTokensChart(networkId: string) {
  const charts = useAppSelector((s) => s.tokens.charts);
  return useMemo(() => charts?.[networkId] ?? {}, [networkId, charts]);
}

export function useNativeToken(networkId: string, accountId: string) {
  const tokens = useAccountTokens(networkId, accountId);
  return useMemo(
    () => tokens.filter((token) => !token.tokenIdOnNetwork),
    [tokens],
  )[0];
}
