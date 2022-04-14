/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import React from 'react';

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
import type { ValuedToken } from '@onekeyhq/kit/src/store/reducers/general';
import { ManageTokenRoutes } from '@onekeyhq/kit/src/views/ManageTokens/types';

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
  const { accountTokens, updateAccountTokens, prices } = useManageTokens();
  const { account, network } = useActiveWalletAccount();
  const navigation = useNavigation<NavigationProps>();

  useFocusEffect(updateAccountTokens);

  const renderItem: ScrollableFlatListProps<ValuedToken>['renderItem'] = ({
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
            <FormatBalance
              balance={item.balance}
              suffix={item.symbol}
              formatOptions={{
                fixed: decimal ?? 4,
              }}
              render={(ele) => (
                <Text typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}>
                  {!item.balance ? '-' : ele}
                </Text>
              )}
            />
            <FormatCurrency
              numbers={[item.balance, prices?.[mapKey]]}
              render={(ele) => (
                <Typography.Body2 color="text-subdued">
                  {item.balance && prices?.[mapKey] ? ele : '-'}
                </Typography.Body2>
              )}
            />
          </Box>
          {!isSmallScreen && (
            <Box mr={3} flexDirection="row" flex={1}>
              {/* <Icon size={20} name="ActivityOutline" /> */}
              <FormatCurrency
                numbers={[prices?.[mapKey]]}
                render={(ele) => (
                  <Typography.Body2Strong ml={3}>
                    {prices?.[mapKey] ? ele : '-'}
                  </Typography.Body2Strong>
                )}
              />
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
