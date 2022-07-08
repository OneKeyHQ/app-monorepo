import { FC } from 'react';

import { IDeviceType } from '@onekeyfe/hd-core';
import { useIntl } from 'react-intl';

import { LottieView, Text } from '@onekeyhq/components';
import ConfirmOnClassic from '@onekeyhq/kit/assets/wallet/confirm-on-onekey-classic.json';
import ConfirmOnMini from '@onekeyhq/kit/assets/wallet/confirm-on-onekey-mini.json';
import ConfirmOnTouch from '@onekeyhq/kit/assets/wallet/confirm-on-onekey-touch.json';

import BaseRequestView, { BaseRequestViewProps } from './BaseRequest';

const getConfirmAnimation = (type: string) => {
  switch (type) {
    case 'mini':
      return ConfirmOnMini;
    case 'touch':
      return ConfirmOnTouch;
    default:
      return ConfirmOnClassic;
  }
};

type RequestConfirmViewProps = {
  deviceType: IDeviceType;
  bootLoader?: boolean;
} & Omit<BaseRequestViewProps, 'children'>;

const RequestConfirmView: FC<RequestConfirmViewProps> = ({
  deviceType,
  bootLoader,
  ...props
}) => {
  const intl = useIntl();

  return (
    <BaseRequestView {...props}>
      <LottieView
        source={getConfirmAnimation(deviceType)}
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
        {bootLoader
          ? intl.formatMessage({ id: 'msg__firmware_is_being_upgraded' })
          : intl.formatMessage({ id: 'modal__confirm_on_device' })}
      </Text>
    </BaseRequestView>
  );
};

export default RequestConfirmView;
