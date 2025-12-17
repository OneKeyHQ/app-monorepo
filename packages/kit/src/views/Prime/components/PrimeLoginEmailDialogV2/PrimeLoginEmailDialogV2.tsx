import { useCallback, useRef } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, Form, Input, Stack, useForm } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import appStorage from '@onekeyhq/shared/src/storage/appStorage';
import { EAppSyncStorageKeys } from '@onekeyhq/shared/src/storage/syncStorageKeys';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { PrimeLoginEmailCodeDialogV2 } from '../PrimeLoginEmailCodeDialogV2';

function PrimeLoginEmailDialogV2(props: {
  onComplete: () => void;
  onLoginSuccess?: () => void | Promise<void>;
  title?: string;
  description?: string;
  onConfirm?: (code: string) => void;
  onCancel?: () => void | Promise<void>;
}) {
  const {
    onComplete,
    onLoginSuccess,
    title,
    description,
    onConfirm,
    onCancel,
  } = props;

  const lastOneKeyIdLoginEmail = appStorage.syncStorage.getString(
    EAppSyncStorageKeys.last_onekey_id_login_email,
  );

  // const isReady = false;
  const {
    isReady,
    getAccessToken,
    useLoginWithEmail,
    // user
  } = useOneKeyAuth();
  const { sendCode, loginWithCode } = useLoginWithEmail();

  const intl = useIntl();

  const form = useForm<{ email: string }>({
    defaultValues: { email: lastOneKeyIdLoginEmail || '' },
  });

  const submit = useCallback(
    async (options: { preventClose?: () => void } = {}) => {
      const { preventClose } = options;
      await form.trigger();
      if (!form.formState.isValid) {
        preventClose?.();
        return;
      }
      const data = form.getValues();

      appStorage.syncStorage.set(
        EAppSyncStorageKeys.last_onekey_id_login_email,
        data.email,
      );

      try {
        onComplete?.();
        await timerUtils.wait(550);
        const dialog = Dialog.show({
          onCancel,
          onClose: onCancel,
          renderContent: (
            <PrimeLoginEmailCodeDialogV2
              sendCode={sendCode}
              loginWithCode={loginWithCode}
              email={data.email}
              onConfirm={onConfirm}
              onLoginSuccess={async () => {
                try {
                  const token = await getAccessToken();
                  await backgroundApiProxy.servicePrime.apiLogin({
                    accessToken: token || '',
                  });
                  await onLoginSuccess?.();
                } finally {
                  await dialog.close();
                }
              }}
            />
          ),
        });
      } catch (error) {
        preventClose?.();
        throw error;
      }
    },
    [
      form,
      getAccessToken,
      loginWithCode,
      onComplete,
      onConfirm,
      onLoginSuccess,
      sendCode,
      onCancel,
    ],
  );

  return (
    <Stack>
      <Dialog.Header>
        <Dialog.Icon icon="EmailOutline" />
        <Dialog.Title>
          {title ||
            intl.formatMessage({
              id: ETranslations.prime_signup_login,
            })}
        </Dialog.Title>
        <Dialog.Description>
          {description ||
            intl.formatMessage({
              id: ETranslations.prime_onekeyid_continue_description,
            })}
        </Dialog.Description>
      </Dialog.Header>
      <Stack>
        <Form form={form}>
          <Form.Field
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
              autoFocus
              autoCapitalize="none"
              size="large"
              placeholder="your@email.com"
              flex={1}
              onChangeText={(text) => text?.trim() ?? text}
              onSubmitEditing={() => submit()}
            />
          </Form.Field>
        </Form>
      </Stack>
      <Dialog.Footer
        showCancelButton={false}
        onConfirmText={intl.formatMessage({
          id: ETranslations.global_continue,
        })}
        confirmButtonProps={{
          disabled: !form.formState.isValid || !isReady,
        }}
        onConfirm={async ({ preventClose }) => {
          await submit({ preventClose });
        }}
      />
    </Stack>
  );
}

export default PrimeLoginEmailDialogV2;
