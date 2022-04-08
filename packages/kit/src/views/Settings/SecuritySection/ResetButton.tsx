import React, { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Dialog,
  Icon,
  Input,
  Pressable,
  Text,
} from '@onekeyhq/components';
import { reload } from '@onekeyhq/kit/src/utils/helper';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

const ResetButton = () => {
  const intl = useIntl();
  const [showResetModal, setShowResetModal] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [input, setInput] = useState('');
  const onReset = useCallback(async () => {
    await backgroundApiProxy.serviceApp.resetApp();
    setShowResetModal(false);
    reload();
  }, []);

  const onOpenResetModal = useCallback(async () => {
    const wallets = await backgroundApiProxy.engine.getWallets();
    const isBackup = wallets.filter((wallet) => !wallet.backuped).length === 0;
    if (isBackup) {
      setShowResetModal(true);
    } else {
      setShowBackupModal(true);
    }
  }, []);

  const onBackupConfirm = useCallback(() => {
    setShowBackupModal(false);
    setTimeout(() => setShowResetModal(true), 500);
  }, []);

  return (
    <>
      <Pressable
        display="flex"
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
        py={4}
        px={{ base: 4, md: 6 }}
        onPress={onOpenResetModal}
      >
        <Text
          typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
          color="text-critical"
          flex="1"
          numberOfLines={1}
          mr="3"
        >
          {intl.formatMessage({
            id: 'form__reset_app',
            defaultMessage: 'Reset App',
          })}
        </Text>
        <Box>
          <Icon name="ChevronRightSolid" size={20} />
        </Box>
      </Pressable>
      <Dialog
        hasFormInsideDialog
        visible={showResetModal}
        onClose={() => setShowResetModal(false)}
        footerButtonProps={{
          primaryActionTranslationId: 'action__delete',
          primaryActionProps: {
            type: 'destructive',
            isDisabled: input.toUpperCase() !== 'RESET',
            onPromise: onReset,
          },
        }}
        contentProps={{
          iconType: 'danger',
          title: intl.formatMessage({
            id: 'form__reset_app',
            defaultMessage: 'Reset App',
          }),
          content: intl.formatMessage({
            id: 'modal__reset_app_desc',
            defaultMessage:
              'This will delete all the data you have created at OneKey, enter "RESET" to reset the App',
          }),
          input: (
            <Box w="full" mt="4">
              <Input
                w="full"
                value={input}
                onChangeText={(text) => setInput(text.trim())}
              />
            </Box>
          ),
        }}
      />
      <Dialog
        visible={showBackupModal}
        onClose={() => setShowBackupModal(false)}
        footerButtonProps={{
          onPrimaryActionPress: onBackupConfirm,
          primaryActionTranslationId: 'action__confirm',
          primaryActionProps: { type: 'primary' },
        }}
        contentProps={{
          iconType: 'info',
          title: intl.formatMessage({
            id: 'modal__back_up_your_wallet',
            defaultMessage: 'Back Up Your Wallet',
          }),
          content: intl.formatMessage({
            id: 'modal__back_up_your_wallet_desc',
            defaultMessage:
              "Before resetting the App, make sure you've backed up all of your wallets.",
          }),
        }}
      />
    </>
  );
};

export default ResetButton;
