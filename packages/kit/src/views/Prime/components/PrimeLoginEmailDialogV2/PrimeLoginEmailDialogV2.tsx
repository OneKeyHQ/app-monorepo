import { useCallback, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  Form,
  Input,
  Stack,
  YStack,
} from '@onekeyhq/components';
import { useForm } from '@onekeyhq/components/src/hooks/useForm';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import appStorage from '@onekeyhq/shared/src/storage/appStorage';
import { EAppSyncStorageKeys } from '@onekeyhq/shared/src/storage/syncStorageKeys';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

import { showOneKeyIdLegacyOAuthBindDialog } from '../OneKeyIdLegacyOAuthBind/OneKeyIdLegacyOAuthBind';
import {
  getSanitizedAuthErrorText,
  logOneKeyIdLoginFailureReason,
  showOneKeyIdLoginFailedToast,
  showOneKeyIdLoginSuccessToast,
} from '../oneKeyIdLoginToastUtils';
import { DevTestAccountSelector } from '../PrimeDevUtils/DevTestAccountSelector';
import { PrimeLoginEmailCodeDialogV2 } from '../PrimeLoginEmailCodeDialogV2';

type IPrimeLoginEmailDialogV2Props = {
  onComplete: () => Promise<void>;
  onLoginSuccess?: () => void | Promise<void>;
  title?: string;
  description?: string;
  onConfirm?: (code: string) => void | Promise<void>;
  onCancel?: () => void | Promise<void>;
  disabled?: boolean;
  onSubmittingChange?: (isSubmitting: boolean) => void;
} & (
  | {
      embedded: true;
      embeddedVerificationEmail?: string;
      onEmbeddedVerificationEmailChange: (email?: string) => void;
    }
  | {
      embedded?: false;
      embeddedVerificationEmail?: never;
      onEmbeddedVerificationEmailChange?: never;
    }
);

