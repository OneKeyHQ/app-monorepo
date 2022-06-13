/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { FC, useCallback, useMemo } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  HStack,
  Icon,
  Select,
  Token,
  Typography,
  useIsVerticalLayout,
  useUserDevice,
} from '@onekeyhq/components';
import { Network } from '@onekeyhq/engine/src/types/network';
import { useActiveWalletAccount } from '@onekeyhq/kit/src/hooks/redux';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useManageNetworks } from '../../hooks';
import {
  ModalRoutes,
  ModalRoutesParams,
  RootRoutes,
  RootRoutesParams,
} from '../../routes/types';
import { ManageNetworkRoutes } from '../../views/ManageNetworks/types';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  RootRoutesParams,
  RootRoutes.Root
>;
const ChainSelector: FC = () => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();

  const { enabledNetworks } = useManageNetworks();
  const { network: activeNetwork } = useActiveWalletAccount();
  const isVerticalLayout = useIsVerticalLayout();

  const { screenWidth } = useUserDevice();
  const handleActiveChainChange = useCallback(
    (id) => {
      if (!enabledNetworks) return null;
      backgroundApiProxy.serviceNetwork.changeActiveNetwork(id);
    },
    [enabledNetworks],
  );

  const options = useMemo(() => {
    if (!enabledNetworks) return [];

    return enabledNetworks.map((network) => ({
      label: network.shortName,
      value: network.id,
      tokenProps: {
        src: network.logoURI,
        letter: network.shortName,
      },
      badge: network.impl === 'evm' ? 'EVM' : undefined,
    }));
  }, [enabledNetworks]);

  return (
    <Box>
      <Select
        setPositionOnlyMounted
        positionTranslateY={-4}
        dropdownPosition="top-left"
        dropdownProps={{ minW: '240px', height: '320px' }}
        value={activeNetwork ? activeNetwork?.id : undefined}
        onChange={handleActiveChainChange}
        title={intl.formatMessage({ id: 'network__networks' })}
        options={options}
        isTriggerPlain
        footerText={intl.formatMessage({ id: 'action__customize_network' })}
        footerIcon="PencilSolid"
        onPressFooter={() => {
          setTimeout(() => {
            navigation.navigate(RootRoutes.Modal, {
              screen: ModalRoutes.ManageNetwork,
              params: { screen: ManageNetworkRoutes.Listing },
            });
          }, 500);
        }}
        renderTrigger={(activeOption, isHovered, visible, isPressed) => (
          <HStack
            p={2}
            space={1}
            bg={
              // eslint-disable-next-line no-nested-ternary
              visible
                ? 'surface-selected'
                : // eslint-disable-next-line no-nested-ternary
                isPressed
                ? 'surface-pressed'
                : isHovered
                ? 'surface-hovered'
                : undefined
            }
            borderRadius="xl"
            alignItems="center"
            justifyContent={isVerticalLayout ? 'flex-end' : 'space-between'}
          >
            <HStack space={3} alignItems="center">
              <Token size={6} {...activeOption.tokenProps} />
              <Typography.Body2Strong
                isTruncated
                numberOfLines={1}
                maxW={screenWidth / 2 - 72}
              >
                {activeOption.label}
              </Typography.Body2Strong>
            </HStack>
            <Icon size={20} name="ChevronDownSolid" />
          </HStack>
        )}
      />
    </Box>
  );
};

export default ChainSelector;
