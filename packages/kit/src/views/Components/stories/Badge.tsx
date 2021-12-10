import React from 'react';

import { Badge, Center, Box } from '@onekeyhq/components';

const BadgeGallery = () => (
  <Center flex="1" bg="background-hovered">
    <Box margin="10px">
      <Badge title="Success" size="lg" type="Success" />
    </Box>

    <Box margin="10px">
      <Badge title="Info" size="lg" type="Info" />
    </Box>

    <Box margin="10px">
      <Badge title="Warning" size="sm" type="Warning" />
    </Box>

    <Box margin="10px">
      <Badge title="Default" size="sm" type="Default" />
    </Box>

    <Box margin="10px">
      <Badge title="Default" size="sm" type="Critical" />
    </Box>
  </Center>
);

export default BadgeGallery;
