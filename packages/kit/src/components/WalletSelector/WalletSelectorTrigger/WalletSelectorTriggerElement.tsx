import React, { FC, useEffect, useMemo, useState } from 'react';

import { useNavigation } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Icon,
  Pressable,
  Spinner,
  Typography,
  useIsVerticalLayout,
  useUserDevice,
} from '@onekeyhq/components';
import { isPassphraseWallet } from '@onekeyhq/engine/src/engineUtils';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { IOneKeyDeviceType } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import {
  useActiveWalletAccount,
  useAppSelector,
  useSettings,
} from '../../../hooks/redux';
import { useWalletName } from '../../../hooks/useWalletName';
import { RootRoutes } from '../../../routes/routesEnum';
import { ModalScreenProps } from '../../../routes/types';
import { getDeviceTypeByDeviceId } from '../../../utils/hardware';
import ExternalAccountImg from '../../WalletConnect/ExternalAccountImg';
import WalletAvatar from '../WalletAvatar';

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
  const { engine } = backgroundApiProxy;
  const { deviceUpdates } = useSettings();
  const { connected } = useAppSelector((s) => s.hardware);
  const isVerticalLayout = useIsVerticalLayout();
  const { account, wallet } = useActiveWalletAccount();
  const { screenWidth } = useUserDevice();
  const navigation = useNavigation<NavigationProps['navigation']>();
  const [hasWalletState, setHasWalletState] = useState(false);
  const [walletState, setWalletState] = useState<string>();
  const [isPassphrase, setIsPassphrase] = useState<boolean>(false);
  const { isLoading } = useAppSelector((s) => s.accountSelector);
  const maxItemWidth = screenWidth / 2 - (platformEnv.isNative ? 72 : 0);
  const walletName = useWalletName({ wallet });

  const hwWalletType = useMemo(() => {
    let deviceType = wallet?.deviceType as IOneKeyDeviceType;
    if (!deviceType) {
      deviceType = getDeviceTypeByDeviceId(wallet?.associatedDevice);
    }
    return deviceType;
  }, [wallet?.associatedDevice, wallet?.deviceType]);

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

  // const { name } = account;
  const name = walletName || 'Wallet';
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
                hwWalletType={hwWalletType}
                avatar={wallet.avatar}
                isPassphrase={isPassphrase}
                size="sm"
                mr={3}
                status={hasWalletState ? walletState : undefined}
              />
              {showExternalImg && account ? (
                <Box position="absolute" right="4px" bottom="-6px">
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
            <Typography.Body2Strong
              isTruncated
              numberOfLines={1}
              mr={1}
              maxWidth={isVerticalLayout ? '106px' : '144px'}
            >
              {name}
            </Typography.Body2Strong>
            <Box ml={!isVerticalLayout ? 'auto' : undefined}>
              {isLoading ? (
                <Spinner size="sm" />
              ) : (
                <Icon size={20} name="ChevronDownSolid" />
              )}
            </Box>
          </Box>
        )}
      </Pressable>
    </>
  );
};
