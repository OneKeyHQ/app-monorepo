import React, { FC, useEffect, useMemo, useState } from 'react';

import { RouteProp, useRoute } from '@react-navigation/core';
import { useNavigation } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Center,
  Form,
  KeyboardDismissView,
  Modal,
  Typography,
  useForm,
  useToast,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import WalletAvatar from '@onekeyhq/kit/src/components/Header/WalletAvatar';
import Protected from '@onekeyhq/kit/src/components/Protected';
import {
  OnekeyHardwareModalRoutes,
  OnekeyHardwareRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/HardwareOnekey';
import { deviceUtils, getDeviceType } from '@onekeyhq/kit/src/utils/hardware';
import {
  IOneKeyDeviceFeatures,
  IOneKeyDeviceType,
} from '@onekeyhq/shared/types';

type FieldValues = { name: string };

type RouteProps = RouteProp<
  OnekeyHardwareRoutesParams,
  OnekeyHardwareModalRoutes.OnekeyHardwareDeviceNameModal
>;

type DeviceNameProps = {
  walletId: string;
  deviceFeatures?: IOneKeyDeviceFeatures;
};

const defaultName: Record<IOneKeyDeviceType, string> = {
  'classic': 'OneKey Classic',
  'mini': 'OneKey Mini',
  'touch': 'OneKey Touch',
  'pro': 'OneKey Pro',
};

const getDeviceDefaultLabel = (features?: IOneKeyDeviceFeatures) =>
  defaultName[getDeviceType(features)];

const OnekeyHardwareDeviceName: FC<DeviceNameProps> = ({
  walletId,
  deviceFeatures,
}) => {
  const intl = useIntl();
  const toast = useToast();
  const navigation = useNavigation();
  const { control, handleSubmit, setError } = useForm<FieldValues>({
    defaultValues: {
      name: deviceFeatures?.label || getDeviceDefaultLabel(deviceFeatures),
    },
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
      const label =
        values.name && values.name.length > 0
          ? values.name
          : getDeviceDefaultLabel(deviceFeatures);
      await serviceHardware.applySettings(connectId, {
        label,
      });
      await engine.updateWalletName(walletId, label);
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

  const ImageView = useMemo(
    () => (
      <Center>
        <Box width="56px" height="56px">
          <WalletAvatar
            walletImage="hw"
            hwWalletType={getDeviceType(deviceFeatures)}
            size="xl"
          />
        </Box>
      </Center>
    ),
    [deviceFeatures],
  );

  return (
    <>
      <KeyboardDismissView px={{ base: 4, md: 6 }}>
        {ImageView}
        <Form mt="3" mb="2">
          <Form.Item
            name="name"
            control={control}
            rules={{
              maxLength: {
                value: 16,
                message: intl.formatMessage({
                  id: 'msg__exceeding_the_maximum_word_limit',
                }),
              },
            }}
          >
            <Form.Input size="xl" autoFocus />
          </Form.Item>
        </Form>
        <Typography.Body2 color="text-subdued">
          {intl.formatMessage({
            id: 'form__wallet_name_help_text',
          })}
        </Typography.Body2>
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
    </>
  );
};

const OnekeyHardwareDeviceNameModal: FC = () => {
  const intl = useIntl();
  const route = useRoute<RouteProps>();
  const { walletId } = route?.params;

  return (
    <Modal
      header={intl.formatMessage({ id: 'modal__edit_wallet' })}
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
