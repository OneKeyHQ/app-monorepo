import React, { ComponentProps, FC, useState } from 'react';

import Box from '../Box';
import Icon, { ICON_NAMES } from '../Icon';
import Pressable from '../Pressable';
import { ThemeValues } from '../Provider/theme';
import { Text } from '../Typography';

export { useToast } from 'native-base';

type ToastStatus = 'info' | 'warning' | 'danger' | 'success' | undefined;

export type ToastProps = {
  title: string;
  description?: string;
  dismiss?: boolean;
  error?: boolean;
  status?: ToastStatus;
  onClose?: (callBack: (display: boolean) => void) => void;
} & ComponentProps<typeof Box>;

export type ToastStatusProps = {
  iconName: ICON_NAMES;
  iconColor: keyof ThemeValues;
  borderColor: keyof ThemeValues;
};

const InfoToastProps: ToastStatusProps = {
  iconName: 'RefreshSolid',
  iconColor: 'icon-default',
  borderColor: 'surface-neutral-subdued',
};

const WarnToastProps: ToastStatusProps = {
  iconName: 'ExclamationOutline',
  iconColor: 'icon-warning',
  // @ts-expect-error
  borderColor: '#7A6200',
};

const DangerToastProps: ToastStatusProps = {
  iconName: 'CloseCircleOutline',
  iconColor: 'icon-critical',
  borderColor: 'border-critical-subdued',
};

const SuccessToastProps: ToastStatusProps = {
  iconName: 'CheckCircleOutline',
  iconColor: 'icon-success',
  borderColor: 'border-success-subdued',
};

function toastPropWithStatus(status: ToastStatus) {
  switch (status) {
    case 'info':
      return InfoToastProps;
    case 'warning':
      return WarnToastProps;
    case 'danger':
      return DangerToastProps;
    default:
      return SuccessToastProps;
  }
}

export const Toast: FC<ToastProps> = ({
  title,
  description,
  error = false,
  dismiss = false,
  status = undefined,
  onClose,
  ...rest
}) => {
  const toastStatusProps = toastPropWithStatus(status);
  const bgColor = error ? 'surface-critical-default' : 'text-default';
  const textColor = error ? 'text-on-critical' : 'surface-default';
  const iconColor = error ? 'text-on-primary' : 'surface-neutral-default';
  const [display, setDisplay] = useState(true);

  return (
    <Box
      width="auto"
      bg={status ? 'surface-default' : bgColor}
      px={status ? '17px' : '12px'}
      py={status ? '17px' : '8px'}
      borderRadius="12px"
      borderWidth={1}
      borderColor="border-default"
      display={display ? 'flex' : 'none'}
      {...rest}
    >
      <Box flexDirection="row" flex={1}>
        <Box flexDirection="row" flex={1}>
          {status ? (
            <Box mr="12px">
              <Icon
                size={24}
                name={toastStatusProps.iconName}
                color={toastStatusProps?.iconColor}
              />
            </Box>
          ) : null}
          <Box flexDirection="column" flex={1}>
            <Text
              typography={status ? 'Body2' : 'Body1'}
              color={status ? 'text-default' : textColor}
              numberOfLines={1}
            >
              {title}
            </Text>
            <Box display={description ? 'flex' : 'none'} mt="4px" flex={1}>
              <Text typography="Body2" color="text-subdued">
                {description}
              </Text>
            </Box>
          </Box>
        </Box>
        {dismiss ? (
          <Pressable
            onPress={() => {
              if (onClose) {
                onClose((outterDisplay) => {
                  setDisplay(outterDisplay);
                });
              } else {
                setDisplay(false);
              }
            }}
          >
            <Box ml="16px" padding="2px" display={dismiss ? 'flex' : 'none'}>
              <Icon
                size={20}
                name="CloseOutline"
                color={status ? 'icon-default' : iconColor}
              />
            </Box>
          </Pressable>
        ) : null}
      </Box>
    </Box>
  );
};

export default Toast;
