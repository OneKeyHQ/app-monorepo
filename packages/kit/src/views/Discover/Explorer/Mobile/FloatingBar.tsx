import { Box } from '@onekeyhq/components';
import { FC, useState } from 'react';

const FloatingBar: FC = () => {
  const [floating, setFloating] = useState(false);
  return (
    <Box
      position="absolute"
      bottom="0"
      left="0"
      right="0"
      height="48px"
      bg="surface-subdued"
      zIndex={5}
    >
      {/* <TabBarMobile />
      <ControllerBarMobile /> */}
    </Box>
  );
};
