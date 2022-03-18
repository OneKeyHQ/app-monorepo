import React, { FC, useState } from 'react';

import { RouteProp } from '@react-navigation/core';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { Box, CheckBox, Icon, Modal, Typography } from '@onekeyhq/components';
import {
  BackupWalletModalRoutes,
  BackupWalletRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/BackupWallet';

import { ModalRoutes, RootRoutes } from '../../../routes/types';

type RouteProps = RouteProp<
  BackupWalletRoutesParams,
  BackupWalletModalRoutes.BackupWalletManualHintModal
>;

const BackupWalletManualHintView: FC = () => {
  const intl = useIntl();

  const [agreement, setAgreement] = useState(false);
  const navigation = useNavigation();
  const { backup, walletId } = useRoute<RouteProps>().params;
  return (
    <Modal
      header={intl.formatMessage({ id: 'backup__manual_backup' })}
      hideSecondaryAction
      primaryActionTranslationId="action__continue"
      primaryActionProps={{
        isDisabled: !agreement,
      }}
      onPrimaryActionPress={() => {
        navigation.navigate(RootRoutes.Modal, {
          screen: ModalRoutes.BackupWallet,
          params: {
            screen: BackupWalletModalRoutes.BackupWalletWarningModal,
            params: {
              backup,
              walletId,
            },
          },
        });
      }}
    >
      <Box justifyContent="space-between" flex={1}>
        <Box mb={8}>
          <Typography.DisplayMedium>
            {intl.formatMessage({ id: 'backup__manual_backup_what_it_is' })}
          </Typography.DisplayMedium>

          <Typography.Body1 mt={8}>
            {intl.formatMessage({
              id: 'backup__manual_backup_advice_title',
            })}
          </Typography.Body1>
          <Box flexDirection="row" mt={4} w="100%">
            <Box mt={1}>
              <Icon size={24} name="CheckCircleOutline" color="icon-success" />
            </Box>

            <Typography.Body1 ml={2} flex={1}>
              {intl.formatMessage({
                id: 'backup__manual_backup_advice_write_on_paper',
              })}
            </Typography.Body1>
          </Box>
          <Box flexDirection="row" mt={4} w="100%">
            <Box mt={1}>
              <Icon size={24} name="CheckCircleOutline" color="icon-success" />
            </Box>

            <Typography.Body1 ml={2} flex={1}>
              {intl.formatMessage({
                id: 'backup__manual_backup_advice_write_sync',
              })}
            </Typography.Body1>
          </Box>
        </Box>

        <CheckBox
          isChecked={agreement}
          onChange={() => {
            setAgreement(!agreement);
          }}
          title={intl.formatMessage({
            id: 'checkbox__manual_backup_warning',
          })}
        />
      </Box>
    </Modal>
  );
};

export default BackupWalletManualHintView;
