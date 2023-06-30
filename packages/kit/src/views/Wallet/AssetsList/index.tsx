import { useCallback, useEffect, useMemo } from 'react';

import { useNavigation } from '@react-navigation/core';
import { omit } from 'lodash';
import { useDebounce } from 'use-debounce';

import { Box, useUserDevice } from '@onekeyhq/components';
import { Tabs } from '@onekeyhq/components/src/CollapsibleTabView';
import type { FlatListProps } from '@onekeyhq/components/src/FlatList';
import type { EVMDecodedItem } from '@onekeyhq/engine/src/vaults/impl/evm/decoder/types';
import { EVMDecodedTxType } from '@onekeyhq/engine/src/vaults/impl/evm/decoder/types';
import type { RootRoutes } from '@onekeyhq/kit/src/routes/routesEnum';
import { HomeRoutes } from '@onekeyhq/kit/src/routes/routesEnum';
import type {
  HomeRoutesParams,
  RootRoutesParams,
} from '@onekeyhq/kit/src/routes/types';
import { MAX_PAGE_CONTAINER_WIDTH } from '@onekeyhq/shared/src/config/appConfig';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useActiveSideAccount } from '../../../hooks';
import { useStatus } from '../../../hooks/redux';
import { useAccountTokens } from '../../../hooks/useOverview';
import { useAccountTokenLoading } from '../../../hooks/useTokens';
import { useVisibilityFocused } from '../../../hooks/useVisibilityFocused';
import { OverviewDefiThumbnal } from '../../Overview/Thumbnail';
import { WalletHomeTabEnum } from '../type';

import AssetsListHeader from './AssetsListHeader';
import { EmptyListOfAccount } from './EmptyList';
import AssetsListSkeleton from './Skeleton';
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
}: IAssetsListProps) {
  const { homeTabName, isUnlock } = useStatus();
  const loading = useAccountTokenLoading(networkId, accountId);
  const accountTokens = useAccountTokens({
    networkId,
    accountId,
    useFilter: true,
    limitSize,
  });

  const { account, network } = useActiveSideAccount({
    accountId,
    networkId,
  });

  const navigation = useNavigation<NavigationProps>();

  const { size } = useUserDevice();
  const responsivePadding = () => {
    if (['NORMAL', 'LARGE'].includes(size)) return 32;
    return 16;
  };

  const [startRefresh] = useDebounce(
    useCallback(() => {
      const { serviceToken, serviceOverview } = backgroundApiProxy;
      serviceOverview.startQueryPendingTasks();
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
      const { serviceToken, serviceOverview } = backgroundApiProxy;
      serviceOverview.stopQueryPendingTasks();
      serviceToken.stopRefreshAccountTokens();
    }, []),
    1000,
    {
      leading: true,
      trailing: false,
    },
  );

  // useEffect(() => {
  //   const { serviceOverview } = backgroundApiProxy;
  //   serviceOverview.fetchAccountOverview({
  //     networkId,
  //     accountId,
  //
  //   });
  // }, [accountId, networkId]);

  useEffect(() => {
    if (platformEnv.isExtensionUi) {
      chrome.runtime.connect();
    }
  }, []);

  const isFocused = useVisibilityFocused();

  const shouldRefreshBalances = useMemo(() => {
    if (!isUnlock) {
      return false;
    }
    if (!isFocused || !accountId || !networkId) {
      return false;
    }
    if (homeTabName && homeTabName !== WalletHomeTabEnum.Tokens) {
      return false;
    }
    return true;
  }, [isFocused, accountId, networkId, homeTabName, isUnlock]);

  useEffect(() => {
    if (shouldRefreshBalances) {
      startRefresh();
    } else {
      stopRefresh();
    }
  }, [shouldRefreshBalances, startRefresh, stopRefresh]);

  useEffect(() => {
    if (isFocused && isUnlock) {
      backgroundApiProxy.serviceToken.fetchAccountTokens();
    }
  }, [isFocused, isUnlock]);

  const onTokenCellPress = useCallback(
    (item: IAccountToken) => {
      console.log(item);
      if (onTokenPress) {
        onTokenPress({ token: item });
        return;
      }
      // TODO: make it work with multi chains.
      const filter = item.address
        ? undefined
        : (i: EVMDecodedItem) => i.txType === EVMDecodedTxType.NATIVE_TRANSFER;

      navigation.navigate(HomeRoutes.ScreenTokenDetail, {
        walletId: walletId ?? '',
        accountId: account?.id ?? '',
        networkId: networkId ?? '',
        tokenId: item.address ?? 'main',
        coingeckoId: item.coingeckoId,
        sendAddress: item.sendAddress,
        historyFilter: filter,
      });
    },
    [account?.id, networkId, navigation, onTokenPress, walletId],
  );

  if (!accountTokens?.length) {
    return loading ? (
      <AssetsListSkeleton />
    ) : (
      <EmptyListOfAccount network={network} accountId={accountId} />
    );
  }

  return (
    <Tabs.ScrollView
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
      showsVerticalScrollIndicator={false}
    >
      {loading
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
          )}
      {accountTokens.map((item, index) => (
        <TokenCell
          accountId={accountId}
          hidePriceInfo={hidePriceInfo}
          bg={flatStyle ? 'transparent' : 'surface-default'}
          borderTopRadius={
            !flatStyle && showRoundTop && index === 0 ? '12px' : 0
          }
          borderRadius={
            // eslint-disable-next-line no-unsafe-optional-chaining
            !flatStyle && index === accountTokens?.length - 1 ? '12px' : '0px'
          }
          borderTopWidth={1}
          // eslint-disable-next-line no-unsafe-optional-chaining
          borderBottomWidth={index === accountTokens?.length - 1 ? 1 : 0}
          borderColor="border-subdued"
          onPress={onTokenCellPress}
          {...omit(item, 'source')}
          networkId={networkId}
        />
      ))}
      <Box>
        {ListFooterComponent}
        {renderDefiList ? (
          <OverviewDefiThumbnal
            networkId={networkId}
            accountId={accountId}
            address={account?.address ?? ''}
            limitSize={limitSize}
          />
        ) : null}
      </Box>
    </Tabs.ScrollView>
  );
}

export default AssetsList;
