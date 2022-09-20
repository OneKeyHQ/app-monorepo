// TODO packages/kit/src/components/Header/AccountSelectorChildren/RightHeader.tsx
import React, { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Dialog,
  Icon,
  IconButton,
  Select,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { OnCloseCallback } from '@onekeyhq/components/src/Dialog/components/FooterButton';
import type {
  SelectGroupItem,
  SelectItem,
} from '@onekeyhq/components/src/Select';
import { IWallet } from '@onekeyhq/engine/src/types';
import { WALLET_TYPE_HW } from '@onekeyhq/engine/src/types/wallet';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import useAppNavigation from '../../../hooks/useAppNavigation';
import useLocalAuthenticationModal from '../../../hooks/useLocalAuthenticationModal';
import { BackupWalletModalRoutes } from '../../../routes/Modal/BackupWallet';
import { OnekeyHardwareModalRoutes } from '../../../routes/Modal/HardwareOnekey';
import { HardwareUpdateModalRoutes } from '../../../routes/Modal/HardwareUpdate';
import { ManagerWalletModalRoutes } from '../../../routes/Modal/ManagerWallet';
import {
  CreateAccountModalRoutes,
  ModalRoutes,
  RootRoutes,
} from '../../../routes/routesEnum';
import ManagerWalletDeleteDialog, {
  DeleteWalletProp,
} from '../../../views/ManagerWallet/DeleteWallet';
import { IHardwareDeviceStatusMap } from '../../NetworkAccountSelector/hooks/useDeviceStatusOfHardwareWallet';
import { ValidationFields } from '../../Protected';

enum EWalletSelectorListItemSelectOptions {
  rename = 'rename',
  backup = 'backup',
  restore = 'restore',
  remove = 'remove',
  details = 'details',
  update = 'update',
}

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
  const [showDeleteWalletDialog, setShowDeleteWalletDialog] = useState(false);
  const [deleteWallet, setDeleteWallet] = useState<DeleteWalletProp>();

  const onDeleteWallet = useCallback(() => {
    if (wallet?.type === 'hw') {
      setDeleteWallet({
        walletId: wallet?.id ?? '',
        password: undefined,
        hardware: true,
      });
      setTimeout(() => setShowDeleteWalletDialog(true), 500);
      return;
    }

    if (wallet?.backuped === true) {
      showVerify(
        (pwd) => {
          setDeleteWallet({
            walletId: wallet?.id ?? '',
            password: pwd,
          });
          setTimeout(() => setShowDeleteWalletDialog(true), 500);
        },
        () => {},
        null,
        ValidationFields.Wallet,
      );
    } else {
      setShowBackupDialog(true);
    }
  }, [wallet?.backuped, wallet?.id, wallet?.type, showVerify]);

  const intl = useIntl();
  const isVerticalLayout = useIsVerticalLayout();

  const isHardwareWallet = wallet?.type === WALLET_TYPE_HW;
  const hasAvailableUpdate = useMemo(
    () => Boolean(isHardwareWallet && deviceStatus?.hasUpgrade) ?? false,
    [deviceStatus?.hasUpgrade, isHardwareWallet],
  );

  const onSelectChange = useCallback(
    (_value: EWalletSelectorListItemSelectOptions) => {
      if (_value === EWalletSelectorListItemSelectOptions.update) {
        return navigation.navigate(RootRoutes.Modal, {
          screen: ModalRoutes.HardwareUpdate,
          params: {
            screen: HardwareUpdateModalRoutes.HardwareUpdateInfoModel,
            params: {
              walletId: wallet?.id ?? '',
            },
          },
        });
      }
      if (_value === EWalletSelectorListItemSelectOptions.details) {
        if (isHardwareWallet) {
          return navigation.navigate(RootRoutes.Modal, {
            screen: ModalRoutes.OnekeyHardware,
            params: {
              screen: OnekeyHardwareModalRoutes.OnekeyHardwareDetailsModal,
              params: {
                walletId: wallet?.id ?? '',
              },
            },
          });
        }
      }
      if (_value === EWalletSelectorListItemSelectOptions.rename) {
        if (isHardwareWallet) {
          return navigation.navigate(RootRoutes.Modal, {
            screen: ModalRoutes.OnekeyHardware,
            params: {
              screen: OnekeyHardwareModalRoutes.OnekeyHardwareDeviceNameModal,
              params: {
                walletId: wallet?.id ?? '',
                deviceName: '',
              },
            },
          });
        }
        return navigation.navigate(RootRoutes.Modal, {
          screen: ModalRoutes.ManagerWallet,
          params: {
            screen: ManagerWalletModalRoutes.ManagerWalletModifyNameModal,
            params: {
              walletId: wallet?.id ?? '',
            },
          },
        });
      }
      // TODO always check password
      if (_value === EWalletSelectorListItemSelectOptions.backup) {
        //
        navigation.navigate(RootRoutes.Modal, {
          screen: ModalRoutes.BackupWallet,
          params: {
            screen: platformEnv.isNative
              ? BackupWalletModalRoutes.BackupWalletOptionsModal
              : BackupWalletModalRoutes.BackupWalletManualModal,
            params: {
              walletId: wallet?.id ?? '',
            },
          },
        });
      }
      if (_value === EWalletSelectorListItemSelectOptions.restore) {
        //
        navigation.navigate(RootRoutes.Modal, {
          screen: ModalRoutes.CreateAccount,
          params: {
            screen: CreateAccountModalRoutes.RecoverySelectChainList,
            params: {
              walletId: wallet?.id ?? '',
            },
          },
        });
      }
      if (_value === EWalletSelectorListItemSelectOptions.remove) {
        onDeleteWallet();
      }
    },
    [isHardwareWallet, navigation, onDeleteWallet, wallet?.id],
  );
  const selectOptions = useMemo((): (
    | SelectItem<EWalletSelectorListItemSelectOptions>
    | SelectGroupItem<EWalletSelectorListItemSelectOptions>
  )[] => {
    const allOptions: Record<
      EWalletSelectorListItemSelectOptions,
      SelectItem<EWalletSelectorListItemSelectOptions>
    > = {
      [EWalletSelectorListItemSelectOptions.rename]: {
        label: intl.formatMessage({ id: 'action__edit' }),
        value: EWalletSelectorListItemSelectOptions.rename,
        iconProps: {
          name: isVerticalLayout ? 'PencilOutline' : 'PencilSolid',
        },
      },
      [EWalletSelectorListItemSelectOptions.backup]: {
        label: intl.formatMessage({ id: 'action__backup' }),
        value: EWalletSelectorListItemSelectOptions.backup,
        iconProps: {
          name: isVerticalLayout ? 'ShieldCheckOutline' : 'ShieldCheckSolid',
        },
      },
      [EWalletSelectorListItemSelectOptions.restore]: {
        label: intl.formatMessage({
          id: 'action__recover_accounts',
        }),
        value: EWalletSelectorListItemSelectOptions.restore,
        iconProps: {
          name: isVerticalLayout ? 'RestoreOutline' : 'RestoreSolid',
        },
      },
      [EWalletSelectorListItemSelectOptions.remove]: {
        label: intl.formatMessage({ id: 'action__delete_wallet' }),
        value: EWalletSelectorListItemSelectOptions.remove,
        iconProps: {
          name: isVerticalLayout ? 'TrashOutline' : 'TrashSolid',
        },
        destructive: true,
      },
      [EWalletSelectorListItemSelectOptions.details]: {
        label: intl.formatMessage({
          id: 'action__view_device_details',
        }),
        value: EWalletSelectorListItemSelectOptions.details,
        iconProps: {
          name: isVerticalLayout ? 'DocumentTextOutline' : 'DocumentTextSolid',
        },
      },
      [EWalletSelectorListItemSelectOptions.update]: {
        label: intl.formatMessage({
          id: 'action__update_available',
        }),
        value: EWalletSelectorListItemSelectOptions.update,
        color: 'text-warning',
        iconProps: {
          color: 'icon-warning',
          name: isVerticalLayout ? 'UploadOutline' : 'UploadSolid',
        },
      },
    };
    // hw wallet options
    if (isHardwareWallet) {
      const options = [
        allOptions.rename, // TODO !selectedWallet?.passphraseState
        allOptions.details,
        // allOptions.restore,
        allOptions.remove,
      ];
      if (hasAvailableUpdate) {
        options.push(allOptions.update);
      }
      return options;
    }
    // hd wallet options
    return [
      allOptions.rename,
      allOptions.backup,
      // allOptions.restore,
      allOptions.remove,
    ];
  }, [hasAvailableUpdate, intl, isHardwareWallet, isVerticalLayout]);

  const selectView = useMemo(
    () => (
      <Select
        onChange={onSelectChange}
        dropdownPosition="right"
        activatable={false}
        options={selectOptions}
        headerShown={false}
        footer={null}
        containerProps={{ width: 'auto' }}
        dropdownProps={{
          width: 248,
        }}
        renderTrigger={({ onPress }) => (
          <IconButton
            name="DotsVerticalSolid"
            circle
            type="plain"
            onPress={onPress}
            // TODO custom props
            // isTriggerHovered={isHovered}
            // isSelectVisible={visible}
            // isTriggerPressed={isPressed}
            // TODO hardware only
            // isNotification={hasAvailableUpdate}
            // notificationColor="icon-warning"
          />
        )}
      />
    ),
    [onSelectChange, selectOptions],
  );

  // TODO use redux to save memory
  const dialogViews = useMemo(
    () => (
      <>
        <ManagerWalletDeleteDialog
          visible={showDeleteWalletDialog}
          deleteWallet={deleteWallet}
          onDialogClose={() => {
            setShowDeleteWalletDialog(false);
          }}
        />
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
                navigation.navigate(RootRoutes.Modal, {
                  screen: ModalRoutes.BackupWallet,
                  params: {
                    screen: platformEnv.isNative
                      ? BackupWalletModalRoutes.BackupWalletOptionsModal
                      : BackupWalletModalRoutes.BackupWalletManualModal,
                    params: {
                      walletId: wallet?.id ?? '',
                    },
                  },
                });
              }, 500);
            },
          }}
        />
      </>
    ),
    [
      deleteWallet,
      intl,
      navigation,
      showBackupDialog,
      showDeleteWalletDialog,
      wallet?.id,
    ],
  );

  return (
    <>
      {selectView}
      {dialogViews}
    </>
  );
}

export { WalletItemSelectDropdown };
