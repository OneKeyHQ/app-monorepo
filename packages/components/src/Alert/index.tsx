import React, { FC, useState } from 'react';

import { Box, Column, Alert as NBAlert, Row } from 'native-base';

import Icon, { ICON_NAMES } from '../Icon';
import IconButton from '../IconButton';
import { useThemeValue } from '../Provider/hooks';
import { ThemeValues } from '../Provider/theme';
import Typography from '../Typography';

type AlertType = 'info' | 'warn' | 'error' | 'success' | 'SeriousWarning';

export type AlertProps = {
  title: string;
  description?: string;
  alertType: AlertType;
  onDismiss?: () => void;
  dismiss?: boolean;
};

type AlertTypeProps = {
  iconName: ICON_NAMES;
  iconColor: keyof ThemeValues;
  bgColor: keyof ThemeValues;
  borderColor: keyof ThemeValues;
};

const InfoAlertProps: AlertTypeProps = {
  iconName: 'InformationCircleSolid',
  iconColor: 'icon-default',
  bgColor: 'surface-neutral-default',
  borderColor: 'surface-neutral-subdued',
};

const WarnAlertProps: AlertTypeProps = {
  iconName: 'ExclamationSolid',
  iconColor: 'icon-warning',
  bgColor: 'surface-warning-subdued',
  // @ts-expect-error
  borderColor: '#7A6200',
};

const ErrorAlertProps: AlertTypeProps = {
  iconName: 'CloseCircleSolid',
  iconColor: 'icon-critical',
  bgColor: 'surface-critical-subdued',
  borderColor: 'border-critical-subdued',
};

const SuccessAlertProps: AlertTypeProps = {
  iconName: 'CheckCircleSolid',
  iconColor: 'icon-success',
  bgColor: 'surface-success-subdued',
  borderColor: 'border-success-subdued',
};

const SeriousWarningAlertProps: AlertTypeProps = {
  iconName: 'ExclamationSolid',
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
}) => {
  const alertTypeProps = alertPropWithType(alertType);
  const borderColor = useThemeValue(alertTypeProps.borderColor);
  const bgColor = useThemeValue(alertTypeProps.bgColor);

  const [display, setDisplay] = useState(true);

  return (
    <>
      <NBAlert
        display={display ? 'flex' : 'none'}
        w="100%"
        borderRadius="12px"
        borderWidth="1px"
        borderColor={borderColor}
        bgColor={bgColor}
        paddingY="16px"
        paddingLeft="16px"
        paddingRight={dismiss ? '48px' : '16px'}
      >
        <Column w="100%">
          <Row space="12px" alignItems="center" justifyContent="space-between">
            <Row space="12px" flex="1">
              <Box>
                <Icon
                  size={20}
                  name={alertTypeProps.iconName}
                  color={alertTypeProps.iconColor}
                />
              </Box>
              <Typography.Body2Strong flex={1}>{title}</Typography.Body2Strong>
            </Row>
          </Row>
          {description ? (
            <Box pl="32px" pt="8px">
              <Typography.Body2>{description}</Typography.Body2>
            </Box>
          ) : null}
        </Column>
      </NBAlert>
      <Box
        position="absolute"
        top="10px"
        right="10px"
        display={display ? 'flex' : 'none'}
      >
        <IconButton
          display={dismiss ? 'flex' : 'none'}
          size="sm"
          type="plain"
          name="CloseOutline"
          iconColor={alertTypeProps.iconColor}
          onPress={() => {
            onDismiss?.();
            setDisplay(false);
          }}
        />
      </Box>
    </>
  );
};

export default Alert;
