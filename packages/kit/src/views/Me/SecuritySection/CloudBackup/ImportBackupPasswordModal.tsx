import React, { FC, useCallback } from 'react';

import { RouteProp, useNavigation } from '@react-navigation/core';
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
  const navigation = useNavigation();
  const { onSuccess, onCancel } = useRoute<RouteProps>().params;

  const {
    control,
    handleSubmit,
    formState: { isValid },
    getValues,
  } = useForm<FieldValues>({
    mode: 'onChange',
    defaultValues: {
      password: '',
    },
  });

  const onSubmit = useCallback(
    (values: FieldValues) => {
      navigation.goBack();
      onSuccess(values.password);
    },
    [navigation, onSuccess],
  );

  return (
    <Modal
      footer={null}
      onClose={() => {
        if (!getValues('password')) onCancel?.();
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
          <Button
            type="primary"
            size="xl"
            onPress={handleSubmit(onSubmit)}
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
