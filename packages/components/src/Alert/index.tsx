import { FC, useState } from 'react';

import { Box } from 'native-base';

import Icon, { ICON_NAMES } from '../Icon';
import IconButton from '../IconButton';
import Pressable from '../Pressable';
import { useThemeValue } from '../Provider/hooks';
import { ThemeValues } from '../Provider/theme';
import Typography from '../Typography';
import VStack from '../VStack';

type AlertType = 'info' | 'warn' | 'error' | 'success' | 'SeriousWarning';
type ActionType = 'bottom' | 'right';

export type AlertProps = {
  title: string | React.ReactNode;
  description?: string;
  alertType: AlertType;
  dismiss?: boolean;
  onDismiss?: () => void;
  action?: string;
  actionType?: ActionType;
  onAction?: () => void;
  customIconName?: ICON_NAMES;
};

type AlertTypeProps = {
  iconName: ICON_NAMES;
  iconColor: keyof ThemeValues;
  bgColor: keyof ThemeValues;
  borderColor: keyof ThemeValues;
};

const InfoAlertProps: AlertTypeProps = {
  iconName: 'InformationCircleMini',
  iconColor: 'icon-default',
  bgColor: 'surface-neutral-subdued',
  borderColor: 'border-subdued',
};

const WarnAlertProps: AlertTypeProps = {
  iconName: 'ExclamationTriangleMini',
  iconColor: 'icon-warning',
  bgColor: 'surface-warning-subdued',
  borderColor: 'border-warning-subdued',
};

const ErrorAlertProps: AlertTypeProps = {
  iconName: 'XCircleMini',
  iconColor: 'icon-critical',
  bgColor: 'surface-critical-subdued',
  borderColor: 'border-critical-subdued',
};

const SuccessAlertProps: AlertTypeProps = {
  iconName: 'CheckCircleMini',
  iconColor: 'icon-success',
  bgColor: 'surface-success-subdued',
  borderColor: 'border-success-subdued',
};

const SeriousWarningAlertProps: AlertTypeProps = {
  iconName: 'ExclamationTriangleMini',
  iconColor: 'icon-critical',
  bgColor: 'surface-critical-subdued',
  borderColor: 'border-critical-subdued',
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
  actionType,
  onAction,
  customIconName,
}) => {
  const alertTypeProps = alertPropWithType(alertType);
  const borderColor = useThemeValue(alertTypeProps.borderColor);
  const bgColor = useThemeValue(alertTypeProps.bgColor);
  const [display, setDisplay] = useState(true);

  return display ? (
    <Box position="relative">
      <Box
        position="relative"
        display="flex"
        flexDirection="row"
        w="100%"
        borderRadius="12"
        borderWidth="1px"
        borderColor={borderColor}
        bgColor={bgColor}
        pl="4"
        pr={dismiss ? '2.5' : '4'}
        pb="2.5"
        pt="2.5"
        alignItems="flex-start"
      >
        <Box flex="1">
          <Box
            flexDirection="row"
            alignItems="center"
            justifyContent="space-between"
            minH="8"
            w="full"
          >
            <Box flexDirection="row" flex={1}>
              <Box>
                <Icon
                  size={20}
                  name={customIconName ?? alertTypeProps.iconName}
                  color={alertTypeProps.iconColor}
                />
              </Box>
              <Typography.Body2Strong ml="3" flex={1}>
                {title}
              </Typography.Body2Strong>
            </Box>
          </Box>
          {description || (action && actionType === 'bottom') ? (
            <VStack pl="8" pt="1" mb="1" space="4">
              {description ? (
                <Typography.Body2>{description}</Typography.Body2>
              ) : null}
              {action && actionType === 'bottom' ? (
                <Pressable onPress={onAction}>
                  <Typography.Body2Underline>
                    {action}
                  </Typography.Body2Underline>
                </Pressable>
              ) : null}
            </VStack>
          ) : null}
        </Box>
        <Box flexDirection="row" alignItems="center" h="8">
          {actionType === 'right' && action ? (
            <Pressable onPress={onAction}>
              <Typography.Body2Underline>{action}</Typography.Body2Underline>
            </Pressable>
          ) : null}
          {dismiss ? (
            <IconButton
              size="sm"
              type="plain"
              name="XMarkOutline"
              iconColor={alertTypeProps.iconColor}
              onPress={() => {
                onDismiss?.();
                setDisplay(false);
              }}
            />
          ) : null}
        </Box>
      </Box>
    </Box>
  ) : null;
};

export default Alert;
