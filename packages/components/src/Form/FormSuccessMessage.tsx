import React from 'react';

import Box from '../Box';
import Icon from '../Icon';
import Typography from '../Typography';

function FormSuccessMessage({ message }: { message: string }) {
  if (!message) {
    return null;
  }
  return (
    <Box display="flex" flexDirection="row" mt="2">
      <Box mr="2">
        <Icon size={20} name="CheckCircleSolid" color="icon-success" />
      </Box>
      <Typography.Body2 color="text-success">{message}</Typography.Body2>
    </Box>
  );
}

export { FormSuccessMessage };
