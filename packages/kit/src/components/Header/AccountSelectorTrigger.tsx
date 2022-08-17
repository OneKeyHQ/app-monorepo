import React, { FC, memo, useEffect, useState } from 'react';

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
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  useActiveWalletAccount,
  useAppSelector,
  useSettings,
} from '@onekeyhq/kit/src/hooks/redux';
import { CreateWalletRoutesParams } from '@onekeyhq/kit/src/routes';
import { ModalScreenProps, RootRoutes } from '@onekeyhq/kit/src/routes/types';
import { getDeviceTypeByDeviceId } from '@onekeyhq/kit/src/utils/hardware';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { IOneKeyDeviceType } from '@onekeyhq/shared/types';

import { ExternalAccountImg } from '../WalletConnect/ExternalAccountImg';

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
  const { engine } = backgroundApiProxy;
  const { deviceUpdates } = useSettings();
  const { connected } = useAppSelector((s) => s.hardware);
  const isVerticalLayout = useIsVerticalLayout();
  const { account, wallet } = useActiveWalletAccount();
  const { screenWidth } = useUserDevice();
  const navigation = useNavigation<NavigationProps['navigation']>();
  const [hasNotification, setHasNotification] = useState(false);
  const [notificationColor, setNotificationColor] = useState<string>();

  const maxItemWidth = screenWidth / 2 - (platformEnv.isNative ? 72 : 0);

  useEffect(() => {
    if (wallet?.type === 'hw' && deviceUpdates) {
      engine.getHWDeviceByWalletId(wallet.id).then((device) => {
        if (!device) return;
        const { ble, firmware } = deviceUpdates[device.mac] || {};
        const hasConnected = connected.includes(device.mac);
        setHasNotification(!!ble || !!firmware || !!hasConnected);
        if (hasConnected) {
          setNotificationColor('icon-success');
        } else if (ble || firmware) {
          setNotificationColor('icon-warning');
        }
      });
    }
  }, [connected, deviceUpdates, engine, wallet]);

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
          <Box>
            <WalletAvatar
              walletImage={wallet.type}
              hwWalletType={
                (wallet.deviceType as IOneKeyDeviceType) ||
                getDeviceTypeByDeviceId(wallet.associatedDevice)
              }
              avatar={wallet.avatar}
              size="sm"
              mr={3}
            />
            <Box position="absolute" right="4px" bottom="-6px">
              <ExternalAccountImg
                key={account.id}
                size={4}
                radius="12px"
                accountId={account.id}
                borderWidth={2}
                borderColor="background-default"
              />
            </Box>
            {!!hasNotification && (
              <Box
                position="absolute"
                top={0}
                right={3}
                size={2}
                bgColor={notificationColor}
                borderWidth={1}
                borderColor="surface-subdued"
                rounded="full"
              />
            )}
          </Box>
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

export default memo(AccountSelectorTrigger);
