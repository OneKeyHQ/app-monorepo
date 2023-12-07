import { useCallback, useEffect, useMemo, useState } from 'react';

import { createSelector } from '@reduxjs/toolkit';
import B from 'bignumber.js';
import { useIntl } from 'react-intl';

import { isAllNetworks } from '@onekeyhq/engine/src/managers/network';
import { getBalanceKey } from '@onekeyhq/engine/src/managers/token';
import type {
  IAccountTokenData,
  Token,
} from '@onekeyhq/engine/src/types/token';
import KeleLogoPNG from '@onekeyhq/kit/assets/staking/kele_pool.png';
import { freezedEmptyArray } from '@onekeyhq/shared/src/consts/sharedConsts';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';
import { ModalRoutes, RootRoutes } from '../routes/routesEnum';
import {
  EOverviewScanTaskType,
  OverviewModalRoutes,
} from '../views/Overview/types';
import { StakingRoutes } from '../views/Staking/typing';

import { useAppSelector } from './useAppSelector';
import useNavigation from './useNavigation';
import { usePromiseResult } from './usePromiseResult';
import { useFrozenBalance } from './useTokens';

import type { IAppState } from '../store';
import type { OverviewDefiRes } from '../views/Overview/types';

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

export function useAccountTokensOnChain(
  networkId = '',
  accountId = '',
  useFilter = false,
) {
  const hideRiskTokens = useAppSelector((s) => s.settings.hideRiskTokens);
  const hideSmallBalance = useAppSelector((s) => s.settings.hideSmallBalance);
  const putMainTokenOnTop = useAppSelector((s) => s.settings.putMainTokenOnTop);

  const { result } = usePromiseResult(
    () =>
      backgroundApiProxy.serviceOverview.buildSingleChainAccountTokens<IAccountTokenData>(
        {
          networkId,
          accountId,
          tokensSort: {
            native: putMainTokenOnTop,
            name: 'asc',
            value: 'desc',
            price: 'desc',
          },
          tokensFilter: {
            hideRiskTokens: useFilter && hideRiskTokens,
            hideSmallBalance: useFilter && hideSmallBalance,
          },
          calculateTokensTotalValue: true,
          buildTokensMapKey: true,
        },
        'raw',
      ),
    [
      networkId,
      accountId,
      useFilter,
      hideSmallBalance,
      hideRiskTokens,
      putMainTokenOnTop,
    ],
  );

  return result?.tokens ?? (freezedEmptyArray as IAccountTokenData[]);
}

