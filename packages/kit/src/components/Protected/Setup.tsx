import type { FC } from 'react';
import { useCallback, useMemo } from 'react';

import * as Burnt from 'burnt';
import { useIntl } from 'react-intl';
import { Input, Switch, getTokens } from 'tamagui';

import { Button, Form, Icon, Stack, Text, useForm } from '@onekeyhq/components';
import { encodeSensitiveText } from '@onekeyhq/engine/src/secret/encryptors/aes256';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../hooks/redux';
import { useFormOnChangeDebounced } from '../../hooks/useFormOnChangeDebounced';
import { useLocalAuthentication } from '../../hooks/useLocalAuthentication';

type FieldValues = {
  password: string;
  confirmPassword: string;
  withEnableAuthentication: boolean;
};

type SetupProps = {
  skipSavePassword?: boolean;
  onOk?: (text: string, withEnableAuthentication?: boolean) => void;
  hideTitle?: boolean;
};

const Setup: FC<SetupProps> = ({ onOk, skipSavePassword, hideTitle }) => {
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
  // const { control, handleSubmit, getValues } = useFormReturn;
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
        Burnt.toast({
          title: intl.formatMessage({
            id: 'msg__password_needs_to_be_the_same',
          }),
          haptic: 'error',
          icon: {
            ios: {
              name: 'x.circle.fill',
              color: getTokens().color.iconCriticalLight.val,
            },
            web: <Icon name="XCircleSolid" color="$iconCritical" size="$5" />,
          },
        });
        // ToastManager.show(
        //   {
        //     title: intl.formatMessage({
        //       id: 'msg__password_needs_to_be_the_same',
        //     }),
        //   },
        //   { type: 'error' },
        // );
        return;
      }
      const key =
        await backgroundApiProxy.servicePassword.getBgSensitiveTextEncodeKey();
      const encodedPassword = encodeSensitiveText({
        text: values.password,
        key,
      });
      if (boardingCompleted && !skipSavePassword) {
        await backgroundApiProxy.serviceApp.updatePassword('', encodedPassword);
      }
      onOk?.(encodedPassword, values.withEnableAuthentication);
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
    // <KeyboardDismissView
    //   h={isAutoHeight ? { base: 'full', sm: 'auto' } : 'full'}
    //   px={{ base: hideTitle ? 0 : 4, md: 0 }}
    // >
    <>
      {!hideTitle ? (
        <Stack mb="8">
          <Text variant="$bodyLg" textAlign="center" mb={2}>
            🔐{' '}
            {intl.formatMessage({
              id: 'title__set_password',
              defaultMessage: 'Set Password',
            })}
          </Text>
          <Text variant="$bodyMd" textAlign="center" color="text-subdued">
            {intl.formatMessage({
              id: 'Only_you_can_unlock_your_wallet',
              defaultMessage: 'Only you can unlock your wallet',
            })}
          </Text>
        </Stack>
      ) : null}

      <Form
        form={useFormReturn}
        footer={
          <Button
            buttonVariant="primary"
            onPress={useFormReturn.handleSubmit(onSubmit)}
            disabled={submitDisabled}
          >
            {intl.formatMessage({
              id: 'action__continue',
              defaultMessage: 'Continue',
            })}
          </Button>
        }
      >
        <Form.Field
          name="password"
          label="password"
          // control={useFormReturn.control}
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
              const confirmPassword =
                useFormReturn.getValues('confirmPassword');
              if (!confirmPassword || !value) return undefined;
              return confirmPassword !== value
                ? intl.formatMessage({
                    id: 'msg__password_needs_to_be_the_same',
                  })
                : undefined;
            },
          }}
        >
          <Input
            autoFocus
            // press enter key to submit
            onSubmitEditing={useFormReturn.handleSubmit(onSubmit)}
            placeholder={intl.formatMessage(
              {
                id: 'form__rule_at_least_int_digits',
              },
              { 0: 8 },
            )}
          />
        </Form.Field>
        <Form.Field
          name="confirmPassword"
          label=""
          defaultValue=""
          // control={control}
          rules={{
            minLength: {
              value: 8,
              message: intl.formatMessage({
                id: 'msg__password_validation',
              }),
            },
            validate: (value) => {
              const password = useFormReturn.getValues('password');
              if (!password || !value) return undefined;
              return password !== value
                ? intl.formatMessage({
                    id: 'msg__password_needs_to_be_the_same',
                  })
                : undefined;
            },
          }}
        >
          <Input
            // press enter key to submit
            onSubmitEditing={useFormReturn.handleSubmit(onSubmit)}
            placeholder={intl.formatMessage({
              id: 'Confirm_password',
            })}
          />
        </Form.Field>
        {isOk ? (
          <Form.Field
            name="withEnableAuthentication"
            label="withEnableAuthentication"
            defaultValue={isOk}
            // control={control}
          >
            <Switch id="notify">
              <Switch.Thumb animation="quick" />
              <Text>
                {intl.formatMessage(
                  { id: 'content__authentication_with' },
                  {
                    0: text,
                  },
                )}
              </Text>
            </Switch>
            {/* <CheckBox
              title={intl.formatMessage(
                { id: 'content__authentication_with' },
                {
                  0: text,
                },
              )}
            /> */}
          </Form.Field>
        ) : null}
      </Form>
    </>
    // </KeyboardDismissView>
  );
};

export default Setup;
