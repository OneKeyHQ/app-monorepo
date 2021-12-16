import React from 'react';

import { Center, Text, Button } from '@onekeyhq/components';
import useNavigation from '../../hooks/useNavigation';

const Approval = () => {
  const navigation = useNavigation();
  return (
    <Center flex="1" bg="background-hovered">
      <Button onPress={() => navigation.navigate('Components/Address' as any)}>
        Go To Components
      </Button>
      <Text color="text-default">Approval</Text>
      <Button
        onPress={() => console.log('TODO: call hardware sign transaction')}
      >
        Approval Transaction
      </Button>
    </Center>
  );
};
export default Approval;
