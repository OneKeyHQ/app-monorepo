import type { FC } from 'react';
import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Center,
  LottieView,
  Text,
  Typography,
} from '@onekeyhq/components';
import type { LocaleIds } from '@onekeyhq/components/src/locale';

import type { IDeviceType } from '@onekeyfe/hd-core';

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
  | 'manually-enter-bootloader-one'
  | 'manually-enter-bootloader-two'
  | 'common_error';

type StateContent = {
  emoji?: string;
  sourceSrc?: any;
  title?: string;
  description?: string;
  deviceType?: IDeviceType;
  help?: string;
  nextState?: StateViewTypeInfo;
  primaryActionTranslationId?: LocaleIds;
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
            title: intl.formatMessage({
              id: 'modal__enter_bootloader_mode_error',
            }),
            description: intl.formatMessage({
              id: 'modal__enter_bootloader_mode_error_desc',
            }),
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

        case 'manually-enter-bootloader-one':
          stateContent = {
            title: intl.formatMessage({ id: 'modal__enter_bootloader_mode' }),
          };

          if (stateInfo?.content?.deviceType === 'mini') {
            // eslint-disable-next-line global-require
            stateContent.sourceSrc = require('@onekeyhq/kit/assets/animations/lottie-onekey-mini-in-bootloader-mode-disconnect-your-device.json');
            stateContent.description = intl.formatMessage({
              id: 'modal__disconnecting_device',
            });
          } else if (stateInfo?.content?.deviceType === 'touch') {
            stateContent.emoji = '📱';
            stateContent.description = intl.formatMessage({
              id: 'modal__enter_bootloader_mode_touch',
            });
          } else if (
            stateInfo?.content?.deviceType === 'classic' ||
            stateInfo?.content?.deviceType === 'classic1s'
          ) {
            // eslint-disable-next-line global-require
            stateContent.sourceSrc = require('@onekeyhq/kit/assets/animations/lottie-onekey-classic-in-bootloader-mode.json');
            stateContent.description = intl.formatMessage({
              id: 'modal__enter_bootloader_mode_classic',
            });
          }
          break;

        case 'manually-enter-bootloader-two':
          stateContent = {
            title: intl.formatMessage({ id: 'modal__enter_bootloader_mode' }),
          };

          if (stateInfo?.content?.deviceType === 'mini') {
            // eslint-disable-next-line global-require
            stateContent.sourceSrc = require('@onekeyhq/kit/assets/animations/lottie-onekey-mini-in-bootloader-mode.json');
            stateContent.description = intl.formatMessage({
              id: 'modal__enter_bootloader_mode_mini_desc',
            });
          }
          break;

        case 'common_error':
          stateContent = {
            emoji: '😞',
            title: intl.formatMessage({
              id: 'msg__unknown_error',
            }),
          };
          break;

        default:
          stateContent = {
            emoji: '🤔',
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
          {!!sourceSrc && (
            <LottieView
              source={sourceSrc}
              autoPlay
              loop
              style={{ width: '100%' }}
            />
          )}
          {!!emoji && <Text fontSize={56}>{emoji}</Text>}

          <Typography.DisplayMedium mt={4}>{title}</Typography.DisplayMedium>
          {!!description && (
            <Typography.Body1 color="text-subdued" mt={2} textAlign="center">
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
