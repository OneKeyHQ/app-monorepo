import React, { FC, useMemo } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Box,
  HStack,
  Icon,
  Pressable,
  Token,
  Typography,
} from '@onekeyhq/components';

import { useActiveWalletAccount, useNavigationActions } from '../../hooks';
import { EAccountSelectorMode } from '../../store/reducers/reducerAccountSelector';
import { useRpcMeasureStatus } from '../../views/ManageNetworks/hooks';

import Speedindicator from './NetworkAccountSelectorModal/SpeedIndicator';

type NetworkAccountSelectorTriggerProps = {
  size?: 'sm' | 'lg' | string;
  type?: 'basic' | 'plain';
  mode?: EAccountSelectorMode;
};

const defaultProps = {
  size: 'sm',
  type: 'plain',
} as const;

const NetworkAccountSelectorTrigger: FC<NetworkAccountSelectorTriggerProps> = ({
  size,
  type,
  mode,
}) => {
  // TODO different options of scene
  const { network, account, wallet } = useActiveWalletAccount();
  const { openAccountSelector } = useNavigationActions();
  const { status: rpcStatus } = useRpcMeasureStatus(network?.id ?? '');
  const intl = useIntl();
  const activeOption = useMemo(
    () => ({
      label:
        account?.name || intl.formatMessage({ id: 'empty__no_account_title' }),
      value: network?.id,
      tokenProps: {
        token: {
          logoURI: network?.logoURI,
          name: network?.shortName,
        },
      },
      badge: network?.impl === 'evm' ? 'EVM' : undefined,
    }),
    [
      account?.name,
      intl,
      network?.id,
      network?.impl,
      network?.logoURI,
      network?.shortName,
    ],
  );

  if (!wallet) {
    return null;
  }

  return (
    <>
      <Pressable
        onPress={() => {
          openAccountSelector({ mode });
        }}
      >
        {(status) => {
          let bgColor: string | undefined;
          bgColor = type === 'basic' ? 'action-secondary-default' : undefined;
          if (status.isPressed) {
            bgColor =
              type === 'basic' ? 'action-secondary-pressed' : 'surface-hovered';
          }
          if (status.isHovered) {
            bgColor =
              type === 'basic' ? 'action-secondary-hovered' : 'surface-hovered';
          }
          if (status.isFocused) {
            bgColor = 'surface-selected';
          }
          return (
            <HStack
              alignItems="center"
              p={1.5}
              pr={2.5}
              space={1}
              bg={bgColor}
              borderRadius="full"
              borderWidth={type === 'basic' ? StyleSheet.hairlineWidth : 0}
              borderColor="border-default"
            >
              <HStack space={size === 'sm' ? 2 : 3} alignItems="center">
                <Box position="relative">
                  <Token
                    size={size === 'sm' ? 5 : 7}
                    {...activeOption.tokenProps}
                  />
                  {rpcStatus && (
                    <Speedindicator
                      position="absolute"
                      top={size === 'sm' ? '-4px' : '-2px'}
                      right={size === 'sm' ? '-4px' : '-2px'}
                      size="10px"
                      backgroundColor={rpcStatus?.color}
                    />
                  )}
                </Box>
                <Typography.Body2Strong isTruncated maxW="120px">
                  {activeOption.label}
                </Typography.Body2Strong>
              </HStack>
              {type === 'plain' ? (
                <Icon size={20} name="ChevronDownSolid" />
              ) : null}
            </HStack>
          );
        }}
      </Pressable>
    </>
  );
};

NetworkAccountSelectorTrigger.defaultProps = defaultProps;

export { NetworkAccountSelectorTrigger };
