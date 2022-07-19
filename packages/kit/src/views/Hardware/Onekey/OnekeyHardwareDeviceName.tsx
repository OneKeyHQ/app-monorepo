import React, { FC, useState } from 'react';

import { RouteProp, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Button,
  Form,
  KeyboardDismissView,
  Modal,
  useForm,
} from '@onekeyhq/components';
import {
  OnekeyHardwareModalRoutes,
  OnekeyHardwareRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/HardwareOnekey';

type FieldValues = { name: string };

type RouteProps = RouteProp<
  OnekeyHardwareRoutesParams,
  OnekeyHardwareModalRoutes.OnekeyHardwareDeviceNameModal
>;

const OnekeyHardwareDeviceName: FC = () => {
  const intl = useIntl();
  const { walletId } = useRoute<RouteProps>().params;
  const { control, handleSubmit, setError } = useForm<FieldValues>({
    defaultValues: { name: '' },
  });
  const [loading, setLoading] = useState(false);

  const onSubmit = () => {};

  return (
    <Modal
      header={intl.formatMessage({ id: 'modal__device_name' })}
      footer={null}
    >
      <KeyboardDismissView px={{ base: 4, md: 6 }}>
        <Form>
          <Form.Item name="name" defaultValue="" control={control}>
            <Form.Input size="xl" autoFocus placeholder={walletId} />
          </Form.Item>
        </Form>
        <Button
          mt="6"
          type="primary"
          size="xl"
          isLoading={loading}
          onPress={onSubmit}
        >
          {intl.formatMessage({
            id: 'action__done',
          })}
        </Button>
      </KeyboardDismissView>
    </Modal>
  );
};

export default React.memo(OnekeyHardwareDeviceName);
