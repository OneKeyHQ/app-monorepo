import React, { FC, useMemo, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
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
import { useAppSelector } from '@onekeyhq/kit/src/hooks/redux';
import {
  BackupWalletModalRoutes,
  BackupWalletRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/BackupWallet';
import { ManagerWalletModalRoutes } from '@onekeyhq/kit/src/routes/Modal/ManagerWallet';
import {
  ModalRoutes,
  ModalScreenProps,
  RootRoutes,
} from '@onekeyhq/kit/src/routes/types';

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
  return <Typography.Body1Strong>{title}</Typography.Body1Strong>;
};

type NavigationProps = ModalScreenProps<BackupWalletRoutesParams>;

const RightHeader: FC<RightHeaderProps> = ({ selectedWallet }) => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps['navigation']>();
  const isVerticalLayout = useIsVerticalLayout();
  const activeNetwork = useAppSelector((s) => s.general.activeNetwork);

  const [showBackupDialog, setShowBackupDialog] = useState(false);

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
      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.ManagerWallet,
        params: {
          screen:
            ManagerWalletModalRoutes.ManagerWalletDialogAuthorityVerifyModal,
          params: {
            walletId: selectedWallet?.id ?? '',
            managerType: 'deleteWallet',
          },
        },
      });
    } else {
      setShowBackupDialog(true);
    }
  };

  return (
    <>
      <HStack zIndex={99} py={3} px={4} space={4} alignItems="center">
        <VStack flex={1}>
          <HeaderTitle selectedWallet={selectedWallet} />
          <Typography.Caption color="text-subdued">
            {intl.formatMessage({ id: 'network__network' })}:{' '}
            {activeNetwork?.network?.name ?? '-'}
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
            dropdownPosition="left"
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
            navigation.navigate(RootRoutes.Modal, {
              screen: ModalRoutes.BackupWallet,
              params: {
                screen: BackupWalletModalRoutes.BackupWalletModal,
                params: {
                  walletId: selectedWallet?.id ?? '',
                },
              },
            });
            onClose?.();
          },
        }}
      />
    </>
  );
};

export default RightHeader;
