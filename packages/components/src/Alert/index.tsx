import { Box, Alert as NBAlert, Column, Row, IconButton } from 'native-base';
import React, { FC, useState } from 'react';
import { useThemeValue, Icon, Typography } from '@onekeyhq/components';
import { ICON_NAMES } from '../Icon/Icons';

type AlertType = 'info' | 'warn' | 'error' | 'success';

export type AlertProps = {
  title: string;
  description: string;
  alertType: AlertType;
  expand?: boolean;
  close?: boolean;
};

type AlertTypeProps = {
  iconName: ICON_NAMES;
  iconColor: string;
  bgColor: string;
  borderColor: string;
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
  close = true,
}) => {
  const alertTypeProps = alertPropWithType(alertType);
  const borderColor = useThemeValue(alertTypeProps.borderColor);
  const bgColor = useThemeValue(alertTypeProps.bgColor);
  const iconColor = useThemeValue(alertTypeProps.iconColor);

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
                color={iconColor}
              />
            </Box>
            <Typography.Body2>{title}</Typography.Body2>
          </Row>
          <IconButton
            padding="2px"
            display={close ? 'flex' : 'none'}
            icon={<Icon size={12} name="CloseOutline" color={iconColor} />}
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
