import type { FC } from 'react';
import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Dialog,
  Icon,
  Input,
  Pressable,
  Text,
  useIsVerticalLayout,
} from '@onekeyhq/components';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { showDialog, showOverlay } from '../../../utils/overlayUtils';
import { showSplashScreen } from '../../Overlay/showSplashScreen';

export type ResetDialogProps = {
  onConfirm: () => Promise<void>;
  onClose?: () => void;
};

const ResetDialog: FC<ResetDialogProps> = ({ onConfirm, onClose }) => {
  const isSmallScreen = useIsVerticalLayout();
  const intl = useIntl();

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  return (
    <Dialog
      hasFormInsideDialog
      visible
      footerButtonProps={{
        primaryActionTranslationId: 'action__delete',
        primaryActionProps: {
          type: 'destructive',
          isDisabled: input.toUpperCase() !== 'RESET',
          isLoading: loading,
        },
        onPrimaryActionPress: async () => {
          setLoading(true);
          await onConfirm();
          setLoading(false);
          onClose?.();
        },
        onSecondaryActionPress: onClose,
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
              placeholder="RESET"
            />
          </Box>
        ),
      }}
    />
  );
};

const ResetButton = () => {
  const intl = useIntl();
  const openResetHintDialog = useCallback(() => {
    showDialog(
      <ResetDialog
        onConfirm={async () => {
          showSplashScreen();
          return backgroundApiProxy.serviceApp.resetApp();
        }}
      />,
    );
  }, []);

  const openBackupModal = useCallback(() => {
    showOverlay(
      (onClose) => (
        <Dialog
          visible
          onClose={onClose}
          footerButtonProps={{
            hideSecondaryAction: true,
            onPrimaryActionPress: () => {
              onClose();
              setTimeout(openResetHintDialog, 500);
            },
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
      ),
      true,
    );
  }, [intl, openResetHintDialog]);

  const onOpenResetModal = useCallback(async () => {
    const wallets = await backgroundApiProxy.engine.getWallets();
    const isBackup = wallets.filter((wallet) => !wallet.backuped).length === 0;
    if (isBackup) {
      // setShowResetModal(true);
      openResetHintDialog();
    } else {
      openBackupModal();
    }
  }, [openBackupModal, openResetHintDialog]);

  return (
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
        <Icon name="ChevronRightMini" color="icon-subdued" size={20} />
      </Box>
    </Pressable>
  );
};

export default ResetButton;
