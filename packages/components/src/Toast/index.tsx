import React, { FC, useState } from 'react';

import { Box, Column, IconButton, Row } from 'native-base';

import Icon, { ICON_NAMES } from '../Icon';
import { ThemeValues } from '../Provider/theme';
import Typography from '../Typography';

export { useToast } from 'native-base';

type ToastStatus = 'info' | 'warning' | 'danger' | 'success' | undefined;

export type ToastProps = {
  title: string;
  description?: string;
  dismiss?: boolean;
  error?: boolean;
  status?: ToastStatus;
};

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
      px={status ? '16px' : '12px'}
      py={status ? '16px' : '8px'}
      borderRadius="12px"
      display={display ? 'flex' : 'none'}
    >
      <Column>
        <Row space={2} alignItems="center" justifyContent="space-between">
          <Row space="12px" alignItems="center">
            {status ? (
              <Box padding="3px">
                <Icon
                  size={18}
                  name={toastStatusProps.iconName}
                  color={toastStatusProps?.iconColor}
                />
              </Box>
            ) : null}
            {status ? (
              <Typography.Body2>{title}</Typography.Body2>
            ) : (
              <Typography.Body1 color={textColor}>{title}</Typography.Body1>
            )}
          </Row>

          <IconButton
            padding="2px"
            display={dismiss ? 'flex' : 'none'}
            icon={
              <Icon
                size={20}
                name="CloseOutline"
                color={status ? 'icon-default' : iconColor}
              />
            }
            onPress={() => {
              setDisplay(false);
            }}
          />
        </Row>
        <Box display={description ? 'flex' : 'none'} pl="32px" pt="8px">
          <Typography.Body2 color="text-subdued">
            {description}
          </Typography.Body2>
        </Box>
      </Column>
    </Box>
  );
};

export default Toast;
