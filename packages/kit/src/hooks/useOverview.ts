import { useCallback, useEffect, useMemo, useState } from 'react';

import B from 'bignumber.js';
import natsort from 'natsort';

import simpleDb from '@onekeyhq/engine/src/dbs/simple/simpleDb';
import { isAllNetworks } from '@onekeyhq/engine/src/managers/network';
import { getBalanceKey } from '@onekeyhq/engine/src/managers/token';
import type { Token } from '@onekeyhq/engine/src/types/token';
import { TokenRiskLevel } from '@onekeyhq/engine/src/types/token';

import { getPreBaseValue } from '../utils/priceUtils';

import { useAllNetworksWalletAccounts } from './useAllNetwoks';
import { useAppSelector } from './useAppSelector';
import { useFrozenBalance, useTokenPrice } from './useTokens';

import type {
  IAccountToken,
  OverviewAllNetworksPortfolioRes,
} from '../views/Overview/types';

export type OverviewAssetType = 'defis' | 'tokens' | 'nfts';

type IAccountTokenOnChain = Token & {
  price: number;
  price24h: number;
  balance: string;
  value: string;
  usdValue: string;
  value24h: string;
};

type ICombinedAccountToken = IAccountToken | IAccountTokenOnChain;

const filterAccountTokens = <T>({
  tokens,
  useFilter,
  hideSmallBalance,
  hideRiskTokens,
  putMainTokenOnTop,
}: {
  tokens: ICombinedAccountToken[];
  useFilter?: boolean;
  hideSmallBalance?: boolean;
  hideRiskTokens?: boolean;
  putMainTokenOnTop?: boolean;
}): T => {
  const valueTokens = tokens.sort(
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
    return valueTokens as T;
  }

  const filteredTokens = valueTokens.filter((t) => {
    if (hideSmallBalance && new B(t.usdValue).isLessThan(1)) {
      return false;
    }
    if (hideRiskTokens && t.riskLevel && t.riskLevel > TokenRiskLevel.WARN) {
      return false;
    }
    if (putMainTokenOnTop && (t.isNative || !t.address)) {
      return false;
    }
    return true;
  });
  if (!putMainTokenOnTop) {
    return filteredTokens as T;
  }
  const nativeToken = valueTokens.find((t) => t.isNative && !t.address);
  if (nativeToken) {
    return [nativeToken, ...filteredTokens] as T;
  }
  return filteredTokens as T;
};

export const useAccountPortfolios = <
  T extends keyof OverviewAllNetworksPortfolioRes,
>({
  networkId,
  accountId,
  type,
}: {
  networkId?: string;
  accountId?: string;
  type: T;
}) => {
  const [state, setState] = useState<{
    data: OverviewAllNetworksPortfolioRes[T];
    updatedAt?: number;
  }>({
    data: [],
    updatedAt: undefined,
  });
  const updateInfo = useAppSelector(
    (s) =>
      s.overview.portfolios[`${networkId ?? ''}___${accountId ?? ''}`] ?? {},
  );

  const fetchData = useCallback(async () => {
    const res = await simpleDb.accountPortfolios.getPortfolio({
      networkId,
      accountId,
    });
    setState({
      data: res[type] || [],
      updatedAt: updateInfo?.updatedAt,
    });
  }, [accountId, networkId, type, updateInfo?.updatedAt]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return state;
};

export function useAccountTokensOnChain(
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

  const valueTokens = tokens.map((t) => {
    const priceInfo =
      prices[`${networkId}${t.address ? '-' : ''}${t.address ?? ''}`];
    const price = priceInfo?.[selectedFiatMoneySymbol] ?? 0;
    const price24h = priceInfo?.[`${selectedFiatMoneySymbol}_24h_change`] ?? 0;
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
      price24h,
      balance,
      value: value.toString(),
      usdValue: usdValue.toString(),
      value24h: value24h.toString(),
    };
    return info;
  });

  return filterAccountTokens<IAccountTokenOnChain[]>({
    tokens: valueTokens,
    useFilter,
    hideSmallBalance,
    hideRiskTokens,
    putMainTokenOnTop,
  });
}

