import type { ComponentProps, FC } from 'react';

import Box from '../Box';
import Icon from '../Icon';
import Pressable from '../Pressable';
import Text from '../Text';

import type { ICON_NAMES } from '../Icon';
import type { ThemeValues } from '../Provider/theme';

type ToastStatus = 'info' | 'warning' | 'danger' | 'success' | undefined;

export type ToastProps = {
  title?: string;
  description?: string;
  dismiss?: boolean;
  error?: boolean;
  status?: ToastStatus;
  onClose?: () => void;
} & ComponentProps<typeof Box>;

export type ToastStatusProps = {
  iconName: ICON_NAMES;
  iconColor: keyof ThemeValues;
  borderColor: keyof ThemeValues;
};

const InfoToastProps: ToastStatusProps = {
  iconName: 'ArrowPathMini',
  iconColor: 'icon-default',
  borderColor: 'surface-neutral-subdued',
};

const WarnToastProps: ToastStatusProps = {
  iconName: 'ExclamationTriangleOutline',
  iconColor: 'icon-warning',
  // @ts-expect-error
  borderColor: '#7A6200',
};

const DangerToastProps: ToastStatusProps = {
  iconName: 'XCircleOutline',
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
  const textColor = error ? 'text-critical' : 'text-default';
  const iconColor = error ? 'icon-critical' : 'icon-default';

  const bgColor = () => {
    if (status) {
      return 'surface-default';
    }
    if (error) {
      return 'surface-critical-subdued';
    }
    // BaseToast
    return 'surface-neutral-default';
  };

  return (
    <Box
      flexDirection="row"
      width="auto"
      px={status ? 4 : 3}
      py={status ? 4 : 2}
      bg={bgColor()}
      borderRadius="xl"
      borderWidth={0.5}
      borderColor={status ? 'border-subdued' : 'border-default'}
      shadow="depth.4"
      {...rest}
    >
      {status && (
        <Box mr="12px">
          <Icon
            size={24}
            name={toastStatusProps.iconName}
            color={toastStatusProps?.iconColor}
          />
        </Box>
      )}
      <Box flex={1} mt={status && 0.5}>
        <Text
          flex={1}
          typography={status ? 'Body2Strong' : 'Body1Strong'}
          color={status ? 'text-default' : textColor}
        >
          {title}
        </Text>
        {description && (
          <Text
            flex={1}
            mt={1}
            textAlign={status ? undefined : 'center'}
            typography="Body2"
            color="text-subdued"
          >
            {description}
          </Text>
        )}
      </Box>
      {dismiss && (
        <Pressable
          ml={4}
          padding={0.5}
          onPress={onClose}
          rounded="full"
          _hover={{ bgColor: 'surface-hovered' }}
          _pressed={{ bgColor: 'surface-pressed' }}
          alignSelf="flex-start"
        >
          <Icon
            size={20}
            name="XMarkOutline"
            color={status ? 'icon-default' : iconColor}
          />
        </Pressable>
      )}
    </Box>
  );
};

export default Toast;
