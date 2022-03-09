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
  useUserDevice,
} from '@onekeyhq/components';
import { Network } from '@onekeyhq/engine/src/types/network';
import {
  useActiveWalletAccount,
  useAppDispatch,
  useAppSelector,
} from '@onekeyhq/kit/src/hooks/redux';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import engine from '../../engine/EngineProvider';
import {
  ModalRoutes,
  ModalRoutesParams,
  RootRoutes,
  RootRoutesParams,
} from '../../routes/types';
import {
  changeActiveAccount,
  changeActiveNetwork,
} from '../../store/reducers/general';
import { ManageNetworkRoutes } from '../../views/ManageNetworks/types';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  RootRoutesParams,
  RootRoutes.Root
>;
const ChainSelector: FC = () => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();

  const dispatch = useAppDispatch();
  const networks = useAppSelector((s) => s.network.network);
  const { wallet } = useActiveWalletAccount();
  const activeNetwork = useAppSelector((s) => s.general.activeNetwork);
  const { screenWidth } = useUserDevice();
  const handleActiveChainChange = useCallback(
    async (id) => {
      if (!networks) return null;

      let selectedNetwork: Network | null = null;
      let selectedSharedChainName: string | null = null;
      networks.forEach((network) => {
        if (network.id === id) {
          selectedNetwork = network;
          selectedSharedChainName = network.impl;
        }
      });
      if (selectedNetwork && selectedSharedChainName) {
        dispatch(
          // backgroundApiProxy.changeChain(chainIdHex);
          changeActiveNetwork({
            network: selectedNetwork,
            sharedChainName: selectedSharedChainName,
          }),
        );

        // @ts-expect-error
        if (activeNetwork?.network.impl === selectedNetwork?.impl) return;
        if (!wallet) return;
        const currentWalletAccounts = wallet.accounts;
        if (!currentWalletAccounts || !currentWalletAccounts?.length) {
          dispatch(
            changeActiveAccount({
              account: null,
              wallet,
            }),
          );
          return;
        }
        const accounts = await engine.getAccounts(currentWalletAccounts, id);
        const targetAccount = accounts[0];
        dispatch(
          changeActiveAccount({
            account: targetAccount,
            wallet,
          }),
        );
      }
    },
    [dispatch, networks, wallet, activeNetwork?.network.impl],
  );

  const options = useMemo(() => {
    if (!networks) return [];

    return networks.map((network) => ({
      label: network.shortName,
      value: network.id,
      tokenProps: {
        src: network.logoURI,
      },
      badge: network.impl === 'evm' ? 'EVM' : undefined,
    }));
  }, [networks]);

  return (
    <Box>
      <Select
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
        onPressFooter={() =>
          setTimeout(() => {
            navigation.navigate(RootRoutes.Modal, {
              screen: ModalRoutes.ManageNetwork,
              params: { screen: ManageNetworkRoutes.Listing },
            });
          }, 200)
        }
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
