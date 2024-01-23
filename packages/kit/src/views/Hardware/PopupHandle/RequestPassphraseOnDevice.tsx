import { useEffect, useState } from 'react';
import type { FC } from 'react';

import { useKeepAwake } from 'expo-keep-awake';
import { useIntl } from 'react-intl';

import { Box, CheckBox, Icon, LottieView, Text } from '@onekeyhq/components';
import EnterPassphraseOnClassic from '@onekeyhq/kit/assets/animations/lottie-onekey-classic-enter-passphrase-on-device.json';
import EnterPassphraseOnMini from '@onekeyhq/kit/assets/animations/lottie-onekey-mini-enter-passphrase-on-device.json';
import EnterPassphraseOnPro from '@onekeyhq/kit/assets/animations/lottie-onekey-pro-enter-passphrase-on-device.json';
import EnterPassphraseOnTouch from '@onekeyhq/kit/assets/animations/lottie-onekey-touch-enter-passphrase-on-device.json';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { SkipAppLock } from '@onekeyhq/kit/src/components/AppLock';
import { setPendingRememberWalletConnectId } from '@onekeyhq/kit/src/store/reducers/hardware';

import BaseRequestView from './BaseRequest';

import type { BaseRequestViewProps } from './BaseRequest';
import type { IDeviceType } from '@onekeyfe/hd-core';

type RequestPassphraseOnDeviceViewProps = {
  connectId: string;
  deviceType: IDeviceType;
  passphraseState?: string;
} & Omit<BaseRequestViewProps, 'children'>;

const getEnterPassphraseAnimation = (type: IDeviceType) => {
  switch (type) {
    case 'classic':
    case 'classic1s':
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
  connectId,
  deviceType,
  passphraseState,
  ...props
}) => {
  const intl = useIntl();
  const { dispatch } = backgroundApiProxy;
  // Prevents screen locking
  useKeepAwake();

  const [removeWalletWhenExit, setRemoveWalletWhenExit] = useState(true);

  useEffect(() => {
    dispatch(
      setPendingRememberWalletConnectId(
        removeWalletWhenExit ? undefined : connectId,
      ),
    );
  }, [connectId, dispatch, removeWalletWhenExit]);

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
      {passphraseState ? null : (
        <Box mt={6}>
          <Box flexDirection="row">
            <Box>
              <CheckBox
                isChecked={removeWalletWhenExit}
                onChange={setRemoveWalletWhenExit}
              />
            </Box>
            <Box flex={1}>
              <Text typography="Body2Strong" color="text-default">
                {intl.formatMessage({
                  id: 'action__remove_when_exit',
                })}
              </Text>
              <Text typography="Body2" color="text-subdued">
                {intl.formatMessage({
                  id: 'action__remove_when_exit_desc',
                })}
              </Text>
            </Box>
          </Box>
          <Box flexDirection="row" mt={4}>
            <Box>
              <Icon
                name="ExclamationTriangleOutline"
                size={20}
                color="icon-warning"
              />
            </Box>
            <Box flex={1} ml={3}>
              <Text typography="Body2Strong" color="text-default">
                {intl.formatMessage({
                  id: 'msg__use_passphrase_enter_hint_not_forget',
                })}
              </Text>
              <Text typography="Body2" color="text-subdued">
                {intl.formatMessage({
                  id: 'msg__use_passphrase_enter_hint_not_forget_dsc',
                })}
              </Text>
            </Box>
          </Box>
        </Box>
      )}
    </BaseRequestView>
  );
};

export default RequestPassphraseOnDeviceView;
