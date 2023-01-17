import { useCallback, useEffect, useMemo } from 'react';

import { useFocusEffect, useNavigation } from '@react-navigation/core';

import {
  Box,
  Divider,
  FlatList,
  useIsVerticalLayout,
  useUserDevice,
} from '@onekeyhq/components';
import { Tabs } from '@onekeyhq/components/src/CollapsibleTabView';
import type { FlatListProps } from '@onekeyhq/components/src/FlatList';
import type { EVMDecodedItem } from '@onekeyhq/engine/src/vaults/impl/evm/decoder/types';
import { EVMDecodedTxType } from '@onekeyhq/engine/src/vaults/impl/evm/decoder/types';
import { useManageTokensOfAccount } from '@onekeyhq/kit/src/hooks/useManageTokens';
import type {
  HomeRoutesParams,
  RootRoutes,
  RootRoutesParams,
} from '@onekeyhq/kit/src/routes/types';
import { HomeRoutes } from '@onekeyhq/kit/src/routes/types';
import { MAX_PAGE_CONTAINER_WIDTH } from '@onekeyhq/shared/src/config/appConfig';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useActiveSideAccount } from '../../../hooks';
import { OverviewDefiThumbnal } from '../../Overview/Thumbnail';

import AssetsListHeader from './AssetsListHeader';
import { EmptyListOfAccount } from './EmptyList';
import AssetsListSkeleton from './Skeleton';
import TokenCell from './TokenCell';

import type { SimplifiedToken } from '../../../store/reducers/tokens';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  RootRoutesParams,
  RootRoutes.Root
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
  hideSmallBalance?: boolean;
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
  const { accountTokens, loading } = useManageTokensOfAccount({
    accountId,
    networkId,
  });

  const { account, network } = useActiveSideAccount({
    accountId,
    networkId,
  });

  const navigation = useNavigation<NavigationProps>();
  const valueSortedTokens = useMemo(
    () => (limitSize ? accountTokens.slice(0, limitSize) : accountTokens),
    [accountTokens, limitSize],
  );

  const { size } = useUserDevice();
  const responsivePadding = () => {
    if (['NORMAL', 'LARGE'].includes(size)) return 32;
    return 16;
  };

  useFocusEffect(
    useCallback(() => {
      if (account && network) {
        backgroundApiProxy.serviceToken.fetchAccountTokens({
          activeAccountId: account.id,
          activeNetworkId: network.id,
        });
      }
    }, [account, network]),
  );

  useEffect(() => {
    if (renderDefiList) {
      backgroundApiProxy.serviceOverview.subscribe();
    }
  }, [renderDefiList]);

  const onTokenCellPress = useCallback(
    (item: SimplifiedToken) => {
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

  const renderListItem: FlatListProps<SimplifiedToken>['renderItem'] = ({
    item,
    index,
  }) => (
    <TokenCell
      networkId={networkId}
      accountId={accountId}
      hidePriceInfo={hidePriceInfo}
      bg={flatStyle ? 'transparent' : 'surface-default'}
      borderTopRadius={!flatStyle && showRoundTop && index === 0 ? '12px' : 0}
      borderRadius={
        // eslint-disable-next-line no-unsafe-optional-chaining
        !flatStyle && index === valueSortedTokens?.length - 1 ? '12px' : '0px'
      }
      borderTopWidth={!flatStyle && showRoundTop && index === 0 ? 1 : 0}
      // eslint-disable-next-line no-unsafe-optional-chaining
      borderBottomWidth={index === valueSortedTokens?.length - 1 ? 1 : 0}
      borderColor={flatStyle ? 'transparent' : 'border-subdued'}
      onPress={onTokenCellPress}
      {...item}
    />
  );

  const Container = singleton ? FlatList : Tabs.FlatList;

  const footer = useMemo(() => {
    console.log('rerender');
    return (
      <Box>
        {ListFooterComponent}
        {renderDefiList ? (
          <OverviewDefiThumbnal
            networkId={networkId}
            address={account?.address ?? ''}
            limitSize={limitSize}
          />
        ) : null}
      </Box>
    );
  }, [
    ListFooterComponent,
    networkId,
    account?.address,
    renderDefiList,
    limitSize,
  ]);

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
      data={valueSortedTokens}
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
                showInnerHeader={valueSortedTokens.length > 0}
                showInnerHeaderRoundTop={!flatStyle}
              />
            )
      }
      ItemSeparatorComponent={Divider}
      ListEmptyComponent={
        loading
          ? AssetsListSkeleton
          : // eslint-disable-next-line react/no-unstable-nested-components
            () => <EmptyListOfAccount network={network} />
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
