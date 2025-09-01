import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  OTPInput,
  SizableText,
  Spinner,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { LazyLoadPage } from '@onekeyhq/kit/src/components/LazyLoadPage';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import type { EPrimeEmailOTPScene } from '@onekeyhq/shared/src/consts/primeConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EModalReferFriendsRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IPrimeUserInfo } from '@onekeyhq/shared/types/prime/primeTypes';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';
import { usePrimeAuthV2 } from '../views/Prime/hooks/usePrimeAuthV2';

const PrimeLoginEmailDialogV2 = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Prime/components/PrimeLoginEmailDialogV2/PrimeLoginEmailDialogV2'
    ),
  0,
  true,
  <Stack>
    <Spinner size="large" />
  </Stack>,
);

const COUNTDOWN_TIME = 60;

export function EmailOTPDialog(props: {
  title: string;
  description: string;
  sendCode: () => Promise<unknown>;
  onConfirm: (code: string) => void | Promise<void>;
  hideResendButton?: boolean;
}) {
  const { sendCode, onConfirm, title, description, hideResendButton } = props;
  const [isSubmittingVerificationCode, setIsSubmittingVerificationCode] =
    useState(false);
  const [countdown, setCountdown] = useState(COUNTDOWN_TIME);
  const [isResending, setIsResending] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [state, setState] = useState<{ status: 'initial' | 'error' | 'done' }>({
    status: 'initial',
  });
  const intl = useIntl();

  useMemo(() => {
    void sendCode();
  }, [sendCode]);

  const sendEmailVerificationCode = useCallback(async () => {
    if (isResending) {
      return;
    }
    setIsResending(true);
    setState({ status: 'initial' });
    setVerificationCode('');
    try {
      await sendCode();
      setCountdown(COUNTDOWN_TIME);
    } finally {
      setIsResending(false);
    }
  }, [isResending, sendCode]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (countdown > 0) {
      timer = setTimeout(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [countdown]);

  const buttonText = useMemo(() => {
    if (countdown > 0)
      return `${intl.formatMessage({
        id: ETranslations.prime_code_resend,
      })} (${countdown}s)`;

    return intl.formatMessage({ id: ETranslations.prime_code_resend });
  }, [intl, countdown]);

  const handleConfirm = useCallback(async () => {
    try {
      setIsConfirming(true);
      await onConfirm(verificationCode);
    } catch (error) {
      console.error('sendEmailOTP error', error);
      setState({ status: 'error' });
    } finally {
      setIsSubmittingVerificationCode(false);
      setIsConfirming(false);
    }
  }, [onConfirm, verificationCode]);

  return (
    <Stack>
      <Dialog.Header>
        <Dialog.Icon icon="BarcodeSolid" />
        <Dialog.Title>{title}</Dialog.Title>
        <Dialog.Description>{description}</Dialog.Description>
      </Dialog.Header>

      <YStack gap="$2">
        {!hideResendButton ? (
          <XStack>
            <Button
              width="auto"
              size="small"
              variant="tertiary"
              disabled={countdown > 0 || isResending}
              onPress={sendEmailVerificationCode}
            >
              {buttonText}
            </Button>
          </XStack>
        ) : null}

        <OTPInput
          autoFocus
          status={state.status === 'error' ? 'error' : 'normal'}
          numberOfDigits={6}
          value={verificationCode}
          onTextChange={(value) => {
            setVerificationCode(value);
            setState({ status: 'initial' });
          }}
        />

        {state.status === 'error' ? (
          <SizableText size="$bodyMd" color="$red9">
            {intl.formatMessage({
              id: ETranslations.prime_invalid_verification_code,
            })}
          </SizableText>
        ) : null}
      </YStack>
      <Dialog.Footer
        showCancelButton={false}
        confirmButtonProps={{
          loading: isSubmittingVerificationCode || isConfirming,
          disabled: verificationCode.length !== 6,
        }}
        onConfirmText={intl.formatMessage({
          id: ETranslations.global_next,
        })}
        onConfirm={async ({ preventClose }) => {
          preventClose();
          await handleConfirm();
        }}
      />
    </Stack>
  );
}

export const useLoginOneKeyId = () => {
  const intl = useIntl();
  const navigation = useAppNavigation();

  const { logout } = usePrimeAuthV2();

  const sendEmailOTP = useCallback(
    async ({
      onConfirm,
      scene,
      description,
    }: {
      onConfirm: ({
        code,
        uuid,
      }: {
        code: string;
        uuid: string;
      }) => Promise<unknown>;
      scene: EPrimeEmailOTPScene;
      description?: ({ userInfo }: { userInfo: IPrimeUserInfo }) => string;
    }) => {
      const userInfo = await backgroundApiProxy.servicePrime.getLocalUserInfo();
      return new Promise<void>((resolve) => {
        let uuid = '';
        const dialog = Dialog.show({
          renderContent: (
            <EmailOTPDialog
              title={intl.formatMessage({
                id: ETranslations.prime_enter_verification_code,
              })}
              description={
                description?.({ userInfo }) ||
                intl.formatMessage(
                  { id: ETranslations.prime_sent_to },
                  { email: userInfo.displayEmail ?? '' },
                )
              }
              onConfirm={async (code: string) => {
                await timerUtils.wait(120);
                await onConfirm({ code, uuid });
                await dialog.close();
                resolve();
              }}
              sendCode={async () => {
                const result =
                  await backgroundApiProxy.servicePrime.sendEmailOTP(scene);
                uuid = result.uuid;
                return result;
              }}
            />
          ),
        });
      });
    },
    [intl],
  );

  const toOneKeyIdPage = useCallback(() => {
    navigation.pushModal(EModalRoutes.ReferFriendsModal, {
      screen: EModalReferFriendsRoutes.OneKeyId,
    });
  }, [navigation]);

  const loginOneKeyId = useCallback(
    async ({
      toOneKeyIdPageOnLoginSuccess,
    }: {
      toOneKeyIdPageOnLoginSuccess?: boolean;
    } = {}) => {
      const isLoggedIn = await backgroundApiProxy.servicePrime.isLoggedIn();
      const onLoginSuccess = async () => {
        if (toOneKeyIdPageOnLoginSuccess) {
          await timerUtils.wait(120);
          toOneKeyIdPage();
        }
      };
      if (isLoggedIn) {
        await onLoginSuccess();
      } else {
        // logout before login, make sure local privy cache is cleared
        void logout();

        // 跳转到登录页面
        const loginDialog = Dialog.show({
          renderContent: (
            <PrimeLoginEmailDialogV2
              title={intl.formatMessage({
                id: ETranslations.prime_signup_login,
              })}
              description={intl.formatMessage({
                id: ETranslations.prime_onekeyid_continue_description,
              })}
              onComplete={() => {
                void loginDialog.close();
              }}
              onLoginSuccess={onLoginSuccess}
            />
          ),
        });
      }
    },
    [intl, logout, toOneKeyIdPage],
  );
  return useMemo(
    () => ({ sendEmailOTP, loginOneKeyId }),
    [loginOneKeyId, sendEmailOTP],
  );
};
