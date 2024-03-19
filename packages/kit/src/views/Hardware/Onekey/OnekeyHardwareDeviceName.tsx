import type { FC } from 'react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useNavigation } from '@react-navigation/native';
import emojiRegex from 'emoji-regex';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Center,
  Form,
  KeyboardDismissView,
  Modal,
  ToastManager,
  Typography,
  useForm,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import Protected from '@onekeyhq/kit/src/components/Protected';
import WalletAvatar from '@onekeyhq/kit/src/components/WalletSelector/WalletAvatar';
import type { OnekeyHardwareRoutesParams } from '@onekeyhq/kit/src/routes/Root/Modal/HardwareOnekey';
import { deviceUtils } from '@onekeyhq/kit/src/utils/hardware';
import { CoreSDKLoader } from '@onekeyhq/shared/src/device/hardwareInstance';
import type {
  IOneKeyDeviceFeatures,
  IOneKeyDeviceType,
} from '@onekeyhq/shared/types';

import type { OnekeyHardwareModalRoutes } from '../../../routes/routesEnum';
import type { IDeviceType } from '@onekeyfe/hd-core';
import type { RouteProp } from '@react-navigation/core';

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
  'classic1s': 'OneKey Classic',
  'mini': 'OneKey Mini',
  'touch': 'OneKey Touch',
  'pro': 'OneKey Pro',
};

const OnekeyHardwareDeviceName: FC<DeviceNameProps> = ({
  walletId,
  deviceFeatures,
}) => {
  const intl = useIntl();

  const navigation = useNavigation();
  const { control, handleSubmit, setError, setValue } = useForm<FieldValues>({
    defaultValues: {
      name: '',
    },
  });
  const [connectId, setConnectId] = useState('');
  const [loading, setLoading] = useState(false);
  const [deviceType, setDeviceType] = useState<IDeviceType | undefined>();

  const getDeviceDefaultLabel = useCallback(
    async (features?: IOneKeyDeviceFeatures) => {
      const { getDeviceType } = await CoreSDKLoader();
      return defaultName[getDeviceType(features)];
    },
    [],
  );

  useEffect(() => {
    const setDeviceInfo = async () => {
      const name =
        deviceFeatures?.label || (await getDeviceDefaultLabel(deviceFeatures));
      setValue('name', name);
      const { getDeviceType } = await CoreSDKLoader();
      setDeviceType(getDeviceType(deviceFeatures));
    };
    setDeviceInfo();
  }, [deviceFeatures, setValue, getDeviceDefaultLabel]);

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
          : await getDeviceDefaultLabel(deviceFeatures);
      await serviceHardware.applySettings(connectId, {
        label,
      });
      await engine.updateWalletName(walletId, label);
      await serviceHardware.updateFeaturesCache(walletId, { label });
      /**
       * use dispatch action to refresh the wallet list
       */
      await serviceAccount.initWallets();
      ToastManager.show({
        title: intl.formatMessage({ id: 'msg__change_saved' }),
      });
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
          <WalletAvatar walletImage="hw" hwWalletType={deviceType} size="xl" />
        </Box>
      </Center>
    ),
    [deviceType],
  );

  return (
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
            validate: (value) => {
              if (!value.length) return true;

              if (emojiRegex().test(value)) {
                return intl.formatMessage({
                  id: 'form__failed_exists_emojis',
                });
              }
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
  );
};

const OnekeyHardwareDeviceNameModal: FC = () => {
  const intl = useIntl();
  const route = useRoute<RouteProps>();
  const { walletId } = route?.params || {};

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

export default memo(OnekeyHardwareDeviceNameModal);
