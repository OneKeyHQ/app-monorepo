import { FC } from 'react';

import { IDeviceType } from '@onekeyfe/hd-core';
import { useIntl } from 'react-intl';

import { LottieView, Text } from '@onekeyhq/components';
import EnterPassphraseOnClassic from '@onekeyhq/kit/assets/animations/lottie-onekey-classic-enter-passphrase-on-device.json';
import EnterPassphraseOnMini from '@onekeyhq/kit/assets/animations/lottie-onekey-mini-enter-passphrase-on-device.json';
import EnterPassphraseOnTouch from '@onekeyhq/kit/assets/animations/lottie-onekey-touch-enter-passphrase-on-device.json';

import BaseRequestView, { BaseRequestViewProps } from './BaseRequest';

type RequestPassphraseOnDeviceViewProps = {
  deviceType: IDeviceType;
} & Omit<BaseRequestViewProps, 'children'>;

const getEnterPassphraseAnimation = (type: string) => {
  switch (type) {
    case 'mini':
      return EnterPassphraseOnMini;
    case 'touch':
      return EnterPassphraseOnTouch;
    default:
      return EnterPassphraseOnClassic;
  }
};

const RequestPassphraseOnDeviceView: FC<RequestPassphraseOnDeviceViewProps> = ({
  deviceType,
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
      <Text typography="Body2" mr={2} textAlign="center" color="text-subdued">
        {intl.formatMessage({ id: 'msg__enter_passphrase_on_device_dsc' })}
      </Text>
    </BaseRequestView>
  );
};

export default RequestPassphraseOnDeviceView;
