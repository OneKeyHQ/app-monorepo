import { useCallback, useEffect, useMemo, useState } from 'react';

import { createSelector } from '@reduxjs/toolkit';
import B from 'bignumber.js';
import { pick } from 'lodash';
import natsort from 'natsort';
import { useIntl } from 'react-intl';

import { isAllNetworks } from '@onekeyhq/engine/src/managers/network';
import { getBalanceKey } from '@onekeyhq/engine/src/managers/token';
import type { Token } from '@onekeyhq/engine/src/types/token';
import { TokenRiskLevel } from '@onekeyhq/engine/src/types/token';
import KeleLogoPNG from '@onekeyhq/kit/assets/staking/kele_pool.png';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';
import { IMPL_EVM } from '@onekeyhq/shared/src/engine/engineConsts';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';
import { ModalRoutes, RootRoutes } from '../routes/routesEnum';
import { getPreBaseValue } from '../utils/priceUtils';
import {
  EOverviewScanTaskType,
  OverviewModalRoutes,
} from '../views/Overview/types';

import { useAllNetworksWalletAccounts } from './useAllNetwoks';
import { useAppSelector } from './useAppSelector';
import useNavigation from './useNavigation';
import { useFrozenBalance, useSingleToken } from './useTokens';

import type { IAppState } from '../store';
import type { ITokenDetailInfo } from '../views/ManageTokens/types';
import type {
  IAccountToken,
  IOverviewTokenDetailListItem,
  OverviewAllNetworksPortfolioRes,
} from '../views/Overview/types';

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

const tasksSelector = ({
  networkId,
  accountId,
}: {
  networkId: string;
  accountId: string;
}) =>
  createSelector([(s: IAppState) => s.overview.tasks], (tasks) => {
    const data = Object.values(tasks || {});
    return data.filter((t) => t.key === `${networkId}___${accountId}`);
  });

const updatedTimeSelector = ({
  networkId,
  accountId,
}: {
  networkId: string;
  accountId: string;
}) =>
  createSelector(
    (s: IAppState) => s.overview.updatedTimeMap,
    (updatedTimeMap) =>
      updatedTimeMap?.[`${networkId}___${accountId}`]?.updatedAt,
  );

export const useOverviewAccountUpdateInfo = ({
  networkId,
  accountId,
}: {
  networkId: string;
  accountId: string;
}) =>
  useAppSelector(
    useMemo(
      () =>
        createSelector(
          (s: IAppState) => s.overview.updatedTimeMap,
          (m) => m?.[`${networkId ?? ''}___${accountId ?? ''}`] ?? {},
        ),
      [accountId, networkId],
    ),
  );

export const useAccountPortfolios = <
  T extends keyof OverviewAllNetworksPortfolioRes,
