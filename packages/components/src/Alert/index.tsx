import type { ComponentProps, FC, ReactNode } from 'react';
import { useState } from 'react';

import { Box } from 'native-base';
import { StyleSheet } from 'react-native';

import { useThemeValue } from '@onekeyhq/components';

import Icon from '../Icon';
import Pressable from '../Pressable';
import Typography from '../Typography';

import type { ICON_NAMES } from '../Icon';
import type { ThemeValues } from '../Provider/theme';

type AlertType = 'info' | 'warn' | 'error' | 'success' | 'SeriousWarning';

export type AlertProps = {
  title: string | ReactNode;
  description?: string | ReactNode;
  alertType: AlertType;
  dismiss?: boolean;
  onDismiss?: () => void;
  action?: string;
  onAction?: () => void;
  customIconName?: ICON_NAMES;
  containerProps?: ComponentProps<typeof Box>;
};

type AlertTypeProps = {
  iconName: ICON_NAMES;
  iconColor: keyof ThemeValues;
  bgColor: keyof ThemeValues;
  borderColor: keyof ThemeValues;
  actionBorderColor: keyof ThemeValues;
};

const InfoAlertProps: AlertTypeProps = {
  iconName: 'ExclamationCircleMini',
  iconColor: 'icon-default',
  bgColor: 'surface-subdued',
  borderColor: 'border-subdued',
  actionBorderColor: 'border-default',
};

const WarnAlertProps: AlertTypeProps = {
  iconName: 'ExclamationTriangleMini',
  iconColor: 'icon-warning',
  bgColor: 'surface-warning-subdued',
  borderColor: 'border-warning-subdued',
  actionBorderColor: 'border-warning-default',
};

const ErrorAlertProps: AlertTypeProps = {
  iconName: 'XCircleMini',
  iconColor: 'icon-critical',
  bgColor: 'surface-critical-subdued',
  borderColor: 'border-critical-subdued',
  actionBorderColor: 'border-critical-default',
};

const SuccessAlertProps: AlertTypeProps = {
  iconName: 'CheckCircleMini',
  iconColor: 'icon-success',
  bgColor: 'surface-success-subdued',
  borderColor: 'border-success-subdued',
  actionBorderColor: 'border-success-default',
};

const SeriousWarningAlertProps: AlertTypeProps = {
  iconName: 'ExclamationTriangleMini',
  iconColor: 'icon-critical',
  bgColor: 'surface-critical-subdued',
  borderColor: 'border-critical-subdued',
  actionBorderColor: 'border-critical-default',
};

function alertPropWithType(alertType: AlertType) {
  switch (alertType) {
    case 'info':
      return InfoAlertProps;
    case 'warn':
      return WarnAlertProps;
    case 'error':
      return ErrorAlertProps;
    case 'SeriousWarning':
      return SeriousWarningAlertProps;
    default:
      return SuccessAlertProps;
  }
}

const Alert: FC<AlertProps> = ({
  title,
  description,
  alertType,
  onDismiss,
  dismiss = true,
  action,
  onAction,
  customIconName,
  containerProps,
}) => {
  const alertTypeProps = alertPropWithType(alertType);
  const borderColor = useThemeValue(alertTypeProps.borderColor);
  const bgColor = useThemeValue(alertTypeProps.bgColor);
  const [display, setDisplay] = useState(true);

  return display ? (
    <Box
      flexDirection="row"
      alignItems="center"
      py="12px"
      px="16px"
      bgColor={bgColor}
      borderRadius="12"
      borderWidth={StyleSheet.hairlineWidth}
      borderColor={borderColor}
      {...containerProps}
    >
      <Box flex={1} flexDirection="row">
        <Box mr="8px">
          <Icon
            size={20}
            name={customIconName ?? alertTypeProps.iconName}
            color={alertTypeProps.iconColor}
          />
        </Box>
        <Box flex={1}>
          {title ? (
            <Typography.Body2Strong>{title}</Typography.Body2Strong>
          ) : null}
          {description ? (
            <Typography.Body2 mt="4px">{description}</Typography.Body2>
          ) : null}
        </Box>
      </Box>
      {action ? (
        <Pressable
          onPress={onAction}
          ml="8px"
          py="6px"
          px="12px"
          rounded="12px"
          borderWidth={StyleSheet.hairlineWidth}
          borderColor={alertTypeProps.actionBorderColor}
        >
          <Typography.Button2>{action}</Typography.Button2>
        </Pressable>
      ) : null}
      {dismiss ? (
        <Pressable
          onPress={() => {
            onDismiss?.();
            setDisplay(false);
          }}
          ml="8px"
        >
          <Icon name="XMarkMini" color={alertTypeProps.iconColor} size={20} />
        </Pressable>
      ) : null}
    </Box>
  ) : null;
};

export default Alert;
