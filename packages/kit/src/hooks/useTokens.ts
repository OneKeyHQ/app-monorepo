import { useEffect, useMemo, useState } from 'react';

import { getBalanceKey } from '@onekeyhq/engine/src/managers/token';
import type { Token } from '@onekeyhq/engine/src/types/token';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

import { useAppSelector } from './useAppSelector';

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

export function useAccountTokens(networkId?: string, accountId?: string) {
  const accountTokens = useAppSelector((s) => s.tokens.accountTokens);

  const accountTokensOnChain = useMemo(() => {
    if (!networkId || !accountId) {
      return [];
    }
    return accountTokens[networkId]?.[accountId] ?? [];
  }, [networkId, accountId, accountTokens]);

  return accountTokensOnChain;
}

export function useAccountTokenLoading(networkId: string, accountId: string) {
  const accountTokens = useAppSelector((s) => s.tokens.accountTokens);
  return useMemo(
    () => typeof accountTokens[networkId]?.[accountId] === 'undefined',
    [networkId, accountId, accountTokens],
  );
}

export const useNativeTokenBalance = (
  networkId?: string,
  accountId?: string,
) => {
  const balances = useAccountTokensBalance(networkId, accountId);
  return useMemo(() => balances?.main, [balances]);
};

export function useNetworkTokens(networkId?: string) {
  const tokens = useAppSelector((s) => s.tokens.tokens);
  return useMemo(() => {
    if (!networkId) {
      return [];
    }
    return tokens[networkId] ?? [];
  }, [networkId, tokens]);
}

export const useNFTSymbolPrice = ({
  networkId,
}: {
  networkId?: string | null;
}) => {
  const nftSymbolPrice = useAppSelector((s) => s.nft.nftSymbolPrice);
  const symbolPrice = useMemo(() => {
    if (networkId) {
      return nftSymbolPrice[networkId] ?? 0;
    }
    return 0;
  }, [networkId, nftSymbolPrice]);
  return symbolPrice;
};

export const useNFTPrice = ({
  accountId,
  networkId,
}: {
  accountId?: string | null;
  networkId?: string | null;
}) => {
  const { nftPrice, disPlayPriceType } = useAppSelector((s) => s.nft);
  const symbolPrice = useNFTSymbolPrice({ networkId });
  const amount = useMemo(() => {
    if (accountId && networkId) {
      const accountInfo = nftPrice[accountId];
      if (accountInfo) {
        const priceValue = accountInfo[networkId];
        if (priceValue) {
          return priceValue[disPlayPriceType];
        }
      }
    }
    return 0;
  }, [accountId, disPlayPriceType, networkId, nftPrice]);

  return symbolPrice * amount;
};

export const useSingleToken = (networkId: string, address: string) => {
  const [token, setToken] = useState<Token>();

  useEffect(() => {
    backgroundApiProxy.engine
      .findToken({
        networkId,
        tokenIdOnNetwork: address,
      })
      .then((t) => {
        if (t) {
          setToken(t);
        }
      });
  }, [address, networkId]);

  return token;
};

export const useTokenSupportStakedAssets = (
  networkId?: string,
  tokenIdOnNetwork?: string,
) =>
  useMemo(
    () =>
      !tokenIdOnNetwork &&
      (networkId === OnekeyNetwork.eth || networkId === OnekeyNetwork.goerli),

    [networkId, tokenIdOnNetwork],
  );

export const useTokenBalance = ({
  networkId,
  accountId,
  token,
  fallback = '0',
}: {
  networkId: string;
  accountId: string;
  token?: Partial<Token> | null;
  fallback?: string;
}) => {
  const balances = useAppSelector((s) => s.tokens.accountTokensBalance);
  return balances?.[networkId]?.[accountId]?.[getBalanceKey(token)] ?? fallback;
};

export const useTokenPrice = ({
  networkId,
  token,
  fallback,
}: {
  networkId: string;
  vsCurrency: string;
  token: Partial<Token>;
  fallback: number;
}) => {
  const key = `${networkId}-${token?.address ?? ''}`;
  const prices = useAppSelector((s) => s.tokens.tokenPriceMap);
  return prices?.[key] ?? fallback;
};

export function useNativeToken(networkId?: string): Token | undefined {
  return useSingleToken(networkId ?? '', '');
}
