/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { FC, useCallback, useMemo } from 'react';

import { truncateSync } from 'fs';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  HStack,
  Icon,
  Select,
  Token,
  Typography,
  useUserDevice,
} from '@onekeyhq/components';
import { Network } from '@onekeyhq/engine/src/types/network';
import {
  useActiveWalletAccount,
  useAppSelector,
} from '@onekeyhq/kit/src/hooks/redux';

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

  const { dispatch } = backgroundApiProxy;
  const { enabledNetworks } = useManageNetworks();
  const { wallet } = useActiveWalletAccount();
  const activeNetwork = useAppSelector((s) => s.general.activeNetwork);
  const { screenWidth } = useUserDevice();
  const handleActiveChainChange = useCallback(
    async (id) => {
      if (!enabledNetworks) return null;

      let selectedNetwork: Network | null = null;
      let selectedSharedChainName: string | null = null;
      enabledNetworks.forEach((network) => {
        if (network.id === id) {
          selectedNetwork = network;
          selectedSharedChainName = network.impl;
        }
      });
      if (selectedNetwork && selectedSharedChainName) {
        backgroundApiProxy.serviceNetwork.changeActiveNetwork({
          network: selectedNetwork,
          sharedChainName: selectedSharedChainName,
        });

        // @ts-expect-error
        if (activeNetwork?.network.impl === selectedNetwork?.impl) return;
        if (!wallet) return;
        const currentWalletAccounts = wallet.accounts;
        if (!currentWalletAccounts || !currentWalletAccounts?.length) {
          backgroundApiProxy.serviceAccount.changeActiveAccount({
            account: null,
            wallet,
          });
          return;
        }
        const accounts = await backgroundApiProxy.engine.getAccounts(
          currentWalletAccounts,
          id,
        );
        const targetAccount = accounts[0];
        backgroundApiProxy.serviceAccount.changeActiveAccount({
          account: targetAccount,
          wallet,
        });
      }
    },
    [enabledNetworks, wallet, activeNetwork?.network.impl],
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
        positionTranslateY={8}
        dropdownPosition="right"
        dropdownProps={{ w: '64' }}
        value={activeNetwork ? activeNetwork?.network?.id : undefined}
        onChange={handleActiveChainChange}
        title={intl.formatMessage({ id: 'network__networks' })}
        options={options}
        isTriggerPlain
        // footer={null}
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
        renderTrigger={(activeOption, isHovered, visible) => (
          <HStack
            p={2}
            space={1}
            bg={
              // eslint-disable-next-line no-nested-ternary
              visible ? 'surface-selected' : isHovered ? 'surface-hovered' : ''
            }
            borderRadius="xl"
            alignItems="center"
            justifyContent="flex-end"
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
