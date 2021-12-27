import React, { FC, useState } from 'react';

import { Box, Column, IconButton, Alert as NBAlert, Row } from 'native-base';

import Icon, { ICON_NAMES } from '../Icon';
import { useThemeValue } from '../Provider/hooks';
import { ThemeValues } from '../Provider/theme';
import Typography from '../Typography';

type AlertType = 'info' | 'warn' | 'error' | 'success';

export type AlertProps = {
  title: string;
  description: string;
  alertType: AlertType;
  expand?: boolean;
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

function alertPropWithType(alertType: AlertType) {
  switch (alertType) {
    case 'info':
      return InfoAlertProps;
    case 'warn':
      return WarnAlertProps;
    case 'error':
      return ErrorAlertProps;
    default:
      return SuccessAlertProps;
  }
}

const Alert: FC<AlertProps> = ({
  title,
  description,
  alertType,
  expand = true,
  dismiss = true,
}) => {
  const alertTypeProps = alertPropWithType(alertType);
  const borderColor = useThemeValue(alertTypeProps.borderColor);
  const bgColor = useThemeValue(alertTypeProps.bgColor);

  const [display, setDisplay] = useState(true);

  return (
    <NBAlert
      display={display ? 'flex' : 'none'}
      w="100%"
      borderRadius={12}
      borderWidth="1px"
      borderColor={borderColor}
      bgColor={bgColor}
      padding="16px"
    >
      <Column w="100%">
        <Row space={2} alignItems="center" justifyContent="space-between">
          <Row space="12px" alignItems="center">
            <Box padding="2px">
              <Icon
                size={16}
                name={alertTypeProps.iconName}
                color={alertTypeProps.iconColor}
              />
            </Box>
            <Typography.Body2>{title}</Typography.Body2>
          </Row>
          <IconButton
            padding="2px"
            display={dismiss ? 'flex' : 'none'}
            icon={
              <Icon
                size={12}
                name="CloseOutline"
                color={alertTypeProps.iconColor}
              />
            }
            onPress={() => {
              setDisplay(false);
            }}
          />
        </Row>

        <Box display={expand ? 'flex' : 'none'} pl="32px" pt="8px">
          <Typography.Body2>{description}</Typography.Body2>
        </Box>
      </Column>
    </NBAlert>
  );
};

export default Alert;
