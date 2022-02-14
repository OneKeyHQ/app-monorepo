import React, { FC } from 'react';

import { useIntl } from 'react-intl';

import {
  Account,
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
    <Pressable onPress={handleToggleVisible}>
      {({ isHovered }) => (
        <HStack
          p="2"
          alignItems="center"
          justifyContent="space-between"
          borderRadius="12px"
          space={1}
          bg={
            // eslint-disable-next-line no-nested-ternary
            visible && !isVerticalLayout
              ? 'surface-selected'
              : isHovered
              ? 'surface-hovered'
              : 'transparent'
          }
        >
          <Account
            address={address}
            name={isVerticalLayout ? undefined : name}
          />
          <Icon size={20} name="SelectorSolid" />
        </HStack>
      )}
    </Pressable>
  );
};

export default AccountSelectorTrigger;
