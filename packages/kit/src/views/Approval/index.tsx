import React from 'react';

import { Center, Text, Button } from '@onekeyhq/components';

const Approval = () => (
  <Center flex="1" bg="background-hovered">
    <Text color="text-default">Approval</Text>
    <Button onPress={() => console.log('TODO: call hardware sign transaction')}>
      Approval Transaction
    </Button>
  </Center>
);

export default Approval;
