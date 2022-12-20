import type { FC } from 'react';

import { useKeepAwake } from 'expo-keep-awake';
import { useIntl } from 'react-intl';

import { Box, Icon, LottieView, Text } from '@onekeyhq/components';
import EnterPassphraseOnClassic from '@onekeyhq/kit/assets/animations/lottie-onekey-classic-enter-passphrase-on-device.json';
import EnterPassphraseOnMini from '@onekeyhq/kit/assets/animations/lottie-onekey-mini-enter-passphrase-on-device.json';
import EnterPassphraseOnPro from '@onekeyhq/kit/assets/animations/lottie-onekey-pro-enter-passphrase-on-device.json';
import EnterPassphraseOnTouch from '@onekeyhq/kit/assets/animations/lottie-onekey-touch-enter-passphrase-on-device.json';
import { SkipAppLock } from '@onekeyhq/kit/src/components/AppLock';

import BaseRequestView from './BaseRequest';

import type { BaseRequestViewProps } from './BaseRequest';
import type { IDeviceType } from '@onekeyfe/hd-core';

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
  // Prevents screen locking
  useKeepAwake();

  return (
    <BaseRequestView {...props}>
      <SkipAppLock />
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
      {passphraseState ? undefined : (
        <Box mt={6}>
          <Box flexDirection="row">
            <Box>
              <Icon name="EyeSlashOutline" size={20} color="icon-subdued" />
            </Box>
            <Text flex={1} ml={3} typography="Body2" color="text-default">
              {intl.formatMessage({
                id: 'msg__use_passphrase_enter_hint_hide_wallet',
              })}
            </Text>
          </Box>
          <Box flexDirection="row" mt={4}>
            <Box>
              <Icon
                name="ExclamationTriangleOutline"
                size={20}
                color="icon-warning"
              />
            </Box>
            <Text flex={1} typography="Body2" ml={3} color="text-default">
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
