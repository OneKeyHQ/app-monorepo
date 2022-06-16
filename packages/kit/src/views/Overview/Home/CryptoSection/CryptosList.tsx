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
import {
  OverviewAllCryptoRoutes,
  OverviewAllCryptoRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/OverviewAllCrypto';
import {
  HomeRoutes,
  HomeRoutesParams,
  ModalRoutes,
  ModalScreenProps,
  RootRoutes,
} from '@onekeyhq/kit/src/routes/types';

import BalanceText from '../../Components/BalanceText';
import { ListProps } from '../../type';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  HomeRoutesParams,
  HomeRoutes.OverviewCryptoDetail
> &
  ModalScreenProps<OverviewAllCryptoRoutesParams>;

const CryptosList: FC<ListProps> = ({ datas }) => {
  const navigation = useNavigation<NavigationProps>();
  const navigationModal = useNavigation<NavigationProps['navigation']>();

  const gotoCryptoDetail = useCallback(
    (token: any) => {
      navigation.navigate(HomeRoutes.OverviewCryptoDetail, {
        token,
      });
    },
    [navigation],
  );

  const renderItem = useCallback(
    ({ item }) => (
      <Pressable
        width="full"
        height="76px"
        paddingX="16px"
        flexDirection="row"
        alignItems="center"
        justifyContent="space-between"
        onPress={() => {
          gotoCryptoDetail(item);
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
          <BalanceText
            text="$6562.61"
            typography="Body2"
            startColor="text-subdued"
          />
        </Box>
      </Pressable>
    ),
    [gotoCryptoDetail],
  );

  return (
    <Box width="100%" borderRadius="12px" bgColor="surface-default">
      <FlatList
        data={datas}
        ListHeaderComponent={() => (
          <Pressable
            height="64px"
            onPress={() => {
              navigationModal.navigate(RootRoutes.Modal, {
                screen: ModalRoutes.OverviewAllCrypto,
                params: {
                  screen: OverviewAllCryptoRoutes.OverviewAllCryptoScreen,
                  params: {
                    tokens: [1, 2, 3, 4, 5],
                    onPress: (token) => {
                      gotoCryptoDetail(token);
                    },
                  },
                },
              });
            }}
          >
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
