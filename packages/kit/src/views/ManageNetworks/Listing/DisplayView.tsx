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
} from '@onekeyhq/components';
import { useIsVerticalLayout } from '@onekeyhq/components/src/Provider/hooks';
import { Text } from '@onekeyhq/components/src/Typography';
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
  const isSmallScreen = useIsVerticalLayout();
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
        p={4}
      >
        <Box display="flex" flexDirection="row" alignItems="center">
          <Image
            size={{ base: 8, md: 6 }}
            source={{ uri: item.logoURI }}
            mr="3"
          />
          <Text mr="3" typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}>
            {item.shortName}
          </Text>
          <Badge size="sm" title={item.impl.toUpperCase()} />
        </Box>
        <Box display="flex" flexDirection="row" alignItems="center">
          <Box mr={3}>
            <Icon
              size={isSmallScreen ? 24 : 20}
              name={isSmallScreen ? 'LockClosedOutline' : 'LockClosedSolid'}
            />
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
