// TODO packages/kit/src/components/Header/AccountSelectorChildren/RightHeader.tsx
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  CheckBox,
  Dialog,
  Divider,
  Icon,
  IconButton,
  Menu,
} from '@onekeyhq/components';
import type { OnCloseCallback } from '@onekeyhq/components/src/Dialog/components/FooterButton';
import type { IWallet } from '@onekeyhq/engine/src/types';
import { WALLET_TYPE_HW } from '@onekeyhq/engine/src/types/wallet';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IHardwareDeviceStatusMap } from '@onekeyhq/kit/src/components/NetworkAccountSelector/hooks/useDeviceStatusOfHardwareWallet';
import { ValidationFields } from '@onekeyhq/kit/src/components/Protected';
import { useAppSelector } from '@onekeyhq/kit/src/hooks';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import useLocalAuthenticationModal from '@onekeyhq/kit/src/hooks/useLocalAuthenticationModal';
import { BackupWalletModalRoutes } from '@onekeyhq/kit/src/routes/Modal/BackupWallet';
import { OnekeyHardwareModalRoutes } from '@onekeyhq/kit/src/routes/Modal/HardwareOnekey';
import { HardwareUpdateModalRoutes } from '@onekeyhq/kit/src/routes/Modal/HardwareUpdate';
import { ManagerWalletModalRoutes } from '@onekeyhq/kit/src/routes/Modal/ManagerWallet';
import { ModalRoutes, RootRoutes } from '@onekeyhq/kit/src/routes/routesEnum';
import { deviceUtils } from '@onekeyhq/kit/src/utils/hardware';
import { getHomescreenKeys } from '@onekeyhq/kit/src/utils/hardware/constants/homescreens';
import { showOverlay } from '@onekeyhq/kit/src/utils/overlayUtils';
import showDeviceAdvancedSettings from '@onekeyhq/kit/src/views/Hardware/Onekey/DeviceAdvancedSettingsBottomSheetModal';
import ManagerWalletDeleteDialog from '@onekeyhq/kit/src/views/ManagerWallet/DeleteWallet';
import type { DeleteWalletProp } from '@onekeyhq/kit/src/views/ManagerWallet/DeleteWallet';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { WalletStatus, useHardwareWalletInfo } from '../WalletAvatar';

