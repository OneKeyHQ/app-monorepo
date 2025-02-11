import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, Form, Input, Stack, useForm } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

import { usePrivyUniversalV2 } from '../../hooks/usePrivyUniversalV2';
import { PrimeLoginEmailCodeDialogV2 } from '../PrimeLoginEmailCodeDialogV2';

export function PrimeLoginEmailDialogV2() {
  const { getAccessToken, useLoginWithEmail } = usePrivyUniversalV2();
  const { sendCode, loginWithCode } = useLoginWithEmail({
    onComplete: async () => {
      console.log('🔑 ✅ User successfully logged in with email');
      const token = await getAccessToken();
      await backgroundApiProxy.servicePrime.apiLogin({
        accessToken: token || '',
      });
    },
    onError: (error) => {
      console.log(error);
    },
  });
  const intl = useIntl();

  const form = useForm<{ email: string }>({
    defaultValues: { email: '' },
  });

  const submit = useCallback(
    async (options: { preventClose?: () => void } = {}) => {
      await form.trigger();
      if (!form.formState.isValid) {
        options?.preventClose?.();
        return;
      }
      const data = form.getValues();

      try {
        console.log('onEmailSubmitted', data);
        // TODO dialog not close when submit by press Enter

        void sendCode({ email: data.email });

        Dialog.show({
          renderContent: (
            <PrimeLoginEmailCodeDialogV2
              sendCode={sendCode}
              loginWithCode={loginWithCode}
              email={data.email}
            />
          ),
        });
      } catch (error) {
        options?.preventClose?.();
        throw error;
      }
    },
    [form, loginWithCode, sendCode],
  );

  return (
    <Stack>
      <Dialog.Icon icon="EmailOutline" />
      <Dialog.Title>
        {intl.formatMessage({
          id: ETranslations.prime_onekeyid_continue,
        })}
      </Dialog.Title>
      <Dialog.Description>
        {intl.formatMessage({
          id: ETranslations.prime_onekeyid_continue_description,
        })}
      </Dialog.Description>
      <Stack pt="$4">
        <Form form={form}>
          <Form.Field
            name="email"
            rules={{
              validate: (value) => {
                if (!value) {
                  return 'email is required';
                }
                if (!stringUtils.isValidEmail(value)) {
                  return 'invalid email';
                }
                return true;
              },
              required: {
                value: true,
                message: 'email is required',
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
          disabled: !form.formState.isValid,
        }}
        onConfirm={async ({ preventClose }) => {
          await submit({ preventClose });
        }}
      />
    </Stack>
  );
}
