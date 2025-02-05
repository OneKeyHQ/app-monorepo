import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, Form, Input, Stack, useForm } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

export function PrimeLoginEmailDialogV2(props: {
  onEmailSubmitted: (email: string) => void;
}) {
  const { onEmailSubmitted } = props;
  const intl = useIntl();

  const form = useForm<{ email: string }>({
    defaultValues: { email: 'yao.hou@onekey.so' },
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
        onEmailSubmitted?.(data.email);
      } catch (error) {
        options?.preventClose?.();
        throw error;
      }
    },
    [form, onEmailSubmitted],
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