>({
  networkId = '',
  accountId = '',
  type,
}: {
  networkId?: string | null;
  accountId?: string | null;
  type: T;
}) => {
  const [state, setState] = useState<{
    data: OverviewAllNetworksPortfolioRes[T];
    updatedAt?: number;
    loading: boolean;
  }>({
    data: [],
    updatedAt: undefined,
    loading: true,
  });
  const updateInfo = useOverviewAccountUpdateInfo({
    networkId: networkId ?? '',
    accountId: accountId ?? '',
  });

  const { data: networkAccountsMap } = useAllNetworksWalletAccounts({
    accountId,
  });

  const fetchData = useCallback(async () => {
    if (isAllNetworks(networkId) && !Object.keys(networkAccountsMap)?.length) {
      setState({
        loading: false,
        data: [],
        updatedAt: updateInfo?.updatedAt,
      });
      return;
    }
    const res = await backgroundApiProxy.serviceOverview.getAccountPortfolio({
      networkId: networkId ?? '',
      accountId: accountId ?? '',
    });
    setState({
      loading: false,
      data: res?.[type] || [],
      updatedAt: updateInfo?.updatedAt,
    });
  }, [accountId, networkId, type, networkAccountsMap, updateInfo?.updatedAt]);

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

export const useOverviewPendingTasks = ({
  networkId,
  accountId,
}: {
  networkId: string;
  accountId: string;
}) => {
  const updatedAt = useAppSelector(
    useMemo(
      () => updatedTimeSelector({ networkId, accountId }),
      [networkId, accountId],
    ),
  );

  const tasks = useAppSelector(
    useMemo(
      () => tasksSelector({ networkId, accountId }),
      [networkId, accountId],
    ),
  );

  return {
    tasks,
    updatedAt,
  };
};

export function useAccountTokenLoading(networkId: string, accountId: string) {
  const pendingTasks = useOverviewPendingTasks({ networkId, accountId });
  const accountTokens = useAppSelector((s) => s.tokens.accountTokens);

  const { data, loading: allNetworksAccountsLoading } =
    useAllNetworksWalletAccounts({
      accountId,
    });

  return useMemo(() => {
    if (isAllNetworks(networkId)) {
      const { tasks, updatedAt } = pendingTasks;
      if (allNetworksAccountsLoading) {
        return true;
      }
      if (!Object.keys(data).length) {
        return false;
      }
      return (
        tasks?.filter((t) => t.scanType === EOverviewScanTaskType.token)
          .length > 0 || typeof updatedAt === 'undefined'
      );
    }
    return typeof accountTokens[networkId]?.[accountId] === 'undefined';
  }, [
    networkId,
    accountId,
    accountTokens,
    pendingTasks,
    data,
    allNetworksAccountsLoading,
  ]);
}

export function useNFTIsLoading({
  networkId,
  accountId,
}: {
  networkId: string;
  accountId: string;
}) {
  const { tasks, updatedAt } = useOverviewPendingTasks({
    networkId,
    accountId,
  });

  return useMemo(
    () =>
      tasks?.filter((t) => t.scanType === EOverviewScanTaskType.nfts).length >
        0 || typeof updatedAt === 'undefined',
    [tasks, updatedAt],
  );
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

  const { data: allNetworksTokens = [], loading: allNetworksTokensLoading } =
    useAccountPortfolios({
      networkId,
      accountId,
      type: EOverviewScanTaskType.token,
    });

  const accountTokensOnChain = useAccountTokensOnChain(
    networkId,
    accountId,
    false,
  );

  const accountTokensLoading = useAccountTokenLoading(networkId, accountId);

  const loading = useMemo(
    () => accountTokensLoading || allNetworksTokensLoading,
    [accountTokensLoading, allNetworksTokensLoading],
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
          tokens: t.tokens ?? [],
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
            tokens: [
              {
                networkId: t.networkId,
                address: t.address ?? '',
                balance: t.balance,
                decimals: t.decimals,
                riskLevel: t.riskLevel ?? TokenRiskLevel.UNKNOWN,
                value: t.value,
              },
            ],
          };
          return info;
        });

    return accountTokens;
  }, [networkId, allNetworksTokens, limitSize, accountTokensOnChain]);

  return {
    loading,
    data: filterAccountTokens<IAccountToken[]>({
      tokens: valueTokens,
      useFilter,
      hideRiskTokens,
      hideSmallBalance,
      putMainTokenOnTop,
    }),
  };
}

