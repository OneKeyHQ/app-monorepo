/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import React, { useEffect, useState } from 'react';

import {
  useFocusEffect,
  useIsFocused,
  useNavigation,
} from '@react-navigation/core';
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
import type { Token as TokenType } from '@onekeyhq/engine/src/types/token';
import {
  FormatBalance,
  FormatCurrency,
} from '@onekeyhq/kit/src/components/Format';
import engine from '@onekeyhq/kit/src/engine/EngineProvider';
import {
  useActiveWalletAccount,
  useManageTokens,
} from '@onekeyhq/kit/src/hooks/redux';

import {
  HomeRoutes,
  HomeRoutesParams,
  ModalRoutes,
  RootRoutes,
  RootRoutesParams,
} from '../../../routes/types';
import { ManageTokenRoutes } from '../../ManageTokens/types';

import type { ValuedToken } from '../../../store/reducers/general';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  RootRoutesParams,
  RootRoutes.Root
> &
  NativeStackNavigationProp<HomeRoutesParams, HomeRoutes.ScreenTokenDetail>;

const ListHeaderComponent = () => {
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
    </Box>
  );
};

const AssetsList = () => {
  const isSmallScreen = useIsVerticalLayout();
  const { accountTokens, updateAccountTokens } = useManageTokens();
  const { account, network } = useActiveWalletAccount();
  const navigation = useNavigation<NavigationProps>();
  const [mainTokenPrice, setMainTokenPrice] =
    useState<Record<string, string>>();
  const isFocused = useIsFocused();

  useEffect(() => {
    async function main() {
      if (!network?.network?.id || !account?.id) return;
      const prices = await engine.getPrices(
        network.network.id,
        accountTokens.map((token) => token.tokenIdOnNetwork),
        true,
      );
      setMainTokenPrice(prices);
    }
    if (isFocused) {
      main();
    }
  }, [network, account?.id, isFocused, accountTokens]);

  useFocusEffect(updateAccountTokens);

  const renderItem: ScrollableFlatListProps<ValuedToken>['renderItem'] = ({
    item,
    index,
  }) => {
    const mapKey = index === 0 ? 'main' : item.tokenIdOnNetwork;
    const decimal =
      index === 0
        ? network?.network.nativeDisplayDecimals
        : network?.network.tokenDisplayDecimals;
    return (
      <Pressable.Item
        p={4}
        borderTopRadius={index === 0 ? '12px' : '0px'}
        borderRadius={index === accountTokens?.length - 1 ? '12px' : '0px'}
        onPress={() => {
          if (!item.tokenIdOnNetwork) return;

          navigation.navigate(HomeRoutes.ScreenTokenDetail, {
            accountId: account?.id ?? '',
            networkId: item.networkId ?? '',
            tokenId: item.id ?? '',
          });
        }}
      >
        <Box w="100%" flexDirection="row" alignItems="center">
          <Token size={8} src={item.logoURI} />
          <Box ml={3} mr={3} flexDirection="column" flex={1}>
            <FormatBalance
              balance={item.balance}
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
            <FormatCurrency
              numbers={[item.balance, mainTokenPrice?.[mapKey]]}
              render={(ele) => (
                <Typography.Body2 color="text-subdued">{ele}</Typography.Body2>
              )}
            />
          </Box>
          {!isSmallScreen && (
            <Box ml={3} mr={20} flexDirection="row" flex={1}>
              <Icon size={20} name="ActivityOutline" />
              <FormatCurrency
                numbers={[item.balance, mainTokenPrice?.[mapKey]]}
                render={(ele) => (
                  <Typography.Body2Strong ml={3}>{ele}</Typography.Body2Strong>
                )}
              />
            </Box>
          )}
          <Icon size={20} name="ChevronRightSolid" />
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
      ListHeaderComponent={<ListHeaderComponent />}
      ItemSeparatorComponent={Divider}
      ListFooterComponent={() => <Box h="20px" />}
      keyExtractor={(_item: TokenType) => _item.id}
      extraData={isSmallScreen}
      showsVerticalScrollIndicator={false}
    />
  );
};

export default AssetsList;
