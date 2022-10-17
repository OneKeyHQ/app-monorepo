/* eslint-disable no-nested-ternary */
import React, { useCallback, useMemo, useState } from 'react';

import { useFocusEffect } from '@react-navigation/core';
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

import Speedindicator from './SpeedIndicator';
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
  const { loading, status } = useRpcMeasureStatus(selectedNetwork?.id ?? '');
  const { dispatch } = backgroundApiProxy;
  const navigation = useNavigation<NavigationProps>();
  const close = useModalClose();

  const toCheckNodePage = useCallback(() => {
    setIsOpen(false);
    navigation.navigate(ManageNetworkRoutes.RPCNode, {
      networkId: selectedNetwork?.id || '',
    });
  }, [navigation, selectedNetwork]);

  useFocusEffect(
    React.useCallback(() => {
      let isActive = true;
      if (firstTimeShowCheckRPCNodeTooltip) {
        return;
      }
      const func = async () => {
        await wait(500);
        if (!isActive) {
          return;
        }
        setIsOpen(true);
        await wait(8 * 1000);
        setIsOpen(false);
        dispatch(setFistTimeShowCheckRPCNodeTooltip(true));
      };
      func();
      return () => {
        setIsOpen(false);
        isActive = false;
      };
    }, [dispatch, firstTimeShowCheckRPCNodeTooltip]),
  );

  const rpcStatusElement = useMemo(() => {
    if (!status || loading) {
      return <Spinner size="sm" />;
    }
    return (
      <>
        <Speedindicator
          mr="6px"
          borderWidth="0"
          backgroundColor={status.color}
        />
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
              <Text typography="Caption" isTruncated color={status.color}>
                {typeof status.responseTime === 'number'
                  ? `${status.responseTime} ms`
                  : intl.formatMessage({ id: 'content__not_available' })}
              </Text>
            </Pressable>
          </Box>
        </Tooltip>
      </>
    );
  }, [status, intl, isOpen, toCheckNodePage, loading]);

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
            {rpcStatusElement}
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
