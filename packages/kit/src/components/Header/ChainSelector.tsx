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
} from '@onekeyhq/components';
import { NetworkShort } from '@onekeyhq/engine/src/types/network';
import { useAppDispatch, useAppSelector } from '@onekeyhq/kit/src/hooks/redux';
import { changeActiveNetwork } from '@onekeyhq/kit/src/store/reducers/general';
import {
  ManageNetworkModalRoutes,
  ManageNetworkRoutesParams,
} from '@onekeyhq/kit/src/views/ManageNetworks/types';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  ManageNetworkRoutesParams,
  ManageNetworkModalRoutes.NetworkListViewModal
>;
const ChainSelector: FC = () => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();

  const dispatch = useAppDispatch();
  const networks = useAppSelector((s) => s.network.network);

  const activeNetwork = useAppSelector((s) => s.general.activeNetwork);

  const handleActiveChainChange = useCallback(
    (id) => {
      if (!networks) return null;

      let selectedNetwork: NetworkShort | null = null;
      let selectedSharedChainName: string | null = null;
      networks.forEach((network) => {
        if (network.id === id) {
          selectedNetwork = network;
          selectedSharedChainName = network.impl;
        }
      });
      if (selectedNetwork && selectedSharedChainName) {
        dispatch(
          changeActiveNetwork({
            network: selectedNetwork,
            sharedChainName: selectedSharedChainName,
          }),
        );
      }

      // dispatch(updateActiveChainId(chainId));
      // const chainIdHex = {
      //   ethereum: '0x1',
      //   bsc: '0x38',
      //   heco: '0x80',
      //   polygon: '0x89',
      //   fantom: '0xfa',
      // }[chainId as string];
      // if (!chainIdHex) {
      //   throw new Error('chainId not available.');
      // }
      // if (chainIdHex) {
      //   backgroundApiProxy.changeChain(chainIdHex);
      // }
    },
    [dispatch, networks],
  );

  const options = useMemo(() => {
    if (!networks) return [];

    return networks.map((network) => ({
      title: network.impl,
      options: [
        {
          label: network.name,
          value: network.id,
          tokenProps: {
            src: network.logoURI,
          },
        },
      ],
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
        // footerText={intl.formatMessage({ id: 'action__customize_network' })}
        // footerIcon="PencilSolid"
        // onPressFooter={() =>
        //   setTimeout(() => {
        //     navigation.navigate(ManageNetworkModalRoutes.NetworkListViewModal);
        //   }, 200)
        // }
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
          >
            <HStack maxW="104" space={3} alignItems="center">
              <Token size={6} {...activeOption.tokenProps} />
              <Typography.Body2Strong flex={1} isTruncated>
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
