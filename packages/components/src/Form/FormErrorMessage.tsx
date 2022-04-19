import React from 'react';

import Box from '../Box';
import Icon from '../Icon';
import Typography from '../Typography';

function FormErrorMessage({ message }: { message: string }) {
  if (!message) {
    return null;
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
