/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import React, { useCallback } from 'react';

import { useFocusEffect, useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Divider,
  Icon,
  IconButton,
  Pressable,
  ScrollableFlatListProps,
  Text,
  Token,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { Tabs } from '@onekeyhq/components/src/CollapsibleTabView';
import Skeleton from '@onekeyhq/components/src/Skeleton';
import type { Token as TokenType } from '@onekeyhq/engine/src/types/token';
import {
  FormatBalance,
  FormatCurrency,
} from '@onekeyhq/kit/src/components/Format';
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

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  RootRoutesParams,
  RootRoutes.Root
> &
  NativeStackNavigationProp<HomeRoutesParams, HomeRoutes.ScreenTokenDetail>;

const ListHeaderComponent = ({ tokenEnabled }: { tokenEnabled: boolean }) => {
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

const AssetsList = () => {
  const isSmallScreen = useIsVerticalLayout();
  const { accountTokens, prices, balances } = useManageTokens();
  const { account, network } = useActiveWalletAccount();
  const navigation = useNavigation<NavigationProps>();
  const { tokenEnabled } = network?.settings ?? { tokenEnabled: false };

  useFocusEffect(
    useCallback(() => {
      backgroundApiProxy.serviceToken.fetchAccountTokens();
    }, []),
  );

  const renderItem: ScrollableFlatListProps<TokenType>['renderItem'] = ({
    item,
    index,
  }) => {
    const mapKey = index === 0 ? 'main' : item.tokenIdOnNetwork;
    const decimal =
      index === 0
        ? network?.nativeDisplayDecimals
        : network?.tokenDisplayDecimals;
    return (
      <Pressable.Item
        disabled={!item.tokenIdOnNetwork}
        p={4}
        borderTopRadius={index === 0 ? '12px' : '0px'}
        borderRadius={index === accountTokens?.length - 1 ? '12px' : '0px'}
        onPress={() => {
          // if (!item.tokenIdOnNetwork) return;

          navigation.navigate(HomeRoutes.ScreenTokenDetail, {
            accountId: account?.id ?? '',
            networkId: item.networkId ?? '',
            tokenId: item.tokenIdOnNetwork ?? '',
          });
        }}
      >
        <Box w="100%" flexDirection="row" alignItems="center">
          <Token size={8} src={item.logoURI} />
          <Box mx={3} flexDirection="column" flex={1}>
            {balances[item.tokenIdOnNetwork || 'main'] ? (
              <FormatBalance
                balance={balances[item.tokenIdOnNetwork || 'main']}
                suffix={item.symbol}
                formatOptions={{
                  fixed: decimal ?? 4,
                }}
                render={(ele) => (
                  <Text typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}>
                    {ele}
                  </Text>
                )}
              />
            ) : (
              <Skeleton shape={isSmallScreen ? 'Body1' : 'Body2'} />
            )}
            {balances[item.tokenIdOnNetwork || 'main'] && prices?.[mapKey] ? (
              <FormatCurrency
                numbers={[
                  balances[item.tokenIdOnNetwork || 'main'],
                  prices?.[mapKey],
                ]}
                render={(ele) => (
                  <Typography.Body2 color="text-subdued">
                    {ele}
                  </Typography.Body2>
                )}
              />
            ) : (
              <Skeleton shape="Body2" />
            )}
          </Box>
          {!isSmallScreen && (
            <Box mx={3} flexDirection="row" flex={1}>
              {/* <Icon size={20} name="ActivityOutline" /> */}

              {prices?.[mapKey] ? (
                <FormatCurrency
                  numbers={[prices?.[mapKey]]}
                  render={(ele) => (
                    <Typography.Body2Strong>{ele}</Typography.Body2Strong>
                  )}
                />
              ) : (
                <Skeleton shape="Body2" />
              )}
            </Box>
          )}
          {item.tokenIdOnNetwork ? (
            <Icon size={20} name="ChevronRightSolid" />
          ) : (
            <Box w={5} />
          )}
        </Box>
      </Pressable.Item>
    );
  };

  return (
    <Tabs.FlatList
      contentContainerStyle={{
        paddingHorizontal: 16,
        marginTop: 24,
      }}
      data={accountTokens}
      renderItem={renderItem}
      ListHeaderComponent={<ListHeaderComponent tokenEnabled={tokenEnabled} />}
      ItemSeparatorComponent={Divider}
      ListFooterComponent={() => <Box h={8} />}
      keyExtractor={(_item: TokenType) => _item.id}
      extraData={isSmallScreen}
      showsVerticalScrollIndicator={false}
    />
  );
};

export default AssetsList;
