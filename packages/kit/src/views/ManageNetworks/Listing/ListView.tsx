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
  Modal,
  Text,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { Network } from '@onekeyhq/engine/src/types/network';

import { useManageNetworks } from '../../../hooks';
import {
  ManageNetworkRoutes,
  ManageNetworkRoutesParams,
} from '../../../routes/Modal/ManageNetwork';

import { NetworkIcon } from './NetworkIcon';

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
                id: network.id,
                name: network.name,
                rpcURL: network.rpcURL,
                symbol: network.symbol,
                exploreUrl: network.blockExplorerURL.name,
                chainId: String(+(network.extraInfo?.chainId ?? '')),
                impl: network.impl,
              });
            } else {
              navigation.navigate(ManageNetworkRoutes.CustomNetwork, {
                id: network.id,
                name: network.name,
                rpcURL: network.rpcURL,
                symbol: network.symbol,
                exploreUrl: network.blockExplorerURL.name,
                chainId: String(+(network.extraInfo?.chainId ?? '')),
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
            <Box
              display="flex"
              flexDirection="row"
              alignItems="center"
              flex="1"
            >
              <NetworkIcon network={network} />
              <Text
                flexShrink={1}
                mr="3"
                typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
                numberOfLines={2}
                isTruncated
              >
                {network.name}
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
        // my: '4',
        contentContainerStyle: {
          paddingTop: 24,
          paddingBottom: 24,
        },
        data: enabledNetworks,
        showsVerticalScrollIndicator: false,
        ItemSeparatorComponent: () => <Divider />,
        // eslint-disable-next-line
        keyExtractor: (item: any) => item.id,
        renderItem,
        ListFooterComponent: (
          <Button
            mt="4"
            leftIconName="PlusOutline"
            type="plain"
            w="full"
            size={isSmallScreen ? 'xl' : 'base'}
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