export function useAccountTokens({
  networkId = '',
  accountId = '',
  useFilter = false,
  limitSize,
}: {
  networkId?: string;
  accountId?: string;
  useFilter?: boolean;
  limitSize?: number;
}) {
  const { hideRiskTokens, hideSmallBalance, putMainTokenOnTop } =
    useAppSelector((s) => s.settings);

  const { data: allNetworksTokens } = useAccountPortfolios({
    networkId,
    accountId,
    type: 'tokens',
  });

  const accountTokensOnChain = useAccountTokensOnChain(
    networkId,
    accountId,
    false,
  );

  const valueTokens: IAccountToken[] = useMemo(() => {
    const accountTokens = isAllNetworks(networkId)
      ? allNetworksTokens.slice(0, limitSize).map((t) => ({
          name: t.name,
          symbol: t.symbol,
          address: undefined,
          logoURI: t.logoURI,
          balance: t.balance,
          usdValue: t.value ?? '0',
          value: new B(t.value ?? '0').toString(),
          value24h: new B(t.value24h ?? '0').toString(),
          price: new B(t.price ?? 0).toNumber(),
          price24h: t.price24h,
          isNative: false,
          riskLevel: TokenRiskLevel.UNKNOWN,
          key: t.coingeckoId,
          coingeckoId: t.coingeckoId,
          sendAddress: undefined,
          autoDetected: false,
        }))
      : accountTokensOnChain.slice(0, limitSize).map((t) => {
          const info = {
            name: t.name,
            symbol: t.symbol,
            address: t.address,
            logoURI: t.logoURI,
            balance: t.balance,
            usdValue: t.usdValue,
            value: t.usdValue,
            value24h: undefined,
            price: t.price,
            price24h: t.price24h,
            isNative: t.isNative,
            riskLevel: t.riskLevel,
            key: `${t.address ?? ''}${t.sendAddress ?? ''}`,
            coingeckoId: t.coingeckoId,
            sendAddress: t.sendAddress,
            autoDetected: t.autoDetected,
          };
          return info;
        });

    return accountTokens;
  }, [networkId, allNetworksTokens, limitSize, accountTokensOnChain]);

  return filterAccountTokens<IAccountToken[]>({
    tokens: valueTokens,
    useFilter,
    hideRiskTokens,
    hideSmallBalance,
    putMainTokenOnTop,
  });
}

export function useAccountTokenValues(
  networkId: string,
  accountId: string,
  useFilter = true,
) {
  const accountTokens = useAccountTokens({
    networkId,
    accountId,
    useFilter,
  });

  return useMemo(() => {
    let value = new B(0);
    let value24h = new B(0);
    for (const t of accountTokens) {
      value = value.plus(t.value);
      value24h = value24h.plus(t.value24h ?? 0);
    }
    return {
      value,
      value24h,
    };
  }, [accountTokens]);
}

export const useNFTValues = ({
  accountId,
  networkId,
}: {
  accountId?: string;
  networkId?: string;
}) => {
  const { disPlayPriceType } = useAppSelector((s) => s.nft);
  const symbolPrice = useTokenPrice({
    networkId: networkId ?? '',
    tokenIdOnNetwork: '',
    vsCurrency: 'usd',
  });
  const { data: collections } = useAccountPortfolios({
    networkId,
    accountId,
    type: 'nfts',
  });
  const nftPrice = useMemo(() => {
    const floorPrice = 0;
    let lastSalePrice = 0;
    collections.forEach((collection) => {
      let totalPrice = 0;
      collection.assets = collection.assets.map((asset) => {
        asset.collection.floorPrice = collection.floorPrice;
        totalPrice += asset.latestTradePrice ?? 0;
        return asset;
      });
      collection.totalPrice = totalPrice;
      lastSalePrice += totalPrice;
      return collection;
    });

    return { 'floorPrice': floorPrice, 'lastSalePrice': lastSalePrice };
  }, [collections]);

  const amount = useMemo(
    () => nftPrice[disPlayPriceType] ?? 0,
    [nftPrice, disPlayPriceType],
  );

  return symbolPrice * amount;
};

