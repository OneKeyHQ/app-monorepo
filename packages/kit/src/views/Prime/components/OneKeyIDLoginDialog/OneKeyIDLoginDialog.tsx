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
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import appStorage from '@onekeyhq/shared/src/storage/appStorage';
import { EAppSyncStorageKeys } from '@onekeyhq/shared/src/storage/syncStorageKeys';

import { OneKeyIDLoginContent } from './OneKeyIDLoginContent';
import { OneKeyIDVerifyCodeContent } from './OneKeyIDVerifyCodeContent';

type IView = 'login' | 'verify';

export interface IOneKeyIDLoginDialogProps {
  /** Initial view to display. Defaults to 'login'. Use 'verify' to skip email input (requires email prop). */
  initialView?: IView;
  /** Email address to use when initialView is 'verify'. */
  email?: string;
  onLoginSuccess?: () => void | Promise<void>;
  onClose?: () => void;
  /** Called when dialog is dismissed without successful login */
  onDismiss?: () => void;
}

export function OneKeyIDLoginDialog({
  initialView = 'login',
  email: emailProp,
  onLoginSuccess,
  onClose,
}: IOneKeyIDLoginDialogProps) {
  const intl = useIntl();
  const [view, setView] = useState<IView>(initialView);
  const [email, setEmail] = useState(emailProp ?? '');

  const { getAccessToken, useLoginWithEmail } = useOneKeyAuth();

  const { sendCode, loginWithCode: supabaseLoginWithCode } =
    useLoginWithEmail();

  // Wrap loginWithCode to ensure email is always provided
  const loginWithCode = useCallback(
    async ({ code, email: emailParam }: { code: string; email?: string }) => {
      await supabaseLoginWithCode({ code, email: emailParam || email });
    },
    [supabaseLoginWithCode, email],
  );

  const handleEmailSubmit = useCallback((submittedEmail: string) => {
    appStorage.syncStorage.set(
      EAppSyncStorageKeys.last_onekey_id_login_email,
      submittedEmail,
    );
    setEmail(submittedEmail);
    setView('verify');
  }, []);

  const handleBack = useCallback(() => {
    // If we started directly on verify view, close the dialog instead of going back
    if (initialView === 'verify') {
      onClose?.();
    } else {
      setView('login');
    }
  }, [initialView, onClose]);

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

  const getTitle = () => {
    if (view === 'verify') {
      return intl.formatMessage({
        id: ETranslations.prime_enter_verification_code,
      });
    }
    return intl.formatMessage({ id: ETranslations.prime_signup_login });
  };
  const title = getTitle();

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
                <OneKeyIDLoginContent onEmailSubmit={handleEmailSubmit} />
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
  const { onDismiss, onLoginSuccess, ...restProps } = props;
  let loginSucceeded = false;

  const dialog = Dialog.show({
    showFooter: false,
    onClose: () => {
      // Called when dialog is dismissed (X button, outside click, back button, etc.)
      if (!loginSucceeded) {
        onDismiss?.();
      }
    },
    renderContent: (
      <OneKeyIDLoginDialog
        {...restProps}
        onLoginSuccess={async () => {
          loginSucceeded = true;
          await onLoginSuccess?.();
        }}
        onClose={async () => {
          await dialog.close();
        }}
      />
    ),
  });
  return dialog;
}
