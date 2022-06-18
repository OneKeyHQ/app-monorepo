import React, { FC } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Icon,
  Pressable,
  Typography,
  useIsVerticalLayout,
  useUserDevice,
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
import { getDeviceTypeByDeviceId } from '@onekeyhq/kit/src/utils/hardware';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

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
  const { screenWidth } = useUserDevice();
  const navigation = useNavigation<NavigationProps['navigation']>();

  const maxItemWidth = screenWidth / 2 - (platformEnv.isNative ? 72 : 0);

  if (!wallet) {
    return (
      <Button
        onPress={() => {
          navigation.navigate(RootRoutes.Modal, {
            screen: ModalRoutes.CreateWallet,
            params: {
              screen: CreateWalletModalRoutes.GuideModal,
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

  const { name } = account;
  return (
    <Pressable onPress={handleToggleVisible} w="full" justifyContent="center">
      {({ isHovered }) => (
        <Box
          flexDirection="row"
          alignItems="center"
          w="full"
          p={1}
          pr={2}
          borderRadius="12px"
          maxW={`${maxItemWidth}px`}
          bg={
            // eslint-disable-next-line no-nested-ternary
            visible && !isVerticalLayout
              ? 'surface-selected'
              : isHovered
              ? 'surface-hovered'
              : 'transparent'
          }
        >
          <WalletAvatar
            walletImage={wallet.type}
            hwWalletType={getDeviceTypeByDeviceId(wallet.associatedDevice)}
            avatar={wallet.avatar}
            size="sm"
            mr={3}
          />
          <Typography.Body2Strong isTruncated numberOfLines={1} mr={1}>
            {name}
          </Typography.Body2Strong>
          <Box ml={!isVerticalLayout ? 'auto' : undefined}>
            <Icon size={20} name="ChevronDownSolid" />
          </Box>
        </Box>
      )}
    </Pressable>
  );
};

export default AccountSelectorTrigger;
