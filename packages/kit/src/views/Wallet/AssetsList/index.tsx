import { useCallback, useEffect, useMemo } from 'react';

import { useFocusEffect, useNavigation } from '@react-navigation/core';
import { omit } from 'lodash';
import { useDebounce } from 'use-debounce';

import {
  Box,
  Divider,
  FlatList,
  useIsVerticalLayout,
  useUserDevice,
} from '@onekeyhq/components';
import { Tabs } from '@onekeyhq/components/src/CollapsibleTabView';
import type { FlatListProps } from '@onekeyhq/components/src/FlatList';
import type { Token } from '@onekeyhq/engine/src/types/token';
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
import { useAccountTokens, useActiveSideAccount } from '../../../hooks';
import { useAccountTokenLoading } from '../../../hooks/useTokens';
import { OverviewDefiThumbnal } from '../../Overview/Thumbnail';

import AssetsListHeader from './AssetsListHeader';
import { EmptyListOfAccount } from './EmptyList';
import AssetsListSkeleton from './Skeleton';
import TokenCell from './TokenCell';

import type { SimplifiedToken } from '../../../store/reducers/tokens';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  RootRoutesParams,
  RootRoutes.Main
> &
  NativeStackNavigationProp<HomeRoutesParams, HomeRoutes.ScreenTokenDetail>;

export type IAssetsListProps = Omit<FlatListProps, 'data' | 'renderItem'> & {
  onTokenPress?:
    | null
    | ((event: { token: SimplifiedToken }) => void)
    | undefined;
  singleton?: boolean;
  hidePriceInfo?: boolean;
  showRoundTop?: boolean;
  limitSize?: number;
  flatStyle?: boolean;
  accountId: string;
  networkId: string;
  renderDefiList?: boolean;
};
function AssetsList({
  showRoundTop,
  singleton,
  hidePriceInfo,
  ListHeaderComponent,
  ListFooterComponent,
  contentContainerStyle,
  onTokenPress,
  limitSize,
  flatStyle,
  accountId,
  networkId,
  renderDefiList,
}: IAssetsListProps) {
  const isVerticalLayout = useIsVerticalLayout();
  const loading = useAccountTokenLoading(networkId, accountId);
  const accountTokensWithoutLimit = useAccountTokens(
    networkId,
    accountId,
    true,
  );

  const accountTokens = useMemo(
    () =>
      limitSize
        ? accountTokensWithoutLimit.slice(0, limitSize)
        : accountTokensWithoutLimit,
    [accountTokensWithoutLimit, limitSize],
  );

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

  const visibilityStateListener = useCallback(() => {
    if (document.visibilityState === 'hidden') {
      stopRefresh();
    }
    if (document.visibilityState === 'visible') {
      startRefresh();
    }
  }, [startRefresh, stopRefresh]);

  useEffect(() => {
    const { serviceOverview } = backgroundApiProxy;
    serviceOverview.subscribe();

    if (platformEnv.isExtensionUi) {
      chrome.runtime.connect();
    }
  }, [networkId, accountId, startRefresh, stopRefresh]);

  useFocusEffect(
    useCallback(() => {
      const { serviceToken } = backgroundApiProxy;
      if (!account || !network) {
        return;
      }
      serviceToken.fetchAccountTokens({
        includeTop50TokensQuery: true,
        networkId: network?.id,
        accountId: account?.id,
      });

      startRefresh();
      if (platformEnv.isRuntimeBrowser) {
        document.addEventListener('visibilitychange', visibilityStateListener);
        if (!platformEnv.isDesktop) {
          window.addEventListener('blur', stopRefresh);
          window.addEventListener('focus', startRefresh);
        }
      }

      return () => {
        stopRefresh();
        if (platformEnv.isRuntimeBrowser) {
          document.removeEventListener(
            'visibilitychange',
            visibilityStateListener,
          );
          if (!platformEnv.isDesktop) {
            window.removeEventListener('blur', stopRefresh);
            window.removeEventListener('focus', startRefresh);
          }
        }
      };
    }, [account, network, visibilityStateListener, startRefresh, stopRefresh]),
  );

  const onTokenCellPress = useCallback(
    (item: Token) => {
      if (onTokenPress) {
        onTokenPress({ token: item });
        return;
      }
      // TODO: make it work with multi chains.
      const filter = item.tokenIdOnNetwork
        ? undefined
        : (i: EVMDecodedItem) => i.txType === EVMDecodedTxType.NATIVE_TRANSFER;

      navigation.navigate(HomeRoutes.ScreenTokenDetail, {
        accountId: account?.id ?? '',
        networkId: networkId ?? '',
        tokenId: item.tokenIdOnNetwork ?? '',
        sendAddress: item.sendAddress,
        historyFilter: filter,
      });
    },
    [account?.id, networkId, navigation, onTokenPress],
  );

  const renderListItem: FlatListProps<Token>['renderItem'] = ({
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

  const Container = singleton ? FlatList : Tabs.FlatList;

  const footer = useMemo(
    () => (
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
    ),
    [
      ListFooterComponent,
      networkId,
      accountId,
      account?.address,
      renderDefiList,
      limitSize,
    ],
  );

  return (
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
      data={accountTokens.slice(0, limitSize)}
      renderItem={renderListItem}
      ListHeaderComponent={
        loading
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
      ListEmptyComponent={
        loading
          ? AssetsListSkeleton
          : // eslint-disable-next-line react/no-unstable-nested-components
            () => <EmptyListOfAccount network={network} accountId={accountId} />
      }
      ListFooterComponent={footer}
      keyExtractor={(_item: SimplifiedToken) =>
        `${_item.tokenIdOnNetwork}--${_item.sendAddress ?? ''}`
      }
      extraData={isVerticalLayout}
      showsVerticalScrollIndicator={false}
    />
  );
}

export default AssetsList;
