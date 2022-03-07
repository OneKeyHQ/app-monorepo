import React, { FC } from 'react';

import { RouteProp } from '@react-navigation/core';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { Button, Center, Icon, Modal, Typography } from '@onekeyhq/components';
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
      <Center flex={1}>
        <Icon
          name="CheckCircleSolid"
          size={56}
          color="surface-success-default"
        />

        <Typography.DisplayMedium mt={6}>
          {intl.formatMessage({ id: 'dialog__manual_backup_successful_title' })}
        </Typography.DisplayMedium>

        <Typography.Body1 mt={2} color="text-subdued">
          {intl.formatMessage({ id: 'dialog__manual_backup_successful_desc' })}
        </Typography.Body1>

        {!!walletId && (
          <Button
            type="plain"
            mt={6}
            leftIconName="EyeOffSolid"
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
