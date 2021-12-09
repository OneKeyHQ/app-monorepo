import React from 'react';
import { Alert, Center, Box } from '@onekeyhq/components';

const AlertGallery = () => (
  <Center flex="1" bg="background-hovered">
    <Box margin="10px" w="384px">
      <Alert
        close={false}
        alertType="info"
        title="Infomation"
        description="Lorem ipsum dolor sit amet consectetur adipisicing elit. Aliquid pariatur, ipsum similique veniam quo totam eius aperiam dolorum."
      />
    </Box>

    <Box margin="10px" w="384px">
      <Alert
        alertType="warn"
        title="Warning"
        description="Lorem ipsum dolor sit amet consectetur adipisicing elit. Aliquid pariatur, ipsum similique veniam quo totam eius aperiam dolorum."
      />
    </Box>

    <Box margin="10px" w="384px">
      <Alert
        alertType="error"
        title="Warning"
        description="Lorem ipsum dolor sit amet consectetur adipisicing elit. Aliquid pariatur, ipsum similique veniam quo totam eius aperiam dolorum."
      />
    </Box>

    <Box margin="10px" w="384px">
      <Alert
        expand={false}
        alertType="success"
        title="Warning"
        description="Lorem ipsum dolor sit amet consectetur adipisicing elit. Aliquid pariatur, ipsum similique veniam quo totam eius aperiam dolorum."
      />
    </Box>
  </Center>
);

export default AlertGallery;
