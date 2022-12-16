import { FC, useCallback, useEffect, useState } from 'react';

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
import { RestoreResult } from '@onekeyhq/shared/src/services/ServiceCloudBackup/ServiceCloudBackup.enums';

type RouteProps = RouteProp<
  ImportBackupPasswordRoutesParams,
  ImportBackupPasswordRoutes.ImportBackupPassword
>;

type FieldValues = {
  password: string;
};

const ImportBackupPasswordModal: FC = () => {
  const intl = useIntl();
  const { withPassword, onSuccess, onError } = useRoute<RouteProps>().params;
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
    async (values: FieldValues) => {
      const result = await withPassword(values.password);
      if (result === RestoreResult.SUCCESS) {
        onSuccess();
      } else if (result === RestoreResult.WRONG_PASSWORD) {
        setError(intl.formatMessage({ id: 'msg__wrong_password' }));
      } else {
        onError();
      }
    },
    [intl, withPassword, onSuccess, onError],
  );

  return (
    <Modal footer={null}>
      <KeyboardDismissView px={{ base: 4, md: 0 }} alignItems="center">
        <Image source={CloudLock} w="64px" h="51.2px" m={4} />
        <Typography.DisplayLarge textAlign="center" mb={2}>
          {intl.formatMessage({ id: 'modal__import_backup' })}
        </Typography.DisplayLarge>
        <Typography.Body1 textAlign="center" color="text-subdued">
          {intl.formatMessage({ id: 'modal__import_backup_desc' })}
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
                value: 128,
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
