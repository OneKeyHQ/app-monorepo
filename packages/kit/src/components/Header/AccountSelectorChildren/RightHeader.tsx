import type { FC } from 'react';
import { memo, useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  Box,
  Dialog,
  HStack,
  Icon,
  Pressable,
  Select,
  Spinner,
  Text,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import type { OnCloseCallback } from '@onekeyhq/components/src/Dialog/components/FooterButton';
import type {
  SelectGroupItem,
  SelectItem,
  SelectProps,
} from '@onekeyhq/components/src/Select';
import type { Wallet } from '@onekeyhq/engine/src/types/wallet';
import { CreateAccountModalRoutes } from '@onekeyhq/kit/src/routes';
import { BackupWalletModalRoutes } from '@onekeyhq/kit/src/routes/Modal/BackupWallet';
import { OnekeyHardwareModalRoutes } from '@onekeyhq/kit/src/routes/Modal/HardwareOnekey';
import { HardwareUpdateModalRoutes } from '@onekeyhq/kit/src/routes/Modal/HardwareUpdate';
import { ManagerWalletModalRoutes } from '@onekeyhq/kit/src/routes/Modal/ManagerWallet';
import { ModalRoutes, RootRoutes } from '@onekeyhq/kit/src/routes/types';
import { showOverlay } from '@onekeyhq/kit/src/utils/overlayUtils';

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

const CustomSelectItem: SelectProps<string>['renderItem'] = (
  option,
  isActive,
  onChange,
) => {
  console.log('CustomSelectItem', option, isActive, onChange);
  const isSmallScreen = useIsVerticalLayout();
  const {
    label,
    description,
    value,
    tokenProps,
    iconProps,
    destructive,
    color,
    badge,
    leading,
    trailing,
  } = option;

  const optionText = (
    <Box flex={1}>
      <HStack alignItems="center">
        <Text
          color={destructive ? 'text-critical' : color ?? 'text-default'}
          typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
          isTruncated
          mr={2}
        >
          {label}
        </Text>
        {!!badge && <Badge title={badge} size="sm" type="default" />}
      </HStack>
      {!!description && (
        <Typography.Body2 color="text-subdued">
          {description ?? '-'}
        </Typography.Body2>
      )}
    </Box>
  );

  return (
    <Pressable
      key={value as unknown as string}
      onPress={() => {
        onChange?.(value, option);
      }}
    >
      {({ isHovered, isPressed }) => (
        <HStack
          alignItems="center"
          space={3}
          px={{ base: '4', md: '2' }}
          py={{ base: '3', md: '2' }}
          borderRadius="xl"
          bg={
            // eslint-disable-next-line no-nested-ternary
            isPressed
              ? 'surface-pressed'
              : // eslint-disable-next-line no-nested-ternary
              isHovered
              ? destructive
                ? 'surface-critical-default'
                : 'surface-hovered'
              : undefined
          }
        >
          {optionText}
          {!!trailing && trailing}
          {!!isActive && (
            <Icon
              name={isSmallScreen ? 'CheckOutline' : 'CheckMini'}
              color="interactive-default"
              size={isSmallScreen ? 24 : 20}
            />
          )}
          {(!!tokenProps || !!iconProps || !!leading) && (
            <Icon
              color={destructive ? 'icon-critical' : 'icon-default'}
              size={isSmallScreen ? 24 : 20}
              {...iconProps}
            />
          )}
        </HStack>
      )}
    </Pressable>
  );
};

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
      showOverlay((onClose) => (
        <ManagerWalletDeleteDialog
          deleteWallet={walletProps}
          closeOverlay={onClose}
        />
      ));
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
          renderItem={CustomSelectItem}
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
