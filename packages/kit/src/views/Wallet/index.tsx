import React from 'react';

import { Center, Text, Button } from '@onekeyhq/components';

const Wallet = () => (
  <Center flex="1" bg="background-hovered">
    <Text color="text-default">Wallet</Text>
    <Button onPress={() => window.open(window.location.href)}>
      Expand View (Ext)
    </Button>
  </Center>
);

export default Wallet;
