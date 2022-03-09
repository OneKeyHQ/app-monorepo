import React, { FC, useCallback } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { TouchableOpacity } from 'react-native';

import {
  Badge,
  Box,
  Button,
  Divider,
  Icon,
  Image,
  Modal,
  Typography,
  useUserDevice,
} from '@onekeyhq/components';
import { Network } from '@onekeyhq/engine/src/types/network';

import { useManageNetworks } from '../../../hooks';
import {
  ManageNetworkRoutes,
  ManageNetworkRoutesParams,
} from '../../../routes/Modal/ManageNetwork';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  ManageNetworkRoutesParams,
  ManageNetworkRoutes.Listing
>;

type ListViewProps = {
  onPress: () => void;
};

export const ListView: FC<ListViewProps> = ({ onPress }) => {
  const intl = useIntl();
  const { size } = useUserDevice();

  const navigation = useNavigation<NavigationProps>();
  const { enabledNetworks } = useManageNetworks();

  const renderItem = useCallback(
    // eslint-disable-next-line
    ({ item, index }: { item: unknown; index: number }) => {
      const network = item as Network;
      return (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => {
            navigation.navigate(ManageNetworkRoutes.CustomNetwork, {
              defaultValues: {
                ...network,
                exploreUrl: network.blockExplorerURL.address,
              },
              isReadOnly: network.preset,
            });
          }}
        >
          <Box
            flexDirection="row"
            justifyContent="space-between"
            alignItems="center"
            py={4}
            px={{ base: 4, md: 6 }}
            bg="surface-default"
            borderTopRadius={index === 0 ? '12' : 0}
            borderBottomRadius={enabledNetworks.length - 1 === index ? '12' : 0}
          >
            <Box display="flex" flexDirection="row" alignItems="center">
              <Image
                alt="logoURI"
                size={{ base: 8, md: 6 }}
                source={{ uri: network.logoURI }}
                mr="3"
              />
              <Typography.Body1Strong mr="3">
                {network.shortName}
              </Typography.Body1Strong>
              <Badge size="sm" title={network.impl.toUpperCase()} />
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
    },
    [enabledNetworks.length, navigation],
  );

  return (
    <Modal
      header={intl.formatMessage({ id: 'action__customize_network' })}
      height="560px"
      hidePrimaryAction
      secondaryActionProps={{
        type: 'basic',
        onPress,
        w: size === 'SMALL' ? 'full' : undefined,
      }}
      secondaryActionTranslationId="action__edit"
      flatListProps={{
        px: '0',
        mx: '6',
        my: '4',
        contentContainerStyle: {},
        data: enabledNetworks,
        showsVerticalScrollIndicator: false,
        ItemSeparatorComponent: () => <Divider />,
        // eslint-disable-next-line
        keyExtractor: (item: any) => item.id,
        renderItem,
        ListFooterComponent: (
          <Button
            mt="6"
            leftIconName="PlusOutline"
            type="plain"
            w="full"
            onPress={() => {
              navigation.navigate(ManageNetworkRoutes.AddNetwork);
            }}
          >
            {intl.formatMessage({ id: 'action__add_network' })}
          </Button>
        ),
      }}
    />
  );
};

export default ListView;