export const useOverviewPendingTasks = ({
  networkId,
  accountId,
}: {
  networkId: string;
  accountId: string;
}) => {
  const refreshAccountNFTTs = useAppSelector(
    (s) => s.refresher.refreshAccountNFTTs,
  );
  const refreshAccountDefiTs = useAppSelector(
    (s) => s.refresher.refreshAccountDefiTs,
  );
  const refreshAccountTokenTs = useAppSelector(
    (s) => s.refresher.refreshAccountTokenTs,
  );

  const updatedAt = useMemo(() => {
    const tsList = [
      refreshAccountNFTTs,
      refreshAccountTokenTs,
      refreshAccountDefiTs,
    ];
    let isUnset = true;
    let max = 0;
    for (const ts of tsList) {
      if (typeof ts !== 'undefined') {
        isUnset = false;
        max = Math.max(max, ts);
      }
    }
    if (isUnset) {
      return undefined;
    }
    return max;
  }, [refreshAccountNFTTs, refreshAccountTokenTs, refreshAccountDefiTs]);

  const tasks = useAppSelector(
    useMemo(
      () => tasksSelector({ networkId, accountId }),
      [networkId, accountId],
    ),
  );

  return useMemo(
    () => ({
      tasks,
      updatedAt,
    }),
    [tasks, updatedAt],
  );
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
          (s: IAppState) => s.refresher.overviewAccountIsUpdating,
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
  const accountTokens = useAppSelector((s) => s.tokens.accountTokens);

  const accountIsUpdating = useAccountIsUpdating({
    networkId,
    accountId,
  });

  return useMemo(() => {
    if (isAllNetworks(networkId)) {
      if (accountIsUpdating) {
        return true;
      }
      return false;
    }
    return typeof accountTokens[networkId]?.[accountId] === 'undefined';
  }, [networkId, accountId, accountTokens, accountIsUpdating]);
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

export function useOverviewLoading({
  networkId = '',
  accountId = '',
}: {
  networkId?: string;
  accountId?: string;
}) {
  const tokensLoading =
    useAppSelector((s) => s.refresher.overviewHomeTokensLoading) ?? false;
  const accountTokensLoading = useAccountTokenLoading(networkId, accountId);

  const loading = useMemo(
    () => accountTokensLoading || tokensLoading,
    [accountTokensLoading, tokensLoading],
  );
  return loading;
}

export const useBRC20TokenBalance = ({
  networkId,
  accountId,
  token,
  fallback = {
    balance: '0',
    availableBalance: '0',
    transferBalance: '0',
  },
}: {
  networkId: string;
  accountId: string;
  token?: Partial<Token> | null;
  fallback?: {
    balance: string;
    availableBalance: string;
    transferBalance: string;
  };
}) => {
  const balances = useAppSelector((s) => s.tokens.accountTokensBalance);

  return useMemo(
    () =>
      balances?.[networkId]?.[accountId]?.[getBalanceKey(token)] ?? fallback,
    [networkId, token, accountId, balances, fallback],
  );
};

export const useTokenBalance = ({
  networkId,
  accountId,
  token,
  fallback = '0',
  useRecycleBalance,
  useCustomAddressesBalance,
}: {
  networkId: string;
  accountId: string;
  token?: Partial<Token> | null;
  fallback?: string;
  useRecycleBalance?: boolean;
  useCustomAddressesBalance?: boolean;
}) => {
  const balances = useAppSelector((s) => s.tokens.accountTokensBalance);
  const [manuallyAddedAddressBalance, setManuallyAddedAddressBalance] =
    useState(fallback);

  useEffect(() => {
    if (!useCustomAddressesBalance) {
      return;
    }

    backgroundApiProxy.serviceToken
      .fetchBalanceDetails({
        networkId,
        accountId,
        useCustomAddressesBalance,
        useRecycleBalance,
      })
      .then((value) => {
        setManuallyAddedAddressBalance(value?.available ?? fallback);
      });
  }, [
    networkId,
    accountId,
    useCustomAddressesBalance,
    fallback,
    useRecycleBalance,
  ]);

  if (isAllNetworks(networkId)) {
    throw new Error(`useTokenBalance: networkId is not valid: ${networkId}`);
  }

  return useMemo(() => {
    if (useCustomAddressesBalance) {
      return manuallyAddedAddressBalance ?? fallback;
    }
    return (
      balances?.[networkId]?.[accountId]?.[getBalanceKey(token)]?.balance ??
      fallback
    );
  }, [
    networkId,
    token,
    accountId,
    balances,
    fallback,
    manuallyAddedAddressBalance,
    useCustomAddressesBalance,
  ]);
};

export const useTokenBalanceWithoutFrozen = ({
  networkId,
  accountId,
  token,
  fallback = '0',
  useRecycleBalance,
  useCustomAddressesBalance,
}: {
  networkId: string;
  accountId: string;
  token?: Partial<Token> | null;
  fallback?: string;
  useRecycleBalance?: boolean;
  useCustomAddressesBalance?: boolean;
}) => {
  const balance = useTokenBalance({
    networkId,
    accountId,
    token,
    fallback,
    useRecycleBalance,
    useCustomAddressesBalance,
  });

  const frozenBalance = useFrozenBalance({
    networkId,
    accountId,
    tokenId: token?.tokenIdOnNetwork || 'main',
    useRecycleBalance,
    useCustomAddressesBalance,
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
  networkId,
  accountId,
  tokenAddress,
  sendAddress,
  coingeckoId,
  defaultInfo,
}: {
  accountId: string;
  networkId: string;
  tokenAddress?: string;
  sendAddress?: string;
  coingeckoId?: string;
  defaultInfo?: {
    price?: number;
    price24h?: number;
    logoURI?: string;
    symbol?: string;
    name?: string;
  };
}) => {
  const intl = useIntl();
  const navigation = useNavigation();

  const onPresDefiProtocol = useCallback(
    ({
      protocol,
      poolCode,
    }: {
      protocol?: OverviewDefiRes;
      poolCode?: string;
    }) => {
      if (!networkId || !accountId || !protocol || !poolCode) {
        return;
      }
      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.Overview,
        params: {
          screen: OverviewModalRoutes.OverviewProtocolDetail,
          params: {
            protocol,
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

  const { result, isLoading } = usePromiseResult(
    () =>
      backgroundApiProxy.serviceOverview.buildTokenDetailPositionInfo({
        networkId,
        accountId,
        tokenAddress,
        sendAddress,
        coingeckoId,
      }),
    [networkId, accountId, tokenAddress, sendAddress, coingeckoId],
    {
      debounced: 0,
      watchLoading: true,
    },
  );

  return useMemo(() => {
    if (!result) {
      return {
        isLoading,
        balance: new B(0),
        detailInfo: {
          ...defaultInfo,
          tokens: [],
          defaultToken: undefined,
          ethereumNativeToken: undefined,
        },
        items: [],
      };
    }
    const { totalBalance, keleStakingBalance, items } = result;

    if (new B(keleStakingBalance)?.gt(0)) {
      items.push({
        name: 'Kelepool',
        symbol: 'ETH',
        address: '',
        logoURI: KeleLogoPNG,
        type: intl.formatMessage({ id: 'form__staking' }),
        balance: keleStakingBalance,
        networkId,
        onPress: onPressStaking,
      });
    }

    return {
      isLoading,
      balance: new B(totalBalance),
      detailInfo: result.detailInfo,
      items: items.map((item) => {
        if (item.poolCode && item.protocol) {
          return {
            ...item,
            onPress: () =>
              onPresDefiProtocol({
                protocol: item.protocol,
                poolCode: item.poolCode,
              }),
          };
        }

        return item;
      }),
    };
  }, [
    result,
    networkId,
    isLoading,
    defaultInfo,
    intl,
    onPressStaking,
    onPresDefiProtocol,
  ]);
};
