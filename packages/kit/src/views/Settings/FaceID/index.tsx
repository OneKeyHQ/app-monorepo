import React from 'react';

import { useIntl } from 'react-intl';

import { Box, Switch, Typography, VStack } from '@onekeyhq/components';

export const FaceID = () => {
  const intl = useIntl();
  return (
    <Box p="4">
      <Box borderRadius="12" bg="surface-default" shadow="depth.2">
        <Box
          display="flex"
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
          p="4"
          borderBottomWidth="1"
          borderBottomColor="divider"
        >
          <VStack>
            <Typography.Body1>
              {intl.formatMessage({
                id: 'form__app_unlock',
                defaultMessage: 'App Unlock',
              })}
            </Typography.Body1>
            <Typography.Body1>
              {intl.formatMessage({
                id: 'form__app_unlock_desc',
                defaultMessage: 'Unlock app with Face ID instead of password',
              })}
            </Typography.Body1>
          </VStack>
          <Switch />
        </Box>
        <Box
          display="flex"
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
          p="4"
          borderBottomWidth="1"
          borderBottomColor="divider"
        >
          <VStack>
            <Typography.Body1>
              {intl.formatMessage({
                id: 'form__password_free_payment',
                defaultMessage: 'Password-Free Payment',
              })}
            </Typography.Body1>
            <Typography.Body1>
              {intl.formatMessage({
                id: 'form__password_free_payment_desc',
                defaultMessage:
                  'Pay with Face ID instead of password (software wallet only)',
              })}
            </Typography.Body1>
          </VStack>
          <Switch />
        </Box>
      </Box>
    </Box>
  );
};

export default FaceID;
