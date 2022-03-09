import React, { FC } from 'react';

import { useNavigation } from '@react-navigation/core';
import { TouchableOpacity } from 'react-native';

import {
  Badge,
  Box,
  Divider,
  FlatList,
  Icon,
  Image,
  Typography,
} from '@onekeyhq/components';
import { Network } from '@onekeyhq/engine/src/types/network';
import {
  ManageNetworkRoutes,
  ManageNetworkRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/ManageNetwork';

import { useAppSelector } from '../../../hooks/redux';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  ManageNetworkRoutesParams,
  ManageNetworkRoutes.Listing
>;

export const DisplayView: FC = () => {
  const navigation = useNavigation<NavigationProps>();
  const networks = useAppSelector((s) => s.network.network);
  const renderItem = ({ item }: { item: Network }) => (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => {
        navigation.navigate(ManageNetworkRoutes.CustomNetwork, {
          defaultValues: { ...item, exploreUrl: item.blockExplorerURL.address },
          isReadOnly: item.preset,
        });
      }}
    >
      <Box
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
        py={4}
        px={{ base: 4, md: 6 }}
      >
        <Box display="flex" flexDirection="row" alignItems="center">
          <Image
            size={{ base: 8, md: 6 }}
            source={{ uri: item.logoURI }}
            mr="3"
          />
          <Typography.Body1Strong mr="3">
            {item.shortName}
          </Typography.Body1Strong>
          <Badge size="sm" title={item.impl.toUpperCase()} />
        </Box>
        <Box display="flex" flexDirection="row" alignItems="center">
          <Box mr="1">
            <Icon size={24} name="LockClosedOutline" />
          </Box>
          <Icon size={20} name="ChevronRightSolid" />
        </Box>
      </Box>
    </TouchableOpacity>
  );
  return (
    <>
      <Box>
        <FlatList
          bg="surface-default"
          borderRadius="12"
          mt="3"
          mb="3"
          data={networks}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <Divider />}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
        />
      </Box>
    </>
  );
};
