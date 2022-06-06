import React, { FC, useCallback, useState } from 'react';

import { useIntl } from 'react-intl';
import { NativeModules } from 'react-native';

import {
  Box,
  Dialog,
  DialogManager,
  Icon,
  Input,
  Pressable,
  Text,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useNavigationActions } from '../../../hooks';

export type ResetDialogProps = {
  onConfirm: () => Promise<void>;
  onClose?: () => void;
};

const ResetDialog: FC<ResetDialogProps> = ({ onConfirm, onClose }) => {
  const isSmallScreen = useIsVerticalLayout();
  const intl = useIntl();

  const [input, setInput] = useState('');

  return (
    <Dialog
      hasFormInsideDialog
      visible
      footerButtonProps={{
        primaryActionTranslationId: 'action__delete',
        primaryActionProps: {
          type: 'destructive',
          isDisabled: input.toUpperCase() !== 'RESET',
        },
        onPrimaryActionPress: async () => {
          await onConfirm?.();
          onClose?.();
        },
        onSecondaryActionPress: () => {
          onClose?.();
        },
      }}
      contentProps={{
        iconType: 'danger',
        title: intl.formatMessage({
          id: 'form__reset_app',
          defaultMessage: 'Reset App',
        }),
        content: intl.formatMessage(
          {
            id: 'modal__reset_app_desc',
          },
          { 0: 'RESET' },
        ),
        input: (
          <Box w="full" mt="4">
            <Input
              w="full"
              value={input}
              size={isSmallScreen ? 'xl' : 'default'}
              onChangeText={(text) => setInput(text.trim())}
            />
          </Box>
        ),
      }}
    />
  );
};

const ResetButton = () => {
  const intl = useIntl();
  const { resetToWelcome } = useNavigationActions();
  const [showBackupModal, setShowBackupModal] = useState(false);

  const onReset = useCallback(async () => {
    if (platformEnv.isNativeIOS) {
      NativeModules.SplashScreenManager.show();
    }
    resetToWelcome();
    return backgroundApiProxy.serviceApp.resetApp();
  }, [resetToWelcome]);

  const onOpenResetHintDialog = useCallback(() => {
    DialogManager.show({
      render: <ResetDialog onConfirm={async () => onReset()} />,
    });
  }, [onReset]);

  const onOpenResetModal = useCallback(async () => {
    const wallets = await backgroundApiProxy.engine.getWallets();
    const isBackup = wallets.filter((wallet) => !wallet.backuped).length === 0;
    if (isBackup) {
      // setShowResetModal(true);
      onOpenResetHintDialog();
    } else {
      setShowBackupModal(true);
    }
  }, [onOpenResetHintDialog]);

  const onBackupConfirm = useCallback(() => {
    setShowBackupModal(false);
    // setTimeout(() => setShowResetModal(true), 500);
    setTimeout(() => onOpenResetHintDialog(), 500);
  }, [onOpenResetHintDialog]);

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
        <Icon name="RestoreOutline" color="icon-critical" />
        <Text
          typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
          color="text-critical"
          flex="1"
          numberOfLines={1}
          mx={3}
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
        visible={showBackupModal}
        onClose={() => setShowBackupModal(false)}
        footerButtonProps={{
          hideSecondaryAction: true,
          onPrimaryActionPress: onBackupConfirm,
          primaryActionTranslationId: 'action__i_got_it',
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