export const useAccountValues = (props: {
  networkId: string;
  accountId: string;
}) => {
  const { networkId, accountId } = props;
  const { includeNFTsInTotal } = useAppSelector((s) => s.settings);

  const { data: defis } = useAccountPortfolios({
    networkId,
    accountId,
    type: 'defis',
  });

  const defiValues = useMemo(
    () =>
      defis.reduce(
        (sum, next) => {
          sum.value = sum.value.plus(next.protocolValue);
          sum.value24h = sum.value24h.plus(next.protocolValue24h);
          return sum;
        },
        {
          value: new B(0),
          value24h: new B(0),
        },
      ),
    [defis],
  );

  const tokenValues = useAccountTokenValues(networkId, accountId, true);

  const nftValue = useNFTValues({
    accountId,
    networkId,
  });

  const nftValues = useMemo(() => {
    if (includeNFTsInTotal) {
      return {
        value: new B(nftValue),
        value24h: new B(0),
      };
    }
    return {
      value: new B(0),
      value24h: new B(0),
    };
  }, [nftValue, includeNFTsInTotal]);

  return [defiValues, tokenValues, nftValues].reduce(
    (sum, next) => ({
      ...sum,
      value: sum.value.plus(next.value),
      value24h: sum.value24h.plus(next.value24h),
    }),
    {
      value: new B(0),
      value24h: new B(0),
    },
  );
};

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
  const { data: tokens } = useAccountPortfolios({
    accountId,
    networkId,
    type: 'tokens',
  });

  const balances = useAppSelector((s) => s.tokens.accountTokensBalance);

  return useMemo(() => {
    if (isAllNetworks(networkId) && token?.coingeckoId) {
      return (
        tokens.find((t) => t.coingeckoId === token?.coingeckoId)?.balance ??
        fallback
      );
    }
    return (
      balances?.[networkId]?.[accountId]?.[getBalanceKey(token)]?.balance ??
      fallback
    );
  }, [networkId, tokens, token, accountId, balances, fallback]);
};

export const useTokenBalanceWithoutFrozen = ({
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
  const balance = useTokenBalance({ networkId, accountId, token, fallback });
  const frozenBalance = useFrozenBalance({
    networkId,
    accountId,
    tokenId: token?.tokenIdOnNetwork || 'main',
  });

  return useMemo(() => {
    if (frozenBalance < 0) return '0';
    const realBalance = new B(balance).minus(frozenBalance);
    if (realBalance.isGreaterThan(0)) {
      return realBalance.toFixed();
    }
    return '0';
  }, [balance, frozenBalance]);
};

export const useTokenPositionInfo = ({
  walletId,
  accountId,
  networkId,
  tokenAddress,
  sendAddress,
  coingeckoId,
}: {
  walletId: string;
  accountId: string;
  networkId: string;
  tokenAddress: string;
  sendAddress?: string;
  coingeckoId?: string;
}) => {
  const { data: defis } = useAccountPortfolios({
    accountId,
    networkId,
    type: 'defis',
  });

  const accountTokenBalance = useTokenBalance({
    networkId,
    accountId,
    token: {
      address: tokenAddress,
      sendAddress,
      coingeckoId,
    },
  });
  const allNetworksAccountInfo = useAllNetworksWalletAccounts({
    accountId,
    walletId,
  });
  const minerOverview = useAppSelector((s) => s.staking.keleMinerOverviews);

  const stakingAmount = useMemo(() => {
    if (!isAllNetworks(networkId)) {
      return minerOverview?.[accountId]?.[networkId]?.amount?.total_amount ?? 0;
    }
    let total = new B(0);
    for (const [nid, accounts] of Object.entries(allNetworksAccountInfo)) {
      for (const account of accounts) {
        const amount =
          minerOverview?.[account?.id]?.[nid]?.amount?.total_amount ?? 0;
        total = total.plus(amount);
      }
    }
    return total;
  }, [networkId, accountId, allNetworksAccountInfo, minerOverview]);

  const defiTokenAmount = useMemo(() => {
    if (!defis?.length) {
      return new B(0);
    }
    return defis.reduce((protocolSum, obj) => {
      const poolTokens = obj.pools.reduce((poolTypeSum, [, items]) => {
        const tokensValues = items.reduce(
          (allTokenSum, { supplyTokens, rewardTokens }) => {
            const supplyTokenSum = supplyTokens
              .filter((t) => t.tokenAddress === tokenAddress)
              .reduce(
                (tokenSum, sToken) => tokenSum.plus(sToken.balanceParsed ?? 0),
                new B(0),
              );
            const rewardTokenSum = rewardTokens
              .filter((t) => t.tokenAddress === tokenAddress)
              .reduce(
                (tokenSum, rToken) => tokenSum.plus(rToken.balanceParsed ?? 0),
                new B(0),
              );
            return allTokenSum.plus(supplyTokenSum).plus(rewardTokenSum);
          },
          new B(0),
        );
        return poolTypeSum.plus(tokensValues);
      }, new B(0));
      return protocolSum.plus(poolTokens);
    }, new B(0));
  }, [defis, tokenAddress]);

  return defiTokenAmount
    .plus(stakingAmount)
    .plus(accountTokenBalance)
    .toFixed();
};
