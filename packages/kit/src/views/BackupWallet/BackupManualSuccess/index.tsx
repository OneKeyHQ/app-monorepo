import React, { FC } from 'react';

import { RouteProp } from '@react-navigation/core';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { Button, Center, Icon, Modal, Typography } from '@onekeyhq/components';
import { useIsVerticalLayout } from '@onekeyhq/components/src/Provider/hooks';
import {
  BackupWalletModalRoutes,
  BackupWalletRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/BackupWallet';

import { ModalRoutes, RootRoutes } from '../../../routes/types';

type RouteProps = RouteProp<
  BackupWalletRoutesParams,
  BackupWalletModalRoutes.BackupWalletManualSuccessModal
>;

const BackupWalletManualSuccessView: FC = () => {
  const intl = useIntl();
  const navigation = useNavigation();
  const { walletId } = useRoute<RouteProps>().params;
  const isSmallScreen = useIsVerticalLayout();

  return (
    <Modal
      hideSecondaryAction
      primaryActionTranslationId="action__done"
      onPrimaryActionPress={() => {
        if (navigation.getParent()) {
          navigation.getParent()?.goBack();
        }
      }}
    >
      <Center flex={1} maxW="320px" mx="auto">
        <Center p={4} rounded="full" bgColor="surface-success-default">
          <Icon name="CheckOutline" size={24} color="icon-success" />
        </Center>

        <Typography.DisplayMedium mt={6} textAlign="center">
          {intl.formatMessage({ id: 'dialog__manual_backup_successful_title' })}
        </Typography.DisplayMedium>

        <Typography.Body1 mt={2} mb={6} color="text-subdued" textAlign="center">
          {intl.formatMessage({ id: 'dialog__manual_backup_successful_desc' })}
        </Typography.Body1>

        {!!walletId && (
          <Button
            type="plain"
            leftIconName="EyeSolid"
            size={isSmallScreen ? 'lg' : 'base'}
            onPress={() => {
              navigation.navigate(RootRoutes.Modal, {
                screen: ModalRoutes.WalletViewMnemonics,
                params: {
                  screen:
                    BackupWalletModalRoutes.BackupWalletAuthorityVerifyModal,
                  params: {
                    walletId,
                    backupType: 'showMnemonics',
                  },
                },
              });
            }}
          >
            {intl.formatMessage({ id: 'action__view_recovery_seed' })}
          </Button>
        )}
      </Center>
    </Modal>
  );
};

export default BackupWalletManualSuccessView;
