import type { FC } from 'react';
import { useCallback, useEffect, useState } from 'react';

import { useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Form,
  Icon,
  KeyboardDismissView,
  Modal,
  Typography,
  useForm,
} from '@onekeyhq/components';
import { useDebounce } from '@onekeyhq/kit/src/hooks';
import type { ImportBackupPasswordRoutesParams } from '@onekeyhq/kit/src/routes/Root/Modal/ImportBackupPassword';
import { RestoreResult } from '@onekeyhq/shared/src/services/ServiceCloudBackup/ServiceCloudBackup.enums';

import type { ImportBackupPasswordModalRoutes } from '../../../../routes/routesEnum';
import type { RouteProp } from '@react-navigation/core';

type RouteProps = RouteProp<
  ImportBackupPasswordRoutesParams,
  ImportBackupPasswordModalRoutes.ImportBackupPassword
>;

type FieldValues = {
  password: string;
};

const ImportBackupPasswordModal: FC = () => {
  const intl = useIntl();
  const { withPassword, onSuccess, onError, onCancel } =
    useRoute<RouteProps>().params;
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
    <Modal
      footer={null}
      onModalClose={() => {
        onCancel?.();
      }}
    >
      <KeyboardDismissView px={{ base: 4, md: 0 }} alignItems="center">
        <Box
          mb="16px"
          p="12px"
          borderRadius="full"
          bgColor="decorative-surface-one"
        >
          <Icon name="LockClosedOutline" color="decorative-icon-one" />
        </Box>
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
