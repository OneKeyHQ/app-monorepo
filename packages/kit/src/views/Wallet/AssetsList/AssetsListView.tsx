import { memo, useCallback, useMemo } from 'react';

import { useNavigation } from '@react-navigation/core';
import { isString, omit } from 'lodash';

import {
  Box,
  Divider,
  FlatList,
  // FlatListPlain,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { Tabs } from '@onekeyhq/components/src/CollapsibleTabView';
import type { FlatListProps } from '@onekeyhq/components/src/FlatList';
import { FlatListPlain } from '@onekeyhq/components/src/FlatListPlain';
import { HomeRoutes } from '@onekeyhq/kit/src/routes/routesEnum';
import { MAX_PAGE_CONTAINER_WIDTH } from '@onekeyhq/shared/src/config/appConfig';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import AssetsListHeader from './AssetsListHeader';
import {
  atomHomeOverviewAccountTokens,
  useAtomAssetsList,
} from './contextAssetsList';
import { AccountAssetsEmptyList } from './EmptyList';
import TokenCell, { TokenCellByKey } from './TokenCell';
import { useAssetsListLayout } from './useAssetsListLayout';

import type { IAssetsListProps, NavigationProps } from '.';
import type { IAccountToken } from '../../Overview/types';
import type { ITokenCellSharedProps } from './TokenCell';

function AssetsListViewCmp({
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
  isRenderByCollapsibleTab,
  FlatListComponent,
  itemsCountForAutoFallbackToPlainList = 0, // TODO scroll issue
  accountTokens,
  showSkeletonHeader,
}: IAssetsListProps) {
  const navigation = useNavigation<NavigationProps>();
  const isVerticalLayout = useIsVerticalLayout();

  const accountTokensLength = accountTokens?.length;

  const { containerPaddingX } = useAssetsListLayout();

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

  const renderListItem: FlatListProps<IAccountToken>['renderItem'] =
    useCallback(
      (row: { item: IAccountToken | string; index: number }) => {
        const sharedProps: ITokenCellSharedProps = {
          accountId,
          networkId,
          hidePriceInfo,
          bg: flatStyle ? 'transparent' : 'surface-default',
          borderTopRadius:
            !flatStyle && showRoundTop && row.index === 0 ? '12px' : 0,
          borderRadius:
            !flatStyle && row.index === accountTokensLength - 1
              ? '12px'
              : '0px',
          borderTopWidth: !flatStyle && showRoundTop && row.index === 0 ? 1 : 0,
          borderBottomWidth: row.index === accountTokensLength - 1 ? 1 : 0,
          borderColor: flatStyle ? 'transparent' : 'border-subdued',
          onPress: onTokenCellPress,
        };

        return isString(row.item) ? (
          <TokenCellByKey {...sharedProps} tokenKey={row.item} />
        ) : (
          <TokenCell
            {...sharedProps}
            {...omit(row?.item, 'source')}
            deepRefreshMode
          />
        );
      },
      [
        accountId,
        accountTokensLength,
        flatStyle,
        hidePriceInfo,
        networkId,
        onTokenCellPress,
        showRoundTop,
      ],
    );

  const footer = useMemo(
    () => (ListFooterComponent ? <>{ListFooterComponent}</> : null),
    [ListFooterComponent],
  );

  const header = useMemo(() => {
    if (!accountTokensLength || ListHeaderComponent === null) {
      return null;
    }
    if (ListHeaderComponent) {
      return ListHeaderComponent;
    }

    return (
      <AssetsListHeader
        innerHeaderBorderColor={flatStyle ? 'transparent' : 'border-subdued'}
        showTokenCount={limitSize !== undefined}
        showOuterHeader={limitSize !== undefined}
        showInnerHeader={accountTokensLength > 0}
        showInnerHeaderRoundTop={!flatStyle}
      />
    );
  }, [ListHeaderComponent, accountTokensLength, flatStyle, limitSize]);

  const containerStyle = useMemo(
    () => ({
      maxWidth: MAX_PAGE_CONTAINER_WIDTH,
      width: '100%',
      marginHorizontal: 'auto',
      alignSelf: 'center' as any,
    }),
    [],
  );

  const contentStyle = useMemo(
    () => [
      {
        paddingHorizontal: flatStyle ? 0 : containerPaddingX.num,
        marginTop: 24,
      },
      contentContainerStyle,
    ],
    [containerPaddingX, contentContainerStyle, flatStyle],
  );

  const AutoFlatList = useMemo(() => {
    // do not auto switch FlatList when FlatListComponent is provided
    if (FlatListComponent) {
      return FlatListComponent;
    }
    // render FlatListPlain for better performance when there are less than 15 tokens
    if (
      !platformEnv.isNative && // native FlatListPlain can not scroll
      itemsCountForAutoFallbackToPlainList &&
      (!accountTokensLength ||
        accountTokensLength <= itemsCountForAutoFallbackToPlainList)
    ) {
      return isRenderByCollapsibleTab ? Tabs.FlatListPlain : FlatListPlain;
    }
    return isRenderByCollapsibleTab ? Tabs.FlatList : FlatList;
  }, [
    FlatListComponent,
    accountTokensLength,
    isRenderByCollapsibleTab,
    itemsCountForAutoFallbackToPlainList,
  ]);

  return (
    <AutoFlatList
      style={containerStyle}
      contentContainerStyle={contentStyle}
      data={accountTokens}
      // data={tokensKeys}
      renderItem={renderListItem as any}
      ListHeaderComponent={header}
      ListFooterComponent={footer}
      ItemSeparatorComponent={Divider}
      ListEmptyComponent={
        <AccountAssetsEmptyList
          showSkeletonHeader={showSkeletonHeader}
          accountId={accountId}
          networkId={networkId}
        />
      }
      keyExtractor={
        useCallback(
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          (item: IAccountToken | string, index: number) =>
            isString(item) ? item : item.key,
          [],
        ) as any
      }
      extraData={isVerticalLayout}
      showsVerticalScrollIndicator={false}
    />
  );
}
export const AssetsListView = memo(AssetsListViewCmp);
