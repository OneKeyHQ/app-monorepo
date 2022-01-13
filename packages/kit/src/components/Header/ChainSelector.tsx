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
import { useAppDispatch, useAppSelector } from '@onekeyhq/kit/src/hooks/redux';
import { updateActiveChainId } from '@onekeyhq/kit/src/store/reducers/chain';
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
  const activeChainId = useAppSelector((s) => s.chain.chainId);

  const handleActiveChainChange = useCallback(
    (chainId) => {
      dispatch(updateActiveChainId(chainId));
      const chainIdHex = {
        ethereum: '0x1',
        bsc: '0x38',
        heco: '0x80',
        polygon: '0x89',
        fantom: '0xfa',
      }[chainId as string];
      if (!chainIdHex) {
        throw new Error('chainId not available.');
      }
      if (chainIdHex) {
        backgroundApiProxy.changeChain(chainIdHex);
      }
    },
    [dispatch],
  );

  const options = useMemo(
    () => [
      {
        title: 'EVM',
        options: [
          {
            label: 'ETH',
            value: 'ethereum',
            tokenProps: {
              chain: 'eth',
            },
          },
          {
            label: 'BSC',
            value: 'bsc',
            tokenProps: {
              chain: 'bsc',
            },
          },
          {
            label: 'HECO',
            value: 'heco',
            tokenProps: {
              chain: 'heco',
            },
          },
          {
            label: 'Polygon',
            value: 'polygon',
            tokenProps: {
              chain: 'polygon',
            },
          },
          {
            label: 'Fantom',
            value: 'fantom',
            tokenProps: {
              chain: 'fantom',
            },
          },
        ],
      },
    ],
    [],
  );

  return (
    <Box>
      <Select
        dropdownPosition="right"
        dropdownProps={{ w: '56' }}
        value={activeChainId}
        onChange={handleActiveChainChange}
        title="Networks"
        options={options}
        footerText={intl.formatMessage({ id: 'action__customize_network' })}
        footerIcon="PencilSolid"
        isTriggerPlain
        onPressFooter={() =>
          setTimeout(() => {
            navigation.navigate(ManageNetworkModalRoutes.NetworkListViewModal);
          }, 200)
        }
        renderTrigger={(activeOption, isHovered, visible) => (
          <HStack
            p={2}
            space={1}
            bg={
              // eslint-disable-next-line no-nested-ternary
              visible
                ? 'surface-selected'
                : isHovered
                ? 'surface-hovered'
                : 'surface-default'
            }
            borderRadius="xl"
            alignItems="center"
          >
            <HStack space={{ base: 2, md: 3 }} alignItems="center">
              <Token size={{ base: 5, md: 6 }} {...activeOption.tokenProps} />
              <Typography.Body2Strong>
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
