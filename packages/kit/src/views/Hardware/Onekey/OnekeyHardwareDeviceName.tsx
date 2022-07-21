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
import Protected from '@onekeyhq/kit/src/components/Protected';
import {
  OnekeyHardwareModalRoutes,
  OnekeyHardwareRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/HardwareOnekey';
import { deviceUtils } from '@onekeyhq/kit/src/utils/hardware';
import { IOneKeyDeviceFeatures } from '@onekeyhq/shared/types';

type FieldValues = { name: string };

type RouteProps = RouteProp<
  OnekeyHardwareRoutesParams,
  OnekeyHardwareModalRoutes.OnekeyHardwareDeviceNameModal
>;

type DeviceNameProps = {
  walletId: string;
  deviceFeatures?: IOneKeyDeviceFeatures;
};

const OnekeyHardwareDeviceName: FC<DeviceNameProps> = ({
  walletId,
  deviceFeatures,
}) => {
  const intl = useIntl();
  const toast = useToast();
  const navigation = useNavigation();
  const { control, handleSubmit, setError } = useForm<FieldValues>({
    defaultValues: { name: deviceFeatures?.label ?? '' },
  });
  const [connectId, setConnectId] = useState('');
  const [loading, setLoading] = useState(false);

  const { engine, serviceHardware, serviceAccount } = backgroundApiProxy;
  useEffect(() => {
    engine.getHWDeviceByWalletId(walletId).then((device) => {
      if (!device) return;
      setConnectId(device.mac);
    });
  }, [walletId, engine]);

  const onSubmit = handleSubmit(async (values: FieldValues) => {
    setLoading(true);
    try {
      await serviceHardware.applySettings(connectId, {
        label: values.name,
      });
      await engine.updateWalletName(walletId, values.name);
      /**
       * use dispatch action to refresh the wallet list
       */
      await serviceAccount.initWallets();
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
    <KeyboardDismissView px={{ base: 4, md: 6 }}>
      <Form>
        <Form.Item
          name="name"
          control={control}
          rules={{
            required: true,
          }}
        >
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
  );
};

const OnekeyHardwareDeviceNameModal: FC = () => {
  const intl = useIntl();
  const route = useRoute<RouteProps>();
  const { walletId } = route?.params;

  return (
    <Modal
      header={intl.formatMessage({ id: 'modal__device_name' })}
      footer={null}
      scrollViewProps={{
        contentContainerStyle: {
          flex: 1,
          justifyContent: 'center',
          paddingTop: 24,
          paddingBottom: 24,
        },
        children: (
          <Protected walletId={walletId}>
            {(_, { deviceFeatures }) => (
              <OnekeyHardwareDeviceName
                walletId={walletId}
                deviceFeatures={deviceFeatures}
              />
            )}
          </Protected>
        ),
      }}
    />
  );
};

export default React.memo(OnekeyHardwareDeviceNameModal);
