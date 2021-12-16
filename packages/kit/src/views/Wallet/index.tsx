import React from 'react';

import { Button, Center, Typography } from '@onekeyhq/components';

const Wallet = () => (
  <Center flex="1" bg="background-hovered">
    <Typography.Body2 color="text-default">Wallet</Typography.Body2>
    <Button onPress={() => window.open(window.location.href)}>
      Expand View (Ext)
    </Button>
  </Center>
);

export default Wallet;
