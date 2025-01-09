import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, Form, Input, Stack, useForm } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

export function PrimeLoginEmailDialog({ promiseId }: { promiseId: number }) {
  const intl = useIntl();

  const form = useForm<{ email: string }>({
    // mode: 'onSubmit',
    // reValidateMode: 'onSubmit',
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
        await backgroundApiProxy.servicePrime.resolvePrimeLoginEmailDialog({
          promiseId,
          email: data.email,
        });
      } catch (error) {
        options?.preventClose?.();
        throw error;
      }
    },
    [form, promiseId],
  );

  return (
    <Stack>
      <Dialog.Icon icon="EmailOutline" />
      <Dialog.Title>Continue with OneKey ID</Dialog.Title>
      <Dialog.Description>
        OneKey ID is all you need to access all prime benefits.
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
              onSubmitEditing={() => submit()} // submit on press enter
            />
          </Form.Field>
        </Form>
      </Stack>
      <Dialog.Footer
        showCancelButton={false}
        onConfirmText="Continue"
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
