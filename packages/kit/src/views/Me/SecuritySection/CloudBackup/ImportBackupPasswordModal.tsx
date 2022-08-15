import React, { FC, useCallback, useEffect, useState } from 'react';

import { RouteProp } from '@react-navigation/core';
import { useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Button,
  Form,
  Image,
  KeyboardDismissView,
  Modal,
  Typography,
  useForm,
} from '@onekeyhq/components';
import CloudLock from '@onekeyhq/kit/assets/3d_cloud_lock.png';
import { useDebounce } from '@onekeyhq/kit/src/hooks';
import {
  ImportBackupPasswordRoutes,
  ImportBackupPasswordRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/ImportBackupPassword';

type RouteProps = RouteProp<
  ImportBackupPasswordRoutesParams,
  ImportBackupPasswordRoutes.ImportBackupPassword
>;

type FieldValues = {
  password: string;
};

const ImportBackupPasswordModal: FC = () => {
  const intl = useIntl();
  const { onSuccess, onCancel } = useRoute<RouteProps>().params;
  const [err, setError] = useState('');

  const {
    control,
    handleSubmit,
    formState: { isValid },
    watch,
  } = useForm<FieldValues>({
    mode: 'onChange',
    defaultValues: {
      password: '',
    },
  });

  const watchedPassword = useDebounce(watch('password'), 200);
  useEffect(() => {
    setError('');
  }, [watchedPassword]);

  const onSubmit = useCallback(
    (values: FieldValues) => {
      onSuccess(values.password).catch((e) => {
        if ((e as { message: string }).message === 'Invalid password') {
          setError(intl.formatMessage({ id: 'msg__wrong_password' }));
        }
      });
    },
    [onSuccess, intl],
  );

  return (
    <Modal
      footer={null}
      onModalClose={() => {
        onCancel?.();
      }}
    >
      <KeyboardDismissView px={{ base: 4, md: 0 }} alignItems="center">
        <Image source={CloudLock} w="64px" h="51.2px" m={4} />
        <Typography.DisplayLarge textAlign="center" mb={2}>
          Import Backup
        </Typography.DisplayLarge>
        <Typography.Body1 textAlign="center" color="text-subdued">
          Verify password to import backup
        </Typography.Body1>
        <Form mt="8">
          <Form.Item
            name="password"
            defaultValue=""
            control={control}
            rules={{
              required: intl.formatMessage({ id: 'form__field_is_required' }),
              minLength: {
                value: 8,
                message: intl.formatMessage({
                  id: 'msg__password_validation',
                }),
              },
              maxLength: {
                value: 24,
                message: intl.formatMessage({
                  id: 'msg__password_validation',
                }),
              },
            }}
          >
            <Form.PasswordInput autoFocus />
          </Form.Item>
          {err ? <Form.FormErrorMessage message={err} /> : null}
          <Button
            type="primary"
            size="xl"
            onPromise={handleSubmit(onSubmit)}
            isDisabled={!isValid}
          >
            {intl.formatMessage({
              id: 'action__unlock',
              defaultMessage: 'Unlock',
            })}
          </Button>
        </Form>
      </KeyboardDismissView>
    </Modal>
  );
};

export default ImportBackupPasswordModal;