function WalletItemSelectDropdown({
  wallet,
  deviceStatus,
}: {
  wallet: IWallet;
  deviceStatus: IHardwareDeviceStatusMap | undefined;
}) {
  const navigation = useAppNavigation();
  const { showVerify } = useLocalAuthenticationModal();

  const [showBackupDialog, setShowBackupDialog] = useState(false);
  const [showHomeScreenSetting, setShowHomeScreenSetting] = useState(false);
  const [deviceConnectId, setDeviceConnectId] = useState('');
  const hwInfo = useHardwareWalletInfo({
    deviceStatus,
    wallet,
  });

  const showDeleteWalletDialog = useCallback(
    (walletProps: DeleteWalletProp) => {
      showOverlay((onClose) => (
        <ManagerWalletDeleteDialog
          deleteWallet={walletProps}
          closeOverlay={onClose}
        />
      ));
    },
    [],
  );

  const onDeleteWallet = useCallback(
    (params?: DeleteWalletProp['hardware']) => {
      if (wallet?.type === 'hw') {
        setTimeout(
          () =>
            showDeleteWalletDialog({
              walletId: wallet?.id ?? '',
              password: undefined, // hardware wallet doesn't need password
              hardware: params,
            }),
          500,
        );
        return;
      }

      if (wallet?.backuped === true) {
        showVerify(
          (pwd) => {
            setTimeout(
              () =>
                showDeleteWalletDialog({
                  walletId: wallet?.id ?? '',
                  password: pwd,
                }),
              500,
            );
          },
          () => {},
          null,
          ValidationFields.Wallet,
        );
      } else {
        setShowBackupDialog(true);
      }
    },
    [
      wallet?.type,
      wallet?.backuped,
      wallet?.id,
      showDeleteWalletDialog,
      showVerify,
    ],
  );

  const intl = useIntl();
  const { engine, serviceHardware } = backgroundApiProxy;
  const deviceVerification = useAppSelector((s) => s.hardware.verification);

  const isHardwareWallet = wallet?.type === WALLET_TYPE_HW;
  const isSoftwareWallet = wallet?.type !== WALLET_TYPE_HW;

  const hasAvailableUpdate = hwInfo?.hasUpgrade;

  const navigateToBackupModal = useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.BackupWallet,
      params: {
        screen: BackupWalletModalRoutes.BackupWalletOptionsModal,
        params: {
          walletId: wallet?.id ?? '',
        },
      },
    });
  }, [navigation, wallet?.id]);

  const getModifyHomeScreenConfig = useCallback(
    async (connectId?: string) => {
      if (!connectId || !hwInfo.hwWalletType) return;
      const hasHomeScreen = getHomescreenKeys(hwInfo.hwWalletType).length > 0;
      if (hwInfo.hwWalletType === 'mini' || hwInfo.hwWalletType === 'classic') {
        setShowHomeScreenSetting(hasHomeScreen);
        return;
      }
      const res = await serviceHardware.getDeviceSupportFeatures(connectId);
      setShowHomeScreenSetting(!!res.modifyHomescreen.support && hasHomeScreen);
    },
    [serviceHardware, hwInfo.hwWalletType],
  );

  useEffect(() => {
    (async () => {
      try {
        const device = await engine.getHWDeviceByWalletId(wallet.id);
        setDeviceConnectId(device?.mac ?? '');
        await getModifyHomeScreenConfig(device?.mac);
      } catch (err: any) {
        if (navigation?.canGoBack?.()) {
          navigation.goBack();
        }

        deviceUtils.showErrorToast(err, 'action__connection_timeout');
      }
    })();
  }, [
    engine,
    intl,
    navigation,
    serviceHardware,
    getModifyHomeScreenConfig,
    wallet.id,
  ]);

  const deviceVerifiedStatus = useMemo(() => {
    if (!isHardwareWallet) return undefined;
    return deviceVerification?.[deviceConnectId];
  }, [deviceConnectId, deviceVerification, isHardwareWallet]);

  const softwareMenuOptions = useMemo(() => {
    if (!isSoftwareWallet) return null;
    return (
      <>
        <Menu.CustomItem
          onPress={() => {
            navigation.navigate(RootRoutes.Modal, {
              screen: ModalRoutes.ManagerWallet,
              params: {
                screen: ManagerWalletModalRoutes.ManagerWalletModifyNameModal,
                params: {
                  walletId: wallet?.id ?? '',
                },
              },
            });
          }}
          icon="PencilMini"
        >
          {intl.formatMessage({ id: 'action__edit' })}
        </Menu.CustomItem>
        <Menu.CustomItem onPress={navigateToBackupModal} icon="ShieldCheckMini">
          {intl.formatMessage({ id: 'action__backup' })}
        </Menu.CustomItem>
        <Divider my="4px" />
        <Menu.CustomItem
          onPress={() => {
            onDeleteWallet();
          }}
          variant="desctructive"
          icon="TrashMini"
        >
          {intl.formatMessage({ id: 'action__delete_wallet' })}
        </Menu.CustomItem>
      </>
    );
  }, [
    intl,
    isSoftwareWallet,
    navigateToBackupModal,
    navigation,
    onDeleteWallet,
    wallet?.id,
  ]);

  const hardwareMenuOptions = useMemo(() => {
    if (!isHardwareWallet) return null;

    if (hwInfo.isPassphrase) {
      return (
        <>
          <Menu.CustomItem
            onPress={() => {
              showDeviceAdvancedSettings({
                walletId: wallet?.id ?? '',
                deviceType: hwInfo?.hwWalletType,
              });
            }}
            extraChildren={<CheckBox />}
          >
            {intl.formatMessage({ id: 'content__passphrase_pin_wallet' })}
          </Menu.CustomItem>
          <Divider my="4px" />
          <Menu.CustomItem
            onPress={() => {
              onDeleteWallet({
                isPassphrase: hwInfo?.isPassphrase ?? false,
              });
            }}
            variant="desctructive"
            icon="TrashMini"
          >
            {intl.formatMessage({ id: 'action__delete_wallet' })}
          </Menu.CustomItem>
        </>
      );
    }

    return (
      <>
        <Menu.CustomItem
          onPress={() => {
            navigation.navigate(RootRoutes.Modal, {
              screen: ModalRoutes.OnekeyHardware,
              params: {
                screen: OnekeyHardwareModalRoutes.OnekeyHardwareDeviceNameModal,
                params: {
                  walletId: wallet?.id ?? '',
                  deviceName: '',
                },
              },
            });
          }}
          icon="PencilMini"
        >
          {intl.formatMessage({ id: 'action__edit' })}
        </Menu.CustomItem>

        {!!showHomeScreenSetting && (
          <Menu.CustomItem
            onPress={() => {
              navigation.navigate(RootRoutes.Modal, {
                screen: ModalRoutes.OnekeyHardware,
                params: {
                  screen:
                    OnekeyHardwareModalRoutes.OnekeyHardwareHomeScreenModal,
                  params: {
                    walletId: wallet?.id ?? '',
                    deviceType: hwInfo?.hwWalletType ?? 'classic',
                  },
                },
              });
            }}
            icon="PhotoMini"
          >
            {intl.formatMessage({ id: 'modal__homescreen' })}
          </Menu.CustomItem>
        )}
        <Menu.CustomItem
          onPress={() => {
            navigation.navigate(RootRoutes.Modal, {
              screen: ModalRoutes.OnekeyHardware,
              params: {
                screen: OnekeyHardwareModalRoutes.OnekeyHardwareVerifyModal,
                params: {
                  walletId: wallet?.id ?? '',
                },
              },
            });
          }}
          icon={!deviceVerifiedStatus ? 'MagnifyingGlassCircleMini' : undefined}
          extraChildren={
            !!deviceVerifiedStatus && (
              <Icon
                name="CheckBadgeMini"
                color="interactive-default"
                size={20}
              />
            )
          }
        >
          {intl.formatMessage({ id: 'action__verify' })}
        </Menu.CustomItem>
        <Menu.CustomItem
          onPress={() => {
            navigation.navigate(RootRoutes.Modal, {
              screen: ModalRoutes.OnekeyHardware,
              params: {
                screen: OnekeyHardwareModalRoutes.OnekeyHardwareDetailsModal,
                params: {
                  walletId: wallet?.id ?? '',
                },
              },
            });
          }}
          icon="InformationCircleMini"
        >
          {intl.formatMessage({ id: 'action__about_device' })}
        </Menu.CustomItem>
        <Menu.CustomItem
          onPress={() => {
            showDeviceAdvancedSettings({
              walletId: wallet?.id ?? '',
              deviceType: hwInfo?.hwWalletType,
            });
          }}
          icon="AdjustmentsHorizontalMini"
        >
          {intl.formatMessage({ id: 'content__advanced' })}
        </Menu.CustomItem>
        {!!hwInfo?.hasUpgrade && <Divider my="4px" />}
        {!!hwInfo?.hasUpgrade && (
          <Menu.CustomItem
            onPress={() => {
              navigation.navigate(RootRoutes.Modal, {
                screen: ModalRoutes.HardwareUpdate,
                params: {
                  screen: HardwareUpdateModalRoutes.HardwareUpdateInfoModel,
                  params: {
                    walletId: wallet?.id ?? '',
                  },
                },
              });
            }}
            variant="highlight"
            icon="ArrowUpTrayMini"
          >
            {intl.formatMessage({ id: 'action__update_available' })}
          </Menu.CustomItem>
        )}
        <Divider my="4px" />
        <Menu.CustomItem
          onPress={() => {
            onDeleteWallet({
              isPassphrase: hwInfo?.isPassphrase ?? false,
            });
          }}
          variant="desctructive"
          icon="TrashMini"
        >
          {intl.formatMessage({ id: 'action__delete_device' })}
        </Menu.CustomItem>
      </>
    );
  }, [
    deviceVerifiedStatus,
    hwInfo?.hasUpgrade,
    hwInfo?.hwWalletType,
    hwInfo.isPassphrase,
    intl,
    isHardwareWallet,
    navigation,
    onDeleteWallet,
    showHomeScreenSetting,
    wallet?.id,
  ]);

  const menuView = useMemo(
    () => (
      <Menu
        width={230}
        // eslint-disable-next-line react/no-unstable-nested-components
        trigger={(triggerProps) => {
          const { onPress } = triggerProps;
          return (
            <Box {...triggerProps}>
              {hasAvailableUpdate ? (
                <WalletStatus
                  size={platformEnv.isNative ? 'lg' : 'sm'}
                  status="warning"
                />
              ) : null}

              <IconButton
                name="EllipsisVerticalMini"
                circle
                type="plain"
                onPress={onPress}
                hitSlop={16}
                // TODO custom props
                // isTriggerHovered={isHovered}
                // isSelectVisible={visible}
                // isTriggerPressed={isPressed}
                // TODO hardware only
                // isNotification={hasAvailableUpdate}
                // notificationColor="icon-warning"
              />
            </Box>
          );
        }}
      >
        {softwareMenuOptions}
        {hardwareMenuOptions}
      </Menu>
    ),
    [softwareMenuOptions, hardwareMenuOptions, hasAvailableUpdate],
  );

  // TODO use redux to save memory
  const dialogViews = useMemo(
    () => (
      <Dialog
        visible={showBackupDialog}
        canceledOnTouchOutside={false}
        onClose={() => setShowBackupDialog(false)}
        contentProps={{
          icon: <Icon name="ShieldExclamationOutline" size={48} />,
          title: intl.formatMessage({
            id: 'dialog__backup_wallet_title',
          }),
          content: intl.formatMessage({
            id: 'dialog__backup_wallet_desc',
          }),
        }}
        footerButtonProps={{
          primaryActionProps: {
            children: intl.formatMessage({ id: 'action__backup' }),
          },
          onPrimaryActionPress: ({ onClose }: OnCloseCallback) => {
            onClose?.();
            setTimeout(() => {
              navigateToBackupModal();
            }, 500);
          },
        }}
      />
    ),
    [intl, navigateToBackupModal, showBackupDialog],
  );

  return (
    <>
      {menuView}
      {dialogViews}
    </>
  );
}

export { WalletItemSelectDropdown };
