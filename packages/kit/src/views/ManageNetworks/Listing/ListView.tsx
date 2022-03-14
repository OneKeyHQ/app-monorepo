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
  Text,
  Typography,
  useIsVerticalLayout,
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
  const isSmallScreen = useIsVerticalLayout();

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
            if (network.preset) {
              navigation.navigate(ManageNetworkRoutes.PresetNetwork, {
                ...network,
                exploreUrl: network.blockExplorerURL.name,
                chainId: String(+network.extraInfo.chainId ?? ''),
              });
            } else {
              navigation.navigate(ManageNetworkRoutes.CustomNetwork, {
                ...network,
                exploreUrl: network.blockExplorerURL.address,
              });
            }
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
              {network.preset ? (
                <Image
                  alt="logoURI"
                  size={{ base: 8, md: 6 }}
                  source={{ uri: network.logoURI }}
                  mr="3"
                />
              ) : (
                <Box
                  mr="3"
                  borderRadius="full"
                  w={{ base: '8', md: '6' }}
                  display="flex"
                  justifyContent="center"
                  alignItems="center"
                  bg="decorative-surface-one"
                >
                  <Typography.DisplaySmall>
                    {network.name[0].toUpperCase()}
                  </Typography.DisplaySmall>
                </Box>
              )}
              <Text
                mr="3"
                typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
              >
                {network.shortName}
              </Text>
              <Badge size="sm" title={network.impl.toUpperCase()} />
            </Box>
            <Box display="flex" flexDirection="row" alignItems="center">
              {network.preset ? (
                <Box mr={3}>
                  <Icon
                    size={isSmallScreen ? 24 : 20}
                    name={
                      isSmallScreen ? 'LockClosedOutline' : 'LockClosedSolid'
                    }
                  />
                </Box>
              ) : null}
              <Icon size={20} name="ChevronRightSolid" />
            </Box>
          </Box>
        </TouchableOpacity>
      );
    },
    [enabledNetworks.length, navigation, isSmallScreen],
  );

  return (
    <Modal
      header={intl.formatMessage({ id: 'action__customize_network' })}
      height="560px"
      hidePrimaryAction
      secondaryActionProps={{
        type: 'basic',
        onPress,
        w: isSmallScreen ? 'full' : undefined,
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
