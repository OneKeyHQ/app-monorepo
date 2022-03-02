import React, { FC, useCallback, useMemo } from 'react';

import { RouteProp } from '@react-navigation/core';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { Alert, Box, Button, Modal, Typography } from '@onekeyhq/components';
import { copyToClipboard } from '@onekeyhq/kit/src/utils/ClipboardUtils';

import { useToast } from '../../../hooks/useToast';
import { ModalRoutes, RootRoutes } from '../../../routes/types';
import { BackupWalletModalRoutes, BackupWalletRoutesParams } from '../routes';

type RouteProps = RouteProp<
  BackupWalletRoutesParams,
  BackupWalletModalRoutes.BackupShowMnemonicsModal
>;

const Mnemonic: FC<{ index: number; word: string }> = ({ index, word }) => (
  <Box flexDirection="row" mt={1} mb={1}>
    <Typography.Body1Strong minW={8} color="text-subdued">
      {`${index}.`}
    </Typography.Body1Strong>
    <Typography.DisplaySmall color="text-default">
      {word}
    </Typography.DisplaySmall>
  </Box>
);

const BackupShowMnemonicsView: FC = () => {
  const intl = useIntl();
  const navigation = useNavigation();
  const toast = useToast();
  const {
    walletId,
    readOnly,
    backup: mnemonic,
  } = useRoute<RouteProps>().params;

  const copyContentToClipboard = useCallback(() => {
    copyToClipboard(mnemonic);
    toast.info(intl.formatMessage({ id: 'msg__copied' }));
  }, [toast, mnemonic, intl]);

  const mnemonicArray = useMemo(() => mnemonic.split(' '), [mnemonic]);

  const halfWayThough = useMemo(
    () => Math.floor((mnemonicArray?.length ?? 0) / 2),
    [mnemonicArray?.length],
  );

  const arrayLeftHalf = useMemo(
    () => mnemonicArray?.slice(0, halfWayThough),
    [halfWayThough, mnemonicArray],
  );
  const arrayRightHalf = useMemo(
    () => mnemonicArray?.slice(halfWayThough, mnemonicArray?.length ?? 0),
    [halfWayThough, mnemonicArray],
  );

  return (
    <Modal
      header={intl.formatMessage({ id: 'modal__your_recovery_seed' })}
      hideSecondaryAction
      primaryActionTranslationId={readOnly ? 'action__done' : 'action__next'}
      onPrimaryActionPress={() => {
        if (readOnly) {
          if (navigation.canGoBack()) {
            navigation.getParent()?.goBack();
          }
          return;
        }
        navigation.navigate(RootRoutes.Modal, {
          screen: ModalRoutes.BackupWallet,
          params: {
            screen: BackupWalletModalRoutes.BackupWalletMnemonicsVerifyModal,
            params: {
              mnemonics: mnemonicArray,
              walletId,
            },
          },
        });
      }}
      scrollViewProps={{
        children: (
          <Box alignItems="center" flex={1}>
            <Alert
              title={`${intl.formatMessage({
                id: 'backup__manual_backup_warning_never_share',
              })}${intl.formatMessage({
                id: 'backup__manual_backup_warning_never_ask',
              })}`}
              alertType="SeriousWarning"
              expand={false}
              dismiss={false}
            />

            <Box
              mt={6}
              p={4}
              flexDirection="row"
              bg="surface-default"
              borderRadius="12px"
            >
              <Box flex={1}>
                {arrayLeftHalf?.map((word, index) => (
                  <Mnemonic index={index + 1} word={word} />
                ))}
              </Box>
              <Box flex={1}>
                {arrayRightHalf?.map((word, index) => (
                  <Mnemonic index={index + halfWayThough + 1} word={word} />
                ))}
              </Box>
            </Box>

            <Button
              onPress={() => {
                copyContentToClipboard();
              }}
              type="plain"
              leftIconName="DuplicateSolid"
              mt={6}
            >
              {intl.formatMessage({ id: 'action__copy_to_clipboard' })}
            </Button>
          </Box>
        ),
      }}
    />
  );
};

export default BackupShowMnemonicsView;
