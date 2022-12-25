import { useEffect, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import natsort from 'natsort';

import type { Token } from '@onekeyhq/engine/src/types/token';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';
import { getTokenValues } from '../utils/priceUtils';

import { useAppSelector } from './useAppSelector';
import { useManageTokenprices } from './useManegeTokenPrice';

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
  const { prices } = useManageTokenprices({
    networkId: networkId ?? '',
    accountId: accountId ?? '',
  });
  const balances = useAccountTokensBalance(networkId, accountId);
  const accountTokens = useAppSelector((s) => s.tokens.accountTokens);
  const {
    hideRiskTokens,
    hideSmallBalance,
    putMainTokenOnTop,
    selectedFiatMoneySymbol: vsCurrency,
  } = useAppSelector((s) => s.settings);

  const accountTokensOnChain = useMemo(() => {
    if (!networkId || !accountId) {
      return [];
    }
    return accountTokens[networkId]?.[accountId] ?? [];
  }, [networkId, accountId, accountTokens]);

  const nativeToken = useMemo(
    () => accountTokensOnChain.find((t) => !t.tokenIdOnNetwork),
    [accountTokensOnChain],
  );

  const valueSortedAccountTokens = useMemo(() => {
    const tokenValues = new Map<Token, BigNumber>();
    const sortedTokens = accountTokensOnChain
      .filter((t) => {
        if (hideRiskTokens && t.security) {
          return false;
        }
        if (putMainTokenOnTop && !t.tokenIdOnNetwork) {
          return false;
        }
        const priceId = `${networkId ?? ''}${
          t.tokenIdOnNetwork ? `-${t.tokenIdOnNetwork}` : ''
        }`;
        if (t.tokenIdOnNetwork && !prices?.[priceId]) {
          if (hideSmallBalance) {
            return false;
          }
          // lower the priority of tokens without price info.
          tokenValues.set(t, new BigNumber(-1));
        }
        const [v] = getTokenValues({
          tokens: [t],
          prices,
          balances,
          vsCurrency,
        });
        if (hideSmallBalance && v.isLessThan(1)) {
          return false;
        }
        tokenValues.set(t, v);
        return true;
      })
      .sort((a, b) => {
        const priceIda = `${networkId ?? ''}${
          a.tokenIdOnNetwork ? `-${a.tokenIdOnNetwork}` : ''
        }`;
        const priceIdb = `${networkId ?? ''}${
          b.tokenIdOnNetwork ? `-${b.tokenIdOnNetwork}` : ''
        }`;
        // By value
        return (
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          tokenValues.get(b)!.comparedTo(tokenValues.get(a)!) ||
          // By price
          new BigNumber(prices?.[priceIdb]?.[vsCurrency] || 0).comparedTo(
            new BigNumber(prices?.[priceIda]?.[vsCurrency] || 0),
          ) ||
          // By native token
          (b.isNative ? 1 : 0) ||
          (a.isNative ? -1 : 0) ||
          // By name
          natsort({ insensitive: true })(a.name, b.name)
        );
      });

    return putMainTokenOnTop && nativeToken
      ? [nativeToken].concat(sortedTokens)
      : sortedTokens;
  }, [
    nativeToken,
    accountTokensOnChain,
    putMainTokenOnTop,
    networkId,
    prices,
    balances,
    vsCurrency,
    hideSmallBalance,
    hideRiskTokens,
  ]);

  return valueSortedAccountTokens;
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
