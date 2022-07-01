import React, { FC, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Box, Center, Image, Text, Typography } from '@onekeyhq/components';

import type { ImageSourcePropType } from 'react-native';

export type StateViewType =
  | 'pre-check-failure'
  | 'download-failure'
  | 'device-not-found'
  | 'device-mismatch'
  | 'device-not-only-ones'
  | 'device-connection-failure'
  | 'device-not-response'
  | 'reboot-bootloader-failure'
  | 'success';

type StateContentProps = {
  emoji?: string;
  sourceSrc?: ImageSourcePropType;
  title: string;
  description?: string;
  help?: string;
};

export type StateViewProps = {
  stateViewType?: StateViewType;
};

const StateView: FC<StateViewProps> = ({ stateViewType }) => {
  const intl = useIntl();

  const { sourceSrc, emoji, title, description, help }: StateContentProps =
    useMemo(() => {
      switch (stateViewType) {
        case 'pre-check-failure':
          return {
            emoji: '😞',
            title: '环境检查失败',
            description: '环境检查失败，可以尝试重试',
          };
        case 'download-failure':
          return {
            emoji: '😞',
            title: intl.formatMessage({ id: 'modal__download_failed' }),
            description: intl.formatMessage({
              id: 'modal__download_failed_desc',
            }),
          };
        case 'device-not-found':
          return {
            emoji: '😞',
            title: '没有发现设备',
            description:
              '请检查设备是否连接, 以及设备保持正常开机，不在 Bootloader 模式下。',
          };
        case 'device-mismatch':
          return {
            emoji: '😞',
            title: '连接的设备有误',
            description: '请检查连接的设备是否正确',
          };
        case 'device-not-only-ones':
          return {
            emoji: '😞',
            title: '你只能连接一个设备',
            description: '为了保障升级成功，请确保只有一个设备在连接',
          };

        case 'device-connection-failure':
          return {
            emoji: '🔗',
            title: intl.formatMessage({
              id: 'modal__disconnected_during_installation',
            }),
            description: intl.formatMessage({
              id: 'modal__disconnected_during_installation_desc',
            }),
          };
        case 'reboot-bootloader-failure':
          return {
            emoji: '🔗',
            title: 'Reboot bootloader failed',
            description: 'Please check the device and try again.',
          };
        case 'device-not-response':
          return {
            emoji: '⌛',
            title: intl.formatMessage({
              id: 'modal__no_response',
            }),
            description: intl.formatMessage({
              id: 'modal__no_response_desc',
            }),
          };
        case 'success':
          return {
            emoji: '🚀',
            title: intl.formatMessage({
              id: 'modal__firmware_updated',
            }),
          };
        default:
          return {
            emoji: '💀',
            title: intl.formatMessage({
              id: 'msg__unknown_error',
            }),
          };
      }
    }, [intl, stateViewType]);

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
