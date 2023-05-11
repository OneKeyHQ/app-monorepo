import { useCallback, useMemo } from 'react';

import { MotiView } from 'moti';
import { useIntl } from 'react-intl';

import {
  Button,
  CustomSkeleton,
  HStack,
  Icon,
  Text,
  Tooltip,
} from '@onekeyhq/components';

import { useNavigation } from '../../hooks';
import { ManageNetworkModalRoutes } from '../../routes/routesEnum';
import { useRpcMeasureStatus } from '../../views/ManageNetworks/hooks';

import Speedindicator from './modals/NetworkAccountSelectorModal/SpeedIndicator';

import type { ManageNetworkRoutesParams } from '../../routes';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { GestureResponderEvent } from 'react-native';

type NavigationProps = NativeStackNavigationProp<
  ManageNetworkRoutesParams,
  ManageNetworkModalRoutes.RPCNode
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
      navigation.navigate(ManageNetworkModalRoutes.RPCNode, {
        networkId: networkId || '',
      });
    },
    [navigation, networkId],
  );

  const rpcStatusElement = useMemo(() => {
    if (!status || loading) {
      /* <Skeleton shape="Body2" width={20} /> */
      return <CustomSkeleton borderRadius="3px" height="10px" width="32px" />;
    }
    return (
      <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <HStack alignItems="center">
          <Speedindicator
            mr="8px"
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
            <HStack alignItems="center">
              <Text
                typography="Body2Strong"
                isTruncated
                color={status.textColor}
                mr="4px"
              >
                {intl.formatMessage({ id: status.text })}
              </Text>
              <Icon
                name="ChevronRightMini"
                color={status.textColor}
                size={20}
              />
            </HStack>
          </Tooltip>
        </HStack>
      </MotiView>
    );
  }, [status, loading, intl]);

  return (
    <Button hitSlop={16} size="xs" onPress={toCheckNodePage as any} h={8}>
      {rpcStatusElement}
    </Button>
  );
}

export { RpcStatusButton };
