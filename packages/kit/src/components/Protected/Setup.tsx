import type { FC } from 'react';
import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Form,
  KeyboardDismissView,
  ToastManager,
  Typography,
  useForm,
} from '@onekeyhq/components';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useAppSelector, useLocalAuthentication } from '../../hooks';
import { useFormOnChangeDebounced } from '../../hooks/useFormOnChangeDebounced';

type FieldValues = {
  password: string;
  confirmPassword: string;
  withEnableAuthentication: boolean;
};

type SetupProps = {
  skipSavePassword?: boolean;
  onOk?: (text: string, withEnableAuthentication?: boolean) => void;
  hideTitle?: boolean;
  isAutoHeight?: boolean;
};

const Setup: FC<SetupProps> = ({
  onOk,
  skipSavePassword,
  hideTitle,
  isAutoHeight,
}) => {
  const intl = useIntl();
  const { isOk } = useLocalAuthentication();
  const boardingCompleted = useAppSelector((s) => s.status.boardingCompleted);
  const authenticationType = useAppSelector((s) => s.status.authenticationType);

  const useFormReturn = useForm<FieldValues>({
    mode: 'onBlur',
    reValidateMode: 'onBlur',
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });
  const { control, handleSubmit, getValues } = useFormReturn;
  const { formValues } = useFormOnChangeDebounced({
    useFormReturn,
    revalidate: false,
    clearErrorIfEmpty: true,
  });
  const submitDisabled = useMemo(
    () => !formValues?.password || !formValues?.confirmPassword,
    [formValues?.confirmPassword, formValues?.password],
  );
  const onSubmit = useCallback(
    async (values: FieldValues) => {
      if (values.password !== values.confirmPassword) {
        ToastManager.show(
          {
            title: intl.formatMessage({
              id: 'msg__password_needs_to_be_the_same',
            }),
          },
          { type: 'error' },
        );
        return;
      }
      if (boardingCompleted && !skipSavePassword) {
        await backgroundApiProxy.serviceApp.updatePassword('', values.password);
      }
      onOk?.(values.password, values.withEnableAuthentication);
    },
    [boardingCompleted, skipSavePassword, onOk, intl],
  );
  const text =
    authenticationType === 'FACIAL'
      ? intl.formatMessage({
          id: 'content__face_id',
        })
      : intl.formatMessage({ id: 'content__touch_id' });

  return (
    <KeyboardDismissView
      h={isAutoHeight ? { base: 'full', sm: 'auto' } : 'full'}
      px={{ base: hideTitle ? 0 : 4, md: 0 }}
    >
      {!hideTitle ? (
        <Box mb="8">
          <Typography.DisplayLarge textAlign="center" mb={2}>
            🔐{' '}
            {intl.formatMessage({
              id: 'title__set_password',
              defaultMessage: 'Set Password',
            })}
          </Typography.DisplayLarge>
          <Typography.Body1 textAlign="center" color="text-subdued">
            {intl.formatMessage({
              id: 'Only_you_can_unlock_your_wallet',
              defaultMessage: 'Only you can unlock your wallet',
            })}
          </Typography.Body1>
        </Box>
      ) : null}

      <Form>
        <Form.Item
          name="password"
          defaultValue=""
          control={control}
          rules={{
            minLength: {
              value: 8,
              message: intl.formatMessage({
                id: 'msg__password_validation',
              }),
            },
            maxLength: {
              value: 128,
              message: intl.formatMessage({
                id: 'msg__password_validation',
              }),
            },
            validate: (value) => {
              const confirmPassword = getValues('confirmPassword');
              if (!confirmPassword || !value) return undefined;
              return confirmPassword !== value
                ? intl.formatMessage({
                    id: 'msg__password_needs_to_be_the_same',
                  })
                : undefined;
            },
          }}
        >
          <Form.PasswordInput
            autoFocus
            // press enter key to submit
            onSubmitEditing={handleSubmit(onSubmit)}
            placeholder={intl.formatMessage(
              {
                id: 'form__rule_at_least_int_digits',
              },
              { 0: 8 },
            )}
          />
        </Form.Item>
        <Form.Item
          name="confirmPassword"
          defaultValue=""
          control={control}
          rules={{
            minLength: {
              value: 8,
              message: intl.formatMessage({
                id: 'msg__password_validation',
              }),
            },
            validate: (value) => {
              const password = getValues('password');
              if (!password || !value) return undefined;
              return password !== value
                ? intl.formatMessage({
                    id: 'msg__password_needs_to_be_the_same',
                  })
                : undefined;
            },
          }}
        >
          <Form.PasswordInput
            // press enter key to submit
            onSubmitEditing={handleSubmit(onSubmit)}
            placeholder={intl.formatMessage({
              id: 'Confirm_password',
            })}
          />
        </Form.Item>
        {isOk ? (
          <Form.Item
            name="withEnableAuthentication"
            defaultValue={isOk}
            control={control}
          >
            <Form.CheckBox
              title={intl.formatMessage(
                { id: 'content__authentication_with' },
                {
                  0: text,
                },
              )}
            />
          </Form.Item>
        ) : null}
        <Button
          type="primary"
          size="xl"
          onPress={handleSubmit(onSubmit)}
          isDisabled={submitDisabled}
        >
          {intl.formatMessage({
            id: 'action__continue',
            defaultMessage: 'Continue',
          })}
        </Button>
      </Form>
    </KeyboardDismissView>
  );
};

export default Setup;
