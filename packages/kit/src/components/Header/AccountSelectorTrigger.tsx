import React, { FC } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  HStack,
  Icon,
  Pressable,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';
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

import WalletAvatar from './WalletAvatar';

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
        {intl.formatMessage({ id: 'empty__no_account_title' })}
      </Button>
    );
  }

  const { name } = account;
  return (
    <Pressable onPress={handleToggleVisible} w="full" justifyContent="center">
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
          <Box
            flex={1}
            minW="144px"
            flexDirection="row"
            alignItems="center"
            maxW="50%"
          >
            <WalletAvatar size="sm" mr={3} />
            <Typography.Body2Strong isTruncated numberOfLines={1}>
              {name}
            </Typography.Body2Strong>
            <Icon size={20} name="SelectorSolid" />
          </Box>
        </HStack>
      )}
    </Pressable>
  );
};

export default AccountSelectorTrigger;
