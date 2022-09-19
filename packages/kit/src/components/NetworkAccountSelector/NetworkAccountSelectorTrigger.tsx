import React, { useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  HStack,
  Icon,
  Pressable,
  Token,
  Typography,
  useIsVerticalLayout,
  useUserDevice,
} from '@onekeyhq/components';

import { useActiveWalletAccount, useNavigationActions } from '../../hooks';

function NetworkAccountSelectorTrigger() {
  const isVerticalLayout = useIsVerticalLayout();
  const { screenWidth } = useUserDevice();
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
        if (status.isPressed) {
          bgColor = 'surface-pressed';
        }
        if (status.isHovered) {
          bgColor = 'surface-hovered';
        }
        if (status.isFocused) {
          bgColor = 'surface-selected';
        }
        return (
          <HStack
            p={2}
            space={1}
            bg={bgColor}
            borderRadius="xl"
            alignItems="center"
            justifyContent={isVerticalLayout ? 'flex-end' : 'space-between'}
          >
            <HStack space={3} alignItems="center">
              <Token size={6} {...activeOption.tokenProps} />
              <Typography.Body2Strong
                isTruncated
                numberOfLines={1}
                maxW={screenWidth / 2 - 72}
              >
                {activeOption.label}
              </Typography.Body2Strong>
            </HStack>
            <Icon size={20} name="ChevronDownSolid" />
          </HStack>
        );
      }}
    </Pressable>
  );
}

export { NetworkAccountSelectorTrigger };
