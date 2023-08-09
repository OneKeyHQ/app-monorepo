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
import { IMPL_EVM } from '@onekeyhq/shared/src/engine/engineConsts';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';
import { ModalRoutes, RootRoutes } from '../routes/routesEnum';
import {
  selectAccountTokens,
  selectAccountTokensBalance,
  selectDisPlayPriceType,
  selectHideRiskTokens,
  selectHideSmallBalance,
  selectIncludeNFTsInTotal,
  selectKeleMinerOverviews,
  selectNFTPrice,
  selectPutMainTokenOnTop,
  selectTokenPriceMap,
} from '../store/selectors';
import { getPreBaseValue } from '../utils/priceUtils';
import { createDeepEqualSelector } from '../utils/reselectUtils';
import {
  EOverviewScanTaskType,
  OverviewModalRoutes,
} from '../views/Overview/types';
import { StakingRoutes } from '../views/Staking/typing';

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
  networkId,
}: {
  networkId: string;
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
    const isNative = (t.isNative || !t.address) && !isAllNetworks(networkId);
    if (hideSmallBalance && new B(t.usdValue).isLessThan(1)) {
      if (!isNative) {
        return false;
      }
    }
    if (putMainTokenOnTop) {
      if (isNative) {
        return false;
      }
    }
    if (hideRiskTokens) {
      if (t.riskLevel && t.riskLevel > TokenRiskLevel.WARN) {
        return false;
      }
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
  const updateInfoUpdatedAt = useAppSelector(
    useMemo(
      () =>
        updatedTimeSelector({
          networkId: networkId ?? '',
          accountId: accountId ?? '',
        }),
      [accountId, networkId],
    ),
  );

  const { data: networkAccountsMap } = useAllNetworksWalletAccounts({
    accountId,
  });

  const fetchData = useCallback(async () => {
    if (isAllNetworks(networkId) && !Object.keys(networkAccountsMap)?.length) {
      setState({
        loading: false,
        data: [],
        updatedAt: updateInfoUpdatedAt,
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
      updatedAt: updateInfoUpdatedAt,
    });
  }, [accountId, networkId, type, networkAccountsMap, updateInfoUpdatedAt]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return state;
};

const balancesSelector = ({
  networkId,
  accountId,
}: {
  networkId: string;
  accountId: string;
}) =>
  createDeepEqualSelector(
    (s: IAppState) => {
      const { accountTokensBalance } = s.tokens;
      const accountBalance = accountTokensBalance?.[networkId]?.[accountId];
      if (accountBalance) {
        return Object.fromEntries(
          Object.entries(accountBalance).map(([tokenId, data]) => [
            tokenId,
            { balance: data?.balance ?? '0' },
          ]),
        );
      }
      return {};
    },
    (tokenBalances) => tokenBalances,
  );

const tokensSelector = ({
  networkId,
  accountId,
}: {
  networkId: string;
  accountId: string;
}) =>
  createSelector(
    (s: IAppState) => s.tokens.accountTokens?.[networkId]?.[accountId] ?? [],
    (accountTokens) => accountTokens,
  );

export function useAccountTokensOnChain(
  networkId = '',
  accountId = '',
  useFilter = false,
) {
  const hideRiskTokens = useAppSelector(selectHideRiskTokens);
  const hideSmallBalance = useAppSelector(selectHideSmallBalance);
  const putMainTokenOnTop = useAppSelector(selectPutMainTokenOnTop);
  const tokens = useAppSelector(
    useMemo(
      () => tokensSelector({ networkId, accountId }),
      [accountId, networkId],
    ),
  );
  const balances =
    useAppSelector(
      useMemo(
        () => balancesSelector({ networkId, accountId }),
        [accountId, networkId],
      ),
    ) ?? [];

  const prices = useAppSelector(selectTokenPriceMap) ?? {};

  const valueTokens = tokens.map((t) => {
    const priceInfo =
      prices[`${networkId}${t.address ? '-' : ''}${t.address ?? ''}`];
    const price = priceInfo?.usd ?? 0;
    const price24h = priceInfo?.usd_24h_change ?? 0;
    const balance = balances[getBalanceKey(t)]?.balance ?? '0';
    const value = new B(price).multipliedBy(balance);
    const usdValue = value;
    const value24h = new B(balance).multipliedBy(
      getPreBaseValue({
        priceInfo,
        vsCurrency: 'usd',
      }).usd ?? 0,
    );
    return {
      ...t,
      price,
      price24h,
      balance,
      value: value.toString(),
      usdValue: usdValue.toString(),
      value24h: value24h.toString(),
    };
  });

  return filterAccountTokens<IAccountTokenOnChain[]>({
    networkId,
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

export const useAccountIsUpdating = ({
  networkId,
  accountId,
}: {
  networkId: string;
  accountId: string;
}) => {
  const isUpdating = useAppSelector(
    useMemo(
      () =>
        createSelector(
          (s: IAppState) => s.overview.accountIsUpdating,
          (map) => map?.[accountId] ?? false,
        ),
      [accountId],
    ),
  );
  const { tasks } = useOverviewPendingTasks({ networkId, accountId });

  return useMemo(
    () => isUpdating || tasks?.length > 0,
    [isUpdating, tasks?.length],
  );
};

export function useAccountTokenLoading(networkId: string, accountId: string) {
  const accountTokens = useAppSelector(selectAccountTokens);

  const { data } = useAllNetworksWalletAccounts({
    accountId,
  });

  const accountIsUpdating = useAccountIsUpdating({
    networkId,
    accountId,
  });

  return useMemo(() => {
    if (isAllNetworks(networkId)) {
      if (accountIsUpdating) {
        return true;
      }
      if (!Object.keys(data).length) {
        return true;
      }
      return false;
    }
    return typeof accountTokens[networkId]?.[accountId] === 'undefined';
  }, [networkId, accountId, accountTokens, data, accountIsUpdating]);
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
  const hideRiskTokens = useAppSelector((s) => s.settings.hideRiskTokens);
  const hideSmallBalance = useAppSelector((s) => s.settings.hideSmallBalance);
  const putMainTokenOnTop = useAppSelector((s) => s.settings.putMainTokenOnTop);

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
      networkId,
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

  const nftPrices = useAppSelector(selectNFTPrice);
  const disPlayPriceType = useAppSelector(selectDisPlayPriceType);

  const prices = useAppSelector(selectTokenPriceMap);

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
  const includeNFTsInTotal = useAppSelector(selectIncludeNFTsInTotal);

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

  const balances = useAppSelector(selectAccountTokensBalance);

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

  const minerOverview = useAppSelector(selectKeleMinerOverviews);

  useEffect(() => {
    if (isAllNetworks(networkId)) {
      return;
    }
    backgroundApiProxy.serviceStaking
      .fetchMinerOverview({
        networkId,
        accountId,
      })
      .catch(() => {
        // pass
      });
  }, [networkId, accountId]);

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
      if (
        !minerOverview ||
        coingeckoId !== 'ethereum' ||
        tokenAddress ||
        isAllNetworks(networkId)
      ) {
        return total;
      }
      const current = minerOverview?.[aid]?.[nid];
      total = total
        .plus(current?.amount?.total_amount ?? 0)
        .plus(current?.amount.withdrawable ?? 0);

      return total;
    },
    [minerOverview, coingeckoId, tokenAddress, networkId],
  );

  const keleStakingInfo = useMemo(() => {
    const total = getStakingAmountInfo({
      networkId,
      accountId,
    });
    return {
      name: 'Kelepool',
      logoURI: KeleLogoPNG,
      address: '',
      sendAddress: undefined,
      type: intl.formatMessage({ id: 'form__staking' }),
      balance: total,
      networkId,
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

  const onPressStaking = useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.Staking,
      params: {
        screen: StakingRoutes.StakedETHOnKele,
        params: {
          networkId,
          accountId,
        },
      },
    });
  }, [navigation, networkId, accountId]);

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
          const account = getAccountFromAccountAddress(
            item.networkId,
            item.accountAddress ?? '',
          );
          if (new B(item.balance).isGreaterThan(0)) {
            items.push({
              name: t.name,
              address: t.address,
              symbol: t.symbol,
              logoURI: t.logoURI ?? '',
              type: 'Token',
              balance: item.balance,
              networkId: item.networkId,
              accountName: account?.name ?? '',
            });
          }
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
      keleStakingInfo;

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
        onPress: onPressStaking,
      });
    }

    return {
      balance,
      items,
    };
  }, [
    onPressStaking,
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
  accountId,
  defaultInfo = {},
}: {
  coingeckoId?: string;
  networkId?: string;
  accountId?: string;
  tokenAddress?: string;
  defaultInfo?: Record<string, unknown>;
}) => {
  const [dataState, setDataState] = useState<{
    data?: ITokenDetailInfo | undefined;
    loading: boolean;
  }>({
    data: undefined,
    loading: true,
  });
  const { token, loading: tokenLoading } = useSingleToken(
    networkId ?? '',
    tokenAddress ?? '',
  );

  useEffect(() => {
    setDataState((pre) => {
      if (pre.loading) {
        return pre;
      }
      return {
        data: undefined,
        loading: true,
      };
    });

    backgroundApiProxy.serviceToken
      .fetchTokenDetailInfo({
        coingeckoId,
        networkId,
        tokenAddress,
        accountId,
      })
      .then((res) =>
        setDataState({
          data: res,
          loading: false,
        }),
      )
      .catch(() =>
        setDataState({
          data: undefined,
          loading: false,
        }),
      );
  }, [coingeckoId, networkId, tokenAddress, accountId]);

  return useMemo(() => {
    const { defaultChain } = dataState?.data ?? {};
    const tokens = dataState?.data?.tokens ?? [];
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
      ...dataState?.data,
      loading: dataState?.loading || tokenLoading,
      tokens,
      defaultToken,
      ethereumNativeToken,
    };
  }, [dataState?.data, token, dataState?.loading, tokenLoading, defaultInfo]);
};
