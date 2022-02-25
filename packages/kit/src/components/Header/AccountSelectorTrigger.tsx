import React, { FC } from 'react';

import { useNavigation } from '@react-navigation/core';
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
import {
  CreateWalletModalRoutes,
  CreateWalletRoutesParams,
} from '@onekeyhq/kit/src/routes';
import {
  ModalRoutes,
  ModalScreenProps,
  RootRoutes,
} from '@onekeyhq/kit/src/routes/types';

type NavigationProps = ModalScreenProps<CreateWalletRoutesParams>;
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
  const navigation = useNavigation<NavigationProps['navigation']>();
  if (!wallet) {
    return (
      <Button
        onPress={() => {
          navigation.navigate(RootRoutes.Modal, {
            screen: ModalRoutes.CreateWallet,
            params: {
              screen: CreateWalletModalRoutes.CreateWalletModal,
            },
          });
        }}
      >
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
