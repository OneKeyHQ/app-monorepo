/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import React, { ComponentProps, FC } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet, TextStyle } from 'react-native';
import Toast, { BaseToast } from 'react-native-toast-message';

import ConfirmOnClassic from '@onekeyhq/kit/assets/wallet/confirm-on-onekey-classic.json';
import ConfirmOnMini from '@onekeyhq/kit/assets/wallet/confirm-on-onekey-mini.json';
import EnterPinCodeOnClassic from '@onekeyhq/kit/assets/wallet/enter-pin-code-on-onekey-classic.json';
import EnterPinCodeOnMini from '@onekeyhq/kit/assets/wallet/enter-pin-code-on-onekey-mini.json';

import Box from '../Box';
import LottieView from '../LottieView';
import { useThemeValue } from '../Provider/hooks';
import { Body1Props, Text } from '../Typography';

type Props = ComponentProps<typeof Toast>;

const CustomToast: FC<Props> = (outerProps) => {
  const [
    backgroundColor,
    fontColor,
    borderColor,
    borderLeftColor,
    shadowColor,
  ] = useThemeValue([
    // 'surface-neutral-default',
    // 'text-default',
    // 'border-default',
    // 'border-default',
    'interactive-default',
    'text-on-primary',
    'interactive-default',
    'interactive-default',
    'interactive-default',
  ]);
  const intl = useIntl();
  return (
    <Toast
      config={{
        default: (props) => (
          <BaseToast
            {...props}
            style={{
              alignSelf: 'center',
              width: 'auto',
              height: 'auto',
              marginLeft: 0,
              backgroundColor,
              borderRadius: 9999,
              borderWidth: StyleSheet.hairlineWidth,
              borderLeftWidth: StyleSheet.hairlineWidth,
              borderColor,
              borderLeftColor,
              // replace the code below with shadow token 'depth.4' in the future, i don't know how – franco
              shadowColor,
              shadowOffset: {
                width: 0,
                height: 4,
              },
              shadowOpacity: 0.15,
              shadowRadius: 20.0,
              elevation: 8,
            }}
            contentContainerProps={{
              style: {
                paddingVertical: 8,
                paddingHorizontal: 16,
                marginLeft: 0,
                alignSelf: 'center',
                maxWidth: 340,
              },
            }}
            text1NumberOfLines={3}
            text1Style={
              { ...Body1Props, color: fontColor, marginBottom: 0 } as TextStyle
            }
          />
        ),
        enterPinOnDevice: ({ props }) => (
          <Box px={6} w="full" maxW="374">
            <Box
              w="full"
              mx="auto"
              p={4}
              pb={6}
              rounded="xl"
              bgColor="surface-default"
              borderWidth={StyleSheet.hairlineWidth}
              borderColor="border-subdued"
              shadow="depth.4"
              {...props}
            >
              <LottieView
                source={
                  props?.deviceType === 'mini'
                    ? EnterPinCodeOnMini
                    : EnterPinCodeOnClassic
                }
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
            </Box>
          </Box>
        ),
        confirmOnDevice: ({ props }) => (
          <Box px={6} w="full" maxW="374">
            <Box
              mx="auto"
              p={4}
              pb={6}
              rounded="xl"
              bgColor="surface-default"
              borderWidth={StyleSheet.hairlineWidth}
              borderColor="border-subdued"
              shadow="depth.4"
              {...props}
            >
              <LottieView
                source={
                  props?.deviceType === 'mini'
                    ? ConfirmOnMini
                    : ConfirmOnClassic
                }
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
                {intl.formatMessage({ id: 'modal__confirm_on_device' })}
              </Text>
            </Box>
          </Box>
        ),
      }}
      {...outerProps}
    />
  );
};

export default CustomToast;
