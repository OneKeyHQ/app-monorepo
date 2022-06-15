import React, { FC, useCallback } from 'react';

import { useNavigation } from '@react-navigation/core';

import {
  Badge,
  Box,
  Divider,
  FlatList,
  Icon,
  Pressable,
  Text,
  TokenGroup,
} from '@onekeyhq/components';
import { HomeRoutes, HomeRoutesParams } from '@onekeyhq/kit/src/routes/types';

import BalanceText from '../../Components/BalanceText';
import { ListProps } from '../../type';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  HomeRoutesParams,
  HomeRoutes.OverviewCryptoDetail
>;

const CryptosList: FC<ListProps> = ({ datas }) => {
  const navigation = useNavigation<NavigationProps>();

  const renderItem = useCallback(
    () => (
      <Pressable
        width="full"
        height="76px"
        paddingX="16px"
        flexDirection="row"
        alignItems="center"
        justifyContent="space-between"
        onPress={() => {
          navigation.navigate(HomeRoutes.OverviewCryptoDetail);
        }}
      >
        <TokenGroup
          size="lg"
          tokens={[{ chain: 'eth' }]}
          cornerToken={{ chain: 'eth' }}
        />
        <Text ml="12px" typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}>
          ETH
        </Text>

        <Box flexDirection="column" alignItems="flex-end" flex={1}>
          <Text typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}>
            562.61 USDT
          </Text>
          <Text typography="Body2" color="text-subdued">
            $6562.61
          </Text>
        </Box>
      </Pressable>
    ),
    [navigation],
  );

  return (
    <Box width="100%" borderRadius="12px" bgColor="surface-default">
      <FlatList
        data={datas}
        ListHeaderComponent={() => (
          <Pressable height="64px">
            <Box
              flex={1}
              flexDirection="row"
              justifyContent="space-between"
              padding="16px"
              alignItems="center"
            >
              <BalanceText text="$541.87" typography="DisplayLarge" />
              <Box flexDirection="row">
                <Badge title="15" size="sm" type="default" />
                <Box ml="12px">
                  <Icon name="ChevronRightSolid" />
                </Box>
              </Box>
            </Box>
            <Divider />
          </Pressable>
        )}
        ItemSeparatorComponent={() => <Divider />}
        renderItem={renderItem}
        keyExtractor={(item, index) => `${index}`}
      />
    </Box>
  );
};

export default CryptosList;
