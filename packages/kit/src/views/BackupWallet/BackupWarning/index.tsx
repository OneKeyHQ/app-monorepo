import React, { FC } from 'react';

import { RouteProp, useNavigation } from '@react-navigation/core';
import { useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { Box, Icon, Image, Modal, Typography } from '@onekeyhq/components';
import IconWarning from '@onekeyhq/kit/assets/wallet/ic_backup_wallet_manual_warning.png';
import {
  BackupWalletModalRoutes,
  BackupWalletRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/BackupWallet';

import { ModalRoutes, RootRoutes } from '../../../routes/types';

type RouteProps = RouteProp<
  BackupWalletRoutesParams,
  BackupWalletModalRoutes.BackupWalletWarningModal
>;

const BackupWalletWarningView: FC = () => {
  const intl = useIntl();
  const { backup, walletId } = useRoute<RouteProps>().params;
  const navigation = useNavigation();
  return (
    <Modal
      header={intl.formatMessage({ id: 'backup__manual_backup_warning' })}
      hideSecondaryAction
      primaryActionTranslationId="action__i_understand"
      onPrimaryActionPress={() => {
        navigation.navigate(RootRoutes.Modal, {
          screen: ModalRoutes.BackupWallet,
          params: {
            screen: BackupWalletModalRoutes.BackupShowMnemonicsModal,
            params: {
              backup,
              readOnly: false,
              walletId,
            },
          },
        });
      }}
    >
      <Box w="full" mt={8} flexDirection="row" justifyContent="center">
        <Image source={IconWarning} height="101px" width="100px" />
      </Box>

      <Typography.DisplayMedium mt={6}>
        {intl.formatMessage({ id: 'backup__manual_backup_warning_heading' })}
      </Typography.DisplayMedium>

      <Box flexDirection="row" mt={6}>
        <Box>
          <Icon size={24} name="CloseCircleOutline" color="icon-critical" />
        </Box>

        <Typography.Body1 ml={2}>
          {intl.formatMessage({
            id: 'backup__manual_backup_warning_never_share',
          })}
        </Typography.Body1>
      </Box>
      <Box flexDirection="row" mt={4}>
        <Box>
          <Icon size={24} name="CloseCircleOutline" color="icon-critical" />
        </Box>

        <Typography.Body1 ml={2}>
          {intl.formatMessage({
            id: 'backup__manual_backup_warning_never_ask',
          })}
        </Typography.Body1>
      </Box>
    </Modal>
  );
};

export default BackupWalletWarningView;
