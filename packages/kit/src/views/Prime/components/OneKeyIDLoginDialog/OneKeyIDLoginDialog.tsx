import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  AnimatePresence,
  Dialog,
  HeightTransition,
  Toast,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import appStorage from '@onekeyhq/shared/src/storage/appStorage';
import { EAppSyncStorageKeys } from '@onekeyhq/shared/src/storage/syncStorageKeys';

import { usePrimeAuthV2 } from '../../hooks/usePrimeAuthV2';

import { OneKeyIDLoginContent } from './OneKeyIDLoginContent';
import { OneKeyIDVerifyCodeContent } from './OneKeyIDVerifyCodeContent';

type IView = 'login' | 'verify';

export type IOneKeyIDLoginDialogVariant = 'keylessWallet' | 'default';

export interface IOneKeyIDLoginDialogProps {
  variant?: IOneKeyIDLoginDialogVariant;
  onLoginSuccess?: () => void | Promise<void>;
  onClose?: () => void;
}

export function OneKeyIDLoginDialog({
  variant = 'default',
  onLoginSuccess,
  onClose,
}: IOneKeyIDLoginDialogProps) {
  const intl = useIntl();
  const [view, setView] = useState<IView>('login');
  const [email, setEmail] = useState('');

  const { getAccessToken, useLoginWithEmail } = usePrimeAuthV2();

  const { sendCode, loginWithCode } = useLoginWithEmail({
    onComplete: async () => {
      // Handle login complete
    },
    onError: (error) => {
      console.error('prime login error', error);
    },
  });

  const handleEmailSubmit = useCallback((submittedEmail: string) => {
    appStorage.syncStorage.set(
      EAppSyncStorageKeys.last_onekey_id_login_email,
      submittedEmail,
    );
    setEmail(submittedEmail);
    setView('verify');
  }, []);

  const handleBack = useCallback(() => {
    setView('login');
  }, []);

  const handleLoginSuccess = useCallback(async () => {
    try {
      const token = await getAccessToken();
      await backgroundApiProxy.servicePrime.apiLogin({
        accessToken: token || '',
      });

      Toast.success({
        title: intl.formatMessage({ id: ETranslations.id_login_success }),
      });

      await onLoginSuccess?.();
      onClose?.();
    } catch (error) {
      console.error('Login success handler error', error);
    }
  }, [getAccessToken, intl, onLoginSuccess, onClose]);

  const title =
    variant === 'keylessWallet'
      ? 'Create keyless wallet'
      : intl.formatMessage({ id: ETranslations.prime_signup_login });

  return (
    <YStack mx="$-5">
      <Dialog.Header>
        <Dialog.Title>{title}</Dialog.Title>
      </Dialog.Header>

      <HeightTransition initialHeight={220}>
        <YStack px="$5">
          <AnimatePresence exitBeforeEnter initial={false}>
            {view === 'login' ? (
              <YStack
                key="login"
                animation="quick"
                enterStyle={{
                  opacity: 0,
                  x: -20,
                  filter: 'blur(4px)',
                }}
              >
                <OneKeyIDLoginContent
                  variant={variant}
                  onEmailSubmit={handleEmailSubmit}
                />
              </YStack>
            ) : (
              <YStack
                key="verify"
                animation="quick"
                enterStyle={{
                  opacity: 0,
                  x: 20,
                  filter: 'blur(4px)',
                }}
              >
                <OneKeyIDVerifyCodeContent
                  email={email}
                  sendCode={sendCode}
                  loginWithCode={loginWithCode}
                  onLoginSuccess={handleLoginSuccess}
                  onBack={handleBack}
                />
              </YStack>
            )}
          </AnimatePresence>
        </YStack>
      </HeightTransition>
    </YStack>
  );
}

export function showOneKeyIDLoginDialog(
  props: Omit<IOneKeyIDLoginDialogProps, 'onClose'> = {},
) {
  const dialog = Dialog.show({
    showFooter: false,
    renderContent: (
      <OneKeyIDLoginDialog
        {...props}
        onClose={async () => {
          await dialog.close();
        }}
      />
    ),
  });
  return dialog;
}
