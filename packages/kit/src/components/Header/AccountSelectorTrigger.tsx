import React, { FC } from 'react';

import { useIntl } from 'react-intl';

import {
  Account,
  Box,
  Button,
  HStack,
  Icon,
  Pressable,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import type { SimpleAccount } from '@onekeyhq/engine/src/types/account';
import { useActiveWalletAccount } from '@onekeyhq/kit/src/hooks/redux';

type Props = {
  visible: boolean;
  handleToggleVisible: () => void;
};

const AccountSelectorTrigger: FC<Props> = ({
  visible,
  handleToggleVisible,
}) => {
  const intl = useIntl();
  const isVerticalLayout = useIsVerticalLayout();
  const { account, wallet } = useActiveWalletAccount();

  if (!wallet) {
    return (
      <Button onPress={handleToggleVisible}>
        {intl.formatMessage({ id: 'action__create_wallet' })}
      </Button>
    );
  }

  if (!account) {
    return (
      <Button onPress={handleToggleVisible}>
        {intl.formatMessage({ id: 'action__create_account' })}
      </Button>
    );
  }

  const { address, name } = account as SimpleAccount;
  return (
    <Pressable onPress={handleToggleVisible} w="full">
      {({ isHovered }) => (
        <HStack
          p="2"
          alignItems="center"
          borderRadius="12px"
          bg={
            // eslint-disable-next-line no-nested-ternary
            visible && !isVerticalLayout
              ? 'surface-selected'
              : isHovered
              ? 'surface-hovered'
              : 'transparent'
          }
        >
          <Box flex={1} minW="144px">
            <Account
              address={address}
              name={isVerticalLayout ? undefined : name}
            />
          </Box>
          <Icon size={20} name="SelectorSolid" />
        </HStack>
      )}
    </Pressable>
  );
};

export default AccountSelectorTrigger;
