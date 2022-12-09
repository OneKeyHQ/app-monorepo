import React, { ComponentProps, useCallback, useMemo } from 'react';

import { useFocusEffect, useNavigation } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import natsort from 'natsort';
import { FlatListProps } from 'react-native';

import {
  Divider,
  FlatList,
  useIsVerticalLayout,
  useUserDevice,
} from '@onekeyhq/components';
import { Tabs } from '@onekeyhq/components/src/CollapsibleTabView';
import type { Token as TokenType } from '@onekeyhq/engine/src/types/token';
import {
  EVMDecodedItem,
  EVMDecodedTxType,
} from '@onekeyhq/engine/src/vaults/impl/evm/decoder/types';
import { useManageTokensOfAccount } from '@onekeyhq/kit/src/hooks/useManageTokens';
import {
  HomeRoutes,
  HomeRoutesParams,
  RootRoutes,
  RootRoutesParams,
} from '@onekeyhq/kit/src/routes/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { MAX_PAGE_CONTAINER_WIDTH } from '../../../config';
import { useActiveSideAccount, useAppSelector } from '../../../hooks';
import { getTokenValues } from '../../../utils/priceUtils';

import AssetsListHeader from './AssetsListHeader';
import { EmptyListOfAccount } from './EmptyList';
import AssetsListSkeleton from './Skeleton';
import TokenCell from './TokenCell';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  RootRoutesParams,
  RootRoutes.Root
> &
  NativeStackNavigationProp<HomeRoutesParams, HomeRoutes.ScreenTokenDetail>;

export type IAssetsListProps = Omit<
  ComponentProps<typeof Tabs.FlatList>,
  'data' | 'renderItem'
> & {
  onTokenPress?: null | ((event: { token: TokenType }) => void) | undefined;
  singleton?: boolean;
  hidePriceInfo?: boolean;
  showRoundTop?: boolean;
  limitSize?: number;
  flatStyle?: boolean;
  accountId: string;
  networkId: string;
  hideSmallBalance?: boolean;
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
  hideSmallBalance,
}: IAssetsListProps) {
  const isVerticalLayout = useIsVerticalLayout();
  const hideRiskTokens = useAppSelector((s) => s.settings.hideRiskTokens);
  const { accountTokens, balances, prices, loading } = useManageTokensOfAccount(
    { accountId, networkId },
  );

  const { account, network } = useActiveSideAccount({
    accountId,
    networkId,
  });
  const navigation = useNavigation<NavigationProps>();
  const valueSortedTokens = useMemo(() => {
    const tokenValues = new Map<TokenType, BigNumber>();
    const sortedTokens = accountTokens
      .filter((t) => {
        if (t.tokenIdOnNetwork && !prices[t.tokenIdOnNetwork]) {
          if (hideSmallBalance) {
            return false;
          }
          // lower the priority of tokens without price info.
          tokenValues.set(t, new BigNumber(-1));
        }
        const [v] = getTokenValues({
          tokens: [t],
          prices,
          balances,
        });
        if (hideSmallBalance && v.isLessThan(1)) {
          return false;
        }
        tokenValues.set(t, v);
        return true;
      })
      .filter((t) => !hideRiskTokens || !t.security)
      .sort(
        (a, b) =>
          // By value
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          tokenValues.get(b)!.comparedTo(tokenValues.get(a)!) ||
          // By price
          new BigNumber(prices[b.tokenIdOnNetwork || 'main'] || 0).comparedTo(
            new BigNumber(prices[a.tokenIdOnNetwork || 'main'] || 0),
          ) ||
          // By native token
          (b.isNative ? 1 : 0) ||
          (a.isNative ? -1 : 0) ||
          // By name
          natsort({ insensitive: true })(a.name, b.name),
      );

    return limitSize ? sortedTokens.slice(0, limitSize) : sortedTokens;
  }, [
    accountTokens,
    balances,
    hideSmallBalance,
    hideRiskTokens,
    limitSize,
    prices,
  ]);

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

  const renderListItem: FlatListProps<TokenType>['renderItem'] = ({
    item,
    index,
  }) => (
    <TokenCell
      networkId={networkId}
      accountId={accountId}
      hidePriceInfo={hidePriceInfo}
      bg={flatStyle ? 'transparent' : 'surface-default'}
      token={item}
      borderTopRadius={!flatStyle && showRoundTop && index === 0 ? '12px' : 0}
      borderRadius={
        !flatStyle && index === valueSortedTokens?.length - 1 ? '12px' : '0px'
      }
      borderTopWidth={!flatStyle && showRoundTop && index === 0 ? 1 : 0}
      borderBottomWidth={index === valueSortedTokens?.length - 1 ? 1 : 0}
      borderColor={flatStyle ? 'transparent' : 'border-subdued'}
      onPress={() => {
        if (onTokenPress) {
          onTokenPress({ token: item });
          return;
        }
        // TODO: make it work with multi chains.
        const filter = item.tokenIdOnNetwork
          ? undefined
          : (i: EVMDecodedItem) =>
              i.txType === EVMDecodedTxType.NATIVE_TRANSFER;

        navigation.navigate(HomeRoutes.ScreenTokenDetail, {
          accountId: account?.id ?? '',
          networkId: item.networkId ?? '',
          tokenId: item.tokenIdOnNetwork,
          historyFilter: filter,
        });
      }}
    />
  );

  const Container = singleton ? FlatList : Tabs.FlatList;

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
          : () => <EmptyListOfAccount network={network} />
      }
      ListFooterComponent={ListFooterComponent}
      keyExtractor={(_item: TokenType) => _item.id}
      extraData={isVerticalLayout}
      showsVerticalScrollIndicator={false}
    />
  );
}

export default AssetsList;
