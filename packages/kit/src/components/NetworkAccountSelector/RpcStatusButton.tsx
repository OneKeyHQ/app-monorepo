import React, { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';
import { GestureResponderEvent } from 'react-native';

import {
  Box,
  Button,
  HStack,
  Skeleton,
  Text,
  Tooltip,
} from '@onekeyhq/components';

import { useNavigation } from '../../hooks';
import { ManageNetworkRoutes } from '../../routes/routesEnum';
import { useRpcMeasureStatus } from '../../views/ManageNetworks/hooks';

import Speedindicator from './modals/NetworkAccountSelectorModal/SpeedIndicator';

import type { ManageNetworkRoutesParams } from '../../routes';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  ManageNetworkRoutesParams,
  ManageNetworkRoutes.RPCNode
>;

interface IRpcStatusButtonProps {
  networkId: string;
}
function RpcStatusButton({ networkId }: IRpcStatusButtonProps) {
  const { loading, status } = useRpcMeasureStatus(networkId || '');
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();

  const toCheckNodePage = useCallback(
    (event: GestureResponderEvent) => {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      // setIsOpen(false);
      navigation.navigate(ManageNetworkRoutes.RPCNode, {
        networkId: networkId || '',
      });
    },
    [navigation, networkId],
  );

  const rpcStatusElement = useMemo(() => {
    if (!status || loading) {
      return (
        <>
          <Skeleton shape="Caption" />
        </>
      );
    }
    return (
      <>
        <Speedindicator
          mr="6px"
          borderWidth="0"
          backgroundColor={status.iconColor}
        />
        <Tooltip
          isOpen={false}
          hasArrow
          label={intl.formatMessage({
            id: 'content__click_here_to_switch_node',
          })}
          bg="interactive-default"
          _text={{ color: 'text-on-primary', fontSize: '14px' }}
          px="16px"
          py="8px"
          borderRadius="12px"
        >
          <Box>
            <Text typography="Caption" isTruncated color={status.textColor}>
              {intl.formatMessage({ id: status.text })}
            </Text>
          </Box>
        </Tooltip>
      </>
    );
  }, [status, intl, loading]);

  return (
    <Button hitSlop={16} size="sm" onPress={toCheckNodePage as any}>
      <HStack alignItems="center">{rpcStatusElement}</HStack>
    </Button>
  );
}

export { RpcStatusButton };
