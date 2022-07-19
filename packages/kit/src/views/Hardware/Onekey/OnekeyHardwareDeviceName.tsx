import React, { FC, useEffect, useState } from 'react';

import { RouteProp, useRoute } from '@react-navigation/core';
import { useNavigation } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Button,
  Form,
  KeyboardDismissView,
  Modal,
  useForm,
  useToast,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  OnekeyHardwareModalRoutes,
  OnekeyHardwareRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/HardwareOnekey';
import { deviceUtils } from '@onekeyhq/kit/src/utils/hardware';

type FieldValues = { name: string };

type RouteProps = RouteProp<
  OnekeyHardwareRoutesParams,
  OnekeyHardwareModalRoutes.OnekeyHardwareDeviceNameModal
>;

const OnekeyHardwareDeviceName: FC = () => {
  const intl = useIntl();
  const toast = useToast();
  const navigation = useNavigation();
  const { walletId } = useRoute<RouteProps>().params;
  const { control, setValue, handleSubmit, setError } = useForm<FieldValues>({
    defaultValues: { name: '' },
  });
  const [connectId, setConnectId] = useState('');
  const [loading, setLoading] = useState(false);

  const { engine, serviceHardware } = backgroundApiProxy;
  useEffect(() => {
    engine.getHWDeviceByWalletId(walletId).then((device) => {
      if (!device) return;
      setConnectId(device.mac);
    });
  }, [walletId, engine]);

  useEffect(() => {
    if (!connectId) return;
    serviceHardware
      .getFeatures(connectId)
      .then((res) => {
        setValue('name', (res && res.label) ?? '');
      })
      .catch((err) => {
        const { key } = err;
        toast.show(
          { title: intl.formatMessage({ id: key }) },
          { type: 'error' },
        );
        navigation.goBack();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectId]);

  const onSubmit = handleSubmit(async (values: FieldValues) => {
    setLoading(true);
    try {
      await serviceHardware.applySettings(connectId, {
        label: values.name,
      });
      toast.show({ title: intl.formatMessage({ id: 'msg__change_saved' }) });
      navigation.getParent()?.goBack();
    } catch (e) {
      const error = deviceUtils.convertDeviceError(e);
      setError('name', {
        message: intl.formatMessage({ id: error.key ?? 'msg__unknown_error' }),
      });
    } finally {
      setLoading(false);
    }
  });

  return (
    <Modal
      header={intl.formatMessage({ id: 'modal__device_name' })}
      footer={null}
    >
      <KeyboardDismissView px={{ base: 4, md: 6 }}>
        <Form>
          <Form.Item name="name" control={control}>
            <Form.Input size="xl" autoFocus />
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
