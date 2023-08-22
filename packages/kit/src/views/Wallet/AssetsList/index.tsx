import { memo, useEffect, useMemo, useRef } from 'react';

import { isEqual, isNil } from 'lodash';

import type { FlatList } from '@onekeyhq/components';
import type { Tabs } from '@onekeyhq/components/src/CollapsibleTabView';
import type { FlatListProps } from '@onekeyhq/components/src/FlatList';
import type { FlatListPlain } from '@onekeyhq/components/src/FlatListPlain';
import { isAllNetworks } from '@onekeyhq/engine/src/managers/network';
import type {
  HomeRoutes,
  RootRoutes,
} from '@onekeyhq/kit/src/routes/routesEnum';
import { TabRoutes } from '@onekeyhq/kit/src/routes/routesEnum';
import type {
  HomeRoutesParams,
  RootRoutesParams,
} from '@onekeyhq/kit/src/routes/types';
import { freezedEmptyArray } from '@onekeyhq/shared/src/consts/sharedConsts';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import {
  useAppSelector,
  useReduxAccountTokenBalancesMap,
  useReduxAccountTokensList,
  useReduxTokenPricesMap,
} from '../../../hooks';
import { useIsFocusedAllInOne } from '../../../hooks/useIsFocusedAllInOne';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { WalletHomeTabEnum } from '../type';

import { AssetsListView } from './AssetsListView';
import {
  atomHomeOverviewAccountTokens,
  atomTokenAssetsListLoading,
  useAtomAssetsList,
  withProviderAssetsList,
} from './contextAssetsList';

import type { IAccountToken } from '../../Overview/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

export type NavigationProps = NativeStackNavigationProp<
  RootRoutesParams,
  RootRoutes.Main
> &
  NativeStackNavigationProp<HomeRoutesParams, HomeRoutes.ScreenTokenDetail>;

export type IAssetsListProps = Omit<
  FlatListProps<IAccountToken>,
  'data' | 'renderItem'
> & {
  onTokenPress?: null | ((event: { token: IAccountToken }) => void) | undefined;
  isRenderByCollapsibleTab?: boolean;
  FlatListComponent?:
    | typeof Tabs.FlatListPlain
    | typeof FlatListPlain
    | typeof Tabs.FlatList
    | typeof FlatList;
  itemsCountForAutoFallbackToPlainList?: number;
  hidePriceInfo?: boolean;
  showRoundTop?: boolean;
  showTokenBalanceDetail?: boolean;
  limitSize?: number;
  flatStyle?: boolean;
  accountId: string;
  networkId: string;
  walletId: string;
  accountTokens: IAccountToken[];
  showSkeletonHeader?: boolean;
};

export function HandleRefreshAssetsListData({
  accountId,
  networkId,
}: {
  accountId: string;
  networkId: string;
}) {
  const isUnlock = useAppSelector((s) => s.status.isUnlock);
  const { isFocused, homeTabFocused, rootTabFocused } = useIsFocusedAllInOne({
    focusDelay: 1000,
    rootTabName: TabRoutes.Home,
    homeTabName: WalletHomeTabEnum.Tokens,
  });
  const { serviceToken } = backgroundApiProxy;
  const shouldRefreshBalancesRef = useRef(false);

  const shouldRefreshBalances = useMemo<boolean>(() => {
    if (!accountId || !networkId || isAllNetworks(networkId)) {
      return false;
    }
    if (!isUnlock || !isFocused) {
      return false;
    }
    if (!homeTabFocused) {
      return false;
    }
    if (!rootTabFocused) {
      return false;
    }
    return true;
  }, [
    accountId,
    networkId,
    isUnlock,
    isFocused,
    homeTabFocused,
    rootTabFocused,
  ]);
  shouldRefreshBalancesRef.current = shouldRefreshBalances;

  useEffect(() => {
    if (!shouldRefreshBalancesRef.current) {
      serviceToken.stopRefreshAccountTokens();
    }
  }, [accountId, networkId, serviceToken]);

  // fetch tokens by interval
  useEffect(() => {
    if (shouldRefreshBalances) {
      serviceToken.startRefreshAccountTokensDebounced();
    } else {
      serviceToken.pauseRefreshAccountTokens();
    }
  }, [serviceToken, shouldRefreshBalances]);

  return null;
}

export type IAssetsListDataFromReduxOptions = {
  networkId: string;
  accountId: string;
  limitSize?: number;
  debounced?: number;
};

