import { FC } from 'react';

import { IDeviceType } from '@onekeyfe/hd-core';
import { useIntl } from 'react-intl';

import { LottieView, Text } from '@onekeyhq/components';
import EnterPinCodeOnClassic from '@onekeyhq/kit/assets/wallet/enter-pin-code-on-onekey-classic.json';
import EnterPinCodeOnMini from '@onekeyhq/kit/assets/wallet/enter-pin-code-on-onekey-mini.json';
import EnterPinCodeOnTouch from '@onekeyhq/kit/assets/wallet/enter-pin-code-on-onekey-touch.json';

import BaseRequestView, { BaseRequestViewProps } from './BaseRequest';

const getEnterPinCodeAnimation = (type: string) => {
  switch (type) {
    case 'mini':
      return EnterPinCodeOnMini;
    case 'touch':
      return EnterPinCodeOnTouch;
    default:
      return EnterPinCodeOnClassic;
  }
};
type RequestPinViewProps = {
  deviceType: IDeviceType;
  // eslint-disable-next-line react/no-unused-prop-types
  onDeviceInput: boolean;
  onCancel?: () => void;
  // eslint-disable-next-line react/no-unused-prop-types
  onConfirm?: (pin: string) => void;
} & Omit<BaseRequestViewProps, 'children'>;

const RequestPinView: FC<RequestPinViewProps> = ({ deviceType, onCancel }) => {
  const intl = useIntl();

  return (
    <BaseRequestView onCancel={onCancel}>
      <LottieView
        source={getEnterPinCodeAnimation(deviceType)}
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
        {intl.formatMessage({ id: 'modal__input_pin_code' })}
      </Text>
    </BaseRequestView>
  );
};

export default RequestPinView;
