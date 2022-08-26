import React, { ComponentProps, useCallback, useMemo } from 'react';

import { useFocusEffect, useNavigation } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
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
import {
  useActiveWalletAccount,
  useAppSelector,
} from '@onekeyhq/kit/src/hooks/redux';
import { useManageTokens } from '@onekeyhq/kit/src/hooks/useManageTokens';
import {
  HomeRoutes,
  HomeRoutesParams,
  RootRoutes,
  RootRoutesParams,
} from '@onekeyhq/kit/src/routes/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { MAX_PAGE_CONTAINER_WIDTH } from '../../../config';
import { getTokenValues } from '../../../utils/priceUtils';

import AssetsListHeader from './AssetsListHeader';
import EmptyList from './EmptyList';
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
}: IAssetsListProps) {
  const isVerticalLayout = useIsVerticalLayout();
  const { accountTokens, balances, prices, loading } = useManageTokens();

  const hideSmallBalance = useAppSelector((s) => s.settings.hideSmallBalance);

  const { account, network } = useActiveWalletAccount();
  const navigation = useNavigation<NavigationProps>();
  const valueSortedTokens = useMemo(() => {
    const tokenValues = new Map<TokenType, BigNumber>();
    const sortedTokens = accountTokens
      .filter((t) => {
        if (t.tokenIdOnNetwork && !prices[t.tokenIdOnNetwork]) {
          // lower the priority of tokens without price info.
          tokenValues.set(t, new BigNumber(-1));
          return true;
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
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      .sort((a, b) => tokenValues.get(b)!.comparedTo(tokenValues.get(a)!));

    return limitSize ? sortedTokens.slice(0, limitSize) : sortedTokens;
  }, [accountTokens, balances, hideSmallBalance, limitSize, prices]);

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
      hidePriceInfo={hidePriceInfo}
      bg={flatStyle ? 'transparent' : 'surface-default'}
      token={item}
      borderTopRadius={!flatStyle && showRoundTop && index === 0 ? '12px' : 0}
      borderRadius={
        !flatStyle && index === valueSortedTokens?.length - 1 ? '12px' : '0px'
      }
      borderTopWidth={0}
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
      ListEmptyComponent={loading ? AssetsListSkeleton : EmptyList}
      ListFooterComponent={ListFooterComponent}
      keyExtractor={(_item: TokenType) => _item.id}
      extraData={isVerticalLayout}
      showsVerticalScrollIndicator={false}
    />
  );
}

export default AssetsList;
