import React, { FC, useMemo } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  HStack,
  Icon,
  Pressable,
  Token,
  Typography,
} from '@onekeyhq/components';

import { useActiveWalletAccount, useNavigationActions } from '../../hooks';

import { useAccountSelectorEffects } from './hooks/useAccountSelectorEffects';

type NetworkAccountSelectorTriggerProps = {
  size?: 'sm' | 'lg' | string;
  type?: 'basic' | 'plain';
};

const defaultProps = {
  size: 'sm',
  type: 'plain',
} as const;

const NetworkAccountSelectorTrigger: FC<NetworkAccountSelectorTriggerProps> = ({
  size,
  type,
}) => {
  useAccountSelectorEffects();
  // TODO different options of scene
  const { network, account } = useActiveWalletAccount();
  const { openAccountSelector } = useNavigationActions();
  const intl = useIntl();
  const activeOption = useMemo(
    () => ({
      label:
        account?.name || intl.formatMessage({ id: 'empty__no_account_title' }),
      value: network?.id,
      tokenProps: {
        src: network?.logoURI,
        letter: network?.shortName,
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

  return (
    <Pressable
      onPress={() => {
        openAccountSelector();
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
              <Token
                size={size === 'sm' ? 5 : 7}
                {...activeOption.tokenProps}
              />
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
  );
};

NetworkAccountSelectorTrigger.defaultProps = defaultProps;

export { NetworkAccountSelectorTrigger };
