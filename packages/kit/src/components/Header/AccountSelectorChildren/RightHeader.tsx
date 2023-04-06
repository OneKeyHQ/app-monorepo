import type { FC } from 'react';
import { memo, useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Dialog,
  HStack,
  Icon,
  Pressable,
  Select,
  Spinner,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import type { OnCloseCallback } from '@onekeyhq/components/src/Dialog/components/FooterButton';
import type {
  SelectGroupItem,
  SelectItem,
} from '@onekeyhq/components/src/Select';
import type { Wallet } from '@onekeyhq/engine/src/types/wallet';
import {
  BackupWalletModalRoutes,
  CreateAccountModalRoutes,
  HardwareUpdateModalRoutes,
  ManagerWalletModalRoutes,
  ModalRoutes,
  OnekeyHardwareModalRoutes,
  RootRoutes,
} from '@onekeyhq/kit/src/routes/routesEnum';
import { showDialog } from '@onekeyhq/kit/src/utils/overlayUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../../hooks';
import useAppNavigation from '../../../hooks/useAppNavigation';
import useLocalAuthenticationModal from '../../../hooks/useLocalAuthenticationModal';
import reducerAccountSelector from '../../../store/reducers/reducerAccountSelector';
import ManagerWalletDeleteDialog from '../../../views/ManagerWallet/DeleteWallet';
import { ValidationFields } from '../../Protected';

import type { DeviceStatusType } from '.';
import type { DeleteWalletProp } from '../../../views/ManagerWallet/DeleteWallet';

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

const { updateIsLoading } = reducerAccountSelector.actions;

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
      <Icon size={20} name="DotsHorizontalMini" />
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
      lineHeight="36px"
      minHeight="36px"
      numberOfLines={1}
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
  const { dispatch } = backgroundApiProxy;

  const isVerticalLayout = useIsVerticalLayout();

  const { showVerify } = useLocalAuthenticationModal();
  const [showBackupDialog, setShowBackupDialog] = useState(false);
  const isLoading = useAppSelector((s) => s.accountSelector.isLoading);

  const hasAvailableUpdate = useMemo(
    () => deviceStatus?.hasUpgrade ?? false,
    [deviceStatus?.hasUpgrade],
  );

  const showDeleteWalletDialog = useCallback(
    (walletProps: DeleteWalletProp) => {
      showDialog(<ManagerWalletDeleteDialog deleteWallet={walletProps} />);
    },
    [],
  );

  const onDeleteWallet = useCallback(() => {
    if (selectedWallet?.type === 'hw') {
      setTimeout(
        () =>
          showDeleteWalletDialog({
            walletId: selectedWallet?.id ?? '',
            password: undefined,
            hardware: {
              isPassphrase: false,
            },
          }),
        500,
      );
      return;
    }

    if (selectedWallet?.backuped === true) {
      showVerify(
        (pwd) => {
          setTimeout(
            () =>
              showDeleteWalletDialog({
                walletId: selectedWallet?.id ?? '',
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
  }, [
    selectedWallet?.backuped,
    selectedWallet?.id,
    selectedWallet?.type,
    showDeleteWalletDialog,
    showVerify,
  ]);

  const hwWalletOptions = useMemo(() => {
    const normalGroup: SelectItem[] = [];

    if (!selectedWallet?.passphraseState) {
      normalGroup.push({
        label: intl.formatMessage({ id: 'action__edit' }),
        value: 'rename',
        iconProps: {
          name: isVerticalLayout ? 'PencilOutline' : 'PencilMini',
        },
      });
    }

    normalGroup.push(
      {
        label: intl.formatMessage({
          id: 'action__device_settings',
        }),
        value: 'details',
        iconProps: {
          name: isVerticalLayout ? 'DocumentTextOutline' : 'DocumentTextMini',
        },
      },
      // {
      //   label: intl.formatMessage({
      //     id: 'action__recover_accounts',
      //   }),
      //   value: 'restore',
      //   iconProps: {
      //     name: isVerticalLayout ? 'RestoreOutline' : 'RestoreMini',
      //   },
      // },
      {
        label: intl.formatMessage({
          id: 'action__delete_wallet',
        }),
        value: 'remove',
        iconProps: {
          name: isVerticalLayout ? 'TrashOutline' : 'TrashMini',
        },
        destructive: true,
      },
    );

    const options: SelectGroupItem<string>[] = [
      {
        title: '',
        options: normalGroup,
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
              name: isVerticalLayout ? 'UploadOutline' : 'UploadMini',
            },
          },
        ],
      });
    }
    return options;
  }, [
    hasAvailableUpdate,
    intl,
    isVerticalLayout,
    selectedWallet?.passphraseState,
  ]);

  const optionsView = useMemo(() => {
    if (isLoading) {
      return (
        <Pressable
          p={2}
          onPress={() => {
            dispatch(updateIsLoading(false));
          }}
        >
          <Spinner size="sm" />
        </Pressable>
      );
    }
    if (['hd', 'normal'].includes(selectedWallet?.type ?? '')) {
      return (
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
                    screen: BackupWalletModalRoutes.BackupWalletOptionsModal,
                    params: {
                      walletId: selectedWallet?.id ?? '',
                    },
                  },
                });
                break;
              case 'restore':
                navigation.navigate(RootRoutes.Modal, {
                  screen: ModalRoutes.CreateAccount,
                  params: {
                    screen: CreateAccountModalRoutes.RecoverySelectChainList,
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
                name: isVerticalLayout ? 'PencilOutline' : 'PencilMini',
              },
            },
            {
              label: intl.formatMessage({ id: 'action__backup' }),
              value: 'backup',
              iconProps: {
                name: isVerticalLayout
                  ? 'ShieldCheckOutline'
                  : 'ShieldCheckMini',
              },
            },
            // {
            //   label: intl.formatMessage({
            //     id: 'action__recover_accounts',
            //   }),
            //   value: 'restore',
            //   iconProps: {
            //     name: isVerticalLayout ? 'RestoreOutline' : 'RestoreMini',
            //   },
            // },
            {
              label: intl.formatMessage({ id: 'action__delete_wallet' }),
              value: 'remove',
              iconProps: {
                name: isVerticalLayout ? 'TrashOutline' : 'TrashMini',
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
          renderTrigger={({ isHovered, visible, isPressed }) => (
            <CustomSelectTrigger
              isTriggerHovered={isHovered}
              isSelectVisible={visible}
              isTriggerPressed={isPressed}
            />
          )}
        />
      );
    }
    if (['hw'].includes(selectedWallet?.type ?? '')) {
      return (
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
              case 'restore':
                navigation.navigate(RootRoutes.Modal, {
                  screen: ModalRoutes.CreateAccount,
                  params: {
                    screen: CreateAccountModalRoutes.RecoverySelectChainList,
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
          renderTrigger={({ isHovered, visible }) => (
            <CustomSelectTrigger
              isTriggerHovered={isHovered}
              isSelectVisible={visible}
              isNotification={hasAvailableUpdate}
              notificationColor="icon-warning"
            />
          )}
        />
      );
    }
  }, [
    isLoading,
    selectedWallet?.type,
    selectedWallet?.id,
    dispatch,
    intl,
    isVerticalLayout,
    navigation,
    onDeleteWallet,
    hwWalletOptions,
    hasAvailableUpdate,
  ]);

  return (
    <>
      <HStack py={3} px={4} alignItems="center">
        <HeaderTitle selectedWallet={selectedWallet} />
        <HStack justifyContent="flex-end">{optionsView}</HStack>
      </HStack>
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
                  screen: BackupWalletModalRoutes.BackupWalletOptionsModal,
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
