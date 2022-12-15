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
import { isPassphraseWallet } from '@onekeyhq/shared/src/engine/engineUtils';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { IOneKeyDeviceType } from '@onekeyhq/shared/types';

import ExternalAccountImg from '../../views/ExternalAccount/components/ExternalAccountImg';
import WalletAvatar from '../WalletSelector/WalletAvatar';

type NavigationProps = ModalScreenProps<CreateWalletRoutesParams>;
type Props = {
  visible: boolean;
  handleToggleVisible: () => void;
};
// const { updateDesktopWalletSelectorVisible } = reducerAccountSelector.actions;
const AccountSelectorTrigger: FC<Props> = ({
  visible,
  handleToggleVisible,
}) => {
  const intl = useIntl();
  const { engine } = backgroundApiProxy;
  const { deviceUpdates } = useSettings();
  const connected = useAppSelector((s) => s.hardware.connected);
  const isVerticalLayout = useIsVerticalLayout();
  const { account, wallet } = useActiveWalletAccount();
  const { screenWidth } = useUserDevice();
  const navigation = useNavigation<NavigationProps['navigation']>();
  const [hasWalletState, setHasWalletState] = useState(false);
  const [walletState, setWalletState] = useState<string>();
  const [isPassphrase, setIsPassphrase] = useState<boolean>(false);

  const maxItemWidth = screenWidth / 2 - (platformEnv.isNative ? 72 : 0);

  useEffect(() => {
    if (wallet) {
      setIsPassphrase(isPassphraseWallet(wallet));
    }
    if (wallet?.type === 'hw' && deviceUpdates) {
      engine.getHWDeviceByWalletId(wallet.id).then((device) => {
        if (!device) return;
        const { ble, firmware } = deviceUpdates[device.mac] || {};
        const hasConnected = connected.includes(device.mac);
        setHasWalletState(!!ble || !!firmware || !!hasConnected);
        if (ble || firmware) {
          setWalletState('warning');
        } else if (hasConnected) {
          setWalletState('connected');
        }
      });
    } else {
      setHasWalletState(false);
      setWalletState(undefined);
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

  // ** Android will crash after account switch
  const showExternalImg = !platformEnv.isNativeAndroid;
  // const showExternalImg = true;
  return (
    <>
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
                isPassphrase={isPassphrase}
                size="sm"
                mr={3}
                status={hasWalletState ? walletState : undefined}
              />
              {showExternalImg ? (
                <Box position="absolute" right="4px" bottom="-6px">
                  <ExternalAccountImg
                    size={4}
                    radius="12px"
                    accountId={account.id}
                    account={account}
                    borderWidth={2}
                    borderColor="background-default"
                  />
                </Box>
              ) : null}
            </Box>
            <Typography.Body2Strong
              isTruncated
              numberOfLines={1}
              mr={1}
              maxWidth={isVerticalLayout ? '106px' : '144px'}
            >
              {name}
            </Typography.Body2Strong>
            <Box ml={!isVerticalLayout ? 'auto' : undefined}>
              <Icon size={20} name="ChevronDownMini" />
            </Box>
          </Box>
        )}
      </Pressable>
    </>
  );
};

export default memo(AccountSelectorTrigger);
