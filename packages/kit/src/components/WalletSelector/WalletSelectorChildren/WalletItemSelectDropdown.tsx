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
  ToastManager,
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
import type { RootNavContainerRef } from '@onekeyhq/kit/src/provider/NavigationProvider';
import { BackupWalletModalRoutes } from '@onekeyhq/kit/src/routes/Modal/BackupWallet';
import { OnekeyHardwareModalRoutes } from '@onekeyhq/kit/src/routes/Modal/HardwareOnekey';
import { HardwareUpdateModalRoutes } from '@onekeyhq/kit/src/routes/Modal/HardwareUpdate';
import { ManagerWalletModalRoutes } from '@onekeyhq/kit/src/routes/Modal/ManagerWallet';
import { ModalRoutes, RootRoutes } from '@onekeyhq/kit/src/routes/routesEnum';
import {
  forgetPassphraseWallet,
  rememberPassphraseWallet,
} from '@onekeyhq/kit/src/store/reducers/settings';
import { deviceUtils } from '@onekeyhq/kit/src/utils/hardware';
import { getHomescreenKeys } from '@onekeyhq/kit/src/utils/hardware/constants/homescreens';
import { showOverlay } from '@onekeyhq/kit/src/utils/overlayUtils';
import showDeviceAdvancedSettings from '@onekeyhq/kit/src/views/Hardware/Onekey/DeviceAdvancedSettingsBottomSheetModal';
import HardwareLoadingDialog from '@onekeyhq/kit/src/views/Hardware/Onekey/OnekeyHardwareConnectDialog';
import ManagerWalletDeleteDialog from '@onekeyhq/kit/src/views/ManagerWallet/DeleteWallet';
import type { DeleteWalletProp } from '@onekeyhq/kit/src/views/ManagerWallet/DeleteWallet';

import { useHardwareWalletInfo } from '../WalletAvatar';

import type { TypeHardwareWalletInfo } from '../WalletAvatar';

