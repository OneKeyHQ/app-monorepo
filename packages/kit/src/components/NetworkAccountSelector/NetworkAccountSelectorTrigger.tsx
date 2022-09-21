import React, { useMemo } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  HStack,
  Hidden,
  Icon,
  Pressable,
  Token,
  Typography,
} from '@onekeyhq/components';

import { useActiveWalletAccount, useNavigationActions } from '../../hooks';

function NetworkAccountSelectorTrigger() {
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
        bgColor = 'action-secondary-default';
        if (status.isPressed) {
          bgColor = 'action-secondary-pressed';
        }
        if (status.isHovered) {
          bgColor = 'action-secondary-hovered';
        }
        if (status.isFocused) {
          bgColor = 'surface-selected';
        }
        return (
          <HStack
            alignItems="center"
            p={1.5}
            space={1}
            bg={bgColor}
            borderRadius="full"
            borderWidth={StyleSheet.hairlineWidth}
            borderColor="border-default"
          >
            <HStack space={2} alignItems="center">
              <Token size={{ base: 5, md: 6 }} {...activeOption.tokenProps} />
              <Typography.Body2Strong isTruncated maxW="120px">
                {activeOption.label}
              </Typography.Body2Strong>
            </HStack>
            <Hidden from="base" till="md">
              <Icon size={20} name="ChevronDownSolid" />
            </Hidden>
          </HStack>
        );
      }}
    </Pressable>
  );
}

export { NetworkAccountSelectorTrigger };
