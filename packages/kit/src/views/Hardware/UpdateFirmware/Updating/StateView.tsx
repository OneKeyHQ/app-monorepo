import React, { FC, useMemo } from 'react';

import { IDeviceType } from '@onekeyfe/hd-core';
import { useIntl } from 'react-intl';

import {
  Box,
  Center,
  Image,
  LottieView,
  Text,
  Typography,
} from '@onekeyhq/components';

export type StateViewType =
  | 'pre-check-failure'
  | 'download-failure'
  | 'install-failure'
  | 'device-not-found'
  | 'device-mismatch'
  | 'device-not-only-ones'
  | 'device-connection-failure'
  | 'device-not-response'
  | 'reboot-bootloader-failure'
  | 'success'
  | 'bluetooth-turned-off'
  | 'manually-enter-bootloader';

type StateContent = {
  emoji?: string;
  sourceSrc?: any;
  title?: string;
  description?: string;
  deviceType?: IDeviceType;
  help?: string;
};

export type StateViewTypeInfo = {
  type: StateViewType;
  content?: StateContent;
};

export type StateViewProps = {
  stateInfo?: StateViewTypeInfo;
};

const StateView: FC<StateViewProps> = ({ stateInfo }) => {
  const intl = useIntl();

  const { sourceSrc, emoji, title, description, help }: StateContent =
    useMemo(() => {
      let stateContent: StateContent;
      switch (stateInfo?.type) {
        case 'pre-check-failure':
          stateContent = {
            emoji: '😞',
            title: intl.formatMessage({
              id: 'modal__device_check_failed',
            }),
            description: intl.formatMessage({
              id: 'modal__device_check_failed_desc',
            }),
          };
          break;

        case 'download-failure':
          stateContent = {
            emoji: '📶',
            title: intl.formatMessage({ id: 'modal__download_failed' }),
            description: intl.formatMessage({
              id: 'modal__download_failed_desc',
            }),
          };
          break;

        case 'install-failure':
          stateContent = {
            emoji: '😞',
            title: intl.formatMessage({
              id: 'modal__firmware_installation_failed',
            }),
            description: intl.formatMessage({
              id: 'modal__firmware_installation_failed_desc',
            }),
          };
          break;

        case 'device-not-found':
          stateContent = {
            emoji: '🔌',
            title: intl.formatMessage({ id: 'modal__no_device_found' }),
            description: intl.formatMessage({
              id: 'modal__no_device_found_desc',
            }),
          };
          break;

        case 'device-not-only-ones':
          stateContent = {
            emoji: '🔌',
            title: intl.formatMessage({
              id: 'modal__only_one_device_can_be_connected',
            }),
            description: intl.formatMessage({
              id: 'modal__only_one_device_can_be_connected_desc',
            }),
          };
          break;

        case 'device-connection-failure':
          stateContent = {
            emoji: '🔗',
            title: intl.formatMessage({
              id: 'modal__disconnected_during_installation',
            }),
            description: intl.formatMessage({
              id: 'modal__disconnected_during_installation_desc',
            }),
          };
          break;

        case 'reboot-bootloader-failure':
          stateContent = {
            emoji: '🔗',
            title: 'Reboot bootloader failed',
            description: 'Please check the device and try again.',
          };
          break;

        case 'device-not-response':
          stateContent = {
            emoji: '⌛',
            title: intl.formatMessage({
              id: 'modal__no_response',
            }),
            description: intl.formatMessage({
              id: 'modal__no_response_desc',
            }),
          };
          break;

        case 'success':
          stateContent = {
            emoji: '🚀',
            title: intl.formatMessage({
              id: 'modal__firmware_updated',
            }),
          };
          break;

        case 'bluetooth-turned-off':
          stateContent = {
            emoji: '📡',
            title: intl.formatMessage({
              id: 'msg__hardware_bluetooth_need_turned_on_error',
            }),
            description: 'Turn on bluetooth and try again.',
          };
          break;

        case 'manually-enter-bootloader':
          stateContent = {
            title: '需要手动进入 BootLoader 模式',
          };

          if (stateInfo?.content?.deviceType === 'mini') {
            // eslint-disable-next-line global-require
            stateContent.sourceSrc = require('@onekeyhq/kit/assets/wallet/lottie-onekey-mini-in-bootloader-mode.json');
            stateContent.description =
              '1. 断开设备连接\n2. 按住 MINI 顶部按键的同时，重新插入 USB 线连接\n3. 此时设备显示 bootloader 字样，松开顶部按键即可';
          } else if (stateInfo?.content?.deviceType === 'touch') {
            stateContent.description =
              '1. 将设备关机\n2. 按住 TOUCH 开关按键的同时，滑动屏幕\n3. 此时设备显示 Download Mode 字样即可';
          }
          break;

        default:
          stateContent = {
            emoji: '💀',
            title: intl.formatMessage({
              id: 'msg__unknown_error',
            }),
          };
          break;
      }

      return { ...stateContent, ...stateInfo?.content };
    }, [intl, stateInfo]);

  return (
    <Box
      flexDirection="column"
      alignItems="center"
      h="100%"
      justifyContent="space-between"
    >
      <Center flex={1} paddingX={4} minHeight={240}>
        <Box alignItems="center">
          {!!sourceSrc && <LottieView source={sourceSrc} autoPlay loop />}
          {!!emoji && <Text fontSize={56}>{emoji}</Text>}

          <Typography.DisplayMedium mt={4}>{title}</Typography.DisplayMedium>
          {!!description && (
            <Typography.Body1 color="text-subdued" mt={2}>
              {description}
            </Typography.Body1>
          )}
        </Box>
      </Center>

      {!!help && (
        <Typography.Body2Underline
          px={8}
          textAlign="center"
          color="text-subdued"
        >
          {help}
        </Typography.Body2Underline>
      )}
    </Box>
  );
};

export default StateView;
