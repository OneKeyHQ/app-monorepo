import React, { FC, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Box, Center, Image, Text, Typography } from '@onekeyhq/components';

import type { ImageSourcePropType } from 'react-native';

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
  | 'success';

type StateContent = {
  emoji?: string;
  sourceSrc?: ImageSourcePropType;
  title?: string;
  description?: string;
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
            title: '环境检查失败',
            description: '环境检查失败，可以尝试重试',
          };
          break;

        case 'download-failure':
          stateContent = {
            emoji: '😞',
            title: intl.formatMessage({ id: 'modal__download_failed' }),
            description: intl.formatMessage({
              id: 'modal__download_failed_desc',
            }),
          };
          break;

        case 'install-failure':
          stateContent = {
            emoji: '😞',
            title: '固件安装失败',
            description: '固件安装失败，可以尝试重试',
          };
          break;

        case 'device-not-found':
          stateContent = {
            emoji: '😞',
            title: '没有发现设备',
            description:
              '请检查设备是否连接, 以及设备保持正常开机，不在 Bootloader 模式下。',
          };
          break;

        case 'device-mismatch':
          stateContent = {
            emoji: '😞',
            title: '连接的设备有误',
            description: '请检查连接的设备是否正确',
          };
          break;

        case 'device-not-only-ones':
          stateContent = {
            emoji: '😞',
            title: '你只能连接一个设备',
            description: '为了保障升级成功，请确保只有一个设备在连接',
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

  console.log('====:StateView', stateInfo);

  return (
    <Box
      flexDirection="column"
      alignItems="center"
      h="100%"
      justifyContent="space-between"
    >
      <Center flex={1} paddingX={4} minHeight={240}>
        <Box alignItems="center">
          {!!sourceSrc && <Image size={56} source={sourceSrc} />}
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
