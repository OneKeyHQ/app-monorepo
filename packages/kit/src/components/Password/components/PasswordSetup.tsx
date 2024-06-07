import { memo, useState } from 'react';

import { useIntl } from 'react-intl';

import type { IButtonProps } from '@onekeyhq/components';
import { Button, Form, Input, Unspaced, useForm } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { PasswordRegex, getPasswordKeyboardType } from '../utils';

export interface IPasswordSetupForm {
  password: string;
  confirmPassword: string;
}
interface IPasswordSetupProps {
  loading: boolean;
  onSetupPassword: (data: IPasswordSetupForm) => void;
  biologyAuthSwitchContainer?: React.ReactNode;
  confirmBtnText?: string;
}

const PasswordSetup = ({
  loading,
  onSetupPassword,
  confirmBtnText,
  biologyAuthSwitchContainer,
}: IPasswordSetupProps) => {
  const intl = useIntl();
  const form = useForm<IPasswordSetupForm>({
    mode: 'onSubmit',
    reValidateMode: 'onSubmit',
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });
  const [secureEntry, setSecureEntry] = useState(true);
  const [secureReentry, setSecureReentry] = useState(true);

  return (
    <Form form={form}>
      <Form.Field
        label={intl.formatMessage({
          id: ETranslations.auth_new_password_form_label,
        })}
        name="password"
        rules={{
          required: {
            value: true,
            message: intl.formatMessage({
              id: ETranslations.auth_error_password_empty,
            }),
          },
          minLength: {
            value: 8,
            message: intl.formatMessage(
              { id: ETranslations.auth_error_password_too_short },
              {
                length: 8,
              },
            ),
          },
          maxLength: {
            value: 128,
            message: intl.formatMessage(
              {
                id: ETranslations.auth_erro_password_too_long,
              },
              {
                length: 128,
              },
            ),
          },
          onChange: () => {
            form.clearErrors();
          },
        }}
      >
        <Input
          size="large"
          $gtMd={{
            size: 'medium',
          }}
          placeholder={intl.formatMessage({
            id: ETranslations.auth_new_password_form_placeholder,
          })}
          disabled={loading}
          autoFocus
          keyboardType={getPasswordKeyboardType(!secureEntry)}
          onChangeText={(text) => text.replace(PasswordRegex, '')}
          secureTextEntry={secureEntry}
          addOns={[
            {
              iconName: secureEntry ? 'EyeOffOutline' : 'EyeOutline',
              onPress: () => {
                setSecureEntry(!secureEntry);
              },
              testID: `password-eye-${secureEntry ? 'off' : 'on'}`,
            },
          ]}
          testID="password"
        />
      </Form.Field>
      <Form.Field
        label={intl.formatMessage({
          id: ETranslations.auth_confirm_password_form_label,
        })}
        name="confirmPassword"
        rules={{
          validate: {
            equal: (v, values) => {
              const state = form.getFieldState('password');
              if (!state.error) {
                return v !== values.password
                  ? intl.formatMessage({
                      id: ETranslations.auth_error_password_not_match,
                    })
                  : undefined;
              }
              return undefined;
            },
          },
          onChange: () => {
            form.clearErrors('confirmPassword');
          },
        }}
      >
        <Input
          size="large"
          $gtMd={{
            size: 'medium',
          }}
          placeholder={intl.formatMessage({
            id: ETranslations.auth_confirm_password_form_placeholder,
          })}
          disabled={loading}
          keyboardType={getPasswordKeyboardType(!secureReentry)}
          onChangeText={(text) => text.replace(PasswordRegex, '')}
          secureTextEntry={secureReentry}
          addOns={[
            {
              iconName: secureReentry ? 'EyeOffOutline' : 'EyeOutline',
              onPress: () => {
                setSecureReentry(!secureReentry);
              },
              testID: `confirm-password-eye-${secureReentry ? 'off' : 'on'}`,
            },
          ]}
          testID="confirm-password"
        />
      </Form.Field>
      <Unspaced>{biologyAuthSwitchContainer}</Unspaced>
      <Button
        size="large"
        $gtMd={
          {
            size: 'medium',
          } as IButtonProps
        }
        variant="primary"
        loading={loading}
        onPress={form.handleSubmit(onSetupPassword)}
        testID="set-password"
      >
        {confirmBtnText ??
          intl.formatMessage({ id: ETranslations.auth_set_password })}
      </Button>
    </Form>
  );
};

export default memo(PasswordSetup);
