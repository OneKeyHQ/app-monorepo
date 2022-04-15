import React, { FC, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Dialog,
  HStack,
  Icon,
  Select,
  Typography,
  VStack,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { OnCloseCallback } from '@onekeyhq/components/src/Dialog/components/FooterButton';
import { Wallet } from '@onekeyhq/engine/src/types/wallet';
import { useActiveWalletAccount } from '@onekeyhq/kit/src/hooks/redux';
import { BackupWalletModalRoutes } from '@onekeyhq/kit/src/routes/Modal/BackupWallet';
import { ManagerWalletModalRoutes } from '@onekeyhq/kit/src/routes/Modal/ManagerWallet';
import { ModalRoutes, RootRoutes } from '@onekeyhq/kit/src/routes/types';

import useAppNavigation from '../../../hooks/useAppNavigation';
import useLocalAuthenticationModal from '../../../hooks/useLocalAuthenticationModal';
import { GlobalDialogIds, GlobalDialogParams } from '../../../routes/Dialog';
import { OnekeyHardwareModalRoutes } from '../../../routes/Modal/HardwareOnekey';
import { useDialog } from '../../Dialog';

type RightHeaderProps = {
  selectedWallet?: Wallet | null;
};

type CustomSelectTriggerProps = {
  isSelectVisible?: boolean;
  isTriggerHovered?: boolean;
};

const CustomSelectTrigger: FC<CustomSelectTriggerProps> = ({
  isSelectVisible,
  isTriggerHovered,
}) => (
  <Box
    p={2}
    borderRadius="xl"
    bg={
      // eslint-disable-next-line no-nested-ternary
      isSelectVisible
        ? 'surface-selected'
        : isTriggerHovered
        ? 'surface-hovered'
        : 'transparent'
    }
  >
    <Icon size={20} name="DotsHorizontalSolid" />
  </Box>
);

const HeaderTitle: FC<RightHeaderProps> = ({ selectedWallet }) => {
  const intl = useIntl();
  let title = selectedWallet?.name ?? '';
  if (selectedWallet?.type === 'imported') {
    title = intl.formatMessage({ id: 'wallet__imported_accounts' });
  } else if (selectedWallet?.type === 'watching') {
    title = intl.formatMessage({ id: 'wallet__watched_accounts' });
  }
  return <Typography.Body1Strong key={title}>{title}</Typography.Body1Strong>;
};

const RightHeader: FC<RightHeaderProps> = ({ selectedWallet }) => {
  const intl = useIntl();
  const navigation = useAppNavigation();

  const isVerticalLayout = useIsVerticalLayout();
  const { network: activeNetwork } = useActiveWalletAccount();

  const { showVerify } = useLocalAuthenticationModal();
  const [showBackupDialog, setShowBackupDialog] = useState(false);

  // 使用 useDialog 展示对话框
  const { show: showDeleteWallet } = useDialog<
    GlobalDialogParams[GlobalDialogIds.DeleteWalletDialog]
  >(GlobalDialogIds.DeleteWalletDialog);

  const renderBackupState = useMemo(() => {
    if (!selectedWallet) return null;
    if (selectedWallet.backuped) {
      return (
        <Icon
          name={isVerticalLayout ? 'CheckCircleOutline' : 'CheckCircleSolid'}
          color="icon-success"
        />
      );
    }
    return (
      <Icon
        name={isVerticalLayout ? 'ExclamationOutline' : 'ExclamationSolid'}
        color="icon-warning"
      />
    );
  }, [isVerticalLayout, selectedWallet]);

  const onDeleteWallet = () => {
    if (selectedWallet?.backuped === true) {
      showVerify(
        (pwd) => {
          // 使用全局的 Dialog
          showDeleteWallet({
            walletId: selectedWallet?.id ?? '',
            password: pwd,
          });

          // 想等待 Dialog 的 处理结果 可以用，这样 Dialog 必须调用 resolve
          // const result = await showDeleteWallet({
          //   walletId: selectedWallet?.id ?? '',
          //   password: pwd,
          // });
        },
        () => {},
      );
    } else {
      setShowBackupDialog(true);
    }
  };

  return (
    <>
      <HStack py={3} px={4} space={4} alignItems="center">
        <VStack flex={1}>
          <HeaderTitle selectedWallet={selectedWallet} />
          <Typography.Caption color="text-subdued">
            {intl.formatMessage({ id: 'network__network' })}:{' '}
            {activeNetwork?.name ?? '-'}
          </Typography.Caption>
        </VStack>
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
                      screen: BackupWalletModalRoutes.BackupWalletModal,
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
                trailing: renderBackupState,
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
            renderTrigger={(activeOption, isHovered, visible) => (
              <CustomSelectTrigger
                isTriggerHovered={isHovered}
                isSelectVisible={visible}
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
            renderTrigger={(activeOption, isHovered, visible) => (
              <CustomSelectTrigger
                isTriggerHovered={isHovered}
                isSelectVisible={visible}
              />
            )}
          />
        ) : null}
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
                  screen: BackupWalletModalRoutes.BackupWalletModal,
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

export default RightHeader;
