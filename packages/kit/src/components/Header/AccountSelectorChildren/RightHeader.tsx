import React, { FC, memo, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Dialog,
  HStack,
  Icon,
  Select,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { OnCloseCallback } from '@onekeyhq/components/src/Dialog/components/FooterButton';
import { SelectGroupItem } from '@onekeyhq/components/src/Select';
import { Wallet } from '@onekeyhq/engine/src/types/wallet';
import { BackupWalletModalRoutes } from '@onekeyhq/kit/src/routes/Modal/BackupWallet';
import { OnekeyHardwareModalRoutes } from '@onekeyhq/kit/src/routes/Modal/HardwareOnekey';
import { HardwareUpdateModalRoutes } from '@onekeyhq/kit/src/routes/Modal/HardwareUpdate';
import { ManagerWalletModalRoutes } from '@onekeyhq/kit/src/routes/Modal/ManagerWallet';
import { ModalRoutes, RootRoutes } from '@onekeyhq/kit/src/routes/types';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import useAppNavigation from '../../../hooks/useAppNavigation';
import useLocalAuthenticationModal from '../../../hooks/useLocalAuthenticationModal';
import ManagerWalletDeleteDialog, {
  DeleteWalletProp,
} from '../../../views/ManagerWallet/DeleteWallet';
import { ValidationFields } from '../../Protected';

import type { DeviceStatusType } from '.';

type RightHeaderProps = {
  selectedWallet?: Wallet | null;
  // eslint-disable-next-line react/no-unused-prop-types
  deviceStatus?: DeviceStatusType;
};

type CustomSelectTriggerProps = {
  isSelectVisible?: boolean;
  isTriggerHovered?: boolean;
  isTriggerPressed?: boolean;
  isNotification?: boolean;
  notificationColor?: string;
};

const CustomSelectTrigger: FC<CustomSelectTriggerProps> = ({
  isSelectVisible,
  isTriggerHovered,
  isTriggerPressed,
  isNotification,
  notificationColor,
}) => (
  <>
    <Box
      p={2}
      borderRadius="xl"
      bg={
        // eslint-disable-next-line no-nested-ternary
        isSelectVisible
          ? 'surface-selected'
          : // eslint-disable-next-line no-nested-ternary
          isTriggerPressed
          ? 'surface-pressed'
          : isTriggerHovered
          ? 'surface-hovered'
          : 'transparent'
      }
    >
      <Icon size={20} name="DotsHorizontalSolid" />
    </Box>

    {!!isNotification && (
      <Box
        position="absolute"
        top={-2}
        right={-2}
        size={3}
        bgColor={notificationColor}
        borderWidth={2}
        borderColor="surface-subdued"
        rounded="full"
      />
    )}
  </>
);

const HeaderTitle: FC<RightHeaderProps> = ({ selectedWallet }) => {
  const intl = useIntl();
  let title = selectedWallet?.name ?? '';
  if (selectedWallet?.type === 'imported') {
    title = intl.formatMessage({ id: 'wallet__imported_accounts' });
  }
  if (selectedWallet?.type === 'watching') {
    title = intl.formatMessage({ id: 'wallet__watched_accounts' });
  }
  if (selectedWallet?.type === 'external') {
    title = intl.formatMessage({ id: 'content__external_account' });
  }
  return (
    // The lineHeight use to keep the Header has same height when switch to Imported/Watched accounts.
    <Typography.Body1Strong
      testID="AccountSelectorChildren-HeaderTitle"
      flex={1}
      key={title}
      lineHeight={36}
    >
      {title}
    </Typography.Body1Strong>
  );
};

const RightHeader: FC<RightHeaderProps> = ({
  selectedWallet,
  deviceStatus,
}) => {
  const intl = useIntl();
  const navigation = useAppNavigation();

  const isVerticalLayout = useIsVerticalLayout();

  const { showVerify } = useLocalAuthenticationModal();
  const [showBackupDialog, setShowBackupDialog] = useState(false);
  const [showDeleteWalletDialog, setShowDeleteWalletDialog] = useState(false);
  const [deleteWallet, setDeleteWallet] = useState<DeleteWalletProp>();
  const [hasAvailableUpdate, setHasAvailableUpdate] = useState(false);

  useEffect(() => {
    setHasAvailableUpdate(deviceStatus?.hasUpgrade ?? false);
  }, [deviceStatus]);

  const onDeleteWallet = () => {
    if (selectedWallet?.type === 'hw') {
      setDeleteWallet({
        walletId: selectedWallet?.id ?? '',
        password: undefined,
        hardware: true,
      });
      setTimeout(() => setShowDeleteWalletDialog(true), 500);
      return;
    }

    if (selectedWallet?.backuped === true) {
      showVerify(
        (pwd) => {
          setDeleteWallet({
            walletId: selectedWallet?.id ?? '',
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
  };

  const hwWalletOptions = useMemo(() => {
    const options: SelectGroupItem<string>[] = [
      {
        title: '',
        options: [
          {
            label: intl.formatMessage({ id: 'action__edit' }),
            value: 'rename',
            iconProps: {
              name: isVerticalLayout ? 'PencilOutline' : 'PencilSolid',
            },
          },
          {
            label: intl.formatMessage({
              id: 'action__view_device_details',
            }),
            value: 'details',
            iconProps: {
              name: isVerticalLayout
                ? 'DocumentTextOutline'
                : 'DocumentTextSolid',
            },
          },
          {
            label: intl.formatMessage({
              id: 'action__delete_wallet',
            }),
            value: 'remove',
            iconProps: {
              name: isVerticalLayout ? 'TrashOutline' : 'TrashSolid',
            },
            destructive: true,
          },
        ],
      },
    ];
    if (hasAvailableUpdate) {
      options.push({
        title: '',
        options: [
          {
            label: intl.formatMessage({
              id: 'action__update_available',
            }),
            value: 'update',
            color: 'text-warning',
            iconProps: {
              color: 'icon-warning',
              name: isVerticalLayout ? 'UploadOutline' : 'UploadSolid',
            },
          },
        ],
      });
    }
    return options;
  }, [hasAvailableUpdate, intl, isVerticalLayout]);

  return (
    <>
      <HStack py={3} px={4} space={4} alignItems="center">
        <HeaderTitle selectedWallet={selectedWallet} />
        {['hd', 'normal'].includes(selectedWallet?.type ?? '') ? (
          <Select
            onChange={(_value) => {
              switch (_value) {
                case 'rename':
                  navigation.navigate(RootRoutes.Modal, {
                    screen: ModalRoutes.ManagerWallet,
                    params: {
                      screen:
                        ManagerWalletModalRoutes.ManagerWalletModifyNameModal,
                      params: {
                        walletId: selectedWallet?.id ?? '',
                      },
                    },
                  });
                  break;
                case 'backup':
                  navigation.navigate(RootRoutes.Modal, {
                    screen: ModalRoutes.BackupWallet,
                    params: {
                      screen: platformEnv.isNative
                        ? BackupWalletModalRoutes.BackupWalletOptionsModal
                        : BackupWalletModalRoutes.BackupWalletManualModal,
                      params: {
                        walletId: selectedWallet?.id ?? '',
                      },
                    },
                  });
                  break;
                case 'remove':
                  onDeleteWallet();
                  break;
                default:
                  break;
              }
            }}
            dropdownPosition="right"
            activatable={false}
            options={[
              {
                label: intl.formatMessage({ id: 'action__edit' }),
                value: 'rename',
                iconProps: {
                  name: isVerticalLayout ? 'PencilOutline' : 'PencilSolid',
                },
              },
              {
                label: intl.formatMessage({ id: 'action__backup' }),
                value: 'backup',
                iconProps: {
                  name: isVerticalLayout
                    ? 'ShieldCheckOutline'
                    : 'ShieldCheckSolid',
                },
              },
              {
                label: intl.formatMessage({ id: 'action__delete_wallet' }),
                value: 'remove',
                iconProps: {
                  name: isVerticalLayout ? 'TrashOutline' : 'TrashSolid',
                },
                destructive: true,
              },
            ]}
            headerShown={false}
            footer={null}
            containerProps={{ width: 'auto' }}
            dropdownProps={{
              width: 248,
            }}
            renderTrigger={(activeOption, isHovered, visible, isPressed) => (
              <CustomSelectTrigger
                isTriggerHovered={isHovered}
                isSelectVisible={visible}
                isTriggerPressed={isPressed}
              />
            )}
          />
        ) : null}
        {['hw'].includes(selectedWallet?.type ?? '') ? (
          <Select
            onChange={(_value) => {
              switch (_value) {
                case 'rename':
                  navigation.navigate(RootRoutes.Modal, {
                    screen: ModalRoutes.OnekeyHardware,
                    params: {
                      screen:
                        OnekeyHardwareModalRoutes.OnekeyHardwareDeviceNameModal,
                      params: {
                        walletId: selectedWallet?.id ?? '',
                        deviceName: '',
                      },
                    },
                  });
                  break;
                case 'details':
                  navigation.navigate(RootRoutes.Modal, {
                    screen: ModalRoutes.OnekeyHardware,
                    params: {
                      screen:
                        OnekeyHardwareModalRoutes.OnekeyHardwareDetailsModal,
                      params: {
                        walletId: selectedWallet?.id ?? '',
                      },
                    },
                  });
                  break;
                case 'remove':
                  onDeleteWallet();
                  break;

                case 'update':
                  navigation.navigate(RootRoutes.Modal, {
                    screen: ModalRoutes.HardwareUpdate,
                    params: {
                      screen: HardwareUpdateModalRoutes.HardwareUpdateInfoModel,
                      params: {
                        walletId: selectedWallet?.id ?? '',
                      },
                    },
                  });
                  break;

                default:
                  break;
              }
            }}
            dropdownPosition="right"
            activatable={false}
            options={hwWalletOptions}
            headerShown={false}
            footer={null}
            containerProps={{ width: 'auto' }}
            dropdownProps={{
              width: 248,
            }}
            renderTrigger={(activeOption, isHovered, visible) => (
              <CustomSelectTrigger
                isTriggerHovered={isHovered}
                isSelectVisible={visible}
                isNotification={hasAvailableUpdate}
                notificationColor="icon-warning"
              />
            )}
          />
        ) : null}
      </HStack>
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
                    walletId: selectedWallet?.id ?? '',
                  },
                },
              });
            }, 500);
          },
        }}
      />
    </>
  );
};

export default memo(RightHeader);
