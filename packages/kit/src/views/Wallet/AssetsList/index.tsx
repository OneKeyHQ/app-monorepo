import { useCallback, useEffect, useMemo, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { omit } from 'lodash';
import { useIntl } from 'react-intl';
import { useDebounce } from 'use-debounce';

import {
  Box,
  Divider,
  Empty,
  FlatList,
  useIsVerticalLayout,
  useUserDevice,
} from '@onekeyhq/components';
import { Tabs } from '@onekeyhq/components/src/CollapsibleTabView';
import type { FlatListProps } from '@onekeyhq/components/src/FlatList';
import { isAllNetworks } from '@onekeyhq/engine/src/managers/network';
import type { RootRoutes } from '@onekeyhq/kit/src/routes/routesEnum';
import { HomeRoutes } from '@onekeyhq/kit/src/routes/routesEnum';
import type {
  HomeRoutesParams,
  RootRoutesParams,
} from '@onekeyhq/kit/src/routes/types';
import { MAX_PAGE_CONTAINER_WIDTH } from '@onekeyhq/shared/src/config/appConfig';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import {
  useAccountPortfolios,
  useAccountTokens,
  useActiveSideAccount,
  useAppSelector,
  useOverviewAccountUpdateInfo,
} from '../../../hooks';
import { useVisibilityFocused } from '../../../hooks/useVisibilityFocused';
import { OverviewDefiThumbnal } from '../../Overview/Thumbnail';
import { EOverviewScanTaskType } from '../../Overview/types';
import { WalletHomeTabEnum } from '../type';

import AssetsListHeader from './AssetsListHeader';
import { AllNetworksEmpty, EmptyListOfAccount } from './EmptyList';
import AssetsListSkeleton from './Skeleton';
import SvgAllNetwrorksLoadingLight from './Svg/SvgAllNetworksLoadingDark';
import TokenCell from './TokenCell';

import type { IAccountToken } from '../../Overview/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  RootRoutesParams,
  RootRoutes.Main
> &
  NativeStackNavigationProp<HomeRoutesParams, HomeRoutes.ScreenTokenDetail>;

export type IAssetsListProps = Omit<FlatListProps, 'data' | 'renderItem'> & {
  onTokenPress?: null | ((event: { token: IAccountToken }) => void) | undefined;
  singleton?: boolean;
  hidePriceInfo?: boolean;
  showRoundTop?: boolean;
  limitSize?: number;
  flatStyle?: boolean;
  accountId: string;
  networkId: string;
  renderDefiList?: boolean;
  walletId: string;
};

function HandleRefresh({
  accountId,
  networkId,
  homeTabName,
  isUnlock,
  startRefresh,
  stopRefresh,
}: {
  accountId: string;
  networkId: string;
  homeTabName: string | undefined;
  isUnlock: boolean;
  startRefresh: () => void;
  stopRefresh: () => void;
}) {
  const isFocused = useVisibilityFocused();
  const [delayedFocus, setDelayedFocus] = useState(isFocused);

  const shouldRefreshBalances = useMemo(() => {
    if (!isUnlock) {
      return false;
    }
    if (!delayedFocus || !accountId || !networkId) {
      return false;
    }
    if (homeTabName && homeTabName !== WalletHomeTabEnum.Tokens) {
      return false;
    }
    return true;
  }, [delayedFocus, accountId, networkId, homeTabName, isUnlock]);

  useEffect(() => {
    if (isFocused === delayedFocus) return;

    const timeoutId = setTimeout(() => {
      setDelayedFocus(isFocused);
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [isFocused, delayedFocus]);

  useEffect(() => {
    if (shouldRefreshBalances) {
      startRefresh();
    } else {
      stopRefresh();
    }
  }, [shouldRefreshBalances, startRefresh, stopRefresh]);

  useEffect(() => {
    if (!delayedFocus || !isUnlock) {
      return;
    }
    if (isAllNetworks(networkId)) {
      return;
    }
    backgroundApiProxy.serviceToken.refreshAccountTokens();
  }, [delayedFocus, isUnlock, networkId]);

  useEffect(() => {
    if (networkId && !isAllNetworks(networkId) && accountId) {
      backgroundApiProxy.serviceOverview.fetchAccountOverview({
        networkId,
        accountId,
        scanTypes: [EOverviewScanTaskType.defi],
      });
    }
  }, [networkId, accountId]);

  return <Box />;
}

function AssetsList({
  showRoundTop,
  hidePriceInfo,
  ListHeaderComponent,
  ListFooterComponent,
  contentContainerStyle,
  onTokenPress,
  limitSize,
  flatStyle,
  accountId,
  networkId,
  walletId,
  renderDefiList,
  singleton,
}: IAssetsListProps) {
  const intl = useIntl();
  const isVerticalLayout = useIsVerticalLayout();
  const homeTabName = useAppSelector((s) => s.status.homeTabName);
  const isUnlock = useAppSelector((s) => s.status.isUnlock);
  const { data: accountTokens, loading } = useAccountTokens({
    networkId,
    accountId,
    useFilter: true,
    limitSize,
  });

  const updateInfo = useOverviewAccountUpdateInfo({
    networkId: networkId ?? '',
    accountId: accountId ?? '',
  });

  const { account, network } = useActiveSideAccount({
    accountId,
    networkId,
  });

  const { data: defis } = useAccountPortfolios({
    networkId,
    accountId,
    type: EOverviewScanTaskType.defi,
  });

  const navigation = useNavigation<NavigationProps>();

  const { size } = useUserDevice();
  const responsivePadding = () => {
    if (['NORMAL', 'LARGE'].includes(size)) return 32;
    return 16;
  };

  const [startRefresh] = useDebounce(
    useCallback(() => {
      const { serviceToken } = backgroundApiProxy;
      serviceToken.startRefreshAccountTokens();
    }, []),
    1000,
    {
      leading: true,
      trailing: false,
    },
  );

  const [stopRefresh] = useDebounce(
    useCallback(() => {
      const { serviceToken } = backgroundApiProxy;
      serviceToken.stopRefreshAccountTokens();
    }, []),
    1000,
    {
      leading: true,
      trailing: false,
    },
  );

  useEffect(() => {
    if (platformEnv.isExtensionUi) {
      chrome.runtime.connect();
    }
  }, []);

  useEffect(() => {
    if (networkId && !isAllNetworks(networkId) && accountId) {
      backgroundApiProxy.serviceOverview.fetchAccountOverview({
        networkId,
        accountId,
        scanTypes: [EOverviewScanTaskType.defi],
      });
    }
  }, [networkId, accountId]);

  const onTokenCellPress = useCallback(
    (item: IAccountToken) => {
      if (onTokenPress) {
        onTokenPress({ token: item });
        return;
      }
      // TODO: make it work with multi chains.
      // const filter = item.address
      //   ? undefined
      //   : (i: EVMDecodedItem) => i.txType === EVMDecodedTxType.NATIVE_TRANSFER;
      //

      navigation.navigate(HomeRoutes.ScreenTokenDetail, {
        walletId,
        accountId,
        networkId,
        coingeckoId: item.coingeckoId,
        sendAddress: item.sendAddress,
        tokenAddress: item.address,
        // historyFilter: filter,
        price: item.price,
        price24h: item.price24h,
        symbol: item.symbol,
        name: item.name,
        logoURI: item.logoURI,
      });
    },
    [networkId, navigation, onTokenPress, walletId, accountId],
  );

  const Container = singleton ? FlatList : Tabs.FlatList;

  const renderListItem: FlatListProps<IAccountToken>['renderItem'] = ({
    item,
    index,
  }) => (
    <TokenCell
      accountId={accountId}
      hidePriceInfo={hidePriceInfo}
      bg={flatStyle ? 'transparent' : 'surface-default'}
      borderTopRadius={!flatStyle && showRoundTop && index === 0 ? '12px' : 0}
      borderRadius={
        // eslint-disable-next-line no-unsafe-optional-chaining
        !flatStyle && index === accountTokens?.length - 1 ? '12px' : '0px'
      }
      borderTopWidth={!flatStyle && showRoundTop && index === 0 ? 1 : 0}
      // eslint-disable-next-line no-unsafe-optional-chaining
      borderBottomWidth={index === accountTokens?.length - 1 ? 1 : 0}
      borderColor={flatStyle ? 'transparent' : 'border-subdued'}
      onPress={onTokenCellPress}
      {...omit(item, 'source')}
      networkId={networkId}
    />
  );

  const footer = useMemo(
    () => (
      <Box>
        {ListFooterComponent}
        {renderDefiList ? (
          <OverviewDefiThumbnal
            accountId={accountId}
            networkId={networkId}
            address={account?.address ?? ''}
            limitSize={limitSize}
            data={defis}
          />
        ) : null}
      </Box>
    ),
    [
      defis,
      ListFooterComponent,
      networkId,
      accountId,
      account?.address,
      renderDefiList,
      limitSize,
    ],
  );

  const empty = useMemo(() => {
    if (loading) {
      if (isAllNetworks(network?.id) && !updateInfo?.updatedAt) {
        return (
          <Box alignItems="center" mt="8">
            <Empty
              w="260px"
              icon={
                <Box mb="6">
                  <SvgAllNetwrorksLoadingLight />
                </Box>
              }
              title={intl.formatMessage({ id: 'empty__creating_data' })}
              subTitle={intl.formatMessage({
                id: 'empty__creating_data_desc',
              })}
            />
          </Box>
        );
      }
      return <AssetsListSkeleton />;
    }
    if (isAllNetworks(network?.id)) {
      return <AllNetworksEmpty />;
    }
    return <EmptyListOfAccount network={network} accountId={accountId} />;
  }, [loading, accountId, network, updateInfo?.updatedAt, intl]);

  return (
    <>
      <Container
        style={{
          maxWidth: MAX_PAGE_CONTAINER_WIDTH,
          width: '100%',
          marginHorizontal: 'auto',
          alignSelf: 'center',
        }}
        contentContainerStyle={[
          {
            paddingHorizontal: flatStyle ? 0 : responsivePadding(),
            marginTop: 24,
          },
          contentContainerStyle,
        ]}
        data={accountTokens}
        renderItem={renderListItem}
        ListHeaderComponent={
          !accountTokens?.length
            ? null
            : ListHeaderComponent ?? (
                <AssetsListHeader
                  innerHeaderBorderColor={
                    flatStyle ? 'transparent' : 'border-subdued'
                  }
                  showTokenCount={limitSize !== undefined}
                  showOuterHeader={limitSize !== undefined}
                  showInnerHeader={accountTokens.length > 0}
                  showInnerHeaderRoundTop={!flatStyle}
                />
              )
        }
        ItemSeparatorComponent={Divider}
        ListEmptyComponent={() => empty}
        ListFooterComponent={footer}
        keyExtractor={(item: IAccountToken) => item.key}
        extraData={isVerticalLayout}
        showsVerticalScrollIndicator={false}
      />
      <HandleRefresh
        accountId={accountId}
        networkId={networkId}
        homeTabName={homeTabName}
        isUnlock={isUnlock}
        startRefresh={startRefresh}
        stopRefresh={stopRefresh}
      />
    </>
  );
}

export default AssetsList;