function HardwarePassphraseMenuOptions({
  navigation,
  wallet,
  hwInfo,
  onDeleteWallet,
}: {
  navigation: RootNavContainerRef;
  wallet: IWallet;
  hwInfo: TypeHardwareWalletInfo | undefined;
  onDeleteWallet: (params?: DeleteWalletProp['hardware']) => void;
}) {
  const intl = useIntl();
  const { dispatch } = backgroundApiProxy;
  const rememberPassphraseWallets = useAppSelector(
    (s) => s.settings?.hardware?.rememberPassphraseWallets,
  );
  const isRememberPassphrase = useMemo(
    () => rememberPassphraseWallets?.includes(wallet.id),
    [rememberPassphraseWallets, wallet.id],
  );

  const onClickRememberPassphrase = useCallback(
    (e) => {
      if (isRememberPassphrase) {
        dispatch(forgetPassphraseWallet(wallet?.id));
      } else {
        dispatch(rememberPassphraseWallet(wallet?.id));
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      e?.preventDefault?.();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      e?.stopPropagation?.();
    },
    [dispatch, isRememberPassphrase, wallet?.id],
  );

  return (
    <>
      <Menu.CustomItem
        onPress={() => {
          navigation.navigate(RootRoutes.Modal, {
            screen: ModalRoutes.OnekeyHardware,
            params: {
              screen: OnekeyHardwareModalRoutes.OnekeyDeviceWalletNameModal,
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
      <Menu.CustomItem
        onPress={onClickRememberPassphrase}
        extraChildren={
          <Box>
            <CheckBox
              containerStyle={{ mr: '0' }}
              isChecked={isRememberPassphrase}
              onChange={onClickRememberPassphrase}
            />
          </Box>
        }
      >
        {intl.formatMessage({ id: 'msg__use_passphrase_remember_wallet' })}
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

function HardwareMenuOptions({
  navigation,
  wallet,
  devicesStatus,
  onDeleteWallet,
}: {
  navigation: RootNavContainerRef;
  wallet: IWallet;
  devicesStatus: IHardwareDeviceStatusMap | undefined;
  onDeleteWallet: (params?: DeleteWalletProp['hardware']) => void;
}) {
  const intl = useIntl();
  const hwInfo = useHardwareWalletInfo({
    devicesStatus,
    wallet,
  });
  const { engine, serviceHardware } = backgroundApiProxy;

  const [showHomeScreenSetting, setShowHomeScreenSetting] = useState(false);
  const [deviceConnectId, setDeviceConnectId] = useState<string | undefined>();

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

  const checkFirmwareUpdate = useCallback(() => {
    if (!deviceConnectId) return;

    showOverlay((onCloseOverlay) => (
      <HardwareLoadingDialog
        onClose={onCloseOverlay}
        onHandler={() =>
          serviceHardware
            .checkFirmwareUpdate(deviceConnectId)
            .then((firmware) => {
              if (firmware) {
                navigation.navigate(RootRoutes.Modal, {
                  screen: ModalRoutes.HardwareUpdate,
                  params: {
                    screen: HardwareUpdateModalRoutes.HardwareUpdateInfoModel,
                    params: {
                      walletId: wallet?.id ?? '',
                    },
                  },
                });
              } else {
                ToastManager.show(
                  {
                    title: intl.formatMessage({
                      id: 'msg__the_current_version_is_the_latest',
                    }),
                  },
                  { type: 'success' },
                );
              }
            })
            .catch((e) => {
              setTimeout(() => {
                deviceUtils.showErrorToast(e);
              }, 500);
            })
        }
      />
    ));
  }, [deviceConnectId, intl, navigation, serviceHardware, wallet?.id]);

  useEffect(() => {
    (async () => {
      try {
        const device = await engine.getHWDeviceByWalletId(wallet.id);
        setDeviceConnectId(device?.mac);
        await getModifyHomeScreenConfig(device?.mac);
      } catch (err: any) {
        if (navigation?.canGoBack?.()) {
          navigation.goBack();
        }
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

  if (hwInfo?.isPassphrase) {
    return (
      <HardwarePassphraseMenuOptions
        navigation={navigation}
        wallet={wallet}
        hwInfo={hwInfo}
        onDeleteWallet={onDeleteWallet}
      />
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
                screen: OnekeyHardwareModalRoutes.OnekeyHardwareHomeScreenModal,
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
      <Divider my="4px" />
      {hwInfo?.hasUpgrade ? (
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
      ) : (
        <Menu.CustomItem
          icon="MagnifyingGlassMini"
          onPress={checkFirmwareUpdate}
        >
          {intl.formatMessage({ id: 'form__check_for_updates' })}
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
}

function WalletItemSelectDropdown({
  wallet,
  devicesStatus,
}: {
  wallet: IWallet;
  devicesStatus: IHardwareDeviceStatusMap | undefined;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { showVerify } = useLocalAuthenticationModal();

  const [showBackupDialog, setShowBackupDialog] = useState(false);

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

  const isHardwareWallet = wallet?.type === WALLET_TYPE_HW;
  const isSoftwareWallet = wallet?.type !== WALLET_TYPE_HW;

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

    return (
      <HardwareMenuOptions
        navigation={navigation}
        wallet={wallet}
        devicesStatus={devicesStatus}
        onDeleteWallet={onDeleteWallet}
      />
    );
  }, [devicesStatus, isHardwareWallet, navigation, onDeleteWallet, wallet]);

  const menuView = useMemo(
    () => (
      <Menu
        placement="bottom right"
        width={224}
        // eslint-disable-next-line react/no-unstable-nested-components
        trigger={(triggerProps) => {
          const { onPress } = triggerProps;
          return (
            <Box {...triggerProps}>
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
    [softwareMenuOptions, hardwareMenuOptions],
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
