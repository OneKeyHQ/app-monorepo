import { FC } from 'react';

import { IDeviceType } from '@onekeyfe/hd-core';
import { useIntl } from 'react-intl';

import { Box, Icon, LottieView, Text } from '@onekeyhq/components';
import EnterPassphraseOnClassic from '@onekeyhq/kit/assets/animations/lottie-onekey-classic-enter-passphrase-on-device.json';
import EnterPassphraseOnMini from '@onekeyhq/kit/assets/animations/lottie-onekey-mini-enter-passphrase-on-device.json';
import EnterPassphraseOnPro from '@onekeyhq/kit/assets/animations/lottie-onekey-pro-enter-passphrase-on-device.json';
import EnterPassphraseOnTouch from '@onekeyhq/kit/assets/animations/lottie-onekey-touch-enter-passphrase-on-device.json';

import BaseRequestView, { BaseRequestViewProps } from './BaseRequest';

type RequestPassphraseOnDeviceViewProps = {
  deviceType: IDeviceType;
  passphraseState?: string;
} & Omit<BaseRequestViewProps, 'children'>;

const getEnterPassphraseAnimation = (type: IDeviceType) => {
  switch (type) {
    case 'classic':
      return EnterPassphraseOnClassic;
    case 'mini':
      return EnterPassphraseOnMini;
    case 'touch':
      return EnterPassphraseOnTouch;
    case 'pro':
      return EnterPassphraseOnPro;
    default:
      // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-case-declarations
      const checkType: never = type;
  }
};

const RequestPassphraseOnDeviceView: FC<RequestPassphraseOnDeviceViewProps> = ({
  deviceType,
  passphraseState,
  ...props
}) => {
  const intl = useIntl();

  return (
    <BaseRequestView {...props}>
      <LottieView
        source={getEnterPassphraseAnimation(deviceType)}
        autoPlay
        loop
        style={{ width: '100%' }}
      />

      <Text
        typography="DisplayMedium"
        mt={6}
        textAlign="center"
        color="text-default"
      >
        {intl.formatMessage({ id: 'msg__enter_passphrase_on_device' })}
      </Text>
      {passphraseState ? (
        <Text typography="Body2" mr={2} textAlign="center" color="text-subdued">
          {intl.formatMessage({ id: 'msg__enter_passphrase_on_device_dsc' })}
        </Text>
      ) : (
        <Box mt={6} mr={4}>
          <Box flexDirection="row">
            <Box>
              <Icon name="EyeOffOutline" size={20} color="icon-subdued" />
            </Box>
            <Text ml={3} mr={2} typography="Body2" color="text-default">
              {intl.formatMessage({
                id: 'msg__use_passphrase_enter_hint_hide_wallet',
              })}
            </Text>
          </Box>
          <Box flexDirection="row" mt={4}>
            <Box>
              <Icon name="ExclamationOutline" size={20} color="icon-warning" />
            </Box>
            <Text typography="Body2" ml={3} mr={2} color="text-default">
              {intl.formatMessage({
                id: 'msg__use_passphrase_enter_hint_not_forget',
              })}
            </Text>
          </Box>
        </Box>
      )}
    </BaseRequestView>
  );
};

export default RequestPassphraseOnDeviceView;
