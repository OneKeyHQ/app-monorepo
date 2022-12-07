import React, { FC } from 'react';

import { useNavigation } from '@react-navigation/native';
import { useIntl } from 'react-intl';
import { Rect } from 'react-native-svg';

import {
  Box,
  Button,
  Hidden,
  Icon,
  Pressable,
  Skeleton,
  Typography,
  useIsVerticalLayout,
  useUserDevice,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useActiveWalletAccount, useAppSelector } from '../../../hooks/redux';
import { useWalletName } from '../../../hooks/useWalletName';
import { RootRoutes } from '../../../routes/routesEnum';
import { ModalScreenProps } from '../../../routes/types';
import ExternalAccountImg from '../../../views/ExternalAccount/components/ExternalAccountImg';
import { useDeviceStatusOfHardwareWallet } from '../../NetworkAccountSelector/hooks/useDeviceStatusOfHardwareWallet';
import { WalletAvatarPro } from '../WalletAvatar';

import type { CreateWalletRoutesParams } from '../../../routes';

type NavigationProps = ModalScreenProps<CreateWalletRoutesParams>;
type Props = {
  visible: boolean;
  handleToggleVisible: () => void;
};

export const WalletSelectorTriggerElement: FC<Props> = ({
  visible,
  handleToggleVisible,
}) => {
  const intl = useIntl();
  const isVerticalLayout = useIsVerticalLayout();
  const { account, wallet } = useActiveWalletAccount();
  const { screenWidth } = useUserDevice();
  const navigation = useNavigation<NavigationProps['navigation']>();
  const isLoading = useAppSelector((s) => s.accountSelector.isLoading);
  const maxItemWidth = screenWidth / 2 - (platformEnv.isNative ? 72 : 0);
  const walletName = useWalletName({ wallet });
  const { deviceStatus } = useDeviceStatusOfHardwareWallet();

  if (!wallet) {
    return (
      <Button
        onPress={() => {
          navigation.navigate(RootRoutes.Onboarding);
        }}
      >
        {intl.formatMessage({ id: 'action__create_wallet' })}
      </Button>
    );
  }

  // const { name } = account;
  const name = walletName || 'Wallet';
  // ** Android will crash after account switch
  const showExternalImg = !platformEnv.isNativeAndroid;
  // const showExternalImg = true;
  return (
    <>
      <Pressable onPress={handleToggleVisible} justifyContent="center">
        {({ isHovered }) => (
          <Box
            flexDirection="row"
            alignItems="center"
            p={1}
            pr={{ base: 1, md: 2 }}
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
            <Box>
              {isLoading ? (
                <Box size={8}>
                  <Skeleton size={32}>
                    <Rect x="0" y="0" width="32" height="32" rx="12" ry="12" />
                  </Skeleton>
                </Box>
              ) : (
                <WalletAvatarPro
                  wallet={wallet}
                  deviceStatus={deviceStatus}
                  size="sm"
                />
              )}
              {showExternalImg && account ? (
                <Box position="absolute" right="-6px" bottom="-6px">
                  <ExternalAccountImg
                    size={4}
                    radius="12px"
                    accountId={account?.id}
                    account={account}
                    borderWidth={2}
                    borderColor="background-default"
                  />
                </Box>
              ) : null}
            </Box>
            <Hidden from="base" till="md">
              <>
                <Typography.Body2Strong
                  isTruncated
                  numberOfLines={1}
                  ml={3}
                  mr={1}
                  maxWidth="106px"
                >
                  {name}
                </Typography.Body2Strong>
                <Box ml={!isVerticalLayout ? 'auto' : undefined}>
                  <Icon
                    size={20}
                    name="ChevronUpDownMini"
                    color="icon-subdued"
                  />
                </Box>
              </>
            </Hidden>
          </Box>
        )}
      </Pressable>
    </>
  );
};
