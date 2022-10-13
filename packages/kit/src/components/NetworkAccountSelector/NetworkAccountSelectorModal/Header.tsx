/* eslint-disable no-nested-ternary */
import React, { useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  HStack,
  IconButton,
  Pressable,
  Spinner,
  Text,
  Tooltip,
  VStack,
} from '@onekeyhq/components';
import useModalClose from '@onekeyhq/components/src/Modal/Container/useModalClose';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useNavigation } from '../../../hooks';
import { useStatus } from '../../../hooks/redux';
import reducerAccountSelector from '../../../store/reducers/reducerAccountSelector';
import { setFistTimeShowCheckRPCNodeTooltip } from '../../../store/reducers/status';
import { wait } from '../../../utils/helper';
import { useRpcMeasureStatus } from '../../../views/ManageNetworks/hooks';
import {
  ManageNetworkRoutes,
  ManageNetworkRoutesParams,
} from '../../../views/ManageNetworks/types';
import { useAccountSelectorInfo } from '../hooks/useAccountSelectorInfo';

import Speedindicator, { SpeedindicatorColors } from './SpeedIndicator';
import { WalletSelectDropdown } from './WalletSelectDropdown';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

const { updateIsLoading } = reducerAccountSelector.actions;

type NavigationProps = NativeStackNavigationProp<
  ManageNetworkRoutesParams,
  ManageNetworkRoutes.RPCNode
>;

function Header({
  accountSelectorInfo,
}: {
  accountSelectorInfo: ReturnType<typeof useAccountSelectorInfo>;
}) {
  const intl = useIntl();
  const { firstTimeShowCheckRPCNodeTooltip } = useStatus();
  const [isOpen, setIsOpen] = useState(false);
  const { selectedNetwork, isLoading } = accountSelectorInfo;
  const rpcStatus = useRpcMeasureStatus(selectedNetwork?.id ?? '');
  const { dispatch } = backgroundApiProxy;
  const navigation = useNavigation<NavigationProps>();
  const close = useModalClose();

  const toCheckNodePage = () => {
    setIsOpen(false);
    navigation.navigate(ManageNetworkRoutes.RPCNode, {
      networkId: selectedNetwork?.id || '',
    });
  };

  useEffect(() => {
    if (firstTimeShowCheckRPCNodeTooltip) {
      return;
    }
    const main = async () => {
      await wait(500);
      setIsOpen(true);
      await wait(8 * 1000);
      setIsOpen(false);
      dispatch(setFistTimeShowCheckRPCNodeTooltip(true));
    };
    main();
  }, [firstTimeShowCheckRPCNodeTooltip, dispatch]);

  return (
    <Box pr={3.5}>
      <Box flexDirection="row" alignItems="center" pt={3.5} pl={4}>
        <VStack flex={1} mr={3}>
          <Box flexDirection="row" alignItems="center">
            <Text typography="Heading" isTruncated>
              {selectedNetwork?.name || '-'}
            </Text>

            {isLoading ? (
              <Pressable
                ml={2}
                onPress={() => {
                  dispatch(updateIsLoading(false));
                }}
              >
                <Spinner size="sm" />
              </Pressable>
            ) : null}
          </Box>
          <HStack alignItems="center" position="relative" pb="2">
            {rpcStatus && (
              <Speedindicator
                mr="6px"
                borderWidth="0"
                backgroundColor={rpcStatus.color}
              />
            )}
            <Tooltip
              isOpen={isOpen}
              hasArrow
              label={intl.formatMessage({
                id: 'content__click_here_to_switch_node',
              })}
              bg="interactive-default"
              _text={{ color: 'text-on-primary', fontSize: '14px' }}
              px="4"
              py="2"
            >
              <Box>
                <Pressable onPress={toCheckNodePage}>
                  <Text
                    typography="Caption"
                    isTruncated
                    color={SpeedindicatorColors.Fast}
                  >
                    {intl.formatMessage({ id: 'content__check_node' })}
                  </Text>
                </Pressable>
              </Box>
            </Tooltip>
          </HStack>
        </VStack>
        <IconButton
          name="CloseSolid"
          type="plain"
          circle
          onPress={() => {
            close();
          }}
        />
      </Box>
      <Box flexDirection="row" alignItems="center" pl={2}>
        <WalletSelectDropdown accountSelectorInfo={accountSelectorInfo} />
      </Box>
    </Box>
  );
}

export default Header;
