import React, { FC } from 'react';

import { useIntl } from 'react-intl';

import { Button, Form, useForm } from '@onekeyhq/components';

import Layout from '../Layout';

import SecondaryContent from './SecondaryContent';

type SetPasswordProps = {
  onPressBackButton?: () => void;
  onPressConfirmButton?: () => void;
  visible?: boolean;
};

const defaultProps = {} as const;

type PasswordsFieldValues = {
  password: string;
  confirmPassword: string;
  withEnableAuthentication: boolean;
};

const SetPassword: FC<SetPasswordProps> = ({
  onPressBackButton,
  onPressConfirmButton,
  visible,
}) => {
  const intl = useIntl();
  const { control } = useForm<PasswordsFieldValues>({
    defaultValues: { password: '' },
    mode: 'onChange',
  });

  return (
    <>
      <Layout
        title={intl.formatMessage({ id: 'title__set_password' })}
        secondaryContent={<SecondaryContent />}
        onPressBackButton={onPressBackButton}
        visible={visible}
      >
        <Form>
          <Form.Item control={control} name="password">
            <Form.PasswordInput
              autoFocus
              placeholder={intl.formatMessage(
                {
                  id: 'form__rule_at_least_int_digits',
                },
                { '0': 8 },
              )}
            />
          </Form.Item>
          <Form.Item control={control} name="confirmPassword">
            <Form.PasswordInput
              placeholder={intl.formatMessage({
                id: 'Confirm_password',
              })}
            />
          </Form.Item>
          <Form.Item control={control} name="withEnableAuthentication">
            <Form.CheckBox
              title={intl.formatMessage({ id: 'content__authentication_with' })}
            />
          </Form.Item>
          <Button size="xl" type="primary" onPress={onPressConfirmButton}>
            {intl.formatMessage({
              id: 'action__continue',
              defaultMessage: 'Continue',
            })}
          </Button>
        </Form>
      </Layout>
    </>
  );
};

SetPassword.defaultProps = defaultProps;

export default SetPassword;
