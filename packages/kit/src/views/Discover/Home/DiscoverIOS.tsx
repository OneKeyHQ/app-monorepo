import React, { useCallback } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { ListRenderItem } from 'react-native';

import {
  Box,
  Divider,
  Empty,
  FlatList,
  Pressable,
  Typography,
} from '@onekeyhq/components';
import IconHistory from '@onekeyhq/kit/assets/3d_transaction_history.png';
import ExploreIMG from '@onekeyhq/kit/assets/explore.png';

import { HomeRoutes, HomeRoutesParams } from '../../../routes/types';
import { DAppItemType } from '../type';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  HomeRoutesParams,
  HomeRoutes.ExploreScreen
>;

const DiscoverIOS = () => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();
  const flatListData: DAppItemType[] = [];
  const banner = (
    <Pressable
      onPress={() => {
        navigation.navigate(HomeRoutes.ExploreScreen);
      }}
    >
      <Box width="100%" height="268px">
        <Box
          justifyContent="center"
          width="100%"
          height="220px"
          bgColor="surface-default"
          borderColor="border-subdued"
          borderRadius="12px"
          borderWidth={1}
        >
          <Empty
            imageUrl={ExploreIMG}
            title={intl.formatMessage({
              id: 'title__explore_dapps',
            })}
            subTitle="https://explore.onekey.so →"
          />
        </Box>
        <Typography.Subheading color="text-subdued" mt="24px">
          {intl.formatMessage({
            id: 'transaction__history',
          })}
        </Typography.Subheading>
      </Box>
    </Pressable>
  );

  const renderItem: ListRenderItem<DAppItemType> = useCallback(
    ({ item, index }) => (
      <Pressable onPress={() => {}}>
        <Box
          padding="16px"
          height="76px"
          width="100%"
          bgColor="surface-default"
          borderTopRadius={index === 0 ? '12px' : '0px'}
          borderRadius={index === flatListData?.length - 1 ? '12px' : '0px'}
        >
          <Box flexDirection="row" flex={1} alignItems="center">
            <Box
              width="40px"
              height="40px"
              borderRadius="12px"
              borderColor="border-subdued"
              borderWidth={1}
            />
            <Box flexDirection="column" ml="12px" justifyContent="center">
              <Typography.Body1Strong>{item.name}</Typography.Body1Strong>
              <Typography.Body2 color="text-subdued">
                {item.description}
              </Typography.Body2>
            </Box>
          </Box>
        </Box>
      </Pressable>
    ),
    [flatListData?.length],
  );

  return (
    <Box flex="1" bg="background-default">
      <FlatList
        contentContainerStyle={{
          paddingBottom: 24,
          paddingTop: 24,
        }}
        px="16px"
        data={flatListData}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <Divider />}
        keyExtractor={(item, index) => `Dapp history${index}`}
        ListHeaderComponent={banner}
        ListEmptyComponent={
          <Empty
            imageUrl={IconHistory}
            title={intl.formatMessage({ id: 'title__no_history' })}
            subTitle={intl.formatMessage({ id: 'title__no_history_desc' })}
          />
        }
      />
    </Box>
  );
};

export default DiscoverIOS;
