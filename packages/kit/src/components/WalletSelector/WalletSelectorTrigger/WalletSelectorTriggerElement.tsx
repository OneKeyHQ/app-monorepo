import React, { FC, useEffect, useMemo, useState } from 'react';

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
                <WalletAvatar
                  walletImage={wallet.type}
                  hwWalletType={hwWalletType}
                  avatar={wallet.avatar}
                  isPassphrase={isPassphrase}
                  size="sm"
                  status={hasWalletState ? walletState : undefined}
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
                  maxWidth={isVerticalLayout ? '106px' : '144px'}
                >
                  {name}
                </Typography.Body2Strong>
                <Box ml={!isVerticalLayout ? 'auto' : undefined}>
                  <Icon size={20} name="SelectorSolid" />
                </Box>
              </>
            </Hidden>
          </Box>
        )}
      </Pressable>
    </>
  );
};
