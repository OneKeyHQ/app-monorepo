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
  | 'success'
  | 'bluetooth-turned-off'
  | 'check-update-failure';

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

        case 'check-update-failure':
          stateContent = {
            emoji: '🔌',
            title: intl.formatMessage({
              id: 'modal__check_firmware_update_failure',
            }),
            description: intl.formatMessage({
              id: 'modal__check_firmware_update_failure_desc',
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
