import React from 'react';

import Alert from '../Alert';
import Box from '../Box';
import Icon from '../Icon';
import Typography from '../Typography';

function FormErrorMessage({
  message,
  isAlertStyle,
}: {
  message: string;
  isAlertStyle?: boolean;
}) {
  if (!message) {
    return null;
  }

  if (isAlertStyle) {
    return (
      <Box>
        <Alert alertType="error" title={message} />
      </Box>
    );
  }

  return (
    <Box display="flex" flexDirection="row" mt="2">
      <Box mr="2">
        <Icon size={20} name="ExclamationCircleSolid" color="icon-critical" />
      </Box>
      <Typography.Body2 color="text-critical">{message}</Typography.Body2>
    </Box>
  );
}

export { FormErrorMessage };
