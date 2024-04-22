/* eslint-disable no-nested-ternary */
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useFocusEffect } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { TouchableOpacity } from 'react-native';

import {
  Box,
  HStack,
  IconButton,
  Pressable,
  Skeleton,
  Spinner,
  Text,
  Tooltip,
  VStack,
} from '@onekeyhq/components';
import useModalClose from '@onekeyhq/components/src/Modal/Container/useModalClose';
import type { WalletType } from '@onekeyhq/engine/src/types/wallet';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { useAppSelector, useNavigation } from '../../../../hooks';
import reducerAccountSelector from '../../../../store/reducers/reducerAccountSelector';
import { setFistTimeShowCheckRPCNodeTooltip } from '../../../../store/reducers/status';
import { isHwClassic } from '../../../../utils/hardware';
import { wait } from '../../../../utils/helper';
import { useRpcMeasureStatus } from '../../../../views/ManageNetworks/hooks';
import { ManageNetworkModalRoutes } from '../../../../views/ManageNetworks/types';

import Speedindicator from './SpeedIndicator';
import { WalletSelectDropdown } from './WalletSelectDropdown';

import type { ManageNetworkRoutesParams } from '../../../../views/ManageNetworks/types';
import type { useAccountSelectorInfo } from '../../hooks/useAccountSelectorInfo';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

const { updateIsLoading } = reducerAccountSelector.actions;

type NavigationProps = NativeStackNavigationProp<
  ManageNetworkRoutesParams,
  ManageNetworkModalRoutes.RPCNode
>;

function Header({
  accountSelectorInfo,
  showCustomLegacyHeader,
  hideCreateAccount,
  multiSelect,
  selectedAccounts,
  walletsToHide,
}: {
  accountSelectorInfo: ReturnType<typeof useAccountSelectorInfo>;
  showCustomLegacyHeader?: boolean;
  hideCreateAccount?: boolean;
  selectedAccounts?: string[];
  multiSelect?: boolean;
  walletsToHide?: WalletType[];
}) {
  const intl = useIntl();
  const firstTimeShowCheckRPCNodeTooltip = useAppSelector(
    (s) => s.status.firstTimeShowCheckRPCNodeTooltip,
  );
  const [isOpen, setIsOpen] = useState(false);
  const {
    selectedNetwork,
    selectedNetworkSettings,
    selectedWallet,
    isLoading,
  } = accountSelectorInfo;
  const { loading, status } = useRpcMeasureStatus(
    (showCustomLegacyHeader ? selectedNetwork?.id : '') ?? '',
  );
  const { dispatch } = backgroundApiProxy;
  const navigation = useNavigation<NavigationProps>();
  const close = useModalClose();

  const shouldHideCreateAccount = useMemo(() => {
    if (hideCreateAccount) {
      return true;
    }

    if (
      selectedNetworkSettings?.enableOnClassicOnly &&
      !isHwClassic(selectedWallet?.deviceType)
    ) {
      return true;
    }
    return false;
  }, [
    hideCreateAccount,
    selectedNetworkSettings?.enableOnClassicOnly,
    selectedWallet?.deviceType,
  ]);

  const toCheckNodePage = useCallback(() => {
    setIsOpen(false);
    navigation.navigate(ManageNetworkModalRoutes.RPCNode, {
      networkId: selectedNetwork?.id || '',
    });
  }, [navigation, selectedNetwork]);

  useEffect(() => {
    if (platformEnv.isNative) {
      // FocusEffect has a delay for Native Stack
      // so need to close the overlay immediately in transitionStart
      const onTransitionStart = navigation.addListener(
        'transitionStart',
        (e) => {
          if (e.data.closing) {
            setIsOpen(false);
          }
        },
      );
      return onTransitionStart;
    }
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
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
      return <Skeleton shape="Caption" />;
    }
    return (
      <>
        <Speedindicator
          mr="6px"
          borderWidth="0"
          backgroundColor={status.iconColor}
        />
        <Tooltip
          isOpen={isOpen}
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
  }, [status, intl, isOpen, loading]);

  return (
    <Box
      pt={{ base: 2, md: 4 }}
      pb={2}
      pl={{ base: 2, md: 4 }}
      pr={{ base: '14px', md: '22px' }}
    >
      <Box flexDirection="row" alignItems="center">
        {showCustomLegacyHeader ? (
          <>
            <VStack flex={1} mr={3}>
              <TouchableOpacity onPress={toCheckNodePage}>
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
                <HStack alignItems="center" position="relative" pb="3">
                  {rpcStatusElement}
                </HStack>
              </TouchableOpacity>
            </VStack>
            <IconButton
              size="xl"
              name="XMarkOutline"
              type="plain"
              circle
              onPress={() => {
                close();
              }}
            />
          </>
        ) : null}
      </Box>
      <Box flexDirection="row" alignItems="center">
        <WalletSelectDropdown
          accountSelectorInfo={accountSelectorInfo}
          hideCreateAccount={shouldHideCreateAccount}
          multiSelect={multiSelect}
          selectedAccounts={selectedAccounts}
          walletsToHide={walletsToHide}
        />
      </Box>
    </Box>
  );
}

export default Header;