export function useAccountTokenValues(
  networkId: string,
  accountId: string,
  useFilter = true,
) {
  const { data: accountTokens } = useAccountTokens({
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
  const { data: networkAccountsMap } = useAllNetworksWalletAccounts({
    accountId,
  });

  const nftPrices = useAppSelector((s) => s.nft.nftPrice);

  const { disPlayPriceType } = useAppSelector((s) => s.nft);

  const prices = useAppSelector((s) => s.tokens.tokenPriceMap);

  const value = useMemo(() => {
    let total = 0;

    if (!isAllNetworks(networkId)) {
      const v =
        nftPrices[accountId ?? '']?.[networkId ?? '']?.[disPlayPriceType] ?? 0;
      const p = prices?.[networkId ?? '']?.usd ?? 0;
      return p * v;
    }

    for (const [nid, accounts] of Object.entries(networkAccountsMap)) {
      const p = prices?.[nid]?.usd ?? 0;
      for (const a of accounts) {
        const nftPrice = nftPrices?.[a.id]?.[nid]?.[disPlayPriceType] ?? 0;
        total += nftPrice * p;
      }
    }

    return total;
  }, [
    disPlayPriceType,
    networkAccountsMap,
    nftPrices,
    prices,
    accountId,
    networkId,
  ]);
  return value;
};

export const useAccountValues = (props: {
  networkId: string;
  accountId: string;
}) => {
  const { networkId, accountId } = props;
  const { includeNFTsInTotal } = useAppSelector((s) => s.settings);

  const { data: defis = [] } = useAccountPortfolios({
    networkId,
    accountId,
    type: EOverviewScanTaskType.defi,
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
    type: EOverviewScanTaskType.token,
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
  accountId = '',
  networkId = '',
  tokenAddress,
  sendAddress,
  coingeckoId,
}: {
  walletId?: string;
  accountId?: string;
  networkId?: string;
  tokenAddress?: string;
  sendAddress?: string;
  coingeckoId?: string;
}) => {
  const intl = useIntl();
  const navigation = useNavigation();
  const { data: defis } = useAccountPortfolios({
    accountId,
    networkId,
    type: EOverviewScanTaskType.defi,
  });

  const { data: accountTokens } = useAccountTokens({
    networkId,
    accountId,
    useFilter: false,
  });

  const { data: allNetworksAccountsMap } = useAllNetworksWalletAccounts({
    accountId,
  });

  // TODO: fetch minerOverview
  const minerOverview = useAppSelector((s) => s.staking.keleMinerOverviews);

  const getAccountFromAccountAddress = useCallback(
    (nid: string, accountAddress: string) =>
      allNetworksAccountsMap?.[nid]?.find((a) => a.address === accountAddress),
    [allNetworksAccountsMap],
  );

  const getStakingAmountInfo = useCallback(
    ({
      networkId: nid,
      accountId: aid,
    }: {
      networkId: string;
      accountId: string;
    }) => {
      let total = new B(0);
      if (!minerOverview) return;
      if (coingeckoId !== 'ethereum' || tokenAddress) {
        return;
      }

      if (isAllNetworks(nid)) {
        for (const a of allNetworksAccountsMap[OnekeyNetwork.eth] ?? []) {
          total = total.plus(
            getStakingAmountInfo({
              networkId: OnekeyNetwork.eth,
              accountId: a.id,
            })?.total ?? 0,
          );
        }
      } else {
        const current = minerOverview?.[aid]?.[nid];
        total = total
          .plus(current?.amount?.total_amount ?? 0)
          .plus(current?.amount.withdrawable ?? 0);
      }

      return {
        total,
        networkId: nid,
      };
    },
    [minerOverview, allNetworksAccountsMap, coingeckoId, tokenAddress],
  );

  const keleStakingInfo = useMemo(() => {
    const { total = new B(0), networkId: nid } =
      getStakingAmountInfo({
        networkId,
        accountId,
      }) ?? {};
    return {
      name: 'Kelepool',
      logoURI: KeleLogoPNG,
      address: '',
      sendAddress: undefined,
      type: intl.formatMessage({ id: 'form__staking' }),
      balance: total,
      networkId: nid,
    };
  }, [getStakingAmountInfo, intl, accountId, networkId]);

  const onPresDefiProtocol = useCallback(
    ({ protocolId, poolCode }: { protocolId: string; poolCode: string }) => {
      if (!networkId || !accountId) {
        return;
      }
      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.Overview,
        params: {
          screen: OverviewModalRoutes.OverviewProtocolDetail,
          params: {
            protocolId,
            networkId,
            accountId,
            poolCode,
          },
        },
      });
    },
    [navigation, accountId, networkId],
  );

  return useMemo(() => {
    let balance = new B(0);
    const items: IOverviewTokenDetailListItem[] = [];
    accountTokens.forEach((t) => {
      if (
        isAllNetworks(networkId)
          ? coingeckoId === t.coingeckoId
          : t.address === tokenAddress && t.sendAddress === sendAddress
      ) {
        t.tokens?.forEach((item) => {
          items.push({
            name: t.name,
            address: t.address,
            symbol: t.symbol,
            logoURI: t.logoURI ?? '',
            type: 'Token',
            balance: item.balance,
            networkId: item.networkId,
            accountName:
              getAccountFromAccountAddress(
                item.networkId,
                item.accountAddress ?? '',
              )?.name ?? '',
          });
        });
        balance = balance.plus(t.balance);
      }
    });

    defis.forEach((d) => {
      d.pools.forEach((p) => {
        p[1].forEach((item) => {
          [...item.supplyTokens, ...item.rewardTokens].forEach((t) => {
            if (
              isAllNetworks(networkId)
                ? coingeckoId === t.coingeckoId
                : t.tokenAddress === tokenAddress
            ) {
              items.push({
                name: d.protocolName,
                symbol: t.symbol ?? '',
                address: t.tokenAddress,
                logoURI: d.protocolIcon,
                type: p[0],
                balance: t.balanceParsed ?? '0',
                networkId: d._id.networkId,
                onPress: () =>
                  onPresDefiProtocol({
                    protocolId: d._id.protocolId,
                    poolCode: item.poolCode,
                  }),
              });
              balance = balance.plus(t.balanceParsed ?? 0);
            }
          });
        });
      });
    });

    const { balance: stakingBalance, networkId: stakingNetworkId } =
      keleStakingInfo ?? {};

    if (stakingBalance?.gt(0) && stakingNetworkId) {
      balance = balance.plus(keleStakingInfo.balance);
      items.push({
        name: 'Kelepool',
        symbol: 'ETH',
        address: '',
        logoURI: KeleLogoPNG,
        type: intl.formatMessage({ id: 'form__staking' }),
        balance: stakingBalance.toFixed(),
        networkId: stakingNetworkId,
      });
    }

    return {
      balance,
      items,
    };
  }, [
    onPresDefiProtocol,
    getAccountFromAccountAddress,
    sendAddress,
    intl,
    accountTokens,
    coingeckoId,
    tokenAddress,
    networkId,
    defis,
    keleStakingInfo,
  ]);
};

export const useTokenDetailInfo = ({
  coingeckoId,
  networkId,
  tokenAddress,
  defaultInfo = {},
}: {
  coingeckoId?: string;
  networkId?: string;
  tokenAddress?: string;
  defaultInfo?: Record<string, unknown>;
}) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ITokenDetailInfo | undefined>();
  const { token, loading: tokenLoading } = useSingleToken(
    networkId ?? '',
    tokenAddress ?? '',
  );

  useEffect(() => {
    setLoading(true);
    backgroundApiProxy.serviceToken
      .fetchTokenDetailInfo({ coingeckoId, networkId, tokenAddress })
      .then((res) => setData(res))
      .finally(() => setLoading(false));
  }, [coingeckoId, networkId, tokenAddress]);

  return useMemo(() => {
    const { defaultChain } = data ?? {};
    const tokens = data?.tokens ?? [];
    if (!tokens.length && token) {
      tokens.push(token);
    }
    const defaultToken =
      tokens?.find(
        (t) =>
          t.impl === defaultChain?.impl && t.chainId === defaultChain?.chainId,
      ) ?? tokens?.[0];

    const ethereumNativeToken = tokens?.find(
      (n) =>
        n.impl === IMPL_EVM &&
        (n.chainId === '1' || n.chainId === '5') &&
        (n.isNative || !n.address),
    );

    return {
      ...defaultInfo,
      ...pick(token, 'name', 'symbol', 'logoURI'),
      ...data,
      loading: loading || tokenLoading,
      tokens,
      defaultToken,
      ethereumNativeToken,
    };
  }, [data, token, loading, tokenLoading, defaultInfo]);
};
