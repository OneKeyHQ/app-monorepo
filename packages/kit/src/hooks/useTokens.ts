import { useEffect, useMemo, useState } from 'react';

import B from 'bignumber.js';
import natsort from 'natsort';
import { useAsync } from 'react-async-hook';

import { getBalanceKey } from '@onekeyhq/engine/src/managers/token';
import type { Token } from '@onekeyhq/engine/src/types/token';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';
import { getPreBaseValue } from '../utils/priceUtils';

import { useAppSelector } from './useAppSelector';

export const useSingleToken = (networkId: string, address: string) => {
  const [loading, setLoading] = useState(true);
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
      })
      .finally(() => {
        setLoading(false);
      });
  }, [address, networkId]);

  return {
    loading,
    token,
  };
};
export function useNativeToken(networkId?: string): Token | undefined {
  const { token } = useSingleToken(networkId ?? '', '');
  return token;
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

export function useAccountTokens(
  networkId = '',
  accountId = '',
  useFilter = false,
) {
  const {
    hideRiskTokens,
    hideSmallBalance,
    putMainTokenOnTop,
    selectedFiatMoneySymbol,
  } = useAppSelector((s) => s.settings);
  const fiatMap = useAppSelector((s) => s.fiatMoney.map);
  const fiat = fiatMap[selectedFiatMoneySymbol]?.value || 0;
  const tokens = useAppSelector(
    (s) => s.tokens.accountTokens?.[networkId]?.[accountId] ?? [],
  );
  const balances = useAppSelector(
    (s) => s.tokens.accountTokensBalance?.[networkId]?.[accountId] ?? [],
  );
  const prices = useAppSelector((s) => s.tokens.tokenPriceMap ?? {});

  const valueTokens = tokens
    .map((t) => {
      const priceInfo =
        prices[`${networkId}${t.address ? '-' : ''}${t.address ?? ''}`];
      const price = priceInfo?.[selectedFiatMoneySymbol] ?? 0;
      const balance = balances[getBalanceKey(t)]?.balance ?? '0';
      const value = new B(price).multipliedBy(balance);
      const usdValue = fiat === 0 ? 0 : value.div(fiat);
      const value24h = new B(balance).multipliedBy(
        getPreBaseValue({
          priceInfo,
          vsCurrency: selectedFiatMoneySymbol,
        })[selectedFiatMoneySymbol] ?? 0,
      );
      const info = {
        ...t,
        price,
        balance,
        value: value.toString(),
        usdValue: usdValue.toString(),
        value24h: value24h.toString(),
      };
      return info;
    })
    .sort(
      (a, b) =>
        // By value
        new B(b.value).comparedTo(a.value) ||
        // By price
        new B(b.price).comparedTo(a.price) ||
        // By native token
        (b.isNative ? 1 : 0) ||
        (a.isNative ? -1 : 0) ||
        // By name
        natsort({ insensitive: true })(a.name, b.name),
    );

  if (!useFilter) {
    return valueTokens;
  }

  const filteredTokens = valueTokens.filter((t) => {
    if (hideSmallBalance && new B(t.usdValue).isLessThan(1)) {
      return false;
    }
    if (hideRiskTokens && t.security) {
      return false;
    }
    if (putMainTokenOnTop && (t.isNative || !t.address)) {
      return false;
    }
    return true;
  });
  if (!putMainTokenOnTop) {
    return filteredTokens;
  }
  const nativeToken = valueTokens.find(
    (t) => t.isNative || !t.tokenIdOnNetwork,
  );
  if (nativeToken) {
    return [nativeToken, ...filteredTokens];
  }
  return filteredTokens;
}

export function useAccountTokenValues(
  networkId: string,
  accountId: string,
  useFilter = true,
) {
  const accountTokens = useAccountTokens(networkId, accountId, useFilter);

  return useMemo(() => {
    let value = new B(0);
    let value24h = new B(0);
    for (const t of accountTokens) {
      value = value.plus(t.value);
      value24h = value24h.plus(t.value24h);
    }
    return {
      value,
      value24h,
    };
  }, [accountTokens]);
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
  return useMemo(() => balances?.main?.balance || '0', [balances]);
};

export function useNetworkTokens(networkId?: string) {
  const { result: tokens } = useAsync(
    async () =>
      backgroundApiProxy.engine.getTopTokensOnNetwork(networkId ?? ''),
    [networkId],
  );

  return tokens ?? [];
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
  return (
    balances?.[networkId]?.[accountId]?.[getBalanceKey(token)]?.balance ??
    fallback
  );
};

export const useTokenPrice = ({
  networkId,
  tokenIdOnNetwork,
  fallback = 0,
  vsCurrency,
}: {
  networkId: string;
  vsCurrency: string;
  tokenIdOnNetwork: string;
  fallback?: number;
}) => {
  const key = tokenIdOnNetwork
    ? `${networkId}-${tokenIdOnNetwork ?? ''}`
    : networkId;
  const prices = useAppSelector((s) => s.tokens.tokenPriceMap);
  const price = prices?.[key]?.[vsCurrency];
  return price ?? fallback;
};

export const useCurrentFiatValue = () => {
  const selectedFiatMoneySymbol = useAppSelector(
    (s) => s.settings.selectedFiatMoneySymbol,
  );
  const fiatMap = useAppSelector((s) => s.fiatMoney.map);
  return fiatMap?.[selectedFiatMoneySymbol]?.value || 0;
};