function PrimeLoginEmailDialogV2(props: IPrimeLoginEmailDialogV2Props) {
  const {
    onComplete,
    onLoginSuccess,
    title,
    description,
    onConfirm,
    onCancel,
    embedded,
    embeddedVerificationEmail,
    onEmbeddedVerificationEmailChange,
    disabled = false,
    onSubmittingChange,
  } = props;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [
    embeddedVerificationSessionEmail,
    setEmbeddedVerificationSessionEmail,
  ] = useState<string>();
  const isSubmittingRef = useRef(false);

  const [devSettings] = useDevSettingsPersistAtom();
  const lastOneKeyIdLoginEmail = appStorage.syncStorage.getString(
    EAppSyncStorageKeys.last_onekey_id_login_email,
  );

  // const isReady = false;
  const {
    isReady,
    useLoginWithEmail,
    // user
  } = useOneKeyAuth();
  const { sendCode, loginWithCode } = useLoginWithEmail();

  const intl = useIntl();

  const form = useForm<{ email: string }>({
    defaultValues: { email: lastOneKeyIdLoginEmail || '' },
  });

  const resetSubmittingState = useCallback(() => {
    isSubmittingRef.current = false;
    setIsSubmitting(false);
    onSubmittingChange?.(false);
  }, [onSubmittingChange]);

  const submit = useCallback(
    async (options: { preventClose?: () => void } = {}) => {
      const { preventClose } = options;
      if (isSubmittingRef.current || disabled) {
        preventClose?.();
        return;
      }
      await form.trigger();
      if (!form.formState.isValid) {
        preventClose?.();
        return;
      }
      const data = form.getValues();

      isSubmittingRef.current = true;
      setIsSubmitting(true);
      onSubmittingChange?.(true);
      let didCloseDialogForNextStep = false;
      let didAdvanceToCodeStep = false;
      try {
        appStorage.syncStorage.set(
          EAppSyncStorageKeys.last_onekey_id_login_email,
          data.email,
        );
        if (embedded) {
          setEmbeddedVerificationSessionEmail(data.email);
          onEmbeddedVerificationEmailChange(data.email);
          didAdvanceToCodeStep = true;
          return;
        }
        await onComplete();
        didCloseDialogForNextStep = true;
        const dialog = Dialog.show({
          onCancel,
          floatingPanelProps: platformEnv.isDesktop
            ? { width: 440 }
            : undefined,
          onClose: async (extra) => {
            // A successful login settles the outer flow explicitly.
            if (extra?.flag === 'loginSuccess') {
              return;
            }
            await onCancel?.();
          },
          renderContent: (
            <PrimeLoginEmailCodeDialogV2
              sendCode={sendCode}
              loginWithCode={loginWithCode}
              email={data.email}
              onConfirm={onConfirm}
              onLoginSuccess={async () => {
                let isDialogClosed = false;
                let isOneKeyIdLoginCommitted = false;
                try {
                  // loginWithCode has already completed the BG-authoritative
                  // OTP verification, session persistence, and Prime commit.
                  isOneKeyIdLoginCommitted = true;
                  showOneKeyIdLoginSuccessToast(intl);
                  // Await the dialog close before the outer continuation
                  // navigates: running close() and pushModal concurrently is
                  // the documented Fabric leftover-dialog hazard. A close
                  // failure must still not turn the committed login into a
                  // cancelled flow, so it only logs.
                  try {
                    await dialog.close({ flag: 'loginSuccess' });
                    isDialogClosed = true;
                  } catch (closeError) {
                    logOneKeyIdLoginFailureReason(
                      `OneKey ID login dialog close failed after committed login: ${getSanitizedAuthErrorText(
                        closeError,
                      )}`,
                      closeError,
                    );
                  }
                  await onLoginSuccess?.();
                  await showOneKeyIdLegacyOAuthBindDialog({
                    type: 'post-email-login',
                  });
                } catch (error) {
                  if (!isOneKeyIdLoginCommitted) {
                    showOneKeyIdLoginFailedToast({ error, intl });
                  }
                  throw error;
                } finally {
                  if (!isDialogClosed) {
                    try {
                      await dialog.close();
                    } catch (closeError) {
                      logOneKeyIdLoginFailureReason(
                        `OneKey ID login dialog final close retry failed: ${getSanitizedAuthErrorText(
                          closeError,
                        )}`,
                        closeError,
                      );
                    }
                  }
                }
              }}
            />
          ),
        });
        didAdvanceToCodeStep = true;
      } catch (error) {
        preventClose?.();
        showOneKeyIdLoginFailedToast({ error, intl });
        if (didCloseDialogForNextStep) {
          await onCancel?.();
        }
      } finally {
        if (!didAdvanceToCodeStep) {
          resetSubmittingState();
        }
      }
    },
    [
      disabled,
      embedded,
      form,
      intl,
      loginWithCode,
      onComplete,
      onConfirm,
      onEmbeddedVerificationEmailChange,
      onLoginSuccess,
      onSubmittingChange,
      resetSubmittingState,
      sendCode,
      onCancel,
    ],
  );

  const handleEmbeddedLoginSuccess = useCallback(async () => {
    showOneKeyIdLoginSuccessToast(intl);
    // OTP verification has already committed the login in the bg runtime.
    // Await the host dialog close before the outer continuation navigates:
    // running close() and pushModal concurrently is the documented Fabric
    // leftover-dialog hazard. A close failure (pathological — Dialog.close
    // otherwise always resolves) must not stop the committed login's
    // continuations, so it only logs.
    try {
      await onComplete();
    } catch (closeError) {
      logOneKeyIdLoginFailureReason(
        `OneKey ID login host dialog close failed after committed login: ${getSanitizedAuthErrorText(
          closeError,
        )}`,
        closeError,
      );
    }
    await onLoginSuccess?.();
    await showOneKeyIdLegacyOAuthBindDialog({
      type: 'post-email-login',
    });
  }, [intl, onComplete, onLoginSuccess]);

  const handleChooseAnotherSignInMethod = useCallback(() => {
    resetSubmittingState();
    onEmbeddedVerificationEmailChange?.(undefined);
  }, [onEmbeddedVerificationEmailChange, resetSubmittingState]);

  const embeddedVerificationCodeContent =
    embedded && embeddedVerificationSessionEmail ? (
      <PrimeLoginEmailCodeDialogV2
        key={embeddedVerificationSessionEmail}
        active={embeddedVerificationEmail === embeddedVerificationSessionEmail}
        sendCode={sendCode}
        loginWithCode={loginWithCode}
        email={embeddedVerificationSessionEmail}
        onConfirm={onConfirm}
        onLoginSuccess={handleEmbeddedLoginSuccess}
        onChooseAnotherSignInMethod={handleChooseAnotherSignInMethod}
      />
    ) : null;
  const showEmailForm = !embedded || embeddedVerificationEmail === undefined;

  const titleContent = (
    <Dialog.Title testID="prime-login-email-title">
      {title ||
        intl.formatMessage({
          id: ETranslations.sign_in_to_onekey_id__title,
        })}
    </Dialog.Title>
  );

  return (
    <>
      {embeddedVerificationCodeContent}
      {showEmailForm ? (
        <Stack>
          {embedded ? null : (
            <Dialog.Header>
              <Dialog.Icon icon="EmailOutline" />
              {titleContent}
              <Dialog.Description>
                {description ||
                  intl.formatMessage({
                    id: ETranslations.onekey_id_auto_create__desc,
                  })}
              </Dialog.Description>
            </Dialog.Header>
          )}
          <YStack gap="$3">
            {devSettings.enabled ? <DevTestAccountSelector /> : null}
            <Form form={form}>
              <Form.Field
                label={intl.formatMessage({
                  id: ETranslations.email__label,
                })}
                name="email"
                rules={{
                  validate: (value) => {
                    if (!value) {
                      return false;
                    }
                    if (!stringUtils.isValidEmail(value)) {
                      return intl.formatMessage({
                        id: ETranslations.prime_onekeyid_email_error,
                      });
                    }
                    return true;
                  },
                  required: {
                    value: true,
                    message: '',
                  },
                  onChange: () => {
                    form.clearErrors();
                  },
                }}
              >
                <Input
                  testID="prime-input"
                  autoFocus={!embedded}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  size="large"
                  placeholder={intl.formatMessage({
                    id: ETranslations.email_address_example__desc,
                  })}
                  flex={1}
                  disabled={disabled || isSubmitting}
                  onChangeText={(text) => text?.trim() ?? text}
                  onSubmitEditing={() => void submit()}
                />
              </Form.Field>
            </Form>
            {embedded ? (
              <Button
                variant="primary"
                size="large"
                testID="prime-login-email-btn"
                loading={isSubmitting}
                disabled={disabled || !form.formState.isValid || !isReady}
                onPress={() => void submit()}
              >
                {intl.formatMessage({
                  id: ETranslations.sign_in_or_sign_up__action,
                })}
              </Button>
            ) : null}
          </YStack>
          {embedded ? null : (
            <Dialog.Footer
              showCancelButton={false}
              onConfirmText={intl.formatMessage({
                id: ETranslations.global_continue,
              })}
              confirmButtonProps={{
                disabled:
                  disabled ||
                  isSubmitting ||
                  !form.formState.isValid ||
                  !isReady,
              }}
              onConfirm={async ({ preventClose }) => {
                await submit({ preventClose });
              }}
            />
          )}
        </Stack>
      ) : null}
    </>
  );
}

export default PrimeLoginEmailDialogV2;
