/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import React, { ComponentProps, useCallback, useMemo } from 'react';

import { useFocusEffect, useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Divider,
  FlatList,
  IconButton,
  ScrollableFlatListProps,
  Typography,
  useIsVerticalLayout,
  useUserDevice,
} from '@onekeyhq/components';
import { Tabs } from '@onekeyhq/components/src/CollapsibleTabView';
import type { Token as TokenType } from '@onekeyhq/engine/src/types/token';
import {
  EVMDecodedItem,
  EVMDecodedTxType,
} from '@onekeyhq/engine/src/vaults/impl/evm/decoder/types';
import { useActiveWalletAccount } from '@onekeyhq/kit/src/hooks/redux';
import { useManageTokens } from '@onekeyhq/kit/src/hooks/useManageTokens';
import {
  HomeRoutes,
  HomeRoutesParams,
  ModalRoutes,
  RootRoutes,
  RootRoutesParams,
} from '@onekeyhq/kit/src/routes/types';
import { ManageTokenRoutes } from '@onekeyhq/kit/src/views/ManageTokens/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { getTokenValues } from '../../../utils/priceUtils';

import TokenCell from './TokenCell';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  RootRoutesParams,
  RootRoutes.Root
> &
  NativeStackNavigationProp<HomeRoutesParams, HomeRoutes.ScreenTokenDetail>;

const AssetsListHeaderComponent = ({
  tokenEnabled,
}: {
  tokenEnabled: boolean;
}) => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();
  return (
    <Box
      flexDirection="row"
      justifyContent="space-between"
      alignItems="center"
      pb={3}
    >
      <Typography.Heading>
        {intl.formatMessage({ id: 'asset__tokens' })}
      </Typography.Heading>
      {tokenEnabled ? (
        <IconButton
          onPress={() =>
            navigation.navigate(RootRoutes.Modal, {
              screen: ModalRoutes.ManageToken,
              params: { screen: ManageTokenRoutes.Listing },
            })
          }
          size="sm"
          name="AdjustmentsSolid"
          type="plain"
          circle
        />
      ) : (
        <Box w={5} />
      )}
    </Box>
  );
};

export type IAssetsListProps = Omit<
  ComponentProps<typeof Tabs.FlatList>,
  'data' | 'renderItem'
> & {
  onTokenPress?: null | ((event: { token: TokenType }) => void) | undefined;
  singleton?: boolean;
  hidePriceInfo?: boolean;
};
function AssetsList({
  singleton,
  hidePriceInfo,
  ListHeaderComponent,
  ListFooterComponent,
  contentContainerStyle,
  onTokenPress,
}: IAssetsListProps) {
  const isVerticalLayout = useIsVerticalLayout();
  // const isSmallScreen = useIsVerticalLayout();
  const { accountTokens, balances, prices } = useManageTokens();
  const { account, network } = useActiveWalletAccount();
  const navigation = useNavigation<NavigationProps>();
  const { tokenEnabled } = network?.settings ?? { tokenEnabled: false };

  const valueSortedTokens = useMemo(
    () =>
      accountTokens.slice().sort((a, b) => {
        const [valA, valB] = getTokenValues({
          tokens: [a, b],
          prices,
          balances,
        });

        return valB.comparedTo(valA);
      }),
    [accountTokens, balances, prices],
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

  const renderListItem: ScrollableFlatListProps<TokenType>['renderItem'] = ({
    item,
    index,
  }) => (
    <TokenCell
      hidePriceInfo={hidePriceInfo}
      token={item}
      borderTopRadius={index === 0 ? '12px' : '0px'}
      borderRadius={index === accountTokens?.length - 1 ? '12px' : '0px'}
      borderTopWidth={index === 0 ? 1 : 0}
      borderBottomWidth={index === accountTokens?.length - 1 ? 1 : 0}
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
      contentContainerStyle={[
        {
          paddingHorizontal: responsivePadding(),
          marginTop: 24,
        },
        contentContainerStyle,
      ]}
      data={valueSortedTokens}
      renderItem={renderListItem}
      ListHeaderComponent={
        ListHeaderComponent ?? (
          <AssetsListHeaderComponent tokenEnabled={tokenEnabled} />
        )
      }
      ItemSeparatorComponent={Divider}
      ListFooterComponent={ListFooterComponent ?? (() => <Box h={8} />)}
      keyExtractor={(_item: TokenType) => _item.id}
      extraData={isVerticalLayout}
      showsVerticalScrollIndicator={false}
    />
  );
}

export default AssetsList;