export function useAssetsListDataFromRedux({
  networkId,
  accountId,
  limitSize,
  debounced = 0,
}: IAssetsListDataFromReduxOptions) {
  const hideRiskTokens = useAppSelector((s) => s.settings.hideRiskTokens);
  const hideSmallBalance = useAppSelector((s) => s.settings.hideSmallBalance);
  const putMainTokenOnTop = useAppSelector((s) => s.settings.putMainTokenOnTop);

  const refresherTs = useAppSelector((s) => s.refresher.refreshAccountTokenTs);
  const tokensList = useReduxAccountTokensList({
    accountId,
    networkId,
  });
  const balancesMap = useReduxAccountTokenBalancesMap({
    accountId,
    networkId,
  });
  const pricesMap = useReduxTokenPricesMap();

  const result = usePromiseResult(
    () => {
      if (refresherTs) {
        //
      }
      if (tokensList && balancesMap && pricesMap) {
        //
      }
      const r = backgroundApiProxy.serviceOverview.buildAccountTokens({
        networkId,
        accountId,
        tokensLimit: limitSize,
        tokensSort: {
          native: putMainTokenOnTop,
          name: 'asc',
          value: 'desc',
          price: 'desc',
        },
        tokensFilter: {
          hideRiskTokens,
          hideSmallBalance,
        },
        calculateTokensTotalValue: true,
        buildTokensMapKey: true,
      });
      return r;
    },
    [
      accountId,
      hideRiskTokens,
      hideSmallBalance,
      limitSize,
      networkId,
      putMainTokenOnTop,
      refresherTs,
      balancesMap,
      tokensList,
      pricesMap,
    ],
    {
      debounced,
      watchLoading: true,
    },
  );

  return result;
}

export function HandleRebuildAssetsListData(
  options: IAssetsListDataFromReduxOptions,
) {
  const result = useAssetsListDataFromRedux(options);
  const [accountTokens, setAccountTokens] = useAtomAssetsList(
    atomHomeOverviewAccountTokens,
  );
  const [, setIsLoading] = useAtomAssetsList(atomTokenAssetsListLoading);

  useEffect(() => {
    (() => {
      const data = result.result;
      if (!data) {
        return;
      }
      if (data.tokensKeys) {
        if (!isEqual(accountTokens.tokensKeys, data.tokensKeys)) {
          setAccountTokens(data);
        }
      } else {
        setAccountTokens(data);
      }
    })();
  }, [accountTokens.tokensKeys, result.result, setAccountTokens]);

  useEffect(() => {
    if (!isNil(result.isLoading)) {
      setIsLoading(result.isLoading);
    }
  }, [result.isLoading, setIsLoading]);

  return null;
}

function HomeTokenAssetsListCmp({
  walletId,
  children,
  accountId,
  networkId,
  limitSize,
}: IAssetsListDataFromReduxOptions & {
  walletId: string;
  children?: any;
}) {
  const [accountTokensInfo] = useAtomAssetsList(atomHomeOverviewAccountTokens);
  const { tokens: accountTokens = freezedEmptyArray } = accountTokensInfo;

  const footer = useMemo(
    () => (
      <>
        <HandleRebuildAssetsListData
          networkId={networkId}
          accountId={accountId}
          limitSize={limitSize}
          debounced={600}
        />
        <HandleRefreshAssetsListData
          accountId={accountId}
          networkId={networkId}
        />
        {children}
      </>
    ),
    [accountId, children, limitSize, networkId],
  );

  return (
    <AssetsListView
      walletId={walletId}
      accountId={accountId}
      networkId={networkId}
      limitSize={limitSize}
      isRenderByCollapsibleTab
      accountTokens={accountTokens}
      itemsCountForAutoFallbackToPlainList={15}
      ListFooterComponent={footer}
    />
  );
}

export const HomeTokenAssetsList = memo(
  withProviderAssetsList(HomeTokenAssetsListCmp),
);
HomeTokenAssetsList.displayName = 'HomeTokenAssetsList';

function FullTokenAssetsListCmp(
  props: Omit<IAssetsListProps, 'accountTokens'>,
) {
  const { accountId, networkId, limitSize } = props;

  const [accountTokensInfo] = useAtomAssetsList(atomHomeOverviewAccountTokens);
  const { tokens: accountTokens = freezedEmptyArray } = accountTokensInfo;

  return (
    <>
      <HandleRebuildAssetsListData
        networkId={networkId}
        accountId={accountId}
        limitSize={limitSize}
        debounced={0}
      />
      <AssetsListView {...props} accountTokens={accountTokens} />
    </>
  );
}

export const FullTokenAssetsList = memo(
  withProviderAssetsList(FullTokenAssetsListCmp),
);
