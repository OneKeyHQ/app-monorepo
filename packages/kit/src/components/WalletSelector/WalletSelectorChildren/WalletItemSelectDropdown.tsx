// TODO packages/kit/src/components/Header/AccountSelectorChildren/RightHeader.tsx
import type { ComponentProps, FC } from 'react';
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
import {
  BackupWalletModalRoutes,
  HardwareUpdateModalRoutes,
  ManagerWalletModalRoutes,
  ModalRoutes,
  OnekeyHardwareModalRoutes,
  RootRoutes,
} from '@onekeyhq/kit/src/routes/routesEnum';
import {
  forgetPassphraseWallet,
  rememberPassphraseWallet,
} from '@onekeyhq/kit/src/store/reducers/settings';
import { deviceUtils } from '@onekeyhq/kit/src/utils/hardware';
import { getHomescreenKeys } from '@onekeyhq/kit/src/utils/hardware/constants/homescreens';
import { showDialog } from '@onekeyhq/kit/src/utils/overlayUtils';
import showDeviceAdvancedSettings from '@onekeyhq/kit/src/views/Hardware/Onekey/DeviceAdvancedSettingsBottomSheetModal';
import HardwareLoadingDialog from '@onekeyhq/kit/src/views/Hardware/Onekey/OnekeyHardwareConnectDialog';
import ManagerWalletDeleteDialog from '@onekeyhq/kit/src/views/ManagerWallet/DeleteWallet';
import type { DeleteWalletProp } from '@onekeyhq/kit/src/views/ManagerWallet/DeleteWallet';

import reducerAccountSelector from '../../../store/reducers/reducerAccountSelector';
import { defaultMenuOffset } from '../../../views/Overlay/BaseMenu';
import { useWalletSelectorStatus } from '../hooks/useWalletSelectorStatus';
import { useHardwareWalletInfo } from '../WalletAvatar';

import type { TypeHardwareWalletInfo } from '../WalletAvatar';

const WalletMenuItem: FC<ComponentProps<typeof Menu.CustomItem>> = ({
  onPress,
  ...rest
}) => (
  <Menu.CustomItem
    onPress={(e) => {
      const { dispatch } = backgroundApiProxy;
      dispatch(
        reducerAccountSelector.actions.updateDesktopWalletSelectorVisible(
          false,
        ),
      );
      onPress?.(e);
    }}
    {...rest}
  />
);

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
      <WalletMenuItem
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
      </WalletMenuItem>
      <WalletMenuItem
        onPress={onClickRememberPassphrase}
        extraChildren={
          <Box>
            <CheckBox
              containerStyle={{ mr: '0' }}
              isChecked={!isRememberPassphrase}
              onChange={onClickRememberPassphrase}
            />
          </Box>
        }
      >
        {intl.formatMessage({ id: 'action__remove_when_exit' })}
      </WalletMenuItem>
      <Divider my="4px" />
      <WalletMenuItem
        onPress={() => {
          onDeleteWallet({
            isPassphrase: hwInfo?.isPassphrase ?? false,
          });
        }}
        variant="desctructive"
        icon="TrashMini"
      >
        {intl.formatMessage({ id: 'action__delete_wallet' })}
      </WalletMenuItem>
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
      if (
        hwInfo.hwWalletType === 'mini' ||
        hwInfo.hwWalletType === 'classic' ||
        hwInfo.hwWalletType === 'classic1s'
      ) {
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

    showDialog(
      <HardwareLoadingDialog
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
      />,
    );
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
      <WalletMenuItem
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
      </WalletMenuItem>

      {!!showHomeScreenSetting && (
        <WalletMenuItem
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
        </WalletMenuItem>
      )}
      <WalletMenuItem
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
      </WalletMenuItem>
      <WalletMenuItem
        onPress={() => {
          showDeviceAdvancedSettings({
            walletId: wallet?.id ?? '',
            deviceType: hwInfo?.hwWalletType,
          });
        }}
        icon="AdjustmentsHorizontalMini"
      >
        {intl.formatMessage({ id: 'content__advanced' })}
      </WalletMenuItem>
      <Divider my="4px" />
      {hwInfo?.hasUpgrade ? (
        <WalletMenuItem
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
        </WalletMenuItem>
      ) : (
        <WalletMenuItem
          icon="MagnifyingGlassMini"
          onPress={checkFirmwareUpdate}
        >
          {intl.formatMessage({ id: 'form__check_for_updates' })}
        </WalletMenuItem>
      )}
      <Divider my="4px" />
      <WalletMenuItem
        onPress={() => {
          onDeleteWallet({
            isPassphrase: hwInfo?.isPassphrase ?? false,
          });
        }}
        variant="desctructive"
        icon="TrashMini"
      >
        {intl.formatMessage({ id: 'action__delete_device' })}
      </WalletMenuItem>
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
      showDialog(<ManagerWalletDeleteDialog deleteWallet={walletProps} />);
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
        <WalletMenuItem
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
        </WalletMenuItem>
        <WalletMenuItem onPress={navigateToBackupModal} icon="ShieldCheckMini">
          {intl.formatMessage({ id: 'action__backup' })}
        </WalletMenuItem>
        <Divider my="4px" />
        <WalletMenuItem
          onPress={() => {
            onDeleteWallet();
          }}
          variant="desctructive"
          icon="TrashMini"
        >
          {intl.formatMessage({ id: 'action__delete_wallet' })}
        </WalletMenuItem>
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
        offset={defaultMenuOffset}
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

  const { visible } = useWalletSelectorStatus();

  if (!visible) return null;
  return (
    <>
      {menuView}
      {dialogViews}
    </>
  );
}

export { WalletItemSelectDropdown };
